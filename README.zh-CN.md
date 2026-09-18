# SceneMeld

**面向 Web 与 Desktop 的对话式图片创作工作台。**

[English](./README.md) | 简体中文

首次使用？阅读图文版 [中文使用教程](./docs/user-guide.zh-CN.md) / [English user guide](./docs/user-guide.md)，了解连接配置、生图、参考图修改、多图与分镜及常见问题。

SceneMeld 是一个基于 React、StyleX 与 Ant Design X 的对话式图片创作工作台。用户自行提供兼容的 Endpoint 与 API Key。项目同时提供 Web 和 Desktop 版本，但不提供图片 API、中转或代理、账户系统，也不提供服务端内容存储。

仓库：<https://github.com/yesw6a/scene-meld>

在线体验：<https://scene-meld.clovemu.com/>

## 选择运行方式

### SceneMeld Web

Web 版是完全静态的 Vite 应用。图片请求会从浏览器直接发送到用户配置的 Endpoint，因此目标服务必须允许所需的浏览器 CORS 访问。

```text
Browser --> {Endpoint}/images/generations
Browser --> {Endpoint}/images/edits
```

适用于支持浏览器跨域请求、且其隐私与内容政策值得用户信任的 Endpoint。SceneMeld 不会中转图片请求；静态托管平台仅用于分发应用资源。

### SceneMeld Desktop

Desktop 版使用 Tauri 2 复用同一套 React 界面，并通过本机 Rust HTTP 客户端发送图片请求。

```text
Desktop device --> configured Endpoint
```

Desktop 不依赖浏览器 CORS。选择记住 API Key 后，应用会尝试将其保存到操作系统凭据管理器；实际保护能力取决于操作系统和账户配置。当前桌面构建矩阵覆盖 Windows x64、macOS Intel、macOS Apple Silicon 与 Linux x64。公开发布前，应在这三类操作系统上完成人工冒烟测试。

### 桌面网络代理

在「连接配置 → 网络代理」中选择「使用系统代理」（默认）、「不使用代理」或「手动配置代理」，点击「保存设置」生效。代理可单独保存，无需先填写 API Key。

- 系统代理：Windows/macOS 读取系统静态代理及代理环境变量；Linux 使用 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`、`NO_PROXY` 等环境变量。不支持 PAC 脚本或自动发现；仅使用 PAC 的网络请改为手动配置代理。环境变量可能覆盖系统设置。
- 不使用代理：明确禁用系统代理及代理环境变量。
- 手动配置：例如 `http://127.0.0.1:7890`。支持 HTTP、HTTPS、SOCKS5、SOCKS5H；SOCKS 地址需要端口，`socks5://` 在本地解析目标域名，`socks5h://` 由代理解析。首版不支持手动代理用户名和密码，地址不得包含凭据、路径或查询参数。

设置适用于桌面端图片生成、AI 辅助、模型列表、生成图片下载、更新检查及更新包下载。保存后新操作使用新配置，运行中的请求与后续图片下载保持原配置。手动代理失败不会切回直连；更新切换到 gh-proxy 镜像时仍遵循代理设置。

代理配置保存在应用配置目录的 `network-proxy.json`，独立于 API Key 和创作记录；清除连接配置不会清除代理设置。网页版仍使用浏览器或系统代理，无法在应用内指定代理服务器。代理仅改变网络连接方式，API Endpoint 仍填写实际服务地址，HTTPS 校验保持开启。

## 功能

- 多会话图片创作工作台
- 文生图，以及上传参考图后的图生图
- 横屏、竖屏和正方形画面比例
- 生成、停止、重新生成、继续修改、复制、下载与删除
- 每个会话中的图片图集预览
- 会话、参考图与生成图片会在可用时保存到本地 IndexedDB
- 生图模型可从应用支持的候选中选择，默认 `gpt-image-2.5-flare`；Endpoint 由用户配置
- Endpoint 设置、生成偏好和外观保存在本地
- Web API Key 默认仅保留在内存中；用户选择后可保存到 `localStorage`
- Desktop API Key 可由用户选择保存到操作系统凭据管理器；实际保护能力取决于操作系统和账户配置
- 浅色、深色和跟随系统外观模式

## 兼容 Endpoint 契约

Endpoint 需要实现：

- 支持用户选择的完整生图模型 ID（默认 `gpt-image-2.5-flare`，可用权限以目标服务为准）
- `POST /images/generations`
- 图生图所需的 `POST /images/edits` multipart 请求
- `data[0].b64_json`，或可下载的 `data[0].url`
- PNG、JPEG、WebP 或 GIF 图片内容
- 最多 16 张参考图，单张不超过 20 MB，总计不超过 50 MB。目标 Endpoint 可能设置更严格的限制。

Web 版还要求：

- 支持 `OPTIONS` CORS 预检
- 在允许的方法中包含 `POST`
- 在允许的请求头中包含 `Authorization` 与 `Content-Type`
- 返回远程图片 URL 时，图片服务器也必须允许浏览器跨域读取

Desktop 不要求 CORS。认证请求不会跟随重定向；下载远程图片时绝不会转发 `Authorization`。生产构建只接受 HTTPS Endpoint，本地开发构建可使用 localhost HTTP。

## 本地数据与安全边界

“本地”表示工作区数据优先写入当前浏览器或桌面 WebView 的本地存储。这不承诺离线可用、永久备份，也不承诺目标 Endpoint 不会保留数据。

- 图片请求会发送到用户配置的 Endpoint；SceneMeld 不提供图片请求中转服务。
- 静态托管平台仅用于分发应用资源。目标 Endpoint 的日志、留存、内容规则、费用和可用性由其运营者决定。
- 用户需要自行评估 Endpoint 运营者、隐私政策、内容规则、费用和可用性。
- IndexedDB 与 WebView 数据是本地缓存，并非永久备份；重要图片应另行下载。
- 仓库和构建产物不包含 API Key、Cloudflare 凭据、代码签名证书或更新私钥。

完整说明请参阅英文原文：[PRIVACY.md](./PRIVACY.md) 和 [SECURITY.md](./SECURITY.md)。

## Web 开发

要求：

- Node.js 20.19+、22.12+ 或更新版本
- pnpm 10.34.4

```powershell
pnpm install
pnpm dev
```

默认地址通常为 <http://localhost:5173>。项目不需要 `.env`、服务端 API Key 或其他运行时环境变量。首次启动后，在连接配置中填写 Endpoint 与 API Key，并选择目标服务支持的生图模型；详细步骤见[使用教程](./docs/user-guide.zh-CN.md)。

## Web 校验与构建

```powershell
pnpm check
pnpm build
```

静态文件输出到 `dist/`。

## Desktop 开发与构建

除 Node.js 与 pnpm 外，还需要 Rust 1.88 和 Tauri 2 对应的平台构建环境。Windows 请安装原生 MSVC Rust 工具链与 WebView2 开发依赖；macOS 需要 Xcode Command Line Tools；Linux 需要 WebKitGTK 4.1、Ayatana AppIndicator、D-Bus、libxdo、OpenSSL、librsvg、pkg-config、patchelf 及相关系统依赖。

```powershell
pnpm desktop:check
pnpm desktop:dev
pnpm desktop:build
```

`desktop:dev` 会启动 Vite 与桌面窗口，应由开发者在本机主动运行。GitHub Actions 的 `Desktop CI` 会在 Windows x64、macOS Intel、macOS Apple Silicon 与 Linux x64 上执行前端检查、Web 构建、`cargo check --locked` 与 Tauri bundle 构建。

## 部署与发布

### Cloudflare Pages

连接 GitHub 仓库并使用：

- Production branch：`main`
- Build command：`pnpm build`
- Build output directory：`dist`
- Root directory：仓库根目录
- Environment variables：不需要

`public/_headers` 提供静态安全头和缓存策略；`public/_redirects` 提供 SPA fallback。可按需在托管平台配置自定义域名；SceneMeld Web 当前的线上部署地址为 <https://scene-meld.clovemu.com/>。

### Desktop 发布与生产更新

推送 `v*` 标签，或手动运行 `Desktop Release` 工作流，会为 Windows x64、macOS Intel、macOS Apple Silicon 与 Linux x64 构建并发布 Tauri 安装包与签名更新元数据。生产环境中，桌面端只会在用户确认后下载更新并重启安装。Web 版继续使用 Vite HMR，开发构建不会加载 updater。

首次启用生产更新前，在仓库设置中配置：

- Actions Secret `TAURI_SIGNING_PRIVATE_KEY`：由 `pnpm exec tauri signer generate` 生成的私钥。
- Actions Secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：私钥密码。可以为空，但建议设置。
- Actions Variable `TAURI_UPDATER_PUBLIC_KEY`：与上述私钥配对的公钥。

私钥只能保存到 GitHub Actions Secrets。发布工作流会将公钥写入一次性的 `src-tauri/tauri.release.conf.json` 覆盖配置，该文件已被 Git 忽略。应用通过 GitHub Releases 的 `latest.json` 校验更新包。公开发布前，还应配置 Windows Authenticode，以及 macOS Developer ID 与 notarization。这些操作系统级签名与 updater 包签名相互独立。

生成密钥示例：

```powershell
pnpm exec tauri signer generate -w .\scenemeld-updater.key
```

不要提交生成的私钥文件。将命令输出的公钥保存为 `TAURI_UPDATER_PUBLIC_KEY`，并将私钥内容复制到 `TAURI_SIGNING_PRIVATE_KEY`。

## 公开仓库注意事项

- 保护 `main` 分支，并要求 Web 与 Desktop CI 通过。
- 审核依赖与 `pnpm-lock.yaml` 变更。
- 不要在 Issue、截图、构建日志或示例配置中提交 API Key、私有 Endpoint、提示词或图片。
- 不要提交 Cloudflare Token、签名证书、证书密码或更新私钥。

## License

[MIT](./LICENSE)

## 无关联声明

SceneMeld 是独立的开源项目，不隶属于、也不代表 OpenAI，包括与 `gpt-image-2` 模型名称相关的提供商；任何其他模型提供商；Endpoint 运营者；Apple；Ant Group；或 Cloudflare。产品和模型名称仅用于描述兼容性，不表示授权、赞助或背书。

`SceneMeld` 名称与图标采用提供商中立的原创方向。公开发布前已做基础名称冲突筛查，但这不等同于目标司法辖区内的正式商标检索。商业发布前，建议针对软件与在线服务相关类别完成专业检索。
