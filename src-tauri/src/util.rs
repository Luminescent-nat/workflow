//! 通用工具:进程执行、原子写、JSON 深合并。

use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::process::Command;

use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
pub struct CmdOutput {
    pub success: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[cfg(windows)]
fn registry_path(scope: &str) -> Option<String> {
    let key = match scope {
        "user" => r"HKCU\Environment",
        "machine" => r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
        _ => return None,
    };
    let out = run_raw("reg", &["query", key, "/v", "Path"]);
    if !out.success {
        return None;
    }
    out.stdout.lines().find_map(|line| {
        let text = line.trim_start();
        if !text.starts_with("Path") {
            return None;
        }
        let mut parts = text.split_whitespace();
        let _name = parts.next()?;
        let _typ = parts.next()?;
        Some(parts.collect::<Vec<_>>().join(" "))
    })
}

#[cfg(windows)]
fn expanded_path(raw: &str) -> String {
    let mut out = String::new();
    let mut rest = raw;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        if let Some(end) = after.find('%') {
            let name = &after[..end];
            match std::env::var(name) {
                Ok(value) => out.push_str(&value),
                Err(_) => {
                    out.push('%');
                    out.push_str(name);
                    out.push('%');
                }
            }
            rest = &after[end + 1..];
        } else {
            out.push_str(&rest[start..]);
            rest = "";
        }
    }
    out.push_str(rest);
    out
}

#[cfg(windows)]
fn merged_windows_path() -> Option<String> {
    let mut seen = HashSet::new();
    let mut parts = Vec::new();
    for raw in [
        std::env::var("PATH").ok(),
        registry_path("machine").map(|s| expanded_path(&s)),
        registry_path("user").map(|s| expanded_path(&s)),
    ]
    .into_iter()
    .flatten()
    {
        for p in raw.split(';').map(str::trim).filter(|p| !p.is_empty()) {
            let key = p.to_ascii_lowercase();
            if seen.insert(key) {
                parts.push(p.to_string());
            }
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join(";"))
    }
}

#[cfg(not(windows))]
fn merged_windows_path() -> Option<String> {
    None
}

pub fn refresh_process_path() {
    if let Some(path) = merged_windows_path() {
        std::env::set_var("PATH", path);
    }
}

pub fn apply_fresh_path(cmd: &mut Command) {
    if let Some(path) = merged_windows_path() {
        cmd.env("PATH", path);
    }
}

/// 直接运行程序并捕获输出(阻塞至结束)。Windows 下抑制控制台窗口闪烁。
fn run_raw(program: &str, args: &[&str]) -> CmdOutput {
    let mut cmd = Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    match cmd.output() {
        Ok(o) => CmdOutput {
            success: o.status.success(),
            code: o.status.code(),
            stdout: String::from_utf8_lossy(&o.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&o.stderr).into_owned(),
        },
        Err(e) => CmdOutput {
            success: false,
            code: None,
            stdout: String::new(),
            stderr: e.to_string(),
        },
    }
}

/// 通过 `cmd /C` 运行,用于解析 .cmd/.ps1 shim(npm / claude / codex 等)。
pub fn run_via_cmd(tool: &str, args: &[&str]) -> CmdOutput {
    let mut full: Vec<&str> = vec!["/C", tool];
    full.extend_from_slice(args);
    run("cmd", &full)
}

/// 原子写:先写临时文件再 rename(Windows 上 rename 可覆盖既有文件)。
pub fn atomic_write(path: &Path, contents: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp-write");
    fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

/// 读取 JSON 文件;文件不存在或为空时返回 null。
pub fn read_json(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(Value::Null);
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

/// 美化写出 JSON(原子)。
pub fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    atomic_write(path, &bytes)
}

/// 深合并:overlay 覆盖 base,对象递归合并,其它类型整体替换。
pub fn deep_merge(base: &mut Value, overlay: &Value) {
    match (base, overlay) {
        (Value::Object(b), Value::Object(o)) => {
            for (k, v) in o {
                deep_merge(b.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
        (b, o) => {
            *b = o.clone();
        }
    }
}

pub fn run(program: &str, args: &[&str]) -> CmdOutput {
    let mut cmd = Command::new(program);
    cmd.args(args);
    apply_fresh_path(&mut cmd);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    match cmd.output() {
        Ok(o) => CmdOutput {
            success: o.status.success(),
            code: o.status.code(),
            stdout: String::from_utf8_lossy(&o.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&o.stderr).into_owned(),
        },
        Err(e) => CmdOutput {
            success: false,
            code: None,
            stdout: String::new(),
            stderr: e.to_string(),
        },
    }
}
