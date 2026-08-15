# Changelog

## v1.4.0 (2026-08-15)

### 📦 Version

- 项目版本从 `1.3.1` 升级到 `1.4.0`。
- `package.json`、Tauri 配置、Rust crate 与 Cargo lockfile 版本统一为 `1.4.0`。

### 🎉 Added

- 新增会话重命名：侧栏提供快捷按钮和右键菜单，支持 Enter 保存、Escape 取消及中文输入法组合输入。
- 新增会话自动/手动标题模式；已有本地会话保留原有标题，手动重命名不会被后续消息覆盖。

### 🔄 Changed

- 更新 Web favicon、应用内品牌图标与各桌面平台包图标资源。
- Vite 开发服务器忽略 `src-tauri/target`，避免桌面构建输出触发无关的文件监听更新。

### 🐛 Fixed

- 将 GitHub Actions 的 Intel macOS runner 从不可用的 `macos-13` 迁移至 `macos-15-intel`，恢复跨平台桌面 CI 与发布构建调度。

### ✅ Verify

- `pnpm.cmd run check` 通过。
- `pnpm.cmd run build` 通过；Vite 保留主包超过 500 kB 的非阻塞提示。
- 使用 Rust `1.88.0` 运行 `cargo check --manifest-path src-tauri/Cargo.toml` 通过；`Cargo.lock` 已由 Cargo 同步。

## v1.3.1 (2026-08-15)

### 📦 Version

- 项目版本从 `1.3.0` 升级到 `1.3.1`。
- `package.json`、Tauri 配置、Rust crate 与 Cargo lockfile 版本统一为 `1.3.1`。

### 🔄 Changed

- 将根目录 `README.md` 重新编审为默认英文文档，调整 Web/Desktop 运行方式、Endpoint 契约、本地数据边界、开发构建与发布说明的表达和结构。
- 新增完整的简体中文 `README.zh-CN.md`，并在中英文文档顶部提供双向语言切换。
- 补充 Tauri updater 公钥、私钥与 GitHub Actions Variables/Secrets 的配置说明，避免混淆公开验证材料和私密签名材料。

### ✅ Verify

- `pnpm.cmd run check` 通过。
- `pnpm.cmd run build` 通过；Vite 保留主包超过 500 kB 的非阻塞提示。
- 使用隔离 `CARGO_TARGET_DIR` 运行 `cargo check --locked` 通过；未删除现有 `src-tauri/target` 中指向旧工作区的缓存。

## v1.3.0 (2026-08-15)

### 📦 Version

- 项目版本从 `1.2.0` 升级到 `1.3.0`。
- `package.json`、Tauri 配置、Rust crate 与 Cargo lockfile 版本统一为 `1.3.0`。

### 🎉 Added

- 新增沉浸式桌面标题栏，提供应用图标、标题、最小化、最大化、关闭、拖拽和双击最大化操作。
- 新增生产态桌面更新：已打包客户端可检查、下载并在用户确认后安装来自 GitHub Release 的签名更新；开发态不会加载 updater。
- 新增独立的外观设置和关于对话框，关于页包含运行版本、开源仓库地址及桌面更新状态。

### 🔄 Changed

- 重组工作区入口、创作引导与连接设置，左侧空间优先用于创作列表；连接信息、外观和关于信息分别呈现。
- 生图请求模型固定为 `gpt-image-2`，画面比例和质量仍可在创作区调整。
- 更新桌面发布工作流、跨平台构建说明、隐私与安全文档，以及产品描述中的兼容性和独立项目声明。

### 🐛 Fixed

- 修复自定义标题栏与 Drawer、Modal、Tooltip、消息提示之间的层级和安全区冲突，标题栏保持在所有应用浮层之上。
- 修复居中关于对话框的垂直定位，并使顶部工作区 Tooltip 和反馈提示避开标题栏。
- 修复桌面端窗口关闭、窗口控制与拖拽区域在无原生装饰模式下的交互衔接。

### ✅ Verify

- `pnpm.cmd run check` 通过。
- `pnpm.cmd run build` 通过；Vite 保留主包超过 500 kB 的非阻塞提示。
- `pnpm.cmd run desktop:check` 通过；未启动桌面 GUI 或发布工作流。

## v1.2.0 (2026-08-10 ~ 2026-08-14)

### 📦 Version

- 项目版本从 `1.1.0` 升级到 `1.2.0`。
- `package.json`、Tauri 配置、Rust crate 与 Cargo lockfile 版本统一为 `1.2.0`。

### 🎉 Added

- 新增桌面端图片保存流程，可通过原生保存对话框选择文件位置，并校验文件名、格式与大小。
- 新增 Windows x64、macOS Intel、macOS Apple Silicon 与 Linux x64 的桌面 CI 和 Draft Release 构建矩阵。
- 新增 Rust 1.88 工具链声明及桌面构建所需的平台依赖说明。

### 🔄 Changed

- 桌面端命令封装与图片 Base64 传输逻辑拆分为独立模块，并改进请求取消时序。
- 桌面开发、检查、构建脚本统一通过运行时探测脚本调用 Tauri/Cargo。
- 更新 README 中的多平台桌面开发、构建与发布说明。

### 🐛 Fixed

- Tooltip 内容改为垂直居中。
- 消息轮次、会话、清除本地记录和清除连接配置的确认交互改为居中、不透明的 Modal，并保留不可点击关闭的遮罩。
- 修复桌面端窗口默认最大化及相关玻璃层/主题样式的一致性问题。

### ✅ Verify

- `pnpm.cmd run check` 通过。
- `pnpm.cmd run build` 通过；Vite 保留主包超过 500 kB 的非阻断提示。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml` 通过（Rust `1.88.0`）；未启动桌面 GUI 或发布工作流。

## v1.1.0 (2026-08-10 ~ 2026-08-14)

### 📦 Version

- 项目版本从 `1.0.0` 升级到 `1.1.0`。
- `package.json`、Tauri 配置与 Rust crate 版本统一为 `1.1.0`。

### 🎉 Added

- 新增提供商中立的 `SceneMeld` 品牌、原创开放画框图标、favicon、社交图片与桌面应用图标。
- 新增基于 Tauri 2 的 `SceneMeld Desktop`，通过 Rust 原生 HTTP 直连用户配置的图片 Endpoint，不依赖浏览器 CORS。
- 新增桌面端系统凭据管理器集成，可保存、读取和删除 API Key，且不会把桌面密钥写入 localStorage。
- 新增共享 `ImageTransport` 契约、桌面请求取消、图生图附件传输以及 Base64/远程 URL 图片响应支持。
- 新增 Windows Desktop CI 与未签名 Draft Release 工作流。

### 🔄 Changed

- Web 产品名称从模型相关命名迁移为 `SceneMeld Web`，保留纯静态、浏览器直连和无中转的数据边界。
- 界面改用矿物青单色强调体系，并保留现有 React、StyleX、Ant Design X 布局和毛玻璃交互系统。
- 设置存储键迁移到 `scenemeld.settings.v1`；旧设置会兼容读取，原 IndexedDB 名称继续保留以避免历史会话和图片丢失。
- 更新 README、隐私政策、安全政策、MIT 版权信息和 Web/Desktop 构建说明。

### 🧰 Chore

- 新增 `@tauri-apps/api` 与 `@tauri-apps/cli`，并由 pnpm 同步依赖锁文件。
- 将接近 800 行的应用样式从 `App.tsx` 拆分为独立 StyleX 模块。

### ✅ Verify

- `pnpm check` 通过。
- `pnpm build` 通过；Vite 保留主包超过 500 kB 的非阻断提示。
- `pnpm audit --prod` 通过，未发现已知生产依赖漏洞。
- 敏感信息、旧公开品牌名和源码文件体积扫描通过。
- GitHub Web CI 通过。
- Windows Desktop CI 的前端检查与 Web 构建通过，但 `Check Tauri crate` 步骤以退出码 1 失败；当前环境没有可用的原生 Rust 工具链，详细编译错误需要在 GitHub 已登录页面查看后修复。
