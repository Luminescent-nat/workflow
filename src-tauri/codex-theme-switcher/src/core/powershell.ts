import fs from "node:fs";
import path from "node:path";

/**
 * 解析 PowerShell 可执行文件路径。
 * 部分机器(及由精简 PATH 环境启动的应用)PATH 中不含
 * C:\Windows\System32\WindowsPowerShell\v1.0,直接 spawn "powershell.exe" 会 ENOENT,
 * 因此优先返回 SystemRoot 下的绝对路径,不存在时才回退到 PATH 查找。
 */
export function powershellExe(): string {
  const root = process.env.SystemRoot || "C:\\Windows";
  const absolute = path.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return fs.existsSync(absolute) ? absolute : "powershell.exe";
}
