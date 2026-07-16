import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { ThemePack } from "./types.js";

export function getConfigPath(): string {
  return path.join(os.homedir(), ".codex", "config.toml");
}

export function getStateRoot(): string {
  return path.join(os.homedir(), "AppData", "Local", "CodexThemeSwitcher");
}

export function getBackupPath(): string {
  return path.join(getStateRoot(), "config.before-theme.toml");
}

export async function ensureBackup(): Promise<void> {
  const configPath = getConfigPath();
  const backupPath = getBackupPath();
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  try {
    await fs.access(backupPath);
    return; // already backed up
  } catch {
    // proceed to backup
  }
  let content = "";
  try {
    content = await fs.readFile(configPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw new Error(`Failed to read Codex config: ${(error as Error).message}`);
    }
    try {
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, content, "utf8");
    } catch (writeError) {
      throw new Error(`Failed to initialize Codex config: ${(writeError as Error).message}`);
    }
  }

  await fs.writeFile(backupPath, content, "utf8");
}

export async function restoreBackup(): Promise<void> {
  const configPath = getConfigPath();
  const backupPath = getBackupPath();
  try {
    await fs.access(backupPath);
  } catch {
    throw new Error("No pre-theme config backup is available.");
  }
  const backupContent = await fs.readFile(backupPath, "utf8");
  await fs.writeFile(configPath, backupContent, "utf8");
}

function serializeChromeTheme(theme: NonNullable<ThemePack["manifest"]["desktop"]>["appearanceLightChromeTheme"]): string {
  if (!theme) return "{}";
  const parts: string[] = [];
  if (theme.accent !== undefined) parts.push(`accent = ${JSON.stringify(theme.accent)}`);
  if (theme.contrast !== undefined) parts.push(`contrast = ${theme.contrast}`);
  if (theme.fonts) {
    const fontParts: string[] = [];
    if (theme.fonts.code !== undefined) fontParts.push(`code = ${JSON.stringify(theme.fonts.code)}`);
    if (theme.fonts.ui !== undefined) fontParts.push(`ui = ${JSON.stringify(theme.fonts.ui)}`);
    parts.push(`fonts = { ${fontParts.join(", ")} }`);
  }
  if (theme.ink !== undefined) parts.push(`ink = ${JSON.stringify(theme.ink)}`);
  if (theme.opaqueWindows !== undefined) parts.push(`opaqueWindows = ${theme.opaqueWindows}`);
  if (theme.semanticColors) {
    const scParts: string[] = [];
    if (theme.semanticColors.diffAdded !== undefined) scParts.push(`diffAdded = ${JSON.stringify(theme.semanticColors.diffAdded)}`);
    if (theme.semanticColors.diffRemoved !== undefined) scParts.push(`diffRemoved = ${JSON.stringify(theme.semanticColors.diffRemoved)}`);
    if (theme.semanticColors.skill !== undefined) scParts.push(`skill = ${JSON.stringify(theme.semanticColors.skill)}`);
    parts.push(`semanticColors = { ${scParts.join(", ")} }`);
  }
  if (theme.surface !== undefined) parts.push(`surface = ${JSON.stringify(theme.surface)}`);
  return `{ ${parts.join(", ")} }`;
}

function countDesktopSections(content: string): number {
  return (content.match(/^\[desktop\]\s*(?:\r?\n|\r|\n|$)/gm) ?? []).length;
}

interface ParsedEntry {
  key: string;
  value: string;
  raw: string;
}

function extractDesktopSections(content: string): string[] {
  const sections: string[] = [];
  const headerPattern = /^\[desktop\]\s*(?:\r?\n|\r|\n|$)/gm;
  let match: RegExpExecArray | null;
  while ((match = headerPattern.exec(content)) !== null) {
    const bodyStart = match.index + match[0].length;
    const nextHeader = content.slice(bodyStart).search(/^\[[^\]]+\]\s*(?:\r?\n|\r|\n|$)/m);
    const bodyEnd = nextHeader === -1 ? content.length : bodyStart + nextHeader;
    sections.push(content.slice(bodyStart, bodyEnd));
  }
  return sections;
}

function parseDesktopEntries(content: string): Map<string, ParsedEntry> {
  const entries = new Map<string, ParsedEntry>();
  const bodies = extractDesktopSections(content);

  for (const body of bodies) {
    const lines = body.split(/\r?\n|\r|\n/);
    let pending: { key: string; raw: string } | null = null;

    const flushPending = () => {
      if (!pending) return;
      const eqIndex = pending.raw.indexOf("=");
      if (eqIndex !== -1) {
        const key = pending.raw.slice(0, eqIndex).trim();
        const value = pending.raw.slice(eqIndex + 1).trim();
        if (key) {
          entries.set(key, { key, value, raw: pending.raw });
        }
      }
      pending = null;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        flushPending();
        continue;
      }
      // A new section header inside a desktop body should not happen in
      // well-formed configs, but treat it as the end of this body.
      if (line.startsWith("[")) {
        flushPending();
        continue;
      }

      if (pending) {
        pending.raw += "\n" + rawLine;
        const openBraces = (pending.raw.match(/\{/g) ?? []).length;
        const closeBraces = (pending.raw.match(/\}/g) ?? []).length;
        if (openBraces === closeBraces && openBraces > 0) {
          flushPending();
        }
        continue;
      }

      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) continue;
      const key = line.slice(0, eqIndex).trim();
      if (!key) continue;

      const value = line.slice(eqIndex + 1).trim();
      const openBraces = (value.match(/\{/g) ?? []).length;
      const closeBraces = (value.match(/\}/g) ?? []).length;

      if (openBraces > closeBraces) {
        pending = { key, raw: rawLine };
      } else {
        entries.set(key, { key, value, raw: rawLine });
      }
    }
    flushPending();
  }
  return entries;
}

function removeDesktopSection(content: string): string {
  // Remove the first [desktop] section and its body, keeping any trailing
  // sections (marketplaces, plugins, features, etc.) that follow it.
  return content
    .replace(/^\[desktop\][\s\S]*?(?=^\[|\Z)/m, "")
    .replace(/\r?\n\r?\n\r?\n/g, "\r\n\r\n")
    .trimEnd();
}

export async function applyThemeConfig(theme: ThemePack): Promise<void> {
  if (theme.id === "default") {
    await restoreBackup();
    return;
  }

  await ensureBackup();
  const configPath = getConfigPath();
  const backupPath = getBackupPath();
  const pollutedContent = await fs.readFile(configPath, "utf8");
  const backupContent = await fs.readFile(backupPath, "utf8");

  const desktop = theme.manifest.desktop;
  if (!desktop) return;

  // Always build on top of the clean backup. This recovers from any prior
  // corruption (duplicate [desktop], duplicate [model_providers], etc.) while
  // preserving the user's original settings and any [desktop] values they
  // may have customized.
  const mergedEntries = parseDesktopEntries(pollutedContent);

  const settings: Record<string, string> = {};
  if (desktop.appearanceTheme) {
    settings.appearanceTheme = `appearanceTheme = ${JSON.stringify(desktop.appearanceTheme)}`;
  }
  if (desktop.appearanceLightCodeThemeId) {
    settings.appearanceLightCodeThemeId = `appearanceLightCodeThemeId = ${JSON.stringify(desktop.appearanceLightCodeThemeId)}`;
  }
  if (desktop.appearanceLightChromeTheme) {
    settings.appearanceLightChromeTheme = `appearanceLightChromeTheme = ${serializeChromeTheme(desktop.appearanceLightChromeTheme)}`;
  }

  for (const [key, value] of Object.entries(settings)) {
    mergedEntries.set(key, { key, value, raw: value });
  }

  const sectionBody = Array.from(mergedEntries.values())
    .map((entry) => entry.raw)
    .join("\r\n");
  const newSection = `[desktop]\r\n${sectionBody}\r\n`;

  const baseContent = removeDesktopSection(backupContent);
  const separator = baseContent.endsWith("\n") ? "" : "\r\n\r\n";
  const finalContent = baseContent + separator + newSection;

  await fs.writeFile(configPath, finalContent, "utf8");
}
