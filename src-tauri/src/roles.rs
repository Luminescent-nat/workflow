//! 功能6:多角色工作流预设包。
//! 自研预设包 = 一组 subagents(agents/*.md)+ 斜杠命令(commands/*.md)+ CLAUDE.md 记忆片段。
//! 应用到全局 ~/.claude 或工作区隔离目录(scope = "global" | "ws:<dir>")。
//! memory 用标记块包裹,便于干净移除;应用前自动快照,可一键还原。

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::{paths, snapshots, util};

const ROLES_JSON: &str = include_str!("../catalog/roles.json");

#[derive(Serialize, Deserialize, Clone)]
pub struct TemplateFile {
    pub name: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RolePack {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub agents: Vec<TemplateFile>,
    #[serde(default)]
    pub commands: Vec<TemplateFile>,
    #[serde(default)]
    pub memory: Option<String>,
    #[serde(default)]
    pub applied: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OfficialInstaller {
    pub id: String,
    pub name: String,
    pub description: String,
    pub command: String,
}

#[derive(Deserialize, Default)]
struct RolesCatalog {
    #[serde(default)]
    packs: Vec<RolePack>,
    #[serde(default)]
    installers: Vec<OfficialInstaller>,
}

#[derive(Serialize)]
pub struct RolesView {
    pub packs: Vec<RolePack>,
    pub installers: Vec<OfficialInstaller>,
}

fn load() -> RolesCatalog {
    serde_json::from_str(ROLES_JSON).unwrap_or_default()
}

fn role_base(scope: &str) -> Result<PathBuf, String> {
    if scope == "global" {
        Ok(paths::claude_dir())
    } else if let Some(p) = scope.strip_prefix("ws:") {
        Ok(PathBuf::from(p))
    } else {
        Err(format!("未知范围: {}", scope))
    }
}

fn is_applied(p: &RolePack) -> bool {
    match p.agents.first() {
        Some(a) => paths::claude_agents_dir().join(format!("{}.md", a.name)).exists(),
        None => false,
    }
}

pub fn view() -> RolesView {
    let c = load();
    let mut packs = c.packs;
    for p in &mut packs {
        p.applied = is_applied(p);
    }
    RolesView {
        packs,
        installers: c.installers,
    }
}

fn find_pack(id: &str) -> Result<RolePack, String> {
    load()
        .packs
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| "预设包不存在".to_string())
}

fn memory_block(id: &str, mem: &str) -> String {
    format!(
        "<!-- BEGIN ROLEPACK {} -->\n{}\n<!-- END ROLEPACK {} -->",
        id, mem, id
    )
}

fn strip_block(text: &str, id: &str) -> String {
    let begin = format!("<!-- BEGIN ROLEPACK {} -->", id);
    let end = format!("<!-- END ROLEPACK {} -->", id);
    if let (Some(bi), Some(ei)) = (text.find(&begin), text.find(&end)) {
        let mut s = String::new();
        s.push_str(&text[..bi]);
        s.push_str(&text[ei + end.len()..]);
        return s.trim().to_string();
    }
    text.trim().to_string()
}

pub fn apply(data_dir: &Path, id: &str, scope: &str) -> Result<(), String> {
    let pack = find_pack(id)?;
    let base = role_base(scope)?;
    let agents_dir = base.join("agents");
    let commands_dir = base.join("commands");
    let claude_md = base.join("CLAUDE.md");

    snapshots::create(
        data_dir,
        "role",
        "auto",
        None,
        &format!("应用角色包 {}", id),
        &[agents_dir.clone(), commands_dir.clone(), claude_md.clone()],
    )?;

    std::fs::create_dir_all(&agents_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&commands_dir).map_err(|e| e.to_string())?;
    for f in &pack.agents {
        util::atomic_write(&agents_dir.join(format!("{}.md", f.name)), f.content.as_bytes())?;
    }
    for f in &pack.commands {
        util::atomic_write(&commands_dir.join(format!("{}.md", f.name)), f.content.as_bytes())?;
    }
    if let Some(mem) = &pack.memory {
        let existing = std::fs::read_to_string(&claude_md).unwrap_or_default();
        let mut text = strip_block(&existing, id);
        if !text.is_empty() {
            text.push_str("\n\n");
        }
        text.push_str(&memory_block(id, mem));
        text.push('\n');
        util::atomic_write(&claude_md, text.as_bytes())?;
    }
    Ok(())
}

pub fn remove(data_dir: &Path, id: &str, scope: &str) -> Result<(), String> {
    let pack = find_pack(id)?;
    let base = role_base(scope)?;
    let agents_dir = base.join("agents");
    let commands_dir = base.join("commands");
    let claude_md = base.join("CLAUDE.md");

    snapshots::create(
        data_dir,
        "role",
        "auto",
        None,
        &format!("移除角色包 {}", id),
        &[agents_dir.clone(), commands_dir.clone(), claude_md.clone()],
    )?;

    for f in &pack.agents {
        let p = agents_dir.join(format!("{}.md", f.name));
        if p.exists() {
            let _ = std::fs::remove_file(&p);
        }
    }
    for f in &pack.commands {
        let p = commands_dir.join(format!("{}.md", f.name));
        if p.exists() {
            let _ = std::fs::remove_file(&p);
        }
    }
    if claude_md.exists() {
        let existing = std::fs::read_to_string(&claude_md).unwrap_or_default();
        let stripped = strip_block(&existing, id);
        util::atomic_write(&claude_md, format!("{}\n", stripped).as_bytes())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_block_removes_only_its_block() {
        let text =
            "head\n\n<!-- BEGIN ROLEPACK a -->\nX\n<!-- END ROLEPACK a -->\n\ntail";
        let out = strip_block(text, "a");
        assert!(!out.contains("ROLEPACK a"));
        assert!(out.contains("head"));
        assert!(out.contains("tail"));
    }

    #[test]
    fn catalog_parses() {
        let v = view();
        assert!(!v.packs.is_empty());
        assert!(!v.installers.is_empty());
    }
}
