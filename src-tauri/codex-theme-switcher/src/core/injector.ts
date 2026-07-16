import WebSocket from "ws";
import type { CdpTarget, InjectorOptions, ThemePack, VerifyResult } from "./types.js";

const CDP_ORIGIN = "127.0.0.1";

export class CdpSession {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
  private listeners = new Map<string, Array<(params: Record<string, unknown>) => void>>();
  closed = false;

  constructor(private target: CdpTarget) {
    this.ws = new WebSocket(target.webSocketDebuggerUrl);
  }

  async open(): Promise<this> {
    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", () => resolve());
      this.ws.once("error", (err) => reject(err));
    });
    this.ws.on("message", (data) => this.onMessage(data.toString()));
    this.ws.on("close", () => {
      this.closed = true;
      for (const waiter of this.pending.values()) {
        waiter.reject(new Error("CDP socket closed"));
      }
      this.pending.clear();
    });
    await this.send("Runtime.enable");
    await this.send("Page.enable");
    return this;
  }

  private onMessage(raw: string) {
    const message = JSON.parse(raw) as {
      id?: number;
      method?: string;
      params?: Record<string, unknown>;
      error?: { message: string; code: number };
      result?: unknown;
    };
    if (message.id) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) {
        waiter.reject(new Error(`${message.error.message} (${message.error.code})`));
      } else {
        waiter.resolve(message.result ?? {});
      }
      return;
    }
    if (message.method) {
      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(message.params ?? {});
      }
    }
  }

  on(method: string, listener: (params: Record<string, unknown>) => void) {
    const list = this.listeners.get(method) ?? [];
    list.push(listener);
    this.listeners.set(method, list);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error("CDP session is closed"));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression: string): Promise<unknown> {
    const result = (await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: false,
    })) as { exceptionDetails?: { exception?: { description?: string }; text: string }; result?: { value?: unknown } };
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Renderer evaluation failed: ${detail}`);
    }
    return result.result?.value;
  }

  close() {
    if (!this.closed) this.ws.close();
    this.closed = true;
  }
}

export async function waitForTargets(port: number, timeoutMs: number): Promise<CdpTarget[]> {
  const deadline = Date.now() + timeoutMs;
  let lastError: Error | undefined;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${CDP_ORIGIN}:${port}/json/list`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const targets = (await response.json()) as CdpTarget[];
      const pages = targets.filter((item) => item.type === "page" && item.url.startsWith("app://"));
      if (pages.length) return pages;
    } catch (error) {
      lastError = error as Error;
    }
    await sleep(350);
  }
  throw new Error(`No Codex renderer target on ${CDP_ORIGIN}:${port}: ${lastError?.message ?? "timed out"}`);
}

export function buildPayload(theme: ThemePack): string {
  const css = theme.css ?? "";
  const injectJs = theme.injectJs ?? "";
  const artDataUrl = theme.artBase64 ? `data:${theme.artMime ?? "image/png"};base64,${theme.artBase64}` : "";

  // The renderer script is wrapped so it receives the CSS and art as constants.
  const className = `codex-theme-${theme.id}`;
  const stateKey = `__CODEX_THEME_${theme.id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_STATE__`;
  const styleId = `codex-theme-${theme.id}-style`;
  const chromeId = `codex-theme-${theme.id}-chrome`;

  const wrapper = `(() => {
const CLASS_NAME = ${JSON.stringify(className)};
const STATE_KEY = ${JSON.stringify(stateKey)};
const STYLE_ID = ${JSON.stringify(styleId)};
const CHROME_ID = ${JSON.stringify(chromeId)};
const CSS_TEXT = ${JSON.stringify(css)};
const INJECT_JS_TEXT = ${JSON.stringify(injectJs)};
const ART_DATA_URL = ${JSON.stringify(artDataUrl)};

window.__CODEX_THEME_ACTIVE_ID__ = ${JSON.stringify(theme.id)};

// Clean up any other previously injected themes (stacked classes/styles/chrome).
for (const key of Object.keys(window)) {
  if (key.startsWith("__CODEX_THEME_") && key.endsWith("_STATE__") && key !== STATE_KEY) {
    try { window[key]?.cleanup?.(); } catch (e) {}
    delete window[key];
  }
}
for (const cls of [...document.documentElement.classList]) {
  if (cls.startsWith("codex-theme-") && cls !== CLASS_NAME) document.documentElement.classList.remove(cls);
}
for (const el of document.querySelectorAll('[id^="codex-theme-"]')) {
  if (el.id !== STYLE_ID && el.id !== CHROME_ID) el.remove();
}
for (const el of document.querySelectorAll('[id$="-chrome"]')) {
  if (el.id !== CHROME_ID) el.remove();
}
window.__CODEX_THEME_DISABLED__ = false;

const previous = window[STATE_KEY];
if (previous?.observer) previous.observer.disconnect();
if (previous?.timer) clearInterval(previous.timer);
if (previous?.scheduler?.timeout) clearTimeout(previous.scheduler.timeout);
try { previous?.jsCleanup?.(); } catch (e) {}

const artUrl = ART_DATA_URL ? (() => {
  const comma = ART_DATA_URL.indexOf(",");
  const binary = atob(ART_DATA_URL.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
})() : (previous?.artUrl || "");
if (previous?.artUrl && previous.artUrl !== artUrl) {
  try { URL.revokeObjectURL(previous.artUrl); } catch (e) {}
}

const existingStyle = document.getElementById(STYLE_ID);
if (existingStyle) existingStyle.textContent = CSS_TEXT;
let jsCleanup = null;

const ensure = () => {
  if (window.__CODEX_THEME_DISABLED__) return;
  const root = document.documentElement;
  if (!root) return;
  root.classList.add(CLASS_NAME);
  if (artUrl) root.style.setProperty("--theme-art", \`url("\${artUrl}")\`);

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    (document.head || root).appendChild(style);
  }
  style.textContent = CSS_TEXT;

  // Run optional per-theme JS
  if (INJECT_JS_TEXT && !window[STATE_KEY]?.jsInitialized) {
    try {
      const fn = new Function("themeId", "artUrl", INJECT_JS_TEXT);
      jsCleanup = fn(${JSON.stringify(theme.id)}, artUrl);
    } catch (e) {
      console.error("[codex-theme] inject js error:", e);
    }
    if (window[STATE_KEY]) {
      window[STATE_KEY].jsCleanup = jsCleanup;
      window[STATE_KEY].jsInitialized = true;
    }
  }

  const shellMain = document.querySelector("main.main-surface") || document.querySelector("main");
  const home = document.querySelector('[role="main"]:has([data-testid="home-icon"])');
  for (const candidate of document.querySelectorAll('[role="main"].theme-home')) {
    if (candidate !== home) candidate.classList.remove("theme-home");
  }
  if (home) home.classList.add("theme-home");
  if (shellMain) shellMain.classList.toggle("theme-home-shell", Boolean(home));
};

const cleanup = () => {
  window.__CODEX_THEME_DISABLED__ = true;
  document.documentElement?.classList.remove(CLASS_NAME);
  document.documentElement?.style.removeProperty("--theme-art");
  document.querySelectorAll(".theme-home").forEach((n) => n.classList.remove("theme-home"));
  document.querySelectorAll(".theme-home-shell").forEach((n) => n.classList.remove("theme-home-shell"));
  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(CHROME_ID)?.remove();
  const state = window[STATE_KEY];
  state?.observer?.disconnect();
  if (state?.timer) clearInterval(state.timer);
  if (state?.scheduler?.timeout) clearTimeout(state.scheduler.timeout);
  if (state?.artUrl) URL.revokeObjectURL(state.artUrl);
  try { state?.jsCleanup?.(); } catch (e) {}
  delete window[STATE_KEY];
  return true;
};

const scheduler = { timeout: null };
const scheduleEnsure = () => {
  if (scheduler.timeout) clearTimeout(scheduler.timeout);
  scheduler.timeout = setTimeout(() => { scheduler.timeout = null; ensure(); }, 180);
};
const observer = new MutationObserver(scheduleEnsure);
observer.observe(document.documentElement, { childList: true, subtree: true });
const timer = setInterval(ensure, 5000);
window[STATE_KEY] = { ensure, cleanup, observer, timer, scheduler, artUrl, jsCleanup, jsInitialized: false, version: "1.0.2" };
ensure();
return { installed: true, version: "1.0.0", themeId: ${JSON.stringify(theme.id)} };
})()`;

  return wrapper;
}

export function buildRemoveExpression(themeId: string): string {
  return `(() => {
  window.__CODEX_THEME_DISABLED__ = true;
  window.__CODEX_THEME_ACTIVE_ID__ = null;
  for (const key of Object.keys(window)) {
    if (key.startsWith("__CODEX_THEME_") && key.endsWith("_STATE__")) {
      try { window[key]?.cleanup?.(); } catch (e) {}
      delete window[key];
    }
  }
  for (const cls of [...document.documentElement.classList]) {
    if (cls.startsWith("codex-theme-")) document.documentElement.classList.remove(cls);
  }
  for (const el of document.querySelectorAll('[id^="codex-theme-"]')) el.remove();
  document.documentElement?.style.removeProperty("--theme-art");
  document.querySelectorAll(".theme-home").forEach((n) => n.classList.remove("theme-home"));
  document.querySelectorAll(".theme-home-shell").forEach((n) => n.classList.remove("theme-home-shell"));
  return true;
})()`;
}

export async function applyToSession(session: CdpSession, theme: ThemePack): Promise<unknown> {
  const payload = buildPayload(theme);
  return session.evaluate(payload);
}

export async function removeFromSession(session: CdpSession, themeId: string): Promise<unknown> {
  return session.evaluate(buildRemoveExpression(themeId));
}

export async function verifySession(session: CdpSession, themeId: string): Promise<VerifyResult> {
  const className = `codex-theme-${themeId}`;
  return session.evaluate(`(() => {
    const box = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    const home = document.querySelector('.theme-home');
    const suggestions = home?.querySelector('[class*="group/home-suggestions"]') ?? null;
    const cards = suggestions ? [...suggestions.querySelectorAll('button')].map(box) : [];
    const result = {
      installed: document.documentElement.classList.contains(${JSON.stringify(className)}),
      version: window.__CODEX_THEME_ACTIVE_ID__ ?? null,
      stylePresent: Boolean(document.getElementById('codex-theme-${themeId}-style')),
      chromePresent: Boolean(document.getElementById('codex-theme-${themeId}-chrome')),
      chromePointerEvents: getComputedStyle(document.getElementById('codex-theme-${themeId}-chrome') || document.body).pointerEvents,
      homePresent: Boolean(home),
      suggestionsPresent: Boolean(suggestions),
      hero: box(home?.firstElementChild?.firstElementChild?.firstElementChild),
      cards,
      composer: box(document.querySelector('.composer-surface-chrome')),
      sidebar: box(document.querySelector('aside.app-shell-left-panel')),
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow: {
        x: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      },
    };
    result.pass = result.installed && result.stylePresent && Boolean(result.composer) && Boolean(result.sidebar) &&
      (!result.homePresent || (Boolean(result.hero) && (!result.suggestionsPresent || (result.cards.length >= 2 && result.cards.length <= 4))));
    return result;
  })()`) as Promise<VerifyResult>;
}

export async function waitForVerifiedSession(
  session: CdpSession,
  themeId: string,
  timeoutMs: number,
): Promise<VerifyResult> {
  const deadline = Date.now() + timeoutMs;
  let lastResult: VerifyResult | undefined;
  while (Date.now() < deadline) {
    lastResult = await verifySession(session, themeId);
    if (lastResult.pass) return lastResult;
    await sleep(500);
  }
  return lastResult!;
}

export async function captureScreenshot(session: CdpSession, outputPath?: string): Promise<Buffer> {
  await session.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  const viewport = (await session.evaluate("({ width: innerWidth, height: innerHeight })")) as { width: number; height: number };
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: Math.round(viewport.width * 0.64),
    y: Math.round(viewport.height * 0.62),
    button: "none",
  });
  await sleep(300);
  const result = (await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  })) as { data: string };
  const buffer = Buffer.from(result.data, "base64");
  if (outputPath) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buffer);
  }
  return buffer;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
