# Auto flows

Auto flows is a Windows desktop console for running Claude Code and OpenAI Codex in a managed, project-oriented workflow.

It brings environment checks, API provider switching, Skills and MCP management, role workflows, isolated workspaces, conversation export, snapshots, and language switching into one application.

Current release: **v1.0.0 MVP**

## Features

- **Environment management**: detect Node.js, npm, Git, Claude Code CLI, Codex CLI, and Claude Desktop; install, update, or remove supported tools.
- **Version visibility**: show the current application version and update version on the Environment page.
- **API providers**: manage Claude and Codex API providers, import existing config, reveal API keys while editing, test connectivity, and switch active providers.
- **Skills market**: view installed CLI Skills by Claude or Codex, install curated Skills, and remove Skills per target.
- **MCP market**: configure MCP servers for Claude Code, Claude Desktop, and Codex; import and remove existing MCP entries.
- **Role workflows**: apply or remove role workflow packs independently for Claude and Codex, with clear per-target status.
- **Workspaces**: isolate Claude and Codex configuration per project with separate providers, Skills, roles, and launch targets.
- **Conversation management**: browse global or workspace conversation history, auto-preview selected conversations, export Markdown, and delete sessions with snapshot backup.
- **Snapshots**: restore previous provider, Skill, MCP, role, and workspace configuration states.
- **Codex theme switcher**: one-click apply/restore visual skins for the OpenAI Codex desktop app, including Genshin Impact character themes.
- **Languages**: switch the interface between English, Japanese, Simplified Chinese, and Traditional Chinese.

## Requirements

- Windows 10 or later
- Node.js 18 or later
- npm
- Rust toolchain with the MSVC target
- Visual Studio 2022 Build Tools with C++ build tools
- Optional: Claude Code CLI, Codex CLI, Claude Desktop, Git

## Installation

Use a packaged release when available. The app stores its configuration under the current Windows user profile and does not require a shared system service.

For source-based use, install the prerequisites above, install dependencies, and launch the Tauri application from the repository root.

## Usage

1. Open **Environment** and confirm the base runtime is ready.
2. Open **API Providers** and add or import Claude and Codex providers.
3. Open **Market** to install Skills or configure MCP servers.
4. Open **Role Workflows** and apply a workflow pack to Claude, Codex, or both.
5. Open **Workspaces**, create a project workspace, choose providers and optional roles/Skills, then launch Claude or Codex.
6. Open **Conversation Records** inside Workspaces to preview, export, or delete conversation history.
7. Open **Themes**, select a Codex visual skin, and choose **Apply Theme**. Use **Restore Default** to remove the skin and recover the backed-up configuration.

## Codex Themes

The Themes page applies visual skins to the Codex desktop application. If Chromium remote debugging is not already available, Codex restarts once to enable it. Later theme changes reuse the running session and apply live without restarting; Codex installation files are not modified.

Before applying a theme, ensure the Codex desktop application is installed and Node.js is available on `PATH`. The first application creates a backup of `~/.codex/config.toml`. Restoring the default theme removes the injected styling, stops the theme helper, and restores that backup when present.

The included themes are visual adaptations only. They are unrelated to Codex models, API providers, or workspace configuration. For standalone CLI use and theme authoring, see `src-tauri/codex-theme-switcher/README.md`.

## Configuration

Auto flows writes tool configuration only through explicit actions such as provider switching, Skill installation, MCP application, role application, or workspace launch.

Global configuration targets include:

- Claude Code: `~/.claude`
- Claude Desktop MCP config: `%APPDATA%\Claude\claude_desktop_config.json`
- Codex: `~/.codex`

Workspace isolation uses:

- `<project>/.aiconsole/claude-home`
- `<project>/.aiconsole/codex-home`

## Safety

- Configuration-changing operations create snapshots before writing.
- Workspace launches use isolated Claude/Codex homes to avoid polluting global configuration.
- API keys are persisted in the app configuration and should be handled as secrets.
- Conversation deletion creates a snapshot backup before removing the selected session file.

## Versioning

The app version is read from the bundled Tauri/Cargo package metadata. The update version is exposed separately so packaged builds can show the target update version.

By default, the update version matches the current version.

## Troubleshooting

- If a CLI works in `cmd` but not inside the app, reopen the app and run Environment detection again.
- If Node.js or npm was installed during this session, use **Check again** on the Environment page after installation completes.
- If Codex cannot connect, verify the selected provider, API key, model, and wire API mode.
- If Claude or Codex launches with unexpected configuration, check whether the workspace is using global defaults or explicit workspace providers.
- If a configuration change causes problems, open **Settings** and restore a recent snapshot.

## License

No license has been declared yet.
