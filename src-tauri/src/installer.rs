//! 功能1/2/3:winget / npm 安装·卸载·更新封装。
//! winget 包 ID 已通过 `winget search` 复核。

use crate::util::{self, CmdOutput};

/// 解析 winget 可执行路径:优先 %LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe,回退 PATH。
pub fn winget_path() -> String {
    if let Some(local) = dirs::data_local_dir() {
        let p = local
            .join("Microsoft")
            .join("WindowsApps")
            .join("winget.exe");
        if p.exists() {
            return p.to_string_lossy().into_owned();
        }
    }
    "winget".to_string()
}

fn winget_install(id: &str, source: Option<&str>) -> CmdOutput {
    let mut args = vec![
        "install",
        "-e",
        "--id",
        id,
        "--accept-source-agreements",
        "--accept-package-agreements",
        "--disable-interactivity",
    ];
    if let Some(source) = source {
        args.push("--source");
        args.push(source);
    }
    util::run(&winget_path(), &args)
}

fn winget_uninstall(id: &str, source: Option<&str>) -> CmdOutput {
    let mut args = vec![
        "uninstall",
        "-e",
        "--id",
        id,
        "--accept-source-agreements",
        "--disable-interactivity",
    ];
    if let Some(source) = source {
        args.push("--source");
        args.push(source);
    }
    util::run(&winget_path(), &args)
}

fn winget_upgrade(id: &str, source: Option<&str>) -> CmdOutput {
    let mut args = vec![
        "upgrade",
        "-e",
        "--id",
        id,
        "--accept-source-agreements",
        "--accept-package-agreements",
        "--disable-interactivity",
    ];
    if let Some(source) = source {
        args.push("--source");
        args.push(source);
    }
    util::run(&winget_path(), &args)
}

/// 安装目标 key → (winget 包 ID, 可选 winget source)。None 表示无对应可安装包。
/// 注:winget 的 OpenAI.Codex 是 CLI;Codex 桌面版是商店应用,按 ProductId 走 msstore 源。
pub fn target_id(target: &str) -> Option<(&'static str, Option<&'static str>)> {
    match target {
        "node" => Some(("OpenJS.NodeJS.LTS", None)),
        "git" => Some(("Git.Git", None)),
        "claude_cli" => Some(("Anthropic.ClaudeCode", None)),
        "codex_cli" => Some(("OpenAI.Codex", None)),
        "claude_desktop" => Some(("Anthropic.Claude", None)),
        "codex_desktop" => Some(("9PLM9XGG6VKS", Some("msstore"))),
        _ => None,
    }
}

fn unknown(target: &str) -> CmdOutput {
    CmdOutput {
        success: false,
        code: None,
        stdout: String::new(),
        stderr: format!("无可用安装包: {}", target),
    }
}

pub fn install(target: &str) -> CmdOutput {
    match target_id(target) {
        Some((id, source)) => winget_install(id, source),
        None => unknown(target),
    }
}

pub fn uninstall(target: &str) -> CmdOutput {
    match target_id(target) {
        Some((id, source)) => winget_uninstall(id, source),
        None => unknown(target),
    }
}

pub fn update(target: &str) -> CmdOutput {
    match target_id(target) {
        Some((id, source)) => winget_upgrade(id, source),
        None => unknown(target),
    }
}
