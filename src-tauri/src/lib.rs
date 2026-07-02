// MVP 阶段:基座模块的部分 API 暂未被全部调用,先放开 dead_code 警告。
#![allow(dead_code)]

mod conversations;
mod env_detect;
mod installer;
mod logs;
mod market;
mod paths;
mod providers;
mod roles;
mod snapshots;
mod state;
mod store;
mod util;
mod workspaces;

use std::sync::Mutex;

use tauri::Manager;

use conversations::SessionInfo;
use logs::LogEntry;
use market::{McpServer, SkillItem};
use providers::Provider;
use state::AppState;
use util::CmdOutput;
use workspaces::Workspace;

#[derive(serde::Serialize)]
pub struct AppInfo {
    name: String,
    version: String,
    update_version: String,
    data_dir: String,
}

#[tauri::command]
fn app_info(state: tauri::State<AppState>) -> AppInfo {
    AppInfo {
        name: "Auto flows".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        update_version: option_env!("AI_DEV_CONSOLE_UPDATE_VERSION")
            .unwrap_or(env!("CARGO_PKG_VERSION"))
            .to_string(),
        data_dir: state.data_dir.to_string_lossy().to_string(),
    }
}

#[tauri::command]
fn read_logs(state: tauri::State<AppState>, limit: Option<usize>) -> Vec<LogEntry> {
    match state.logs.lock() {
        Ok(buf) => buf.recent(limit.unwrap_or(500)),
        Err(_) => Vec::new(),
    }
}

// ---- 功能1/2/3 环境 ----

#[tauri::command]
async fn detect_environment(state: tauri::State<'_, AppState>) -> Result<Vec<env_detect::ToolStatus>, String> {
    let list = tauri::async_runtime::spawn_blocking(env_detect::detect_all)
        .await
        .map_err(|e| e.to_string())?;
    state.log("info", "env", format!("环境检测完成: {} 项", list.len()));
    Ok(list)
}

#[tauri::command]
async fn install_tool(state: tauri::State<'_, AppState>, target: String) -> Result<CmdOutput, String> {
    state.log("info", "installer", format!("开始安装: {}", target));
    let target_for_task = target.clone();
    let out = tauri::async_runtime::spawn_blocking(move || installer::install(&target_for_task))
        .await
        .map_err(|e| e.to_string())?;
    util::refresh_process_path();
    state.log(
        if out.success { "info" } else { "error" },
        "installer",
        format!("安装结束 {}: success={} code={:?}", target, out.success, out.code),
    );
    Ok(out)
}

#[tauri::command]
async fn uninstall_tool(state: tauri::State<'_, AppState>, target: String) -> Result<CmdOutput, String> {
    state.log("info", "installer", format!("开始卸载: {}", target));
    let target_for_task = target.clone();
    let out = tauri::async_runtime::spawn_blocking(move || installer::uninstall(&target_for_task))
        .await
        .map_err(|e| e.to_string())?;
    util::refresh_process_path();
    state.log(
        if out.success { "info" } else { "error" },
        "installer",
        format!("卸载结束 {}: success={}", target, out.success),
    );
    Ok(out)
}

#[tauri::command]
async fn update_tool(state: tauri::State<'_, AppState>, target: String) -> Result<CmdOutput, String> {
    state.log("info", "installer", format!("开始更新: {}", target));
    let target_for_task = target.clone();
    let out = tauri::async_runtime::spawn_blocking(move || installer::update(&target_for_task))
        .await
        .map_err(|e| e.to_string())?;
    util::refresh_process_path();
    state.log(
        if out.success { "info" } else { "error" },
        "installer",
        format!("更新结束 {}: success={}", target, out.success),
    );
    Ok(out)
}

// ---- 功能4 供应商 ----

#[tauri::command]
fn list_providers(state: tauri::State<AppState>, tool: String) -> Vec<Provider> {
    let cfg = state.config.lock().expect("config lock");
    providers::list(&cfg.providers, &tool)
}

#[tauri::command]
fn upsert_provider(state: tauri::State<AppState>, provider: Provider) -> Result<Provider, String> {
    let saved = {
        let mut cfg = state.config.lock().map_err(|_| "配置锁定失败".to_string())?;
        providers::upsert(&mut cfg.providers, provider)
    };
    state.save_config()?;
    state.log("info", "providers", format!("保存供应商: {} ({})", saved.name, saved.tool));
    Ok(saved)
}

#[tauri::command]
fn delete_provider(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    {
        let mut cfg = state.config.lock().map_err(|_| "配置锁定失败".to_string())?;
        providers::delete(&mut cfg.providers, &id);
    }
    state.save_config()?;
    state.log("info", "providers", format!("删除供应商: {}", id));
    Ok(())
}

#[tauri::command]
fn switch_provider(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    {
        let mut cfg = state.config.lock().map_err(|_| "配置锁定失败".to_string())?;
        providers::switch(&mut cfg.providers, &state.data_dir, &id)?;
    }
    state.save_config()?;
    state.log("info", "providers", format!("切换供应商: {}", id));
    Ok(())
}

#[tauri::command]
fn import_current_provider(tool: String) -> Result<Provider, String> {
    providers::import_current(&tool)
}

// ---- 功能5 市场(Skills + MCP)----

#[tauri::command]
fn list_skills(state: tauri::State<AppState>) -> Vec<SkillItem> {
    market::skills_catalog(&state.data_dir)
}

#[tauri::command]
fn install_skill(state: tauri::State<AppState>, id: String, target: Option<String>) -> Result<(), String> {
    let target = target.unwrap_or_else(|| "claude".to_string());
    let r = market::install_skill_for(&state.data_dir, &id, &target);
    state.log(
        if r.is_ok() { "info" } else { "error" },
        "market",
        format!("安装 skill {} -> {}: {}", id, target, if r.is_ok() { "ok".into() } else { format!("{:?}", r) }),
    );
    r
}

#[tauri::command]
fn remove_skill(state: tauri::State<AppState>, id: String, target: Option<String>) -> Result<(), String> {
    let target = target.unwrap_or_else(|| "both".to_string());
    let r = market::remove_skill_for(&state.data_dir, &id, &target);
    state.log("info", "market", format!("移除 skill {} -> {}", id, target));
    r
}

#[tauri::command]
fn list_mcp(state: tauri::State<AppState>) -> Vec<McpServer> {
    market::mcp_catalog(&state.data_dir)
}

#[tauri::command]
fn apply_mcp(
    state: tauri::State<AppState>,
    server: McpServer,
    targets: Vec<String>,
) -> Result<(), String> {
    let r = market::apply_mcp(&state.data_dir, &server, &targets);
    state.log(
        if r.is_ok() { "info" } else { "error" },
        "market",
        format!("配置 MCP {} → {:?}", server.name, targets),
    );
    r
}

#[tauri::command]
fn import_mcp(target: String) -> Result<Vec<McpServer>, String> {
    market::import_mcp(&target)
}

#[tauri::command]
fn remove_mcp(
    state: tauri::State<AppState>,
    name: String,
    targets: Vec<String>,
) -> Result<(), String> {
    let r = market::remove_mcp(&state.data_dir, &name, &targets);
    state.log("info", "market", format!("移除 MCP {} ← {:?}", name, targets));
    r
}

#[tauri::command]
async fn refresh_catalog(state: tauri::State<'_, AppState>, url: String) -> Result<String, String> {
    let dir = state.data_dir.clone();
    let r = market::refresh_catalog(&dir, &url).await;
    state.log(
        if r.is_ok() { "info" } else { "error" },
        "market",
        format!("在线刷新目录: {}", if r.is_ok() { "ok".into() } else { format!("{:?}", r) }),
    );
    r
}

// ---- 功能6 角色工作流 ----

#[tauri::command]
fn list_roles() -> roles::RolesView {
    roles::view()
}

#[tauri::command]
fn apply_role(state: tauri::State<AppState>, id: String, scope: String) -> Result<(), String> {
    let r = roles::apply(&state.data_dir, &id, &scope);
    state.log(
        if r.is_ok() { "info" } else { "error" },
        "roles",
        format!("应用角色包 {} ({})", id, scope),
    );
    r
}

#[tauri::command]
fn remove_role(state: tauri::State<AppState>, id: String, scope: String) -> Result<(), String> {
    let r = roles::remove(&state.data_dir, &id, &scope);
    state.log("info", "roles", format!("移除角色包 {} ({})", id, scope));
    r
}

// ---- 功能8 工作区 ----

#[tauri::command]
fn list_workspaces(state: tauri::State<AppState>) -> Vec<Workspace> {
    state.config.lock().map(|c| c.workspaces.clone()).unwrap_or_default()
}

#[tauri::command]
fn upsert_workspace(
    state: tauri::State<AppState>,
    workspace: Workspace,
) -> Result<Workspace, String> {
    let saved = {
        let mut cfg = state.config.lock().map_err(|_| "配置锁定失败".to_string())?;
        workspaces::upsert(&mut cfg.workspaces, workspace)
    };
    state.save_config()?;
    state.log("info", "workspaces", format!("保存工作区: {}", saved.name));
    Ok(saved)
}

#[tauri::command]
fn delete_workspace(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    {
        let mut cfg = state.config.lock().map_err(|_| "配置锁定失败".to_string())?;
        workspaces::delete(&mut cfg.workspaces, &id);
    }
    state.save_config()?;
    state.log("info", "workspaces", format!("删除工作区: {}", id));
    Ok(())
}

#[tauri::command]
async fn materialize_workspace(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let (ws, provs) = {
        let cfg = state.config.lock().map_err(|_| "配置锁定失败".to_string())?;
        let ws = cfg
            .workspaces
            .iter()
            .find(|w| w.id == id)
            .cloned()
            .ok_or_else(|| "工作区不存在".to_string())?;
        (ws, cfg.providers.clone())
    };
    let data_dir = state.data_dir.clone();
    let ws_for_task = ws.clone();
    let r = tauri::async_runtime::spawn_blocking(move || {
        workspaces::materialize(&data_dir, &ws_for_task, &provs)
    })
    .await
    .map_err(|e| e.to_string())?;
    state.log(
        if r.is_ok() { "info" } else { "error" },
        "workspaces",
        format!("物化工作区 {}", ws.name),
    );
    r
}

#[tauri::command]
async fn launch_workspace(
    state: tauri::State<'_, AppState>,
    id: String,
    tool: String,
) -> Result<(), String> {
    let (ws, provs) = {
        let cfg = state.config.lock().map_err(|_| "配置锁定失败".to_string())?;
        let ws = cfg
            .workspaces
            .iter()
            .find(|w| w.id == id)
            .cloned()
            .ok_or_else(|| "工作区不存在".to_string())?;
        (ws, cfg.providers.clone())
    };
    let data_dir = state.data_dir.clone();
    let ws_for_task = ws.clone();
    let tool_for_task = tool.clone();
    let r = tauri::async_runtime::spawn_blocking(move || {
        workspaces::materialize(&data_dir, &ws_for_task, &provs)?;
        workspaces::launch(&ws_for_task, &tool_for_task)
    })
    .await
    .map_err(|e| e.to_string())?;
    state.log(
        if r.is_ok() { "info" } else { "error" },
        "workspaces",
        format!("启动工作区 {} ({})", ws.name, tool),
    );
    r
}

// ---- 功能9 会话 ----

#[tauri::command]
fn list_sessions(tool: String, config_dir: Option<String>) -> Vec<SessionInfo> {
    conversations::list_sessions(&tool, config_dir.as_deref())
}

#[tauri::command]
fn export_session(
    state: tauri::State<AppState>,
    tool: String,
    path: String,
    include_thinking: bool,
    out_dir: Option<String>,
) -> Result<String, String> {
    let r = conversations::export_to_file(
        &state.data_dir,
        &tool,
        &path,
        include_thinking,
        out_dir.as_deref(),
    );
    state.log(
        "info",
        "conversations",
        format!("导出会话 {} (思考={})", path, include_thinking),
    );
    r
}

#[tauri::command]
fn preview_session(
    tool: String,
    path: String,
    include_thinking: bool,
) -> Result<String, String> {
    conversations::preview_session(&tool, &path, include_thinking)
}

/// 弹原生文件夹选择器,返回所选目录(取消返回 None)。default_dir 作为初始目录。
#[tauri::command]
fn pick_export_dir(app: tauri::AppHandle, default_dir: Option<String>) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let mut builder = app.dialog().file();
    if let Some(d) = default_dir.filter(|s| !s.trim().is_empty()) {
        builder = builder.set_directory(d);
    }
    builder.blocking_pick_folder().map(|p| p.to_string())
}

/// 通用文件夹选择器(工作区项目路径用)。
#[tauri::command]
fn pick_directory(app: tauri::AppHandle, default_dir: Option<String>) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let mut builder = app.dialog().file();
    if let Some(d) = default_dir.filter(|s| !s.trim().is_empty()) {
        builder = builder.set_directory(d);
    }
    builder.blocking_pick_folder().map(|p| p.to_string())
}

/// 测试供应商连接:对 base_url 做一次最小请求,诊断证书/DNS/网络/认证层问题。
/// 返回人类可读的诊断结论。
#[tauri::command]
async fn test_provider(base_url: String) -> Result<String, String> {
    let url = base_url.trim().trim_end_matches('/').to_string();
    if url.is_empty() {
        return Err("Base URL 为空".to_string());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    match client.get(&url).send().await {
        Ok(resp) => Ok(format!(
            "连接正常(HTTP {})。网关可达,TLS 握手成功。",
            resp.status().as_u16()
        )),
        Err(e) => {
            let s = e.to_string();
            let hint = if s.contains("certificate") || s.contains("tls") || s.contains("ssl") {
                "TLS/证书验证失败:网关证书无效,或 DNS 被解析到证书不匹配的节点(常见于代理/加速工具)。建议检查代理或更换供应商节点。"
            } else if s.contains("dns") || s.contains("resolve") || s.contains("lookup") {
                "DNS 解析失败:无法解析该域名。检查网络或域名是否正确。"
            } else if s.contains("timed out") || s.contains("timeout") {
                "连接超时:网关无响应。检查网络或更换节点。"
            } else if s.contains("connect") {
                "无法建立连接:网关不可达。检查网络/防火墙/代理。"
            } else {
                "连接失败。"
            };
            Err(format!("{} (原始错误: {})", hint, s))
        }
    }
}

#[tauri::command]
fn delete_session(state: tauri::State<AppState>, path: String) -> Result<(), String> {
    let r = conversations::delete_session(&state.data_dir, &path);
    state.log("info", "conversations", format!("删除会话 {}", path));
    r
}

// ---- 功能10 快照 / 还原 ----

#[tauri::command]
fn list_all_snapshots(state: tauri::State<AppState>) -> Vec<snapshots::SnapshotManifest> {
    snapshots::list_all(&state.data_dir)
}

#[tauri::command]
fn restore_snapshot(
    state: tauri::State<AppState>,
    scope: String,
    id: String,
) -> Result<(), String> {
    let r = snapshots::restore(&state.data_dir, &scope, &id);
    state.log(
        if r.is_ok() { "info" } else { "error" },
        "snapshots",
        format!("还原快照 {} ({})", id, scope),
    );
    r
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let data_dir = dirs::data_dir()
                .unwrap_or_else(std::env::temp_dir)
                .join("auto-flows");
            let _ = std::fs::create_dir_all(&data_dir);

            let log_file = data_dir.join("logs").join("app.log");
            if let Some(p) = log_file.parent() {
                let _ = std::fs::create_dir_all(p);
            }
            let mut log_buffer = logs::LogBuffer::new(log_file);
            log_buffer.push("info", "app", "应用启动");

            let config_path = data_dir.join("config.json");
            let config = store::load(&config_path);

            app.manage(AppState {
                data_dir,
                config_path,
                config: Mutex::new(config),
                logs: Mutex::new(log_buffer),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            read_logs,
            detect_environment,
            install_tool,
            uninstall_tool,
            update_tool,
            list_providers,
            upsert_provider,
            delete_provider,
            switch_provider,
            import_current_provider,
            list_skills,
            install_skill,
            remove_skill,
            list_mcp,
            apply_mcp,
            import_mcp,
            remove_mcp,
            refresh_catalog,
            list_roles,
            apply_role,
            remove_role,
            list_workspaces,
            upsert_workspace,
            delete_workspace,
            materialize_workspace,
            launch_workspace,
            list_sessions,
            export_session,
            preview_session,
            delete_session,
            pick_export_dir,
            pick_directory,
            test_provider,
            list_all_snapshots,
            restore_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
