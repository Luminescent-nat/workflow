# Codex Theme Switcher

OpenAI Codex 桌面端一键换肤工具。基于 Chromium 调试协议（CDP）注入 CSS/JS 主题，**不修改 Codex 安装文件**，可随时一键还原。

## 特性

- 下拉选择主题，一键应用/恢复
- 内置 5 款原神角色灵感主题：雷电将军、纳西妲、芙宁娜、胡桃、钟离
- 自动备份 `~/.codex/config.toml`
- 导航/刷新后主题自动恢复（后台守护进程）
- 提供 CLI 与 E:\workflow（auto-flows）GUI 集成

## 目录结构

```
codex-theme-switcher/
├── dist/                 # TypeScript 编译输出
├── scripts/
│   └── build-themes.mjs  # 根据配色模板生成各主题 CSS/JS
├── src/
│   ├── cli.ts            # 命令行入口
│   ├── core/
│   │   ├── codex-launcher.ts   # 启动/复用 Codex
│   │   ├── config-patcher.ts   # 读写 ~/.codex/config.toml
│   │   ├── injector.ts         # CDP 连接、注入、验证
│   │   ├── state.ts            # 守护进程状态管理
│   │   ├── themes.ts           # 主题包扫描与加载
│   │   └── types.ts            # 类型定义
│   └── gui/              # （预留）独立 GUI
└── themes/               # 主题包目录
    ├── default/
    ├── genshin-raiden/
    ├── genshin-nahida/
    ├── genshin-furina/
    ├── genshin-hutao/
    └── genshin-zhongli/
```

## 安装

在 `E:\workflow` 中已经内置了本工具（`E:\workflow\codex-theme-switcher`）。如需单独使用：

```bash
cd codex-theme-switcher
npm install
npm run build
```

## CLI 用法

```bash
# 列出所有主题
node dist/cli.js list

# 应用主题（会自动启动 Codex 并注入）
node dist/cli.js apply genshin-raiden

# 应用主题，如果 Codex 已运行则强制重启
node dist/cli.js apply genshin-raiden --restart-existing

# 使用自定义调试端口
node dist/cli.js apply genshin-raiden --port 9336

# 验证当前主题
node dist/cli.js verify

# 截图验证
node dist/cli.js verify --screenshot C:\Users\You\Desktop\codex-theme.png

# 恢复默认
node dist/cli.js remove
```

## E:\workflow GUI 用法

1. 打开 auto-flows 应用
2. 在左侧导航点击 **主题换肤**
3. 选择喜欢的主题
4. 点击 **应用主题**
5. 需要恢复时点击 **恢复默认**

## 替换角色图片

每个主题目录下可放置一张 `art.png` 作为角色立绘/背景：

```
themes/genshin-raiden/
├── theme.json
├── theme.css
├── inject.js
└── art.png          <-- 放入你喜欢的图片
```

推荐尺寸：横图 1200×600 以上，人物主体偏右，左侧留出标题文字区域。

无 `art.png` 时，主题仍会通过渐变背景正常工作。

## 开发新主题

1. 在 `themes/` 下新建目录，例如 `genshin-newchar/`
2. 创建 `theme.json`，填写名称、描述、配色
3. 创建 `theme.css` 和可选的 `inject.js`
4. 或在 `scripts/build-themes.mjs` 的 `palette` 中添加配色配置，运行 `node scripts/build-themes.mjs` 自动生成

## 安全说明

- 不修改 `C:\Program Files\WindowsApps` 下的 Codex 安装文件
- 首次应用主题前会自动备份 `~/.codex/config.toml`
- 恢复默认时会还原配置并移除注入的 DOM/CSS
- 装饰层全部设置 `pointer-events: none`，不拦截原生控件点击

## 故障排除

| 问题 | 解决 |
|------|------|
| Codex 无法自动启动 | 手动启动 Codex 并带上 `--remote-debugging-port=9335`，然后重新应用主题 |
| 端口被占用 | 使用 `--port <port>` 指定其他端口 |
| 应用后无效果 | 确认 Codex 已以调试模式启动，并查看 `%LOCALAPPDATA%\CodexThemeSwitcher\injector-error.log` |
| 更新 Codex 后主题失效 | 重新运行 `apply` 即可 |

## 版权说明

默认主题使用角色配色灵感的抽象渐变与占位装饰，避免直接使用原神官方素材。用户可自行替换 `art.png` 为个人喜欢的图片。
