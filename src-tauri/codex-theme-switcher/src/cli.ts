#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyThemeConfig } from "./core/config-patcher.js";
import { ensureCodexRunning } from "./core/codex-launcher.js";
import {
  applyToSession,
  buildPayload,
  captureScreenshot,
  CdpSession,
  removeFromSession,
  verifySession,
  waitForTargets,
  waitForVerifiedSession,
} from "./core/injector.js";
import { defaultTheme, listThemeIds, loadTheme } from "./core/themes.js";
import { clearState, ensureStateDir, getLogPaths, readState, stopDaemon, writeState } from "./core/state.js";
import type { ThemePack, VerifyResult } from "./core/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]) {
  const args = {
    command: argv[0] ?? "help",
    themeId: "",
    port: 9335,
    restartExisting: false,
    restartIfNeeded: false,
    profilePath: "",
    screenshot: "",
    timeoutMs: 30000,
  };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port") args.port = Number(argv[++i]);
    else if (arg === "--restart-existing") args.restartExisting = true;
    else if (arg === "--restart-if-needed") args.restartIfNeeded = true;
    else if (arg === "--profile") args.profilePath = argv[++i];
    else if (arg === "--screenshot") args.screenshot = argv[++i];
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++i]);
    else if (!args.themeId && !arg.startsWith("--")) args.themeId = arg;
  }
  return args;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function cmdList() {
  const ids = await listThemeIds();
  const themes = await Promise.all(ids.map((id) => loadTheme(id).catch(() => defaultTheme())));
  console.log(JSON.stringify(
    themes.map((t) => ({
      id: t.id,
      name: t.manifest.name,
      description: t.manifest.description,
      author: t.manifest.author,
      version: t.manifest.version,
      preview: t.manifest.preview,
    })),
    null,
    2,
  ));
}

async function cmdApply(themeId: string, port: number, restartExisting: boolean, restartIfNeeded: boolean, profilePath: string, timeoutMs: number) {
  const theme = await loadTheme(themeId);
  if (theme.id === "default") {
    await cmdRemove(port, false);
    return;
  }

  // Stop any existing daemon first.
  await stopDaemon();

  // Patch config.
  await applyThemeConfig(theme);

  // Ensure Codex is running with debug port.
  const launchResult = await ensureCodexRunning({ port, restartExisting, restartIfNeeded, profilePath, timeoutMs });
  console.error(`[codex-theme] Codex ${launchResult.alreadyRunning ? "already running" : "started"} on port ${port}`);

  // Wait for target and inject.
  const targets = await waitForTargets(port, timeoutMs);
  for (const target of targets) {
    const session = await new CdpSession(target).open();
    try {
      await applyToSession(session, theme);
    } finally {
      session.close();
    }
  }

  // Verify.
  await sleep(800);
  const verifyTargets = await waitForTargets(port, timeoutMs);
  let verified: VerifyResult | undefined;
  for (const target of verifyTargets) {
    const session = await new CdpSession(target).open();
    try {
      verified = await waitForVerifiedSession(session, theme.id, timeoutMs);
    } finally {
      session.close();
    }
  }

  if (!verified?.pass) {
    console.error("[codex-theme] Warning: verification did not pass.", verified);
  }

  // Start daemon in background.
  await startDaemon(theme, port, profilePath);

  console.log(JSON.stringify({ ok: true, themeId, port, verified }, null, 2));
}

async function startDaemon(theme: ThemePack, port: number, profilePath: string) {
  const node = process.execPath;
  const script = path.resolve(__dirname, "cli.js");
  const args = [script, "daemon", theme.id, "--port", String(port)];
  if (profilePath) args.push("--profile", profilePath);
  const { stdout, stderr } = getLogPaths();
  await ensureStateDir();
  const out = await fs.open(stdout, "a");
  const err = await fs.open(stderr, "a");
  const child = spawn(node, args, {
    detached: true,
    stdio: ["ignore", out.fd, err.fd],
    windowsHide: true,
  });
  child.unref();
  await writeState({
    themeId: theme.id,
    port,
    injectorPid: child.pid,
    startedAt: new Date().toISOString(),
    profilePath: profilePath || undefined,
  });
}

async function cmdRemove(requestedPort: number, restoreConfig: boolean) {
  const state = await readState();
  const activeThemeId = state?.themeId;
  const port = state?.port ?? requestedPort;

  // Stop daemon.
  await stopDaemon();

  // Remove from running renderer.
  try {
    const targets = await waitForTargets(port, 5000);
    for (const target of targets) {
      const session = await new CdpSession(target).open();
      try {
        await removeFromSession(session, activeThemeId ?? "unknown");
      } finally {
        session.close();
      }
    }
  } catch {
    // ignore if Codex is not running
  }

  // Restore config if requested.
  let configRestored = false;
  if (restoreConfig) {
    try {
      const { restoreBackup } = await import("./core/config-patcher.js");
      await restoreBackup();
      configRestored = true;
    } catch {
      // No backup available; nothing to restore.
    }
  }

  console.log(JSON.stringify({ ok: true, removed: activeThemeId ?? null, configRestored }, null, 2));
}

async function cmdStatus() {
  const state = await readState();
  const ids = await listThemeIds();
  console.log(JSON.stringify({ state, availableThemes: ids }, null, 2));
}

async function cmdVerify(port: number, screenshotPath: string | undefined, timeoutMs: number) {
  const state = await readState();
  const themeId = state?.themeId;
  if (!themeId) {
    console.error("[codex-theme] No active theme.");
    process.exit(1);
  }
  const targets = await waitForTargets(port, timeoutMs);
  let verified: VerifyResult | undefined;
  for (const target of targets) {
    const session = await new CdpSession(target).open();
    try {
      verified = await verifySession(session, themeId);
      if (screenshotPath) {
        await captureScreenshot(session, screenshotPath);
      }
    } finally {
      session.close();
    }
  }
  console.log(JSON.stringify({ themeId, verified }, null, 2));
  if (!verified?.pass) process.exit(2);
}

async function cmdDaemon(themeId: string, port: number, timeoutMs: number) {
  const theme = await loadTheme(themeId);
  const payload = buildPayload(theme);
  const sessions = new Map<string, CdpSession>();
  const registrationDeadline = Date.now() + 5000;
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.error(`[codex-theme daemon] watching theme ${themeId} on port ${port}`);

  while (Date.now() < registrationDeadline) {
    const state = await readState();
    if (state?.themeId === themeId && state.injectorPid === process.pid) break;
    await sleep(100);
  }

  const registeredState = await readState();
  if (registeredState?.themeId !== themeId || registeredState.injectorPid !== process.pid) return;

  while (!stopping) {
    const state = await readState();
    if (state?.themeId !== themeId || state.injectorPid !== process.pid) break;

    let targets: Awaited<ReturnType<typeof waitForTargets>> = [];
    try {
      targets = await waitForTargets(port, 1000);
    } catch {
      await sleep(1500);
      continue;
    }

    const activeIds = new Set(targets.map((t) => t.id));
    for (const [id, session] of sessions) {
      if (!activeIds.has(id) || session.closed) {
        session.close();
        sessions.delete(id);
      }
    }

    for (const target of targets) {
      if (sessions.has(target.id)) continue;
      try {
        const session = await new CdpSession(target).open();
        session.on("Page.loadEventFired", () => {
          setTimeout(() => {
            session.evaluate(payload).catch((error) => {
              console.error(`[codex-theme daemon] reinject failed: ${error.message}`);
            });
          }, 250);
        });
        await session.evaluate(payload);
        sessions.set(target.id, session);
        console.error(`[codex-theme daemon] injected target ${target.id}`);
      } catch (error) {
        console.error(`[codex-theme daemon] inject failed for ${target.id}: ${(error as Error).message}`);
      }
    }
    await sleep(2000);
  }

  for (const session of sessions.values()) session.close();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    switch (args.command) {
      case "list":
        await cmdList();
        break;
      case "apply":
        if (!args.themeId) throw new Error("Usage: apply <themeId>");
        await cmdApply(args.themeId, args.port, args.restartExisting, args.restartIfNeeded, args.profilePath, args.timeoutMs);
        break;
      case "remove":
        await cmdRemove(args.port, true);
        break;
      case "status":
        await cmdStatus();
        break;
      case "verify":
        await cmdVerify(args.port, args.screenshot, args.timeoutMs);
        break;
      case "daemon":
        if (!args.themeId) throw new Error("Usage: daemon <themeId>");
        await cmdDaemon(args.themeId, args.port, args.timeoutMs);
        break;
      case "help":
      default:
        console.log(`Usage:
  codex-theme list
  codex-theme apply <themeId> [--port 9335] [--restart-if-needed] [--restart-existing]
  codex-theme remove [--port 9335]
  codex-theme status
  codex-theme verify [--port 9335] [--screenshot <path>]
  codex-theme daemon <themeId> [--port 9335]
`);
    }
  } catch (error) {
    console.error(`[codex-theme] ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
