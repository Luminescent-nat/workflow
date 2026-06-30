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

fn winget_install(id: &str) -> CmdOutput {
    util::run(
        &winget_path(),
        &[
            "install",
            "-e",
            "--id",
            id,
            "--accept-source-agreements",
            "--accept-package-agreements",
            "--disable-interactivity",
        ],
    )
}

fn winget_uninstall(id: &str) -> CmdOutput {
    util::run(
        &winget_path(),
        &[
            "uninstall",
            "-e",
            "--id",
            id,
            "--accept-source-agreements",
            "--disable-interactivity",
        ],
    )
}

fn winget_upgrade(id: &str) -> CmdOutput {
    util::run(
        &winget_path(),
        &[
            "upgrade",
            "-e",
            "--id",
            id,
            "--accept-source-agreements",
            "--accept-package-agreements",
            "--disable-interactivity",
        ],
    )
}

/// 安装目标 key → winget 包 ID。None 表示无对应可安装包(如 codex 桌面版)。
fn target_id(target: &str) -> Option<&'static str> {
    match target {
        "node" => Some("OpenJS.NodeJS.LTS"),
        "git" => Some("Git.Git"),
        "claude_cli" => Some("Anthropic.ClaudeCode"),
        "codex_cli" => Some("OpenAI.Codex"),
        "claude_desktop" => Some("Anthropic.Claude"),
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
        Some(id) => winget_install(id),
        None => unknown(target),
    }
}

pub fn uninstall(target: &str) -> CmdOutput {
    match target_id(target) {
        Some(id) => winget_uninstall(id),
        None => unknown(target),
    }
}

pub fn update(target: &str) -> CmdOutput {
    match target_id(target) {
        Some(id) => winget_upgrade(id),
        None => unknown(target),
    }
}
