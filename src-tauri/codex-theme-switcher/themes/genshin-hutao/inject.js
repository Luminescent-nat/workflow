return (() => {
  const CHROME_ID = "codex-theme-{{id}}-chrome";
  const THEME_ID = "{{id}}";
  const LABEL = "胡桃";
  const SIGNATURE = "Hu Tao ♡";
  const RIBBON = "🌸";

  const ensureChrome = () => {
    let chrome = document.getElementById(CHROME_ID);
    if (chrome && chrome.parentElement === document.body) return chrome;
    chrome?.remove();
    chrome = document.createElement("div");
    chrome.id = CHROME_ID;
    chrome.setAttribute("aria-hidden", "true");
    chrome.innerHTML = `
      <div class="theme-brand"><span class="theme-note">🌸</span><span><b>原神 · ${LABEL}</b><small>Codex App 限定主题</small></span></div>
      <div class="theme-signature">${SIGNATURE}</div>
      <div class="theme-sparkles"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="theme-ribbon"><span>🌸</span>${RIBBON}<span>🌸</span></div>
      <div class="theme-polaroid"></div>`;
    document.body.appendChild(chrome);
    return chrome;
  };

  const positionChrome = () => {
    if (window.__CODEX_THEME_ACTIVE_ID__ !== THEME_ID) {
      document.getElementById(CHROME_ID)?.remove();
      return;
    }
    const shellMain = document.querySelector("main.main-surface") || document.querySelector("main");
    const home = document.querySelector('[role="main"]:has([data-testid="home-icon"])');
    const chrome = ensureChrome();
    if (shellMain) {
      const box = shellMain.getBoundingClientRect();
      chrome.style.left = `${Math.round(box.left)}px`;
      chrome.style.top = `${Math.round(box.top)}px`;
      chrome.style.width = `${Math.round(box.width)}px`;
      chrome.style.height = `${Math.round(box.height)}px`;
    }
    chrome.classList.toggle("theme-home-shell", Boolean(home));
  };

  positionChrome();
  window.addEventListener("resize", positionChrome);
  const observer = new MutationObserver(positionChrome);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", positionChrome);
    document.getElementById(CHROME_ID)?.remove();
  };
})();
