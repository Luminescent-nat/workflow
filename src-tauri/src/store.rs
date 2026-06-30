//! SSOT 持久化:data_dir/config.json 保存供应商等配置。

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::providers::Provider;
use crate::util;
use crate::workspaces::Workspace;

#[derive(Serialize, Deserialize, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub providers: Vec<Provider>,
    #[serde(default)]
    pub workspaces: Vec<Workspace>,
}

pub fn load(path: &Path) -> AppConfig {
    match util::read_json(path) {
        Ok(serde_json::Value::Null) => AppConfig::default(),
        Ok(v) => serde_json::from_value(v).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save(path: &Path, cfg: &AppConfig) -> Result<(), String> {
    let v = serde_json::to_value(cfg).map_err(|e| e.to_string())?;
    util::write_json(path, &v)
}
