return (() => {
  const CHROME_ID = "codex-theme-{{id}}-chrome";
  const THEME_ID = "{{id}}";
  const LABEL = "芙宁娜";
  const SIGNATURE = "Furina ✦";
  const RIBBON = "💧";

  const ensureChrome = () => {
    let chrome = document.getElementById(CHROME_ID);
    if (chrome && chrome.parentElement === document.body) return chrome;
    chrome?.remove();
    chrome = document.createElement("div");
    chrome.id = CHROME_ID;
    chrome.setAttribute("aria-hidden", "true");
    chrome.innerHTML = `
      <div class="theme-brand"><span class="theme-note">💧</span><span><b>原神 · ${LABEL}</b><small>Codex App 限定主题</small></span></div>
      <div class="theme-signature">${SIGNATURE}</div>
      <div class="theme-sparkles"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="theme-ribbon"><span>💧</span>${RIBBON}<span>💧</span></div>
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
