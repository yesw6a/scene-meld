# Changelog

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
