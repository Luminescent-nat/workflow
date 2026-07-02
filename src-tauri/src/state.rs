//! 应用全局状态。Tauri 通过 State<AppState> 注入到各 command。

use std::path::PathBuf;
use std::sync::Mutex;

use crate::logs::LogBuffer;
use crate::store::AppConfig;

pub struct AppState {
    /// 应用数据目录(%APPDATA%/auto-flows)
    pub data_dir: PathBuf,
    /// SSOT 配置文件路径(config.json)
    pub config_path: PathBuf,
    /// SSOT 配置(供应商等)
    pub config: Mutex<AppConfig>,
    /// 内存日志缓冲 + 落盘(调试中心数据源)
    pub logs: Mutex<LogBuffer>,
}

impl AppState {
    pub fn log(&self, level: &str, module: &str, message: impl Into<String>) {
        if let Ok(mut buf) = self.logs.lock() {
            buf.push(level, module, message);
        }
    }

    /// 持久化 SSOT 配置到磁盘。
    pub fn save_config(&self) -> Result<(), String> {
        let cfg = self.config.lock().map_err(|_| "配置锁定失败".to_string())?;
        crate::store::save(&self.config_path, &cfg)
    }
}
