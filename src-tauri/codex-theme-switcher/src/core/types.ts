export interface ThemeManifest {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  preview?: {
    accent: string;
    surface: string;
    ink: string;
  };
  /** Override values written to [desktop] in ~/.codex/config.toml */
  desktop?: {
    appearanceTheme?: string;
    appearanceLightCodeThemeId?: string;
    appearanceLightChromeTheme?: {
      accent?: string;
      contrast?: number;
      fonts?: { code?: string; ui?: string };
      ink?: string;
      opaqueWindows?: boolean;
      semanticColors?: { diffAdded?: string; diffRemoved?: string; skill?: string };
      surface?: string;
    };
  };
}

export interface ThemePack {
  id: string;
  dir: string;
  manifest: ThemeManifest;
  css?: string;
  injectJs?: string;
  artBase64?: string;
  artMime?: string;
}

export interface InjectorOptions {
  port: number;
  timeoutMs: number;
}

export interface ApplyOptions extends InjectorOptions {
  restartExisting?: boolean;
  profilePath?: string;
  watch?: boolean;
}

export interface ThemeState {
  themeId: string;
  port: number;
  injectorPid?: number;
  startedAt: string;
  profilePath?: string;
}

export interface VerifyResult {
  pass: boolean;
  installed: boolean;
  version: string | null;
  stylePresent: boolean;
  chromePresent: boolean;
  chromePointerEvents: string;
  homePresent: boolean;
  suggestionsPresent: boolean;
  hero: Box | null;
  cards: Box[];
  composer: Box | null;
  sidebar: Box | null;
  viewport: { width: number; height: number };
  documentOverflow: { x: boolean; y: boolean };
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CdpTarget {
  id: string;
  title: string;
  url: string;
  type: string;
  webSocketDebuggerUrl: string;
}
