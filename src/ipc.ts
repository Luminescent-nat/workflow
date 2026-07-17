import { invoke } from "@tauri-apps/api/core";

export interface AppInfo {
  name: string;
  version: string;
  update_version: string;
  data_dir: string;
}

export type ToolCategory = "runtime" | "cli" | "desktop";

export interface ToolStatus {
  key: string;
  name: string;
  category: ToolCategory;
  installed: boolean;
  version: string | null;
  available_version: string | null;
  note: string | null;
  install_target: string | null;
}

export interface CmdOutput {
  success: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface LogEntry {
  ts: string;
  level: string;
  module: string;
  message: string;
}

export type Tool = "claude" | "codex";

export interface Provider {
  id: string;
  tool: Tool;
  name: string;
  base_url: string;
  key: string;
  model: string | null;
  wire_api: string | null;
  active: boolean;
}

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  installed: boolean;
  claude_installed: boolean;
  codex_installed: boolean;
}

export type McpTarget = "claude_code" | "claude_desktop" | "codex";

export interface McpServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface TemplateFile {
  name: string;
  content: string;
}

export interface WorkflowStep {
  name: string;
  description: string;
  command: string | null;
}

export interface RolePack {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: WorkflowStep[];
  agents: TemplateFile[];
  commands: TemplateFile[];
  memory: string | null;
  applied: boolean;
  claude_applied: boolean;
  codex_applied: boolean;
}

export interface OfficialInstaller {
  id: string;
  name: string;
  description: string;
  command: string;
}

export interface RolesView {
  packs: RolePack[];
  installers: OfficialInstaller[];
}

export interface Workspace {
  id: string;
  name: string;
  project_path: string;
  tool: "claude" | "codex" | "both";
  provider_id: string | null;
  claude_provider_id: string | null;
  codex_provider_id: string | null;
  model: string | null;
  skills: string[];
  role_id: string | null;
}

export interface SessionInfo {
  id: string;
  path: string;
  title: string;
  project: string;
  modified: string;
  size: number;
  tool: string;
  cwd: string | null;
}

export interface FileRecord {
  original: string;
  stored: string;
  existed: boolean;
}

export interface SnapshotManifest {
  id: string;
  scope: string;
  kind: string;
  label: string | null;
  created_at: string;
  note: string;
  files: FileRecord[];
}

/**
 * 强类型的 IPC 封装。随各功能模块实现逐步扩充。
 */
export const ipc = {
  appInfo: () => invoke<AppInfo>("app_info"),
  readLogs: (limit?: number) => invoke<LogEntry[]>("read_logs", { limit }),

  // 功能 1/2/3 环境
  detectEnvironment: () => invoke<ToolStatus[]>("detect_environment"),
  installTool: (target: string) => invoke<CmdOutput>("install_tool", { target }),
  uninstallTool: (target: string) => invoke<CmdOutput>("uninstall_tool", { target }),
  updateTool: (target: string) => invoke<CmdOutput>("update_tool", { target }),

  // 功能 4 供应商
  listProviders: (tool: Tool) => invoke<Provider[]>("list_providers", { tool }),
  upsertProvider: (provider: Provider) => invoke<Provider>("upsert_provider", { provider }),
  deleteProvider: (id: string) => invoke<void>("delete_provider", { id }),
  switchProvider: (id: string) => invoke<void>("switch_provider", { id }),
  importCurrentProvider: (tool: Tool) =>
    invoke<Provider>("import_current_provider", { tool }),

  // 功能 5 市场(Skills + MCP)
  listSkills: () => invoke<SkillItem[]>("list_skills"),
  installSkill: (id: string, target?: "claude" | "codex" | "both") =>
    invoke<void>("install_skill", { id, target }),
  removeSkill: (id: string, target?: "claude" | "codex" | "both") =>
    invoke<void>("remove_skill", { id, target }),
  listMcp: () => invoke<McpServer[]>("list_mcp"),
  applyMcp: (server: McpServer, targets: McpTarget[]) =>
    invoke<void>("apply_mcp", { server, targets }),
  importMcp: (target: McpTarget) => invoke<McpServer[]>("import_mcp", { target }),
  removeMcp: (name: string, targets: McpTarget[]) =>
    invoke<void>("remove_mcp", { name, targets }),
  refreshCatalog: (url: string) => invoke<string>("refresh_catalog", { url }),

  // 功能 6 角色工作流
  listRoles: () => invoke<RolesView>("list_roles"),
  applyRole: (id: string, scope: string) => invoke<void>("apply_role", { id, scope }),
  removeRole: (id: string, scope: string) => invoke<void>("remove_role", { id, scope }),

  // 功能 8 工作区
  listWorkspaces: () => invoke<Workspace[]>("list_workspaces"),
  upsertWorkspace: (workspace: Workspace) =>
    invoke<Workspace>("upsert_workspace", { workspace }),
  deleteWorkspace: (id: string) => invoke<void>("delete_workspace", { id }),
  materializeWorkspace: (id: string) => invoke<void>("materialize_workspace", { id }),
  launchWorkspace: (id: string, tool: string) =>
    invoke<void>("launch_workspace", { id, tool }),

  // 功能 9 会话
  listSessions: (tool: string, configDir?: string) =>
    invoke<SessionInfo[]>("list_sessions", { tool, configDir }),
  exportSession: (
    tool: string,
    path: string,
    includeThinking: boolean,
    outDir?: string,
  ) => invoke<string>("export_session", { tool, path, includeThinking, outDir }),
  previewSession: (tool: string, path: string, includeThinking: boolean) =>
    invoke<string>("preview_session", { tool, path, includeThinking }),
  pickExportDir: (defaultDir?: string) =>
    invoke<string | null>("pick_export_dir", { defaultDir }),
  pickDirectory: (defaultDir?: string) =>
    invoke<string | null>("pick_directory", { defaultDir }),
  testProvider: (baseUrl: string) => invoke<string>("test_provider", { baseUrl }),
  deleteSession: (path: string) => invoke<void>("delete_session", { path }),

  // 功能 10 快照 / 还原
  listAllSnapshots: () => invoke<SnapshotManifest[]>("list_all_snapshots"),
  restoreSnapshot: (scope: string, id: string) =>
    invoke<void>("restore_snapshot", { scope, id }),
};
