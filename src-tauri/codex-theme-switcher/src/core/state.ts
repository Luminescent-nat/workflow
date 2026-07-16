import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ThemeState } from "./types.js";

const execFileAsync = promisify(execFile);

const STATE_DIR = path.join(os.homedir(), "AppData", "Local", "CodexThemeSwitcher");
const STATE_PATH = path.join(STATE_DIR, "state.json");
const LOG_PATH = path.join(STATE_DIR, "injector.log");
const ERROR_LOG_PATH = path.join(STATE_DIR, "injector-error.log");

export async function readState(): Promise<ThemeState | null> {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    return JSON.parse(raw) as ThemeState;
  } catch {
    return null;
  }
}

export async function writeState(state: ThemeState): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

export async function clearState(): Promise<void> {
  try {
    await fs.unlink(STATE_PATH);
  } catch {
    // ignore
  }
}

export async function stopDaemon(): Promise<void> {
  const state = await readState();
  if (state?.injectorPid) {
    try {
      process.kill(state.injectorPid, "SIGTERM");
    } catch {
      // ignore
    }
  }
  await stopOrphanDaemons();
  await clearState();
}

async function stopOrphanDaemons(): Promise<void> {
  if (process.platform !== "win32") return;
  const script = `$selfPid = ${process.pid}; Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ProcessId -ne $selfPid -and $_.CommandLine -match 'cli\\.js"?\\s+daemon\\s+genshin-' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try {
    await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
    });
  } catch {}
}

export function getLogPaths(): { stdout: string; stderr: string } {
  return { stdout: LOG_PATH, stderr: ERROR_LOG_PATH };
}

export async function ensureStateDir(): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
}
