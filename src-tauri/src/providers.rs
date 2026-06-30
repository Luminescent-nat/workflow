//! 功能4:第三方 API 供应商管理与一键切换(仿 cc-switch)。
//! Claude 写入 ~/.claude/settings.json 的 env;Codex 写入 ~/.codex/config.toml + auth.json。
//! 切换前对实时配置文件创建快照,可一键还原。

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::{paths, snapshots, util};

#[derive(Serialize, Deserialize, Clone)]
pub struct Provider {
    #[serde(default)]
    pub id: String,
    /// "claude" | "codex"
    pub tool: String,
    pub name: String,
    pub base_url: String,
    pub key: String,
    #[serde(default)]
    pub model: Option<String>,
    /// 仅 Codex:wire_api,默认 "chat"(OpenAI 兼容网关)
    #[serde(default)]
    pub wire_api: Option<String>,
    #[serde(default)]
    pub active: bool,
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 由名称生成 Codex provider 标识(附短 id 保证唯一)。
fn slugify(name: &str, id: &str) -> String {
    let mut base = String::new();
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            base.push(c.to_ascii_lowercase());
        } else if c == ' ' || c == '-' || c == '_' {
            base.push('-');
        }
    }
    let base = base.trim_matches('-').to_string();
    let base = if base.is_empty() { "provider".to_string() } else { base };
    let suffix: String = id.chars().filter(|c| c.is_ascii_alphanumeric()).take(6).collect();
    if suffix.is_empty() {
        base
    } else {
        format!("{}-{}", base, suffix)
    }
}

pub fn list(providers: &[Provider], tool: &str) -> Vec<Provider> {
    providers.iter().filter(|p| p.tool == tool).cloned().collect()
}

/// 新增或更新供应商;若 id 为空则分配新 id。返回落库后的供应商。
pub fn upsert(providers: &mut Vec<Provider>, mut p: Provider) -> Provider {
    if p.id.is_empty() {
        p.id = new_id();
    }
    if let Some(existing) = providers.iter_mut().find(|x| x.id == p.id) {
        *existing = p.clone();
    } else {
        providers.push(p.clone());
    }
    p
}

pub fn delete(providers: &mut Vec<Provider>, id: &str) {
    providers.retain(|p| p.id != id);
}

/// 切换激活供应商:快照实时文件 → 写入 → 更新 active 标记。
pub fn switch(providers: &mut [Provider], data_dir: &Path, id: &str) -> Result<(), String> {
    let p = providers
        .iter()
        .find(|x| x.id == id)
        .cloned()
        .ok_or_else(|| "供应商不存在".to_string())?;

    let files = match p.tool.as_str() {
        "claude" => vec![paths::claude_settings()],
        "codex" => vec![paths::codex_config(), paths::codex_auth()],
        other => return Err(format!("未知工具: {}", other)),
    };
    snapshots::create(
        data_dir,
        &format!("provider:{}", p.tool),
        "auto",
        None,
        "切换供应商前自动快照",
        &files,
    )?;

    match p.tool.as_str() {
        "claude" => write_claude(&p)?,
        "codex" => write_codex(&p)?,
        other => return Err(format!("未知工具: {}", other)),
    }

    for x in providers.iter_mut() {
        if x.tool == p.tool {
            x.active = x.id == id;
        }
    }
    Ok(())
}

/// 从当前实时配置导入为一个供应商草稿(未落库)。
pub fn import_current(tool: &str) -> Result<Provider, String> {
    match tool {
        "claude" => {
            let v = util::read_json(&paths::claude_settings())?;
            let env = v.get("env");
            let base = env
                .and_then(|e| e.get("ANTHROPIC_BASE_URL"))
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let key = env
                .and_then(|e| {
                    e.get("ANTHROPIC_AUTH_TOKEN")
                        .or_else(|| e.get("ANTHROPIC_API_KEY"))
                })
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let model = env
                .and_then(|e| e.get("ANTHROPIC_MODEL"))
                .and_then(|x| x.as_str())
                .map(|s| s.to_string());
            Ok(Provider {
                id: new_id(),
                tool: "claude".into(),
                name: "当前 Claude 配置".into(),
                base_url: base,
                key,
                model,
                wire_api: None,
                active: false,
            })
        }
        "codex" => {
            let auth = util::read_json(&paths::codex_auth())?;
            let key = auth
                .get("OPENAI_API_KEY")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let base = read_codex_active_base().unwrap_or_default();
            Ok(Provider {
                id: new_id(),
                tool: "codex".into(),
                name: "当前 Codex 配置".into(),
                base_url: base,
                key,
                model: None,
                wire_api: Some("chat".into()),
                active: false,
            })
        }
        other => Err(format!("未知工具: {}", other)),
    }
}

fn write_claude(p: &Provider) -> Result<(), String> {
    write_claude_to(&paths::claude_settings(), p)
}

pub fn write_claude_to(path: &Path, p: &Provider) -> Result<(), String> {
    let mut root = util::read_json(path)?;
    if !root.is_object() {
        root = serde_json::json!({});
    }
    let mut env = serde_json::Map::new();
    env.insert(
        "ANTHROPIC_BASE_URL".into(),
        serde_json::Value::String(p.base_url.clone()),
    );
    env.insert(
        "ANTHROPIC_AUTH_TOKEN".into(),
        serde_json::Value::String(p.key.clone()),
    );
    if let Some(m) = &p.model {
        if !m.is_empty() {
            env.insert("ANTHROPIC_MODEL".into(), serde_json::Value::String(m.clone()));
        }
    }
    let overlay = serde_json::json!({ "env": serde_json::Value::Object(env) });
    util::deep_merge(&mut root, &overlay);
    util::write_json(path, &root)
}

fn write_codex(p: &Provider) -> Result<(), String> {
    write_codex_to(&paths::codex_config(), &paths::codex_auth(), p)
}

pub fn write_codex_to(cfg_path: &Path, auth_path: &Path, p: &Provider) -> Result<(), String> {
    // auth.json
    let auth = serde_json::json!({ "OPENAI_API_KEY": p.key });
    util::write_json(auth_path, &auth)?;

    // config.toml(定点改,保留用户其它字段)
    let text = std::fs::read_to_string(cfg_path).unwrap_or_default();
    let mut doc = text
        .parse::<toml_edit::DocumentMut>()
        .map_err(|e| format!("解析 config.toml 失败: {}", e))?;

    let slug = slugify(&p.name, &p.id);
    let wire = p.wire_api.clone().unwrap_or_else(|| "chat".to_string());

    doc["model_provider"] = toml_edit::value(slug.clone());
    if let Some(m) = &p.model {
        if !m.is_empty() {
            doc["model"] = toml_edit::value(m.clone());
        }
    }

    let mut entry = toml_edit::Table::new();
    entry["name"] = toml_edit::value(p.name.clone());
    entry["base_url"] = toml_edit::value(p.base_url.clone());
    // key 存于 auth.json 的 OPENAI_API_KEY,故用 requires_openai_auth 让 codex 从 auth.json 读取,
    // 而非 env_key(后者要求 key 在进程环境变量里,与 auth.json 不配套)。
    entry["requires_openai_auth"] = toml_edit::value(true);
    entry["wire_api"] = toml_edit::value(wire);

    let mp = doc
        .entry("model_providers")
        .or_insert(toml_edit::Item::Table(toml_edit::Table::new()));
    if let Some(mt) = mp.as_table_mut() {
        mt.set_implicit(true);
        mt.insert(slug.as_str(), toml_edit::Item::Table(entry));
    }

    util::atomic_write(cfg_path, doc.to_string().as_bytes())
}

fn read_codex_active_base() -> Option<String> {
    let text = std::fs::read_to_string(paths::codex_config()).ok()?;
    let doc = text.parse::<toml_edit::DocumentMut>().ok()?;
    let active = doc.get("model_provider")?.as_str()?.to_string();
    let mp = doc.get("model_providers")?.as_table()?;
    let entry = mp.get(active.as_str())?.as_table()?;
    entry.get("base_url")?.as_str().map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("adc-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn claude_write_merges_and_preserves() {
        let dir = temp_dir();
        let path = dir.join("settings.json");
        std::fs::write(&path, r#"{"theme":"dark","env":{"FOO":"bar"}}"#).unwrap();
        let p = Provider {
            id: "1".into(),
            tool: "claude".into(),
            name: "t".into(),
            base_url: "https://x/v1".into(),
            key: "sk-1".into(),
            model: Some("claude-3".into()),
            wire_api: None,
            active: false,
        };
        write_claude_to(&path, &p).unwrap();
        let v: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(v["env"]["ANTHROPIC_BASE_URL"], "https://x/v1");
        assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-1");
        assert_eq!(v["env"]["ANTHROPIC_MODEL"], "claude-3");
        assert_eq!(v["theme"], "dark"); // 其它字段保留
        assert_eq!(v["env"]["FOO"], "bar"); // 其它 env 保留
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn codex_write_sets_provider_and_auth() {
        let dir = temp_dir();
        let cfg = dir.join("config.toml");
        let auth = dir.join("auth.json");
        std::fs::write(&cfg, "approval_policy = \"on-request\"\n").unwrap();
        let p = Provider {
            id: "abc123".into(),
            tool: "codex".into(),
            name: "My Proxy".into(),
            base_url: "https://prox/v1".into(),
            key: "sk-2".into(),
            model: Some("gpt-5".into()),
            wire_api: Some("chat".into()),
            active: false,
        };
        write_codex_to(&cfg, &auth, &p).unwrap();
        let toml = std::fs::read_to_string(&cfg).unwrap();
        assert!(toml.contains("model_provider = \"my-proxy-abc123\""));
        assert!(toml.contains("[model_providers.my-proxy-abc123]"));
        assert!(toml.contains("base_url = \"https://prox/v1\""));
        assert!(toml.contains("approval_policy")); // 其它字段保留
        let a: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&auth).unwrap()).unwrap();
        assert_eq!(a["OPENAI_API_KEY"], "sk-2");
        std::fs::remove_dir_all(&dir).ok();
    }
}
