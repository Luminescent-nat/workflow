//! 功能9:会话列举 / 导出 Markdown(思考内容可选)/ 删除(删除前快照备份)。
//! 支持两种来源:
//!   - Claude:<config_dir>/projects/<编码路径>/<session>.jsonl(行 type=user/assistant,message.content)
//!   - Codex :<codex_home>/sessions/**/rollout-*.jsonl(行 type=response_item,payload.type=message/reasoning/function_call)

use std::io::BufRead;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use crate::{paths, snapshots};

#[derive(Serialize)]
pub struct SessionInfo {
    pub id: String,
    pub path: String,
    pub title: String,
    pub project: String,
    pub modified: String,
    pub size: u64,
    pub tool: String,
    /// 该对话的工作目录(从会话文件的 cwd 字段读取),用作导出时默认目录
    pub cwd: Option<String>,
}

fn fmt_time(t: std::time::SystemTime) -> String {
    let dt: chrono::DateTime<chrono::Local> = t.into();
    dt.format("%Y-%m-%d %H:%M").to_string()
}

/// 递归查找 JSON 中第一个非空 cwd 字符串。
fn find_cwd(v: &Value) -> Option<String> {
    match v {
        Value::Object(m) => {
            if let Some(Value::String(s)) = m.get("cwd") {
                if !s.trim().is_empty() {
                    return Some(s.clone());
                }
            }
            for val in m.values() {
                if let Some(r) = find_cwd(val) {
                    return Some(r);
                }
            }
            None
        }
        Value::Array(a) => a.iter().find_map(find_cwd),
        _ => None,
    }
}

/// 从会话文件前若干行提取工作目录(Claude 顶层 cwd / Codex session_meta/turn_context 内嵌 cwd)。
fn extract_cwd(path: &Path) -> Option<String> {
    let file = std::fs::File::open(path).ok()?;
    for line in std::io::BufReader::new(file)
        .lines()
        .map_while(Result::ok)
        .take(60)
    {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(v) = serde_json::from_str::<Value>(&line) {
            if let Some(c) = find_cwd(&v) {
                return Some(c);
            }
        }
    }
    None
}

fn cap(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        s.to_string()
    } else {
        let t: String = s.chars().take(n).collect();
        format!("{}…(已截断)", t)
    }
}

fn meta(path: &Path) -> (u64, String) {
    let m = path.metadata().ok();
    let size = m.as_ref().map(|x| x.len()).unwrap_or(0);
    let modified = m.and_then(|x| x.modified().ok()).map(fmt_time).unwrap_or_default();
    (size, modified)
}

// ============ Claude ============

fn claude_first_user_text(path: &Path) -> String {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return String::new(),
    };
    for line in std::io::BufReader::new(file).lines().map_while(Result::ok) {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(v) = serde_json::from_str::<Value>(&line) {
            if v.get("type").and_then(|x| x.as_str()) == Some("user") {
                if let Some(s) = v
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                {
                    let t: String = s.trim().chars().take(60).collect();
                    if !t.is_empty() {
                        return t;
                    }
                }
            }
        }
    }
    String::new()
}

fn list_claude(base: &Path) -> Vec<SessionInfo> {
    let projects = base.join("projects");
    let mut out = Vec::new();
    if let Ok(rd) = std::fs::read_dir(&projects) {
        for proj in rd.flatten() {
            if !proj.path().is_dir() {
                continue;
            }
            let project_name = proj.file_name().to_string_lossy().to_string();
            if let Ok(files) = std::fs::read_dir(proj.path()) {
                for f in files.flatten() {
                    let p = f.path();
                    if p.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                        continue;
                    }
                    let (size, modified) = meta(&p);
                    let id = p
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let mut title = claude_first_user_text(&p);
                    if title.is_empty() {
                        title = id.clone();
                    }
                    out.push(SessionInfo {
                        id,
                        path: p.to_string_lossy().to_string(),
                        title,
                        project: project_name.clone(),
                        modified,
                        size,
                        tool: "claude".into(),
                        cwd: extract_cwd(&p),
                    });
                }
            }
        }
    }
    out
}

fn tool_result_text(c: Option<&Value>) -> String {
    match c {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(arr)) => arr
            .iter()
            .filter_map(|b| b.get("text").and_then(|x| x.as_str()))
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

fn render_claude_message(md: &mut String, role: &str, v: &Value, include_thinking: bool) {
    let content = match v.get("message").and_then(|m| m.get("content")) {
        Some(c) => c,
        None => return,
    };
    let mut body = String::new();
    if let Some(s) = content.as_str() {
        body.push_str(s);
    } else if let Some(arr) = content.as_array() {
        for b in arr {
            match b.get("type").and_then(|x| x.as_str()).unwrap_or("") {
                "text" => {
                    if let Some(t) = b.get("text").and_then(|x| x.as_str()) {
                        body.push_str(t);
                        body.push_str("\n\n");
                    }
                }
                "thinking" => {
                    if include_thinking {
                        if let Some(t) = b.get("thinking").and_then(|x| x.as_str()) {
                            body.push_str("> 💭 思考\n>\n");
                            for line in t.lines() {
                                body.push_str("> ");
                                body.push_str(line);
                                body.push('\n');
                            }
                            body.push('\n');
                        }
                    }
                }
                "tool_use" => {
                    let name = b.get("name").and_then(|x| x.as_str()).unwrap_or("");
                    let input = b
                        .get("input")
                        .map(|i| serde_json::to_string_pretty(i).unwrap_or_default())
                        .unwrap_or_default();
                    body.push_str(&format!(
                        "<details><summary>工具调用: {}</summary>\n\n```json\n{}\n```\n</details>\n\n",
                        name,
                        cap(&input, 2000)
                    ));
                }
                "tool_result" => {
                    body.push_str(&format!(
                        "<details><summary>工具结果</summary>\n\n```\n{}\n```\n</details>\n\n",
                        cap(&tool_result_text(b.get("content")), 3000)
                    ));
                }
                _ => {}
            }
        }
    }
    let body = body.trim();
    if !body.is_empty() {
        md.push_str(&format!("## {}\n\n{}\n\n", role, body));
    }
}

fn build_md_claude(path: &Path, include_thinking: bool) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut md = String::new();
    for line in std::io::BufReader::new(file).lines().map_while(Result::ok) {
        if line.trim().is_empty() {
            continue;
        }
        let v: Value = match serde_json::from_str(&line) {
            Ok(x) => x,
            Err(_) => continue,
        };
        match v.get("type").and_then(|x| x.as_str()).unwrap_or("") {
            "user" => render_claude_message(&mut md, "用户", &v, include_thinking),
            "assistant" => render_claude_message(&mut md, "助手", &v, include_thinking),
            _ => {}
        }
    }
    Ok(md)
}

// ============ Codex ============

fn collect_rollouts(dir: &Path, out: &mut Vec<PathBuf>) {
    if let Ok(rd) = std::fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                collect_rollouts(&p, out);
            } else if p.extension().and_then(|x| x.to_str()) == Some("jsonl") {
                if let Some(n) = p.file_name().and_then(|x| x.to_str()) {
                    if n.starts_with("rollout-") {
                        out.push(p);
                    }
                }
            }
        }
    }
}

/// 从 codex content 块数组取文本(input_text / output_text / text)。
fn codex_block_text(content: &Value) -> String {
    let mut s = String::new();
    if let Some(arr) = content.as_array() {
        for b in arr {
            match b.get("type").and_then(|x| x.as_str()).unwrap_or("") {
                "input_text" | "output_text" | "text" | "summary_text" | "reasoning_text" => {
                    if let Some(t) = b.get("text").and_then(|x| x.as_str()) {
                        s.push_str(t);
                        s.push('\n');
                    }
                }
                _ => {}
            }
        }
    } else if let Some(t) = content.as_str() {
        s.push_str(t);
    }
    s.trim().to_string()
}

fn codex_first_user_text(path: &Path) -> String {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return String::new(),
    };
    for line in std::io::BufReader::new(file).lines().map_while(Result::ok) {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(v) = serde_json::from_str::<Value>(&line) {
            if v.get("type").and_then(|x| x.as_str()) == Some("response_item") {
                let pl = v.get("payload");
                let is_msg = pl.and_then(|p| p.get("type")).and_then(|x| x.as_str()) == Some("message");
                let role = pl.and_then(|p| p.get("role")).and_then(|x| x.as_str()).unwrap_or("");
                if is_msg && role == "user" {
                    if let Some(c) = pl.and_then(|p| p.get("content")) {
                        let t: String = codex_block_text(c).chars().take(60).collect();
                        if !t.is_empty() {
                            return t;
                        }
                    }
                }
            }
        }
    }
    String::new()
}

fn list_codex(base: &Path) -> Vec<SessionInfo> {
    let sessions = base.join("sessions");
    let mut files = Vec::new();
    collect_rollouts(&sessions, &mut files);
    let mut out = Vec::new();
    for p in files {
        let (size, modified) = meta(&p);
        let id = p
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let mut title = codex_first_user_text(&p);
        if title.is_empty() {
            title = id.clone();
        }
        out.push(SessionInfo {
            id,
            path: p.to_string_lossy().to_string(),
            title,
            project: "codex".into(),
            modified,
            size,
            tool: "codex".into(),
            cwd: extract_cwd(&p),
        });
    }
    out
}

fn build_md_codex(path: &Path, include_thinking: bool) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut md = String::new();
    for line in std::io::BufReader::new(file).lines().map_while(Result::ok) {
        if line.trim().is_empty() {
            continue;
        }
        let v: Value = match serde_json::from_str(&line) {
            Ok(x) => x,
            Err(_) => continue,
        };
        if v.get("type").and_then(|x| x.as_str()) != Some("response_item") {
            continue;
        }
        let pl = match v.get("payload") {
            Some(p) => p,
            None => continue,
        };
        match pl.get("type").and_then(|x| x.as_str()).unwrap_or("") {
            "message" => {
                let role = pl.get("role").and_then(|x| x.as_str()).unwrap_or("");
                let label = match role {
                    "user" => "用户",
                    "assistant" => "助手",
                    _ => continue, // 跳过 developer / system 指令
                };
                if let Some(c) = pl.get("content") {
                    let body = codex_block_text(c);
                    if !body.is_empty() {
                        md.push_str(&format!("## {}\n\n{}\n\n", label, body));
                    }
                }
            }
            "reasoning" => {
                if include_thinking {
                    let text = pl
                        .get("content")
                        .map(codex_block_text)
                        .filter(|s| !s.is_empty())
                        .or_else(|| pl.get("summary").map(codex_block_text))
                        .unwrap_or_default();
                    if !text.is_empty() {
                        md.push_str("> 💭 思考\n>\n");
                        for line in text.lines() {
                            md.push_str("> ");
                            md.push_str(line);
                            md.push('\n');
                        }
                        md.push('\n');
                    }
                }
            }
            "function_call" => {
                let name = pl.get("name").and_then(|x| x.as_str()).unwrap_or("");
                let args = pl.get("arguments").and_then(|x| x.as_str()).unwrap_or("");
                md.push_str(&format!(
                    "<details><summary>工具调用: {}</summary>\n\n```\n{}\n```\n</details>\n\n",
                    name,
                    cap(args, 2000)
                ));
            }
            "function_call_output" => {
                let out = pl
                    .get("output")
                    .and_then(|x| x.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| tool_result_text(pl.get("output")));
                md.push_str(&format!(
                    "<details><summary>工具结果</summary>\n\n```\n{}\n```\n</details>\n\n",
                    cap(&out, 3000)
                ));
            }
            _ => {}
        }
    }
    Ok(md)
}

// ============ 对外接口 ============

fn claude_base(config_dir: Option<&str>) -> PathBuf {
    match config_dir {
        Some(d) if !d.trim().is_empty() => PathBuf::from(d),
        _ => paths::claude_dir(),
    }
}
fn codex_base(config_dir: Option<&str>) -> PathBuf {
    match config_dir {
        Some(d) if !d.trim().is_empty() => PathBuf::from(d),
        _ => paths::codex_dir(),
    }
}

pub fn list_sessions(tool: &str, config_dir: Option<&str>) -> Vec<SessionInfo> {
    let mut out = match tool {
        "codex" => list_codex(&codex_base(config_dir)),
        _ => list_claude(&claude_base(config_dir)),
    };
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    out
}

fn build_md(tool: &str, path: &Path, include_thinking: bool) -> Result<String, String> {
    let header = format!("# 对话导出\n\n> 来源:`{}`\n\n", path.to_string_lossy());
    let body = match tool {
        "codex" => build_md_codex(path, include_thinking)?,
        _ => build_md_claude(path, include_thinking)?,
    };
    Ok(format!("{}{}", header, body))
}

pub fn export_to_file(
    data_dir: &Path,
    tool: &str,
    session_path: &str,
    include_thinking: bool,
    out_dir: Option<&str>,
) -> Result<String, String> {
    let path = PathBuf::from(session_path);
    let md = build_md(tool, &path, include_thinking)?;
    // 输出目录:优先用户指定;否则回退应用数据目录下的 exports
    let dir = match out_dir {
        Some(d) if !d.trim().is_empty() => PathBuf::from(d),
        _ => data_dir.join("exports"),
    };
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "session".to_string());
    let out = dir.join(format!("{}.md", stem));
    std::fs::write(&out, md.as_bytes()).map_err(|e| e.to_string())?;
    Ok(out.to_string_lossy().to_string())
}

pub fn preview_session(
    tool: &str,
    session_path: &str,
    include_thinking: bool,
) -> Result<String, String> {
    build_md(tool, &PathBuf::from(session_path), include_thinking)
}

pub fn delete_session(data_dir: &Path, session_path: &str) -> Result<(), String> {
    let path = PathBuf::from(session_path);
    snapshots::create(
        data_dir,
        "conversation",
        "auto",
        None,
        &format!(
            "删除会话 {}",
            path.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default()
        ),
        &[path.clone()],
    )?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_export_thinking_toggle() {
        let dir = std::env::temp_dir().join(format!("adc-conv-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let f = dir.join("s.jsonl");
        let lines = [
            r#"{"type":"user","message":{"role":"user","content":"你好"}}"#,
            r#"{"type":"assistant","message":{"role":"assistant","content":[{"type":"thinking","thinking":"内心想法"},{"type":"text","text":"你好,我能帮你"}]}}"#,
        ];
        std::fs::write(&f, lines.join("\n")).unwrap();
        let with = build_md("claude", &f, true).unwrap();
        let without = build_md("claude", &f, false).unwrap();
        assert!(with.contains("## 用户") && with.contains("你好,我能帮你"));
        assert!(with.contains("内心想法") && !without.contains("内心想法"));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn codex_export_parses_response_items() {
        let dir = std::env::temp_dir().join(format!("adc-cx-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let f = dir.join("rollout-x.jsonl");
        let lines = [
            r#"{"type":"session_meta","payload":{}}"#,
            r#"{"type":"response_item","payload":{"type":"message","role":"developer","content":[{"type":"input_text","text":"系统指令"}]}}"#,
            r#"{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"帮我写代码"}]}}"#,
            r#"{"type":"response_item","payload":{"type":"reasoning","content":[{"type":"reasoning_text","text":"思考中"}]}}"#,
            r#"{"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"好的"}]}}"#,
        ];
        std::fs::write(&f, lines.join("\n")).unwrap();
        let with = build_md("codex", &f, true).unwrap();
        let without = build_md("codex", &f, false).unwrap();
        assert!(with.contains("## 用户") && with.contains("帮我写代码"));
        assert!(with.contains("## 助手") && with.contains("好的"));
        assert!(!with.contains("系统指令")); // developer 跳过
        assert!(with.contains("思考中") && !without.contains("思考中"));
        std::fs::remove_dir_all(&dir).ok();
    }
}
