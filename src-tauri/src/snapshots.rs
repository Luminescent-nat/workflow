//! 通用快照 / 还原引擎(功能10 底座)。
//! 所有"改环境"动作:先 snapshot 受影响文件,再写入,失败可 restore。
//! scope 例:provider:claude / skills / mcp / role / workspace:<id> / baseline

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct FileRecord {
    /// 原始绝对路径
    pub original: String,
    /// 快照目录内的存储文件名
    pub stored: String,
    /// 快照时该路径是否存在(还原时用于决定是恢复还是删除)
    pub existed: bool,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SnapshotManifest {
    pub id: String,
    pub scope: String,
    pub kind: String, // baseline | named | auto
    pub label: Option<String>,
    pub created_at: String,
    pub note: String,
    pub files: Vec<FileRecord>,
}

fn snapshots_root(data_dir: &Path) -> PathBuf {
    data_dir.join("snapshots")
}

/// scope 可能含 ':' '/'(如 provider:claude、ws:<path>),需净化为合法目录名(Windows)。
fn scope_path(data_dir: &Path, scope: &str) -> PathBuf {
    let safe: String = scope
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    snapshots_root(data_dir).join(safe)
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

/// 为一组文件/目录创建快照,返回 manifest。
pub fn create(
    data_dir: &Path,
    scope: &str,
    kind: &str,
    label: Option<String>,
    note: &str,
    files: &[PathBuf],
) -> Result<SnapshotManifest, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let dir = scope_path(data_dir, scope).join(&id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let mut records = Vec::new();
    for (i, f) in files.iter().enumerate() {
        let existed = f.exists();
        let base_name = f
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "file".to_string());
        let stored_name = format!("{}__{}", i, base_name);
        let stored_path = dir.join(&stored_name);
        if existed {
            if f.is_dir() {
                copy_dir_all(f, &stored_path).map_err(|e| e.to_string())?;
            } else {
                fs::copy(f, &stored_path).map_err(|e| e.to_string())?;
            }
        }
        records.push(FileRecord {
            original: f.to_string_lossy().to_string(),
            stored: stored_name,
            existed,
        });
    }

    let manifest = SnapshotManifest {
        id,
        scope: scope.to_string(),
        kind: kind.to_string(),
        label,
        created_at: chrono::Local::now().to_rfc3339(),
        note: note.to_string(),
        files: records,
    };
    let bytes = serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(dir.join("manifest.json"), bytes).map_err(|e| e.to_string())?;
    Ok(manifest)
}

/// 列出某 scope 下的快照(新→旧)。
pub fn list(data_dir: &Path, scope: &str) -> Vec<SnapshotManifest> {
    let dir = scope_path(data_dir, scope);
    let mut out = Vec::new();
    if let Ok(rd) = fs::read_dir(&dir) {
        for e in rd.flatten() {
            let manifest_path = e.path().join("manifest.json");
            if let Ok(bytes) = fs::read(&manifest_path) {
                if let Ok(m) = serde_json::from_slice::<SnapshotManifest>(&bytes) {
                    out.push(m);
                }
            }
        }
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    out
}

/// 还原指定快照:存在的恢复,快照时不存在的则删除当前。
pub fn restore(data_dir: &Path, scope: &str, id: &str) -> Result<(), String> {
    let dir = scope_path(data_dir, scope).join(id);
    let bytes = fs::read(dir.join("manifest.json")).map_err(|e| e.to_string())?;
    let manifest: SnapshotManifest =
        serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;

    for rec in &manifest.files {
        let original = PathBuf::from(&rec.original);
        let stored = dir.join(&rec.stored);
        if rec.existed {
            if stored.is_dir() {
                if original.exists() {
                    let _ = fs::remove_dir_all(&original);
                }
                copy_dir_all(&stored, &original).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = original.parent() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
                fs::copy(&stored, &original).map_err(|e| e.to_string())?;
            }
        } else if original.is_dir() {
            let _ = fs::remove_dir_all(&original);
        } else if original.exists() {
            let _ = fs::remove_file(&original);
        }
    }
    Ok(())
}

/// 跨所有 scope 列举快照(新→旧),供快照管理 UI。
pub fn list_all(data_dir: &Path) -> Vec<SnapshotManifest> {
    let root = snapshots_root(data_dir);
    let mut out = Vec::new();
    if let Ok(rd) = fs::read_dir(&root) {
        for scope_dir in rd.flatten() {
            if !scope_dir.path().is_dir() {
                continue;
            }
            if let Ok(items) = fs::read_dir(scope_dir.path()) {
                for it in items.flatten() {
                    let m = it.path().join("manifest.json");
                    if let Ok(bytes) = fs::read(&m) {
                        if let Ok(man) = serde_json::from_slice::<SnapshotManifest>(&bytes) {
                            out.push(man);
                        }
                    }
                }
            }
        }
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_restore_roundtrip_with_colon_scope() {
        let data = std::env::temp_dir().join(format!("adc-snap-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&data).unwrap();
        let target = data.join("settings.json");
        std::fs::write(&target, "original").unwrap();

        let m = create(&data, "provider:claude", "auto", None, "t", &[target.clone()]).unwrap();
        std::fs::write(&target, "modified").unwrap();
        restore(&data, "provider:claude", &m.id).unwrap();

        assert_eq!(std::fs::read_to_string(&target).unwrap(), "original");
        assert!(!list(&data, "provider:claude").is_empty());
        assert!(!list_all(&data).is_empty());
        std::fs::remove_dir_all(&data).ok();
    }
}
