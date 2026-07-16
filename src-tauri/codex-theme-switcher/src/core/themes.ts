import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ThemeManifest, ThemePack } from "./types.js";

const DEFAULT_THEME: ThemeManifest = {
  id: "default",
  name: "Codex 默认",
  description: "恢复 Codex 官方默认外观",
  author: "Codex Theme Switcher",
  version: "1.0.0",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function themesRoot(): string {
  const envRoot = process.env.CODEX_THEMES_DIR;
  if (envRoot) return path.resolve(envRoot);
  // dist/core/themes.js -> ../../themes (also works for src/core/themes.ts during dev)
  return path.resolve(__dirname, "..", "..", "themes");
}

export async function listThemeIds(): Promise<string[]> {
  const root = themesRoot();
  const ids: string[] = ["default"];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== "default") {
        const manifestPath = path.join(root, entry.name, "theme.json");
        try {
          await fs.access(manifestPath);
          ids.push(entry.name);
        } catch {
          // skip directories without theme.json
        }
      }
    }
  } catch {
    // themes dir may not exist
  }
  return ids;
}

export async function loadTheme(id: string): Promise<ThemePack> {
  if (id === "default") {
    return {
      id: "default",
      dir: "",
      manifest: DEFAULT_THEME,
    };
  }

  const root = themesRoot();
  const dir = path.join(root, id);
  const manifestPath = path.join(dir, "theme.json");
  let manifest: ThemeManifest;
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    manifest = JSON.parse(raw) as ThemeManifest;
  } catch (error) {
    throw new Error(`Failed to load theme "${id}": ${(error as Error).message}`);
  }

  const [cssRaw, injectJsRaw, artBase64, artMime] = await Promise.all([
    readOptionalFile(path.join(dir, "theme.css")),
    readOptionalFile(path.join(dir, "inject.js")),
    readArtAsBase64(dir),
    Promise.resolve("image/png"),
  ]);

  const css = cssRaw?.replaceAll("{{id}}", id);
  const injectJs = injectJsRaw?.replaceAll("{{id}}", id);

  return {
    id,
    dir,
    manifest,
    css: css ?? undefined,
    injectJs: injectJs ?? undefined,
    artBase64: artBase64 ?? undefined,
    artMime: artBase64 ? artMime : undefined,
  };
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function readArtAsBase64(dir: string): Promise<string | undefined> {
  for (const name of ["art.png", "art.jpg", "art.jpeg", "art.webp"]) {
    const filePath = path.join(dir, name);
    try {
      const data = await fs.readFile(filePath);
      return data.toString("base64");
    } catch {
      // try next extension
    }
  }
  return undefined;
}

export function defaultTheme(): ThemePack {
  return {
    id: "default",
    dir: "",
    manifest: DEFAULT_THEME,
  };
}
