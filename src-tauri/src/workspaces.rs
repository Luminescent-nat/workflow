//! 功能8:工作区隔离与并行运行。
//! 每个工作区在 <project>/.aiconsole/ 下拥有独立的 claude-home / codex-home,
//! 通过 CLAUDE_CONFIG_DIR / CODEX_HOME 实现隔离;在外部终端中启动,天然多实例并行。

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::{providers, roles};

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Workspace {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub project_path: String,
    /// "claude" | "codex" | "both"
    pub tool: String,
    /// 兼容旧字段:单一供应商(未区分工具时的回退)
    #[serde(default)]
    pub provider_id: Option<String>,
    /// Claude 工具使用的供应商
    #[serde(default)]
    pub claude_provider_id: Option<String>,
    /// Codex 工具使用的供应商
    #[serde(default)]
    pub codex_provider_id: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub role_id: Option<String>,
}

impl Workspace {
    /// 取 claude 供应商 id:优先 claude_provider_id,回退 provider_id。
    fn claude_pid(&self) -> Option<&String> {
        self.claude_provider_id.as_ref().or(self.provider_id.as_ref())
    }
    /// 取 codex 供应商 id:优先 codex_provider_id,回退 provider_id。
    fn codex_pid(&self) -> Option<&String> {
        self.codex_provider_id.as_ref().or(self.provider_id.as_ref())
    }
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn claude_home(ws: &Workspace) -> PathBuf {
    PathBuf::from(&ws.project_path)
        .join(".aiconsole")
        .join("claude-home")
}
pub fn codex_home(ws: &Workspace) -> PathBuf {
    PathBuf::from(&ws.project_path)
        .join(".aiconsole")
        .join("codex-home")
}

pub fn upsert(list: &mut Vec<Workspace>, mut w: Workspace) -> Workspace {
    if w.id.is_empty() {
        w.id = new_id();
    }
    if let Some(e) = list.iter_mut().find(|x| x.id == w.id) {
        *e = w.clone();
    } else {
        list.push(w.clone());
    }
    w
}

pub fn delete(list: &mut Vec<Workspace>, id: &str) {
    list.retain(|w| w.id != id);
}

/// 物化隔离目录:按工作区选定的供应商写入隔离配置,并应用角色包。
pub fn materialize(
    data_dir: &Path,
    ws: &Workspace,
    provider_list: &[providers::Provider],
) -> Result<(), String> {
    if ws.project_path.trim().is_empty() {
        return Err("工作区未设置项目路径".to_string());
    }

    if ws.tool == "claude" || ws.tool == "both" {
        let home = claude_home(ws);
        std::fs::create_dir_all(&home).map_err(|e| e.to_string())?;
        if let Some(pid) = ws.claude_pid() {
            if let Some(p) = provider_list
                .iter()
                .find(|x| x.id == *pid && x.tool == "claude")
            {
                let mut p2 = p.clone();
                if ws.model.is_some() {
                    p2.model = ws.model.clone();
                }
                providers::write_claude_to(&home.join("settings.json"), &p2)?;
            }
        }
        if let Some(rid) = &ws.role_id {
            let scope = format!("ws:{}", home.to_string_lossy());
            roles::apply(data_dir, rid, &scope)?;
        }
        for sid in &ws.skills {
            crate::market::install_skill_into(&home.join("skills"), sid, data_dir)?;
        }
    }

    if ws.tool == "codex" || ws.tool == "both" {
        let home = codex_home(ws);
        std::fs::create_dir_all(&home).map_err(|e| e.to_string())?;
        if let Some(pid) = ws.codex_pid() {
            if let Some(p) = provider_list
                .iter()
                .find(|x| x.id == *pid && x.tool == "codex")
            {
                let mut p2 = p.clone();
                if ws.model.is_some() {
                    p2.model = ws.model.clone();
                }
                providers::write_codex_to(
                    &home.join("config.toml"),
                    &home.join("auth.json"),
                    &p2,
                )?;
            }
        }
    }
    Ok(())
}

/// 在外部终端启动隔离实例(注入 CLAUDE_CONFIG_DIR / CODEX_HOME)。
pub fn launch(ws: &Workspace, tool: &str) -> Result<(), String> {
    let project = ws.project_path.clone();
    if project.trim().is_empty() {
        return Err("工作区未设置项目路径".to_string());
    }
    let (var, home, cli) = match tool {
        "claude" => ("CLAUDE_CONFIG_DIR", claude_home(ws), "claude"),
        "codex" => ("CODEX_HOME", codex_home(ws), "codex"),
        other => return Err(format!("未知工具: {}", other)),
    };
    let home_s = home.to_string_lossy().to_string();

    let aiconsole = PathBuf::from(&project).join(".aiconsole");
    std::fs::create_dir_all(&aiconsole).map_err(|e| e.to_string())?;
    let bat = aiconsole.join(format!("launch-{}.bat", tool));
    let content = format!(
        "@echo off\r\nset \"{var}={home}\"\r\ncd /d \"{proj}\"\r\necho [AI Dev Console] {cli}  (隔离配置目录: {home})\r\n{cli}\r\n",
        var = var,
        home = home_s,
        proj = project,
        cli = cli,
    );
    std::fs::write(&bat, content).map_err(|e| e.to_string())?;
    let bat_s = bat.to_string_lossy().to_string();

    let mut c = Command::new("cmd");
    c.args(["/c", "start", "AI Dev Console", "cmd", "/k", &bat_s]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // 启动器自身不弹窗;start 会另开可见终端
    }
    c.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::Provider;

    fn provider(tool: &str) -> Provider {
        Provider {
            id: format!("{}-prov", tool),
            tool: tool.into(),
            name: "测试供应商".into(),
            base_url: "https://test.example/v1".into(),
            key: "sk-test-key".into(),
            model: Some("test-model".into()),
            wire_api: if tool == "codex" { Some("chat".into()) } else { None },
            active: true,
        }
    }

    #[test]
    fn materialize_isolates_per_workspace() {
        let root = std::env::temp_dir().join(format!("adc-ws-{}", uuid::Uuid::new_v4()));
        let data_dir = root.join("data");
        std::fs::create_dir_all(&data_dir).unwrap();

        // 两个工作区,不同 skills / role,验证互不影响
        let ws_a = Workspace {
            id: "a".into(),
            name: "A".into(),
            project_path: root.join("projA").to_string_lossy().to_string(),
            tool: "both".into(),
            provider_id: None,
            claude_provider_id: Some("claude-prov".into()),
            codex_provider_id: Some("codex-prov".into()),
            model: None,
            skills: vec!["code-reviewer".into(), "debugging".into()],
            role_id: Some("fullstack-team".into()),
        };
        let ws_b = Workspace {
            id: "b".into(),
            name: "B".into(),
            project_path: root.join("projB").to_string_lossy().to_string(),
            tool: "claude".into(),
            provider_id: Some("claude-prov".into()),
            claude_provider_id: None,
            codex_provider_id: None,
            model: None,
            skills: vec!["git-commit".into()],
            role_id: Some("test-regression".into()),
        };
        let provs = vec![provider("claude"), provider("codex")];

        materialize(&data_dir, &ws_a, &provs).unwrap();
        materialize(&data_dir, &ws_b, &provs).unwrap();

        let a_home = claude_home(&ws_a);
        let b_home = claude_home(&ws_b);

        // 1) 供应商 env 写入各自隔离 settings.json
        let a_settings: serde_json::Value =
            serde_json::from_slice(&std::fs::read(a_home.join("settings.json")).unwrap()).unwrap();
        assert_eq!(a_settings["env"]["ANTHROPIC_BASE_URL"], "https://test.example/v1");

        // 2) skills 物化到各自目录,且互不串味
        assert!(a_home.join("skills").join("code-reviewer").join("SKILL.md").exists());
        assert!(a_home.join("skills").join("debugging").join("SKILL.md").exists());
        assert!(!a_home.join("skills").join("git-commit").exists(), "A 不应有 B 的 skill");
        assert!(b_home.join("skills").join("git-commit").join("SKILL.md").exists());
        assert!(!b_home.join("skills").join("code-reviewer").exists(), "B 不应有 A 的 skill");

        // 3) 角色 agents 物化到各自目录,且不同
        assert!(a_home.join("agents").join("requirement-reviewer.md").exists());
        assert!(a_home.join("agents").join("architect.md").exists());
        assert!(b_home.join("agents").join("test-engineer.md").exists());
        assert!(!b_home.join("agents").join("architect.md").exists(), "B 不应有 A 的 agent");

        // 4) 命令物化
        assert!(a_home.join("commands").join("kickoff.md").exists());
        assert!(b_home.join("commands").join("regress.md").exists());

        // 5) codex 隔离配置(ws_a 含 codex)
        let a_codex = codex_home(&ws_a);
        assert!(a_codex.join("config.toml").exists());
        assert!(a_codex.join("auth.json").exists());
        // ws_b 仅 claude,不应生成 codex-home/config.toml
        assert!(!codex_home(&ws_b).join("config.toml").exists());

        // 6) 不污染全局 ~/.claude(物化只写工作区目录)
        // (此处仅断言路径互相独立,全局目录不在 root 下)
        assert!(a_home.starts_with(&root));
        assert!(b_home.starts_with(&root));

        std::fs::remove_dir_all(&root).ok();
    }
}
