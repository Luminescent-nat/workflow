//! 通用工具:进程执行、原子写、JSON 深合并。

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

/// 直接运行程序并捕获输出(阻塞至结束)。Windows 下抑制控制台窗口闪烁。
pub fn run(program: &str, args: &[&str]) -> CmdOutput {
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
