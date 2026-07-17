//! 功能6:多角色工作流预设包。
//! 自研预设包 = 一组 subagents(agents/*.md)+ 斜杠命令(commands/*.md)+ CLAUDE.md 记忆片段。
//! 应用到全局 ~/.claude 或工作区隔离目录(scope = "global" | "ws:<dir>")。
//! memory 用标记块包裹,便于干净移除;应用前自动快照,可一键还原。

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::{paths, snapshots, util};

const INSTALLERS_JSON: &str = include_str!("../catalog/roles.json");

/// 自研预设包目录:每包一个 JSON 文件(catalog/roles/<id>.json)。
/// 新增包时创建对应文件并在下方登记。
const PACK_SOURCES: &[&str] = &[
    include_str!("../catalog/roles/architecture-design.json"),
    include_str!("../catalog/roles/frontend-ui-design.json"),
    include_str!("../catalog/roles/frontend-dev-flow.json"),
    include_str!("../catalog/roles/backend-dev-flow.json"),
    include_str!("../catalog/roles/android-dev.json"),
    include_str!("../catalog/roles/fullstack-team.json"),
    include_str!("../catalog/roles/frontend-backend-split.json"),
    include_str!("../catalog/roles/spec-driven.json"),
    include_str!("../catalog/roles/test-regression.json"),
    include_str!("../catalog/roles/code-review.json"),
    include_str!("../catalog/roles/devops-ci.json"),
    include_str!("../catalog/roles/video-processing.json"),
    include_str!("../catalog/roles/doc-reading.json"),
    include_str!("../catalog/roles/doc-writing.json"),
    include_str!("../catalog/roles/translation-review.json"),
];

#[derive(Serialize, Deserialize, Clone)]
pub struct TemplateFile {
    pub name: String,
    pub content: String,
}

/// 工作流步骤元数据:把包内命令串成有序流水线,UI 据此展示流程。
#[derive(Serialize, Deserialize, Clone)]
pub struct WorkflowStep {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub command: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RolePack {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub steps: Vec<WorkflowStep>,
    #[serde(default)]
    pub agents: Vec<TemplateFile>,
    #[serde(default)]
    pub commands: Vec<TemplateFile>,
    #[serde(default)]
    pub memory: Option<String>,
    #[serde(default)]
    pub applied: bool,
    #[serde(default)]
    pub claude_applied: bool,
    #[serde(default)]
    pub codex_applied: bool,
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
    let mut catalog: RolesCatalog = serde_json::from_str(INSTALLERS_JSON).unwrap_or_default();
    for src in PACK_SOURCES {
        if let Ok(pack) = serde_json::from_str::<RolePack>(src) {
            catalog.packs.push(pack);
        }
    }
    catalog
}

fn role_base(scope: &str) -> Result<PathBuf, String> {
    if scope == "global" {
        Ok(paths::claude_dir())
    } else if scope == "codex-global" {
        Ok(paths::codex_dir())
    } else if let Some(p) = scope.strip_prefix("ws:") {
        Ok(PathBuf::from(p))
    } else {
        Err(format!("未知范围: {}", scope))
    }
}

fn memory_file(base: &Path, scope: &str) -> PathBuf {
    let is_codex = scope == "codex-global"
        || base
            .file_name()
            .and_then(|x| x.to_str())
            .map(|x| x.eq_ignore_ascii_case("codex-home") || x.eq_ignore_ascii_case(".codex"))
            .unwrap_or(false);
    base.join(if is_codex { "AGENTS.md" } else { "CLAUDE.md" })
}

fn role_applied_in(base: &Path, p: &RolePack, scope: &str) -> bool {
    let memory_path = memory_file(base, scope);
    let memory_ok = match &p.memory {
        Some(_) => std::fs::read_to_string(&memory_path)
            .map(|text| text.contains(&format!("<!-- BEGIN ROLEPACK {} -->", p.id)))
            .unwrap_or(false),
        None => true,
    };
    let agents_ok = p
        .agents
        .iter()
        .all(|a| base.join("agents").join(format!("{}.md", a.name)).exists());
    let commands_ok = p
        .commands
        .iter()
        .all(|c| base.join("commands").join(format!("{}.md", c.name)).exists());
    memory_ok && agents_ok && commands_ok
}

fn is_claude_applied(p: &RolePack) -> bool {
    role_applied_in(&paths::claude_dir(), p, "global")
}

fn is_codex_applied(p: &RolePack) -> bool {
    role_applied_in(&paths::codex_dir(), p, "codex-global")
}

fn is_applied(p: &RolePack) -> bool {
    match p.agents.first() {
        Some(a) => {
            paths::claude_agents_dir().join(format!("{}.md", a.name)).exists()
                || paths::codex_dir()
                    .join("agents")
                    .join(format!("{}.md", a.name))
                    .exists()
        }
        None => false,
    }
}

pub fn view() -> RolesView {
    let c = load();
    let mut packs = c.packs;
    for p in &mut packs {
        p.claude_applied = is_claude_applied(p);
        p.codex_applied = is_codex_applied(p);
        p.applied = p.claude_applied || p.codex_applied || is_applied(p);
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
    let memory_path = memory_file(&base, scope);

    snapshots::create(
        data_dir,
        "role",
        "auto",
        None,
        &format!("应用角色包 {}", id),
        &[agents_dir.clone(), commands_dir.clone(), memory_path.clone()],
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
        let existing = std::fs::read_to_string(&memory_path).unwrap_or_default();
        let mut text = strip_block(&existing, id);
        if !text.is_empty() {
            text.push_str("\n\n");
        }
        text.push_str(&memory_block(id, mem));
        text.push('\n');
        util::atomic_write(&memory_path, text.as_bytes())?;
    }
    Ok(())
}

pub fn remove(data_dir: &Path, id: &str, scope: &str) -> Result<(), String> {
    let pack = find_pack(id)?;
    let base = role_base(scope)?;
    let agents_dir = base.join("agents");
    let commands_dir = base.join("commands");
    let memory_path = memory_file(&base, scope);

    snapshots::create(
        data_dir,
        "role",
        "auto",
        None,
        &format!("移除角色包 {}", id),
        &[agents_dir.clone(), commands_dir.clone(), memory_path.clone()],
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
    if memory_path.exists() {
        let existing = std::fs::read_to_string(&memory_path).unwrap_or_default();
        let stripped = strip_block(&existing, id);
        util::atomic_write(&memory_path, format!("{}\n", stripped).as_bytes())?;
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
        assert_eq!(v.packs.len(), PACK_SOURCES.len(), "有预设包解析失败");
        assert!(!v.installers.is_empty());
        assert!(v.packs.iter().all(|p| !p.category.is_empty()));
    }
}
