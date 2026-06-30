//! 全平台配置路径解析。Windows 优先;路径基于用户主目录。
//! Claude 主目录可被 CLAUDE_CONFIG_DIR 重定向,Codex 可被 CODEX_HOME 重定向(隔离用)。

use std::path::PathBuf;

pub fn home() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

// ---- Claude Code ----
pub fn claude_dir() -> PathBuf {
    home().join(".claude")
}
pub fn claude_settings() -> PathBuf {
    claude_dir().join("settings.json")
}
pub fn claude_json() -> PathBuf {
    home().join(".claude.json")
}
pub fn claude_skills_dir() -> PathBuf {
    claude_dir().join("skills")
}
pub fn claude_agents_dir() -> PathBuf {
    claude_dir().join("agents")
}
pub fn claude_commands_dir() -> PathBuf {
    claude_dir().join("commands")
}
pub fn claude_projects_dir() -> PathBuf {
    claude_dir().join("projects")
}

/// Claude 桌面版 MCP 配置(Windows: %APPDATA%/Claude/claude_desktop_config.json)
pub fn claude_desktop_config() -> Option<PathBuf> {
    dirs::config_dir().map(|c| c.join("Claude").join("claude_desktop_config.json"))
}

// ---- Codex ----
pub fn codex_dir() -> PathBuf {
    home().join(".codex")
}
pub fn codex_config() -> PathBuf {
    codex_dir().join("config.toml")
}
pub fn codex_auth() -> PathBuf {
    codex_dir().join("auth.json")
}
pub fn codex_prompts_dir() -> PathBuf {
    codex_dir().join("prompts")
}
pub fn codex_sessions_dir() -> PathBuf {
    codex_dir().join("sessions")
}
