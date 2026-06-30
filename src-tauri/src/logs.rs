//! 结构化日志:内存环形缓冲 + 追加落盘。作为调试中心的数据源。

use std::collections::VecDeque;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct LogEntry {
    pub ts: String,
    pub level: String,
    pub module: String,
    pub message: String,
}

pub struct LogBuffer {
    entries: VecDeque<LogEntry>,
    file: PathBuf,
    capacity: usize,
}

impl LogBuffer {
    pub fn new(file: PathBuf) -> Self {
        Self {
            entries: VecDeque::new(),
            file,
            capacity: 2000,
        }
    }

    pub fn push(&mut self, level: &str, module: &str, message: impl Into<String>) {
        let entry = LogEntry {
            ts: chrono::Local::now().to_rfc3339(),
            level: level.to_string(),
            module: module.to_string(),
            message: message.into(),
        };
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&self.file) {
            if let Ok(line) = serde_json::to_string(&entry) {
                let _ = writeln!(f, "{}", line);
            }
        }
        self.entries.push_back(entry);
        while self.entries.len() > self.capacity {
            self.entries.pop_front();
        }
    }

    /// 返回最近 limit 条(新→旧)。
    pub fn recent(&self, limit: usize) -> Vec<LogEntry> {
        self.entries.iter().rev().take(limit).cloned().collect()
    }
}
