// postinstall:安装 codex-theme-switcher 子目录依赖。
// 之前直接用 `node $npm_execpath --prefix ... install`,在 Windows CI(npm 10 + cmd shim)上
// 会因 npm_config_* 生命周期环境变量泄漏给子进程而递归触发根包 postinstall,最终失败。
// 这里改为:剥离 npm_config_* 环境变量 + 以 cwd 方式调用 npm,彻底规避递归。
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const themeDir = path.join(root, "src-tauri", "codex-theme-switcher");

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^npm_config_/i.test(key)) delete env[key];
}

const isWin = process.platform === "win32";
const result = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
  cwd: themeDir,
  env,
  stdio: "inherit",
  shell: isWin, // Windows 上 npm 是 .cmd shim,Node 安全策略要求经 shell 调用
});

if (result.error) {
  console.error("[install-themes] failed to spawn npm:", result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
