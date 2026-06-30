# AI 开发控制台(AI Dev Console)

Claude Code 与 OpenAI Codex 的一体化桌面控制台:环境检测与安装、第三方 API 切换、
Skills/MCP 市场、多角色工作流、工作区隔离并行、对话导出,以及全程可一键应用 / 一键还原。

技术栈:**Tauri 2 + Rust + React 19 + TypeScript + Vite + Tailwind CSS v4**。

## 环境要求(Windows)

- **Node.js** ≥ 18(已验证 22.x)与 npm
- **Rust** 工具链(MSVC 目标):`winget install -e --id Rustlang.Rustup`
- **VS 2022 Build Tools**(C++ 生成工具,用于链接):
  `winget install -e --id Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`

## 开发

```bash
npm install            # 安装前端依赖
npm run tauri dev      # 启动桌面应用(开发模式,带热更新)
```

仅构建/校验前端:

```bash
npm run build          # tsc + vite build,产物在 dist/
```

仅校验后端:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## 打包

```bash
npm run tauri build    # 产出 Windows 安装包(NSIS/MSI)与 EXE
```

## 目录结构

```
src/                 React 前端
  pages/             环境 / 供应商 / 市场 / 角色 / 工作区 / 设置
  components/        共享组件(侧边栏、页头等)
  store/  ipc.ts     状态与 IPC 封装
src-tauri/src/       Rust 后端
  paths.rs           Claude/Codex 配置路径解析
  util.rs            原子写 / JSON 深合并
  state.rs           应用全局状态
  logs.rs            结构化日志(调试中心数据源)
  snapshots.rs       快照 / 还原引擎(一键还原底座)
  lib.rs             命令注册与初始化
src-tauri/catalog/   内置精选目录(Skills / MCP / 角色预设包)
```
