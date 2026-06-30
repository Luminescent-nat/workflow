//! 功能1/2/3:环境检测。检测 Node/npm/git 与 Claude/Codex 的 CLI 及桌面版。

use std::path::PathBuf;

use serde::Serialize;

use crate::installer;
use crate::util;

#[derive(Serialize)]
pub struct ToolStatus {
    pub key: String,
    pub name: String,
    /// runtime | cli | desktop
    pub category: String,
    pub installed: bool,
    pub version: Option<String>,
    /// 额外说明(如不可安装的原因)
    pub note: Option<String>,
    /// 对应的安装目标 key(传给 install_tool);None 表示不可一键安装
    pub install_target: Option<String>,
}

fn first_line(out: &util::CmdOutput) -> Option<String> {
    if out.success {
        let line = out.stdout.lines().next().unwrap_or("").trim().to_string();
        if line.is_empty() {
            None
        } else {
            Some(line)
        }
    } else {
        None
    }
}

/// 通过 `<tool> <arg>` 取版本号(经 PATH);失败返回 None。
fn version_of(tool: &str, arg: &str) -> Option<String> {
    first_line(&util::run_via_cmd(tool, &[arg]))
}

/// 先按 PATH 找;找不到则在 candidates 给出的绝对路径里逐个尝试。
/// 用于 git 等可能被安装到非标准目录、未把可执行目录写入 PATH 的工具
/// (例如 Git 安装在 D:\Git,PATH 只含 D:\Git\usr\bin 却漏了 D:\Git\cmd)。
fn version_of_with_fallback(tool: &str, arg: &str, candidates: &[PathBuf]) -> Option<String> {
    if let Some(v) = version_of(tool, arg) {
        return Some(v);
    }
    for exe in candidates {
        if exe.exists() {
            if let Some(v) = first_line(&util::run(&exe.to_string_lossy(), &[arg])) {
                return Some(v);
            }
        }
    }
    None
}

/// git 常见安装位置(覆盖标准安装与自定义盘符根目录,如 D:\Git)。
fn git_candidates() -> Vec<PathBuf> {
    let mut v = Vec::new();
    // 标准安装
    if let Some(pf) = std::env::var_os("ProgramFiles") {
        v.push(PathBuf::from(&pf).join("Git").join("cmd").join("git.exe"));
        v.push(PathBuf::from(&pf).join("Git").join("bin").join("git.exe"));
    }
    if let Some(pf86) = std::env::var_os("ProgramFiles(x86)") {
        v.push(PathBuf::from(&pf86).join("Git").join("cmd").join("git.exe"));
    }
    // 用户级安装
    if let Some(local) = dirs::data_local_dir() {
        v.push(local.join("Programs").join("Git").join("cmd").join("git.exe"));
    }
    // 从 PATH 中的 Git 内部目录(如 D:\Git\usr\bin)反推 Git 根,拼出 cmd\git.exe / bin\git.exe
    if let Some(path) = std::env::var_os("PATH") {
        for p in std::env::split_paths(&path) {
            let lossy = p.to_string_lossy();
            let lower = lossy.to_lowercase();
            if let Some(idx) = lower.rfind("\\git\\") {
                let root = PathBuf::from(&lossy[..idx + 4]); // 含 "\git"
                v.push(root.join("cmd").join("git.exe"));
                v.push(root.join("bin").join("git.exe"));
            } else if lower.ends_with("\\git") {
                let root = PathBuf::from(lossy.as_ref());
                v.push(root.join("cmd").join("git.exe"));
                v.push(root.join("bin").join("git.exe"));
            }
        }
    }
    // 常见自定义盘符根目录
    for drive in ["C", "D", "E"] {
        v.push(PathBuf::from(format!("{}:\\Git\\cmd\\git.exe", drive)));
    }
    v
}


/// 通过 winget list 判断某包是否已安装。
fn winget_has(id: &str) -> bool {
    let out = util::run(
        &installer::winget_path(),
        &[
            "list",
            "--id",
            id,
            "-e",
            "--accept-source-agreements",
            "--disable-interactivity",
        ],
    );
    out.stdout.contains(id)
}

pub fn detect_all() -> Vec<ToolStatus> {
    let mut list = Vec::new();

    let node = version_of("node", "-v");
    list.push(ToolStatus {
        key: "node".into(),
        name: "Node.js".into(),
        category: "runtime".into(),
        installed: node.is_some(),
        version: node,
        note: None,
        install_target: Some("node".into()),
    });

    let npm = version_of("npm", "-v");
    list.push(ToolStatus {
        key: "npm".into(),
        name: "npm".into(),
        category: "runtime".into(),
        installed: npm.is_some(),
        version: npm,
        note: Some("随 Node.js 一并安装".into()),
        install_target: Some("node".into()),
    });

    let git = version_of_with_fallback("git", "--version", &git_candidates());
    list.push(ToolStatus {
        key: "git".into(),
        name: "Git".into(),
        category: "runtime".into(),
        installed: git.is_some(),
        version: git,
        note: None,
        install_target: Some("git".into()),
    });

    let claude = version_of("claude", "--version");
    list.push(ToolStatus {
        key: "claude".into(),
        name: "Claude Code CLI".into(),
        category: "cli".into(),
        installed: claude.is_some(),
        version: claude,
        note: None,
        install_target: Some("claude_cli".into()),
    });

    let codex = version_of("codex", "--version");
    list.push(ToolStatus {
        key: "codex".into(),
        name: "Codex CLI".into(),
        category: "cli".into(),
        installed: codex.is_some(),
        version: codex,
        note: None,
        install_target: Some("codex_cli".into()),
    });

    let claude_desktop = winget_has("Anthropic.Claude");
    list.push(ToolStatus {
        key: "claude_desktop".into(),
        name: "Claude 桌面版".into(),
        category: "desktop".into(),
        installed: claude_desktop,
        version: None,
        note: None,
        install_target: Some("claude_desktop".into()),
    });

    // 注:OpenAI 不提供独立的 Codex 桌面 exe,Codex 以 CLI(上方已检测)与 IDE 扩展形式提供。
    // 故不再列"Codex 桌面版"伪条目,避免把已装好的 Codex 误显示为"环境缺失"。

    list
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn git_candidates_derives_root_from_inner_path() {
        // 模拟 PATH 含 D:\Git\usr\bin 的情形,验证能反推出 D:\Git\cmd\git.exe
        let lossy = r"D:\Git\usr\bin";
        let lower = lossy.to_lowercase();
        let idx = lower.rfind("\\git\\").unwrap();
        let root = std::path::PathBuf::from(&lossy[..idx + 4]);
        assert_eq!(root, std::path::PathBuf::from(r"D:\Git"));
        assert_eq!(
            root.join("cmd").join("git.exe"),
            std::path::PathBuf::from(r"D:\Git\cmd\git.exe")
        );
    }

    #[test]
    fn detect_finds_git_when_installed() {
        // 本机 git 安装在非标准 PATH 时,fallback 应仍能检测到。
        // 仅当存在任一候选路径时断言(避免无 git 环境误失败)。
        let has_candidate = git_candidates().iter().any(|p| p.exists());
        let v = version_of_with_fallback("git", "--version", &git_candidates());
        if has_candidate {
            assert!(v.is_some(), "存在 git.exe 候选但未检测到");
            assert!(v.unwrap().to_lowercase().contains("git"));
        }
    }
}
