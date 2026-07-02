//! 功能5:Skills + MCP 合并市场。
//! 内置精选目录(随包,离线可用)+ 在线刷新缓存。
//! Skills 安装到 ~/.claude/skills/<id>/SKILL.md;
//! MCP 可写入 Claude Code(~/.claude.json)/ Claude 桌面 / Codex(config.toml)。

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::{paths, snapshots, util};

const SKILLS_JSON: &str = include_str!("../catalog/skills.json");
const MCP_JSON: &str = include_str!("../catalog/mcp.json");

#[derive(Serialize, Deserialize, Clone)]
pub struct SkillItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub installed: bool,
    #[serde(default)]
    pub claude_installed: bool,
    #[serde(default)]
    pub codex_installed: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct McpServer {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
}

// ---- 目录加载(缓存优先,回退内置)----

fn cache_skills(data_dir: &Path) -> PathBuf {
    data_dir.join("catalog-cache").join("skills.json")
}
fn cache_mcp(data_dir: &Path) -> PathBuf {
    data_dir.join("catalog-cache").join("mcp.json")
}

pub fn skills_catalog(data_dir: &Path) -> Vec<SkillItem> {
    let raw = std::fs::read_to_string(cache_skills(data_dir))
        .unwrap_or_else(|_| SKILLS_JSON.to_string());
    let mut items: Vec<SkillItem> = serde_json::from_str(&raw).unwrap_or_default();
    for it in &mut items {
        it.claude_installed = skill_installed_in(&paths::claude_skills_dir(), &it.id);
        it.codex_installed = skill_installed_in(&paths::codex_dir().join("skills"), &it.id);
        it.installed = it.claude_installed || it.codex_installed;
    }
    items
}

pub fn mcp_catalog(data_dir: &Path) -> Vec<McpServer> {
    let raw =
        std::fs::read_to_string(cache_mcp(data_dir)).unwrap_or_else(|_| MCP_JSON.to_string());
    serde_json::from_str(&raw).unwrap_or_default()
}

// ---- Skills 安装/移除 ----

fn skill_dir(id: &str) -> PathBuf {
    paths::claude_skills_dir().join(id)
}
fn skill_installed_in(skills_dir: &Path, id: &str) -> bool {
    skills_dir.join(id).join("SKILL.md").exists()
}

fn write_skill(skills_dir: &Path, item: &SkillItem) -> Result<(), String> {
    let dir = skills_dir.join(&item.id);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let md = format!(
        "---\nname: {}\ndescription: {}\n---\n\n{}\n",
        item.name, item.description, item.content
    );
    util::atomic_write(&dir.join("SKILL.md"), md.as_bytes())
}

pub fn install_skill(data_dir: &Path, id: &str) -> Result<(), String> {
    install_skill_for(data_dir, id, "claude")
}

pub fn install_skill_for(data_dir: &Path, id: &str, target: &str) -> Result<(), String> {
    let item = skills_catalog(data_dir)
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| "skill 不存在".to_string())?;
    let mut targets = Vec::new();
    match target {
        "claude" => targets.push(paths::claude_skills_dir()),
        "codex" => targets.push(paths::codex_dir().join("skills")),
        "both" => {
            targets.push(paths::claude_skills_dir());
            targets.push(paths::codex_dir().join("skills"));
        }
        other => return Err(format!("未知 skill 目标: {}", other)),
    }
    for dir in &targets {
        snapshots::create(
            data_dir,
            "skills",
            "auto",
            None,
            &format!("安装 skill {} -> {}", item.id, target),
            &[dir.join(&item.id)],
        )?;
        write_skill(dir, &item)?;
    }
    Ok(())
}

/// 安装 skill 到指定 skills 目录(供工作区隔离物化复用,不快照)。
pub fn install_skill_into(skills_dir: &Path, id: &str, data_dir: &Path) -> Result<(), String> {
    let item = skills_catalog(data_dir)
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("skill 不存在: {}", id))?;
    write_skill(skills_dir, &item)
}

pub fn remove_skill(data_dir: &Path, id: &str) -> Result<(), String> {
    remove_skill_for(data_dir, id, "both")
}

pub fn remove_skill_for(data_dir: &Path, id: &str, target: &str) -> Result<(), String> {
    let mut dirs = Vec::new();
    match target {
        "claude" => dirs.push(skill_dir(id)),
        "codex" => dirs.push(paths::codex_dir().join("skills").join(id)),
        "both" => {
            dirs.push(skill_dir(id));
            dirs.push(paths::codex_dir().join("skills").join(id));
        }
        other => return Err(format!("未知 skill 目标: {}", other)),
    }
    for dir in dirs {
        snapshots::create(
            data_dir,
            "skills",
            "auto",
            None,
            &format!("移除 skill {} -> {}", id, target),
            &[dir.clone()],
        )?;
        if dir.exists() {
            std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ---- MCP 应用/导入/移除 ----

fn mcp_value(s: &McpServer) -> serde_json::Value {
    serde_json::json!({ "command": s.command, "args": s.args, "env": s.env })
}

pub fn apply_mcp(data_dir: &Path, server: &McpServer, targets: &[String]) -> Result<(), String> {
    for t in targets {
        match t.as_str() {
            "claude_code" => apply_mcp_json(data_dir, &paths::claude_json(), server)?,
            "claude_desktop" => {
                let p = paths::claude_desktop_config()
                    .ok_or_else(|| "无法定位 Claude 桌面配置".to_string())?;
                apply_mcp_json(data_dir, &p, server)?;
            }
            "codex" => apply_mcp_codex(data_dir, server)?,
            other => return Err(format!("未知目标: {}", other)),
        }
    }
    Ok(())
}

fn apply_mcp_json(data_dir: &Path, path: &Path, s: &McpServer) -> Result<(), String> {
    snapshots::create(
        data_dir,
        "mcp",
        "auto",
        None,
        &format!("配置 MCP {}", s.name),
        &[path.to_path_buf()],
    )?;
    let mut root = util::read_json(path)?;
    if !root.is_object() {
        root = serde_json::json!({});
    }
    let mut servers = serde_json::Map::new();
    servers.insert(s.name.clone(), mcp_value(s));
    let overlay = serde_json::json!({ "mcpServers": serde_json::Value::Object(servers) });
    util::deep_merge(&mut root, &overlay);
    util::write_json(path, &root)
}

fn apply_mcp_codex(data_dir: &Path, s: &McpServer) -> Result<(), String> {
    let path = paths::codex_config();
    snapshots::create(
        data_dir,
        "mcp",
        "auto",
        None,
        &format!("配置 MCP {} → codex", s.name),
        &[path.clone()],
    )?;
    let text = std::fs::read_to_string(&path).unwrap_or_default();
    let mut doc = text
        .parse::<toml_edit::DocumentMut>()
        .map_err(|e| format!("解析 config.toml 失败: {}", e))?;

    let mut entry = toml_edit::Table::new();
    entry["command"] = toml_edit::value(s.command.clone());
    let mut arr = toml_edit::Array::new();
    for a in &s.args {
        arr.push(a.clone());
    }
    entry["args"] = toml_edit::value(arr);
    if !s.env.is_empty() {
        let mut envt = toml_edit::InlineTable::new();
        for (k, v) in &s.env {
            envt.insert(k.as_str(), v.clone().into());
        }
        entry["env"] = toml_edit::value(envt);
    }

    let mp = doc
        .entry("mcp_servers")
        .or_insert(toml_edit::Item::Table(toml_edit::Table::new()));
    if let Some(mt) = mp.as_table_mut() {
        mt.set_implicit(true);
        mt.insert(s.name.as_str(), toml_edit::Item::Table(entry));
    }
    util::atomic_write(&path, doc.to_string().as_bytes())
}

pub fn import_mcp(target: &str) -> Result<Vec<McpServer>, String> {
    match target {
        "claude_code" => import_mcp_json(&paths::claude_json()),
        "claude_desktop" => {
            let p = paths::claude_desktop_config()
                .ok_or_else(|| "无法定位 Claude 桌面配置".to_string())?;
            import_mcp_json(&p)
        }
        "codex" => import_mcp_codex(),
        other => Err(format!("未知目标: {}", other)),
    }
}

fn import_mcp_json(path: &Path) -> Result<Vec<McpServer>, String> {
    let v = util::read_json(path)?;
    let mut out = Vec::new();
    if let Some(servers) = v.get("mcpServers").and_then(|x| x.as_object()) {
        for (name, def) in servers {
            let command = def
                .get("command")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let args = def
                .get("args")
                .and_then(|x| x.as_array())
                .map(|a| {
                    a.iter()
                        .filter_map(|x| x.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();
            let env = def
                .get("env")
                .and_then(|x| x.as_object())
                .map(|o| {
                    o.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                        .collect()
                })
                .unwrap_or_default();
            out.push(McpServer {
                id: name.clone(),
                name: name.clone(),
                description: "(已配置)".into(),
                command,
                args,
                env,
            });
        }
    }
    Ok(out)
}

fn import_mcp_codex() -> Result<Vec<McpServer>, String> {
    let text = std::fs::read_to_string(paths::codex_config()).unwrap_or_default();
    let doc = text
        .parse::<toml_edit::DocumentMut>()
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    if let Some(mp) = doc.get("mcp_servers").and_then(|x| x.as_table()) {
        for (name, item) in mp.iter() {
            if let Some(t) = item.as_table() {
                let command = t
                    .get("command")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();
                let args = t
                    .get("args")
                    .and_then(|x| x.as_array())
                    .map(|a| {
                        a.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();
                out.push(McpServer {
                    id: name.to_string(),
                    name: name.to_string(),
                    description: "(已配置)".into(),
                    command,
                    args,
                    env: BTreeMap::new(),
                });
            }
        }
    }
    Ok(out)
}

pub fn remove_mcp(data_dir: &Path, name: &str, targets: &[String]) -> Result<(), String> {
    for t in targets {
        match t.as_str() {
            "claude_code" => remove_mcp_json(data_dir, &paths::claude_json(), name)?,
            "claude_desktop" => {
                if let Some(p) = paths::claude_desktop_config() {
                    remove_mcp_json(data_dir, &p, name)?;
                }
            }
            "codex" => remove_mcp_codex(data_dir, name)?,
            other => return Err(format!("未知目标: {}", other)),
        }
    }
    Ok(())
}

fn remove_mcp_json(data_dir: &Path, path: &Path, name: &str) -> Result<(), String> {
    snapshots::create(
        data_dir,
        "mcp",
        "auto",
        None,
        &format!("移除 MCP {}", name),
        &[path.to_path_buf()],
    )?;
    let mut root = util::read_json(path)?;
    if let Some(servers) = root.get_mut("mcpServers").and_then(|x| x.as_object_mut()) {
        servers.remove(name);
    }
    util::write_json(path, &root)
}

fn remove_mcp_codex(data_dir: &Path, name: &str) -> Result<(), String> {
    let path = paths::codex_config();
    snapshots::create(
        data_dir,
        "mcp",
        "auto",
        None,
        &format!("移除 MCP {} ← codex", name),
        &[path.clone()],
    )?;
    let text = std::fs::read_to_string(&path).unwrap_or_default();
    let mut doc = text
        .parse::<toml_edit::DocumentMut>()
        .map_err(|e| e.to_string())?;
    if let Some(mt) = doc.get_mut("mcp_servers").and_then(|x| x.as_table_mut()) {
        mt.remove(name);
    }
    util::atomic_write(&path, doc.to_string().as_bytes())
}

// ---- 在线刷新 ----

#[derive(Deserialize)]
struct RemoteCatalog {
    #[serde(default)]
    skills: Vec<SkillItem>,
    #[serde(default)]
    mcp: Vec<McpServer>,
}

pub async fn refresh_catalog(data_dir: &Path, url: &str) -> Result<String, String> {
    if url.trim().is_empty() {
        return refresh_from_registry(data_dir).await;
    }
    let body = reqwest::get(url)
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let cat: RemoteCatalog =
        serde_json::from_str(&body).map_err(|e| format!("目录格式错误: {}", e))?;
    let dir = data_dir.join("catalog-cache");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    if !cat.skills.is_empty() {
        let v = serde_json::to_value(&cat.skills).map_err(|e| e.to_string())?;
        util::write_json(&cache_skills(data_dir), &v)?;
    }
    if !cat.mcp.is_empty() {
        let v = serde_json::to_value(&cat.mcp).map_err(|e| e.to_string())?;
        util::write_json(&cache_mcp(data_dir), &v)?;
    }
    Ok(format!(
        "已更新:skills {} 项,MCP {} 项",
        cat.skills.len(),
        cat.mcp.len()
    ))
}

// ---- 官方 MCP 注册表(在线刷新默认源)----

#[derive(Deserialize, Default)]
struct RegMeta {
    #[serde(rename = "nextCursor", default)]
    next_cursor: Option<String>,
}
#[derive(Deserialize)]
struct RegPkg {
    #[serde(rename = "registryType", default)]
    registry_type: String,
    #[serde(default)]
    identifier: String,
}
#[derive(Deserialize)]
struct RegServer {
    #[serde(default)]
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    packages: Vec<RegPkg>,
}
#[derive(Deserialize)]
struct RegItem {
    server: RegServer,
}
#[derive(Deserialize, Default)]
struct RegResp {
    #[serde(default)]
    servers: Vec<RegItem>,
    #[serde(default)]
    metadata: RegMeta,
}

fn enc(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            ':' => "%3A".to_string(),
            '/' => "%2F".to_string(),
            ' ' => "%20".to_string(),
            _ => c.to_string(),
        })
        .collect()
}

fn map_reg(s: &RegServer) -> Option<McpServer> {
    for p in &s.packages {
        let (command, mut args) = match p.registry_type.as_str() {
            "npm" => ("npx".to_string(), vec!["-y".to_string()]),
            "pypi" => ("uvx".to_string(), Vec::new()),
            _ => continue,
        };
        if p.identifier.is_empty() {
            continue;
        }
        args.push(p.identifier.clone());
        let name = s
            .title
            .clone()
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| s.name.clone());
        return Some(McpServer {
            id: s.name.clone(),
            name,
            description: s.description.clone(),
            command,
            args,
            env: BTreeMap::new(),
        });
    }
    None
}

/// 从官方 MCP 注册表拉取并映射为内置 MCP 目录缓存(最多两页)。
async fn refresh_from_registry(data_dir: &Path) -> Result<String, String> {
    let mut servers: Vec<McpServer> = Vec::new();
    let mut cursor: Option<String> = None;
    for _ in 0..2 {
        let mut u = "https://registry.modelcontextprotocol.io/v0/servers?limit=100".to_string();
        if let Some(c) = &cursor {
            u.push_str(&format!("&cursor={}", enc(c)));
        }
        let body = reqwest::get(&u)
            .await
            .map_err(|e| e.to_string())?
            .text()
            .await
            .map_err(|e| e.to_string())?;
        let resp: RegResp =
            serde_json::from_str(&body).map_err(|e| format!("注册表解析失败: {}", e))?;
        for it in &resp.servers {
            if let Some(m) = map_reg(&it.server) {
                servers.push(m);
            }
        }
        cursor = resp.metadata.next_cursor.clone();
        if cursor.is_none() {
            break;
        }
    }
    if servers.is_empty() {
        return Err("注册表未返回可用的 stdio 服务器".to_string());
    }
    let dir = data_dir.join("catalog-cache");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let v = serde_json::to_value(&servers).map_err(|e| e.to_string())?;
    util::write_json(&cache_mcp(data_dir), &v)?;
    Ok(format!("已从官方 MCP 注册表更新 {} 个服务器", servers.len()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp() -> PathBuf {
        let d = std::env::temp_dir().join(format!("adc-mkt-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn mcp_json_apply_merges_and_preserves() {
        let data = temp();
        let path = data.join(".claude.json");
        std::fs::write(
            &path,
            r#"{"projects":{"x":1},"mcpServers":{"old":{"command":"a"}}}"#,
        )
        .unwrap();
        let mut env = BTreeMap::new();
        env.insert("T".to_string(), "v".to_string());
        let s = McpServer {
            id: "github".into(),
            name: "github".into(),
            description: String::new(),
            command: "npx".into(),
            args: vec!["-y".into(), "srv".into()],
            env,
        };
        apply_mcp_json(&data, &path, &s).unwrap();
        let v: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(v["mcpServers"]["github"]["command"], "npx");
        assert_eq!(v["mcpServers"]["github"]["args"][1], "srv");
        assert_eq!(v["mcpServers"]["github"]["env"]["T"], "v");
        assert_eq!(v["mcpServers"]["old"]["command"], "a"); // 既有 MCP 保留
        assert_eq!(v["projects"]["x"], 1); // 其它字段保留
        std::fs::remove_dir_all(&data).ok();
    }

    #[test]
    fn catalogs_parse() {
        // 内置目录可被解析
        let skills: Vec<SkillItem> = serde_json::from_str(SKILLS_JSON).unwrap();
        let mcp: Vec<McpServer> = serde_json::from_str(MCP_JSON).unwrap();
        assert!(!skills.is_empty());
        assert!(!mcp.is_empty());
    }
}
