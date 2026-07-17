#!/usr/bin/env python3
"""Regenerate CSS and JS for all Genshin Impact themes.

Reads theme.json for each theme, then writes a polished theme.css and inject.js
based on a shared template. Character art is referenced via the generated art.png.
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "themes"

CSS_TEMPLATE = '''/* Auto-generated character theme for {{id}}. Replace art.png with your own character art. */
:root.codex-theme-{{id}} {
  color-scheme: light !important;
  --theme-ink: {{ink}};
  --theme-primary: {{primary}};
  --theme-secondary: {{secondary}};
  --theme-surface: {{surface}};
  --theme-light: {{light}};
  --theme-dark: {{dark}};
  --theme-accent: {{accent}};
  --theme-glow: {{glow}};
  --theme-line: color-mix(in srgb, {{primary}} 42%, transparent);
  --theme-pearl: color-mix(in srgb, {{surface}} 92%, white);
  --theme-art-position: right {{art_position}}%;
}

html.codex-theme-{{id}} body {
  background:
    radial-gradient(circle at 78% 2%, color-mix(in srgb, {{secondary}} 66%, transparent), transparent 28%),
    radial-gradient(circle at 24% 12%, color-mix(in srgb, {{glow}} 48%, transparent), transparent 30%),
    linear-gradient(135deg, {{surface}} 0%, {{light}} 48%, white 100%) !important;
  color: var(--theme-ink) !important;
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif !important;
}

html.codex-theme-{{id}} body::before {
  content: none;
}

html.codex-theme-{{id}} aside.app-shell-left-panel {
  background:
    linear-gradient(180deg, color-mix(in srgb, {{surface}} 98%, white), color-mix(in srgb, {{light}} 96%, white)) !important;
  border-right: 1px solid var(--theme-line) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  color: var(--theme-ink) !important;
}

html.codex-theme-{{id}} aside.app-shell-left-panel nav {
  background: transparent !important;
}

html.codex-theme-{{id}} aside.app-shell-left-panel button {
  color: {{ink}} !important;
  transition: transform .16s ease, background .16s ease, box-shadow .16s ease !important;
}

html.codex-theme-{{id}} aside.app-shell-left-panel button:hover {
  background: linear-gradient(90deg, color-mix(in srgb, {{secondary}} 72%, transparent), color-mix(in srgb, {{glow}} 62%, transparent)) !important;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, {{primary}} 22%, transparent) !important;
  transform: translateX(1px);
}

html.codex-theme-{{id}} aside.app-shell-left-panel button[aria-label^="切换模式"] {
  background: transparent !important;
  border-color: transparent !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-size: 20px !important;
  font-weight: 700 !important;
  color: {{dark}} !important;
  text-shadow: 0 2px 10px color-mix(in srgb, {{primary}} 28%, transparent);
}

html.codex-theme-{{id}} aside.app-shell-left-panel button[aria-label^="切换模式"]::after {
  content: "{{emblem}}";
  margin-left: 2px;
  color: {{primary}};
}

html.codex-theme-{{id}} aside.app-shell-left-panel [class~="bg-token-list-hover-background"],
html.codex-theme-{{id}} aside.app-shell-left-panel [aria-current="page"] {
  background: linear-gradient(90deg, color-mix(in srgb, {{glow}} 78%, transparent), color-mix(in srgb, {{secondary}} 72%, transparent)) !important;
  border: 1px solid color-mix(in srgb, {{primary}} 30%, transparent) !important;
  box-shadow: 0 4px 16px color-mix(in srgb, {{primary}} 10%, transparent) !important;
}

html.codex-theme-{{id}} main.main-surface {
  background:
    radial-gradient(circle at 84% 10%, color-mix(in srgb, {{secondary}} 34%, transparent), transparent 30%),
    radial-gradient(circle at 20% 0%, color-mix(in srgb, {{glow}} 25%, transparent), transparent 26%),
    linear-gradient(180deg, {{surface}} 0%, {{light}} 100%) !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: visible !important;
}

html.codex-theme-{{id}} main.main-surface > header.app-header-tint {
  background:
    linear-gradient(90deg, color-mix(in srgb, {{surface}} 95%, white), color-mix(in srgb, {{light}} 84%, white), color-mix(in srgb, {{glow}} 78%, transparent)) !important;
  border-bottom: 1px solid var(--theme-line) !important;
  backdrop-filter: none !important;
}

#codex-theme-{{id}}-chrome {
  position: fixed;
  z-index: 31;
  overflow: hidden;
  border-radius: 0;
}

#codex-theme-{{id}}-chrome,
#codex-theme-{{id}}-chrome * {
  pointer-events: none !important;
}

.theme-brand {
  position: absolute;
  left: 25px;
  top: 3px;
  height: 40px;
  display: none;
  align-items: center;
  gap: 10px;
  color: {{dark}};
  text-shadow: 0 1px 0 white;
}
#codex-theme-{{id}}-chrome.theme-home-shell .theme-brand { display: flex; }
.theme-brand .theme-note { font-size: 29px; color: {{primary}}; filter: drop-shadow(0 2px 4px color-mix(in srgb, {{primary}} 34%, transparent)); }
.theme-brand b { display: block; font-size: 15px; letter-spacing: .04em; }
.theme-brand small { display: block; margin-top: 1px; color: {{dark}}; font-size: 10px; letter-spacing: .03em; }

.theme-signature {
  position: absolute;
  right: 92px;
  top: 6px;
  display: none;
  color: {{primary}};
  font: italic 20px/1.2 "Segoe Script", "Comic Sans MS", cursive;
  text-shadow: 0 0 8px white, 0 2px 8px color-mix(in srgb, {{primary}} 24%, transparent);
  transform: rotate(-3deg);
}
#codex-theme-{{id}}-chrome.theme-home-shell .theme-signature { display: block; }

.theme-sparkles { position: absolute; inset: 48px 0 0; opacity: .72; }
.theme-sparkles i { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: white; box-shadow: 0 0 8px 2px color-mix(in srgb, {{primary}} 54%, transparent); animation: none; }
.theme-sparkles i::before, .theme-sparkles i::after { content: ""; position: absolute; left: 2px; top: -6px; width: 1px; height: 17px; background: linear-gradient(transparent, rgba(255,255,255,.95), transparent); }
.theme-sparkles i::after { transform: rotate(90deg); }
.theme-sparkles i:nth-child(1) { left: 7%; top: 11%; animation-delay: 0s; }
.theme-sparkles i:nth-child(2) { left: 31%; top: 5%; opacity: .55; animation-delay: .6s; }
.theme-sparkles i:nth-child(3) { left: 55%; top: 17%; opacity: .82; animation-delay: 1.2s; }
.theme-sparkles i:nth-child(4) { left: 78%; top: 8%; opacity: .64; animation-delay: 1.8s; }
.theme-sparkles i:nth-child(5) { left: 92%; top: 27%; opacity: .9; animation-delay: .3s; }
.theme-sparkles i:nth-child(6) { left: 66%; top: 66%; opacity: .48; animation-delay: .9s; }

@keyframes theme-twinkle {
  0%, 100% { opacity: .4; transform: scale(.9); }
  50% { opacity: 1; transform: scale(1.1); }
}

.theme-polaroid {
  position: absolute;
  right: 14px;
  bottom: 70px;
  width: 126px;
  height: 164px;
  display: none;
  background-image: var(--theme-art);
  background-color: color-mix(in srgb, {{light}} 82%, white);
  background-repeat: no-repeat;
  background-size: auto 72%;
  background-position: right center;
  border: 6px solid rgba(255,253,253,.98);
  border-bottom-width: 22px;
  box-shadow: 0 14px 32px color-mix(in srgb, {{dark}} 24%, transparent), 0 0 0 1px color-mix(in srgb, {{primary}} 28%, transparent);
  transform: rotate(-5deg);
  border-radius: 3px;
}
#codex-theme-{{id}}-chrome.theme-home-shell .theme-polaroid { display: block; }
.theme-polaroid::before { content: "{{emblem}}"; position: absolute; left: -21px; top: -24px; font-size: 32px; filter: drop-shadow(0 3px 4px color-mix(in srgb, {{primary}} 25%, transparent)); }

.theme-ribbon {
  position: absolute;
  left: 50%;
  bottom: 68px;
  display: none;
  align-items: center;
  gap: 8px;
  color: {{dark}};
  font-size: 30px;
  transform: translateX(-50%);
  filter: drop-shadow(0 4px 5px color-mix(in srgb, {{primary}} 26%, transparent));
}
#codex-theme-{{id}}-chrome.theme-home-shell .theme-ribbon { display: flex; }
.theme-ribbon span { font-size: 15px; color: {{primary}}; }

html.codex-theme-{{id}} [role="main"] {
  background: transparent !important;
  scrollbar-color: color-mix(in srgb, {{primary}} 52%, transparent) transparent;
}

html.codex-theme-{{id}} .theme-home {
  --thread-content-max-width: min(950px, calc(100cqw - 44px)) !important;
  overflow-x: hidden !important;
}

.theme-home > div:first-child {
  padding-top: 15px !important;
  min-height: 100% !important;
}

.theme-home > div:first-child > div:first-child {
  flex: 0 0 430px !important;
  min-height: 430px !important;
  align-items: flex-start !important;
  padding-bottom: 0 !important;
}

.theme-home > div:first-child > div:first-child > div:first-child {
  position: relative !important;
  isolation: isolate;
  width: calc(100% - 44px) !important;
  max-width: none !important;
  height: 252px !important;
  min-height: 252px !important;
  flex: 0 1 auto !important;
  padding: 0 !important;
  border: 2px solid color-mix(in srgb, {{secondary}} 90%, transparent) !important;
  border-radius: 25px !important;
  overflow: visible !important;
  background-image:
    linear-gradient(90deg, color-mix(in srgb, {{dark}} 6%, transparent), color-mix(in srgb, {{primary}} 5%, transparent)),
    var(--theme-art) !important;
  background-repeat: no-repeat !important;
  background-size: 100% 100%, auto 115% !important;
  background-position: center, var(--theme-art-position) !important;
  box-shadow: 0 14px 34px color-mix(in srgb, {{primary}} 22%, transparent), inset 0 0 0 4px rgba(255,255,255,.20) !important;
}

.theme-home > div:first-child > div:first-child > div:first-child::before {
  content: "";
  position: absolute;
  z-index: 0;
  inset: 0 auto 0 0;
  width: 62%;
  border-radius: 23px 0 0 23px;
  pointer-events: none;
  background: linear-gradient(90deg, color-mix(in srgb, {{dark}} 98%, transparent) 0%, color-mix(in srgb, {{primary}} 94%, transparent) 54%, color-mix(in srgb, {{primary}} 66%, transparent) 78%, transparent 100%);
}

.theme-home > div:first-child > div:first-child > div:first-child::after {
  content: "";
  position: absolute;
  z-index: 0;
  inset: 0 0 0 auto;
  width: 40%;
  pointer-events: none;
  background: radial-gradient(circle at 80% 50%, transparent 0%, color-mix(in srgb, {{dark}} 35%, transparent) 100%);
}

.theme-home > div:first-child > div:first-child > div:first-child > div:first-child {
  position: relative;
  z-index: 1;
  height: 100%;
  align-items: center !important;
  justify-content: flex-start !important;
  padding-left: 38px;
}

.theme-home > div:first-child > div:first-child > div:first-child > div:first-child > div:first-child {
  width: 54% !important;
  align-items: flex-start !important;
  gap: 0 !important;
}

.theme-home [data-testid="home-icon"] {
  display: none !important;
}

.theme-home [data-feature="game-source"] {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: flex-start !important;
  max-width: 100% !important;
  color: white !important;
  font-size: clamp(22px, 2.2vw, 34px) !important;
  line-height: 1.25 !important;
  font-weight: 780 !important;
  text-align: left !important;
  text-shadow: 0 2px 14px color-mix(in srgb, {{dark}} 55%, transparent), 0 1px 0 rgba(255,255,255,.28);
  opacity: 1 !important;
  pointer-events: auto !important;
}

.theme-home [data-feature="game-source"]::after {
  content: "{{tagline}}";
  display: block;
  margin-top: 13px;
  color: rgba(255,248,255,.94);
  font-size: 15px;
  line-height: 1.5;
  font-weight: 500;
  letter-spacing: .02em;
}

.theme-home [data-feature="game-source"] button {
  margin: 0 5px;
  padding: 2px 9px 3px;
  border: 1px solid rgba(255,255,255,.72);
  border-radius: 999px;
  background: rgba(255,255,255,.22);
  color: #ffffff !important;
  text-decoration-color: rgba(255,255,255,.72) !important;
  text-underline-offset: 5px;
  box-shadow: inset 0 0 12px rgba(255,255,255,.10);
}

.theme-home [data-feature="game-source"] button::before {
  content: "选择项目 · ";
  font-size: .48em;
  font-weight: 600;
  vertical-align: middle;
  opacity: .86;
}

.theme-home > div:first-child > div:first-child > div:first-child > div:nth-child(2) {
  left: 14px !important;
  right: 14px !important;
  top: 100% !important;
  margin-top: 13px !important;
  z-index: 8 !important;
}

.theme-home [class*="group/home-suggestions"] {
  position: relative !important;
  z-index: 8 !important;
  overflow: visible !important;
}

.theme-home [class*="group/home-suggestions"] button {
  position: relative !important;
  min-height: 112px !important;
  padding: 15px 16px 14px !important;
  align-items: stretch !important;
  justify-content: space-between !important;
  text-align: left !important;
  border: 1px solid color-mix(in srgb, {{primary}} 24%, transparent) !important;
  border-radius: 17px !important;
  background: linear-gradient(145deg, rgba(255,255,255,.94), color-mix(in srgb, {{light}} 74%, white)) !important;
  color: {{ink}} !important;
  font-weight: 600 !important;
  line-height: 1.45 !important;
  box-shadow: 0 7px 18px color-mix(in srgb, {{dark}} 8%, transparent), inset 0 1px rgba(255,255,255,.86) !important;
  transform: translateY(0);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease !important;
}

.theme-home [class*="group/home-suggestions"] button:hover {
  transform: translateY(-2px) !important;
  border-color: color-mix(in srgb, {{primary}} 48%, transparent) !important;
  box-shadow: 0 12px 24px color-mix(in srgb, {{primary}} 14%, transparent) !important;
}

.theme-home [class*="group/home-suggestions"] button > span:first-child > span:first-child {
  width: 30px;
  height: 30px;
  display: grid !important;
  place-items: center;
  margin: 0;
  border-radius: 10px;
  color: {{primary}} !important;
  background: color-mix(in srgb, {{light}} 76%, white);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, {{primary}} 16%, transparent);
}
.theme-home [class*="group/home-suggestions"] button svg {
  width: 17px !important;
  height: 17px !important;
  color: {{primary}} !important;
}
.theme-home [class*="group/home-suggestions"] button > span:first-child {
  justify-content: flex-start !important;
}
.theme-home [class*="group/home-suggestions"] button > span:last-child {
  align-items: flex-start !important;
  text-align: left !important;
}

html.codex-theme-{{id}} .composer-surface-chrome {
  border: 2px solid color-mix(in srgb, {{primary}} 58%, transparent) !important;
  border-radius: 25px !important;
  background:
    radial-gradient(circle at 88% 22%, rgba(255,255,255,.92), transparent 24%),
    linear-gradient(145deg, rgba(255,255,255,.96), color-mix(in srgb, {{light}} 94%, white)) !important;
  box-shadow: 0 10px 25px color-mix(in srgb, {{primary}} 15%, transparent), inset 0 0 0 4px rgba(255,255,255,.45) !important;
  backdrop-filter: none !important;
  overflow: visible !important;
}

html.codex-theme-{{id}} .composer-surface-chrome::before {
  content: "{{emblem}}";
  position: absolute;
  left: -13px;
  top: -13px;
  z-index: 20;
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: white;
  background: linear-gradient(145deg, {{secondary}}, {{primary}});
  box-shadow: 0 4px 12px color-mix(in srgb, {{primary}} 22%, transparent);
}

.theme-home .theme-project-selector-shell {
  position: relative;
  padding-top: 28px !important;
  border: 1px solid color-mix(in srgb, {{primary}} 44%, transparent);
  border-bottom: 0;
  background: linear-gradient(180deg, color-mix(in srgb, {{surface}} 94%, white), color-mix(in srgb, {{light}} 88%, white)) !important;
}

.theme-home .theme-project-selector-shell::before {
  content: "{{emblem}}  选择项目";
  position: absolute;
  left: 13px;
  top: 6px;
  z-index: 2;
  color: {{dark}};
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .04em;
  text-shadow: 0 1px white;
  white-space: nowrap;
}

.theme-home [class*="group/project-selector"] > button {
  border-color: color-mix(in srgb, {{primary}} 38%, transparent) !important;
  background: linear-gradient(135deg, rgba(255,255,255,.92), color-mix(in srgb, {{light}} 86%, white)) !important;
  color: {{dark}} !important;
  box-shadow: 0 3px 10px color-mix(in srgb, {{primary}} 10%, transparent) !important;
}

html.codex-theme-{{id}} .ProseMirror {
  color: {{ink}} !important;
  caret-color: {{primary}} !important;
}

html.codex-theme-{{id}} button[class~="bg-token-foreground"] {
  background: linear-gradient(145deg, {{secondary}}, {{dark}}) !important;
  color: white !important;
  box-shadow: 0 5px 12px color-mix(in srgb, {{primary}} 26%, transparent) !important;
}

html.codex-theme-{{id}} article,
html.codex-theme-{{id}} [data-message-author-role] {
  border-radius: 20px;
}

@media (max-width: 1120px) {
  .theme-polaroid { right: 7px; bottom: 82px; width: 100px; height: 132px; }
  .theme-ribbon { bottom: 70px; font-size: 25px; }
  .theme-home { --thread-content-max-width: min(860px, calc(100cqw - 30px)) !important; }
  .theme-home > div:first-child > div:first-child > div:first-child { width: calc(100% - 28px) !important; }
}

@media (max-width: 900px) {
  .theme-polaroid { right: -4px; bottom: 92px; width: 84px; height: 110px; border-width: 5px; border-bottom-width: 16px; opacity: .84; }
  .theme-signature { display: none !important; }
  .theme-brand { left: 15px; }
  .theme-brand b { font-size: 13px; }
  .theme-home > div:first-child > div:first-child { flex-basis: 396px !important; min-height: 396px !important; }
  .theme-home > div:first-child > div:first-child > div:first-child { height: 224px !important; min-height: 224px !important; background-size: 100% 100%, auto 140% !important; }
  .theme-home > div:first-child > div:first-child > div:first-child > div:first-child { padding-left: 26px; }
  .theme-home > div:first-child > div:first-child > div:first-child > div:first-child > div:first-child { width: 66% !important; }
  .theme-home [data-feature="game-source"] { font-size: 18px !important; }
  .theme-home [data-feature="game-source"]::after { font-size: 12px; margin-top: 10px; }
  .theme-home [class*="group/home-suggestions"] button { min-height: 104px !important; font-size: 12px !important; }
}

@media (prefers-reduced-motion: reduce) {
  .theme-sparkles i { animation: none !important; }
}
'''

JS_TEMPLATE = '''return (() => {
  const CHROME_ID = "codex-theme-{{id}}-chrome";
  const THEME_ID = "{{id}}";
  const LABEL = "{{label}}";
  const SIGNATURE = "{{signature}}";
  const RIBBON = "{{emblem}}";

  const ensureChrome = () => {
    let chrome = document.getElementById(CHROME_ID);
    if (chrome && chrome.parentElement === document.body) return chrome;
    chrome?.remove();
    chrome = document.createElement("div");
    chrome.id = CHROME_ID;
    chrome.setAttribute("aria-hidden", "true");
    chrome.innerHTML = `
      <div class="theme-brand"><span class="theme-note">{{emblem}}</span><span><b>原神 · ${LABEL}</b><small>Codex App 限定主题</small></span></div>
      <div class="theme-signature">${SIGNATURE}</div>
      <div class="theme-sparkles"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="theme-ribbon"><span>{{emblem}}</span>${RIBBON}<span>{{emblem}}</span></div>
      <div class="theme-polaroid"></div>`;
    document.body.appendChild(chrome);
    return chrome;
  };

  let observedMain = null;
  const resizeObserver = new ResizeObserver(() => positionChrome());
  const positionChrome = () => {
    if (window.__CODEX_THEME_ACTIVE_ID__ !== THEME_ID) {
      resizeObserver.disconnect();
      document.getElementById(CHROME_ID)?.remove();
      return;
    }
    const shellMain = document.querySelector("main.main-surface") || document.querySelector("main");
    const homeIcon = document.querySelector('[data-testid="home-icon"]');
    const home = homeIcon?.closest('[role="main"]') ?? null;
    const chrome = ensureChrome();
    if (observedMain !== shellMain) {
      resizeObserver.disconnect();
      if (shellMain) resizeObserver.observe(shellMain);
      observedMain = shellMain;
    }
    if (shellMain) {
      const box = shellMain.getBoundingClientRect();
      const styles = {
        left: `${Math.round(box.left)}px`,
        top: `${Math.round(box.top)}px`,
        width: `${Math.round(box.width)}px`,
        height: `${Math.round(box.height)}px`,
      };
      for (const [property, value] of Object.entries(styles)) {
        if (chrome.style[property] !== value) chrome.style[property] = value;
      }
    }
    const homeShell = Boolean(home);
    if (chrome.classList.contains("theme-home-shell") !== homeShell) {
      chrome.classList.toggle("theme-home-shell", homeShell);
    }
  };

  positionChrome();
  window.addEventListener("resize", positionChrome);
  return {
    ensure: positionChrome,
    cleanup: () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", positionChrome);
      document.getElementById(CHROME_ID)?.remove();
    },
  };
})();
'''

THEME_VARS = {
    "genshin-furina": {
        "ink": "#0c4a6e", "primary": "#0ea5e9", "secondary": "#7dd3fc",
        "surface": "#f0f9ff", "light": "#e0f2fe", "dark": "#0284c7",
        "accent": "#facc15", "glow": "#38bdf8", "emblem": "💧",
        "label": "芙宁娜", "signature": "Furina ✦", "tagline": "水色舞台，与你共赴每一场灵感演出 ♡",
        "art_position": "55",
    },
    "genshin-hutao": {
        "ink": "#450a0a", "primary": "#dc2626", "secondary": "#f87171",
        "surface": "#fef2f2", "light": "#fee2e2", "dark": "#991b1b",
        "accent": "#fbbf24", "glow": "#b91c1c", "emblem": "🌸",
        "label": "胡桃", "signature": "Hu Tao ♡", "tagline": "梅花香里，把灵感燃成最亮的火 ♡",
        "art_position": "50",
    },
    "genshin-nahida": {
        "ink": "#14532d", "primary": "#22c55e", "secondary": "#86efac",
        "surface": "#f0fdf4", "light": "#dcfce7", "dark": "#15803d",
        "accent": "#facc15", "glow": "#4ade80", "emblem": "🌿",
        "label": "纳西妲", "signature": "Nahida ✦", "tagline": "智慧与绿野，陪你种下每一个想法 ♡",
        "art_position": "50",
    },
    "genshin-raiden": {
        "ink": "#2e1065", "primary": "#a855f7", "secondary": "#d8b4fe",
        "surface": "#faf5ff", "light": "#f3e8ff", "dark": "#6b21a8",
        "accent": "#38bdf8", "glow": "#9333ea", "emblem": "⚡",
        "label": "雷电将军", "signature": "Raiden ✦", "tagline": "雷鸣寂静之处，让灵感如电光闪耀 ♡",
        "art_position": "45",
    },
    "genshin-zhongli": {
        "ink": "#451a03", "primary": "#d97706", "secondary": "#fbbf24",
        "surface": "#fffbeb", "light": "#fef3c7", "dark": "#92400e",
        "accent": "#a8a29e", "glow": "#b45309", "emblem": "◆",
        "label": "钟离", "signature": "Zhongli ✦", "tagline": "岩铸千秋，与你沉淀每一份灵感 ♡",
        "art_position": "50",
    },
}


def hex_to_rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def darken(hex_color: str, amount: float = 0.15) -> str:
    r, g, b = hex_to_rgb(hex_color)
    return f"#{int(r * (1 - amount)):02x}{int(g * (1 - amount)):02x}{int(b * (1 - amount)):02x}"


def lighten(hex_color: str, amount: float = 0.15) -> str:
    r, g, b = hex_to_rgb(hex_color)
    return f"#{min(255, int(r + (255 - r) * amount)):02x}{min(255, int(g + (255 - g) * amount)):02x}{min(255, int(b + (255 - b) * amount)):02x}"


def write_theme(theme_id: str, vars_map: dict):
    theme_dir = ROOT / theme_id
    manifest_path = theme_dir / "theme.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Update manifest preview to match generated palette
    preview = manifest.get("preview", {})
    preview["accent"] = vars_map["primary"]
    preview["surface"] = vars_map["surface"]
    preview["ink"] = vars_map["ink"]
    manifest["preview"] = preview
    desktop = manifest.get("desktop", {})
    chrome = desktop.get("appearanceLightChromeTheme", {})
    chrome["accent"] = vars_map["primary"]
    chrome["ink"] = vars_map["ink"]
    chrome["surface"] = vars_map["surface"]
    if "semanticColors" in chrome:
        chrome["semanticColors"]["diffAdded"] = vars_map["secondary"]
        chrome["semanticColors"]["diffRemoved"] = lighten(vars_map["primary"], 0.25)
        chrome["semanticColors"]["skill"] = vars_map["glow"]
    desktop["appearanceLightChromeTheme"] = chrome
    manifest["desktop"] = desktop
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    css = CSS_TEMPLATE
    js = JS_TEMPLATE
    for key, value in vars_map.items():
        css = css.replace("{{" + key + "}}", value)
        js = js.replace("{{" + key + "}}", value)

    with open(theme_dir / "theme.css", "w", encoding="utf-8") as f:
        f.write(css)
    with open(theme_dir / "inject.js", "w", encoding="utf-8") as f:
        f.write(js)

    print(f"Updated {theme_id}")


def main():
    for theme_id, vars_map in THEME_VARS.items():
        write_theme(theme_id, vars_map)


if __name__ == "__main__":
    main()
