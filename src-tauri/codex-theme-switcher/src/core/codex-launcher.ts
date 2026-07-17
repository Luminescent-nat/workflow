import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { waitForTargets } from "./injector.js";
import { powershellExe } from "./powershell.js";

const execFileAsync = promisify(execFile);

/** 桌面版已更名 ChatGPT:AppxPackage 包名新旧两种都要试。 */
const PACKAGE_NAMES = ["OpenAI.Codex", "OpenAI.ChatGPT-Desktop"];
/** 包内可执行文件候选名(更名后可能变化)。 */
const EXE_NAMES = ["ChatGPT.exe", "Codex.exe"];

export interface LaunchOptions {
  port: number;
  restartExisting?: boolean;
  restartIfNeeded?: boolean;
  profilePath?: string;
  timeoutMs?: number;
}

export interface LaunchResult {
  alreadyRunning: boolean;
  pid?: number;
}

async function testDebugPort(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!response.ok) return false;
    const targets = (await response.json()) as Array<{ type: string; url: string }>;
    return targets.some((t) => t.type === "page" && t.url.startsWith("app://"));
  } catch {
    return false;
  }
}

async function findCodexExecutable(): Promise<string> {
  try {
    let installLocation = "";
    for (const packageName of PACKAGE_NAMES) {
      const { stdout } = await execFileAsync(powershellExe(), [
        "-NoProfile",
        "-Command",
        `(Get-AppxPackage ${packageName} | Sort-Object Version -Descending | Select-Object -First 1).InstallLocation`,
      ]);
      installLocation = stdout.trim();
      if (installLocation) break;
    }
    if (!installLocation) throw new Error("Codex(ChatGPT)Store package not found.");
    for (const exeName of EXE_NAMES) {
      const exe = path.join(installLocation, "app", exeName);
      if (fs.existsSync(exe)) return exe;
    }
    return path.join(installLocation, "app", EXE_NAMES[0]);
  } catch (error) {
    throw new Error(`Failed to locate Codex executable: ${(error as Error).message}`);
  }
}

async function findRunningCodexProcesses(): Promise<Array<{ pid: number; mainWindowHandle: number }>> {
  try {
    const { stdout } = await execFileAsync(powershellExe(), [
      "-NoProfile",
      "-Command",
      "Get-Process ChatGPT -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object Id, MainWindowHandle | ConvertTo-Json -Compress",
    ]);
    const trimmed = stdout.trim();
    if (!trimmed || trimmed === "null") return [];
    const parsed = JSON.parse(trimmed) as Array<{ Id: number; MainWindowHandle: number }> | { Id: number; MainWindowHandle: number };
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((p) => ({ pid: p.Id, mainWindowHandle: p.MainWindowHandle }));
  } catch {
    return [];
  }
}

async function killCodexProcesses(): Promise<void> {
  const processes = await findRunningCodexProcesses();
  for (const proc of processes) {
    try {
      process.kill(proc.pid, "SIGTERM");
    } catch {
      // ignore
    }
  }
  await sleep(2600);
  try {
    await execFileAsync(powershellExe(), [
      "-NoProfile",
      "-Command",
      "Get-Process ChatGPT -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
    ]);
  } catch {
    // ignore
  }
  await sleep(600);
}

export async function ensureCodexRunning(options: LaunchOptions): Promise<LaunchResult> {
  const { port, restartExisting, restartIfNeeded, profilePath, timeoutMs = 30000 } = options;

  let debugReady = await testDebugPort(port);
  let mainProcesses = await findRunningCodexProcesses();

  if (restartExisting && (debugReady || mainProcesses.length > 0)) {
    await killCodexProcesses();
    debugReady = false;
    mainProcesses = [];
  }

  if (restartIfNeeded && !debugReady && mainProcesses.length > 0) {
    await killCodexProcesses();
    debugReady = false;
    mainProcesses = [];
  }

  if (!debugReady && mainProcesses.length > 0 && !restartExisting && !restartIfNeeded) {
    throw new Error(
      `Codex is already running without theme-switcher debugging on port ${port}. Close Codex or rerun with --restart-if-needed.`,
    );
  }

  if (!debugReady) {
    if (mainProcesses.length > 0) {
      await killCodexProcesses();
    }

    const exe = await findCodexExecutable();
    const args = [`--remote-debugging-port=${port}`];
    if (profilePath) {
      args.push(`--user-data-dir=${profilePath}`);
    }

    // Try direct spawn first; fall back to PowerShell if WindowsApps ACL blocks it.
    let child = spawn(exe, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();

    const spawnError = await new Promise<Error | null>((resolve) => {
      child.once("error", (err) => resolve(err));
      setTimeout(() => resolve(null), 500);
    });

    if (spawnError) {
      const psCommand = `Start-Process -FilePath '${exe.replace(/'/g, "''")}' -ArgumentList '${args.map((a) => a.replace(/'/g, "''")).join("','")}' -WindowStyle Normal`;
      const ps = spawn(powershellExe(), ["-NoProfile", "-Command", psCommand], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      ps.unref();
      const psError = await new Promise<Error | null>((resolve) => {
        ps.once("error", (err) => resolve(err));
        setTimeout(() => resolve(null), 500);
      });
      if (psError) {
        throw new Error(
          `Failed to launch Codex (${exe}): ${psError.message}. You may need to launch Codex manually with --remote-debugging-port=${port}.`,
        );
      }
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await testDebugPort(port)) {
        return { alreadyRunning: false, pid: child.pid };
      }
      await sleep(400);
    }
    throw new Error(`Codex did not expose CDP on port ${port} within ${timeoutMs}ms.`);
  }

  return { alreadyRunning: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
