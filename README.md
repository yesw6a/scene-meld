# SceneMeld

**Image workspace for Web and Desktop.**

SceneMeld 是一个基于 React、StyleX 与 Ant Design X 的对话式图片创作工作台。用户自行提供兼容的 Endpoint 与 API Key；项目提供 Web 和 Desktop 两个版本，但不提供图片 API、中转代理、账户系统或服务端内容存储。

开源仓库：<https://github.com/yesw6a/scene-meld>

## 两种运行方式

### SceneMeld Web

Web 版是完全静态的 Vite 应用。应用会把图片请求发送到用户配置的 Endpoint，因此目标服务需要正确开放浏览器 CORS。

```text
Browser ──发送请求──> {Endpoint}/images/generations
Browser ──发送请求──> {Endpoint}/images/edits
```

适合已经支持浏览器跨域调用、且用户信任其隐私与内容条款的 Endpoint。SceneMeld 不提供图片请求中转服务；静态托管平台用于分发应用资源。

### SceneMeld Desktop

Desktop 版使用 Tauri 2 复用同一套 React 界面，并通过本机 Rust HTTP 客户端向 Endpoint 发起请求。

```text
Desktop device ──发送请求──> configured Endpoint
```

Desktop 不依赖浏览器 CORS。选择记住 API Key 时，应用会尝试将 Key 保存到操作系统凭据管理器；具体保护能力取决于操作系统和账户配置。当前桌面构建矩阵覆盖 Windows x64、macOS Intel、macOS Apple Silicon 与 Linux x64，正式公开分发前仍需要在三类系统上做人工冒烟测试。

## 功能

- 多会话对话式图片生成
- 文生图与上传参考图的图生图
- 常规桌面横屏、手机竖屏和正方形画面比例
- 生成、停止、重新生成、继续修改、复制、下载与删除
- 同一会话图片图集预览
- 会话、参考图和生成图片默认尝试保存在本地 IndexedDB
- 生图模型固定为 `gpt-image-2`；Endpoint 仍由用户配置
- Endpoint、生成偏好与外观保存在本地偏好存储
- Web API Key 默认仅保留到刷新前，也可由用户主动保存到 localStorage
- Desktop API Key 可由用户主动请求保存到操作系统凭据管理器，具体保护能力取决于系统和账户配置
- 浅色、深色和跟随系统外观

## Endpoint 契约

Endpoint 需要实现：

- 请求模型固定为 `gpt-image-2`
- `POST /images/generations`
- 图生图所需的 `POST /images/edits` multipart 请求
- `data[0].b64_json`，或可下载的 `data[0].url`
- 支持 PNG、JPEG、WebP 或 GIF 图片内容
- 客户端允许最多 16 张参考图，单张不超过 20 MB，总计不超过 50 MB；目标 Endpoint 可能设置更严格的限制

Web 版额外要求：

- 支持 `OPTIONS` CORS 预检
- 允许 `POST`
- 允许 `Authorization` 与 `Content-Type` 请求头
- 如果返回远程图片 URL，图片服务器也要允许浏览器跨域读取

Desktop 版不要求 CORS。认证请求禁止重定向；远程图片下载不会转发 Authorization。生产构建只接受 HTTPS Endpoint，本地调试构建可使用 localhost HTTP。

## 本地数据与安全边界

这里的“本地”指工作区数据优先写入当前浏览器或桌面 WebView 的本地存储，不承诺离线可用、永久备份或目标服务不留存。

- 应用发起的图片请求会发送到用户配置的 Endpoint；SceneMeld 不提供图片请求中转服务。
- 静态托管平台用于分发应用资源，目标 Endpoint 的日志、留存、内容规则和费用由其运营者决定。
- 用户需要自行判断 Endpoint 的运营者、隐私政策、内容规则、费用和可用性。
- IndexedDB 与 WebView 数据是本地缓存，不是永久备份；重要图片应另行下载。
- 仓库和构建产物不包含 API Key、Cloudflare 凭据、代码签名证书或更新私钥。

完整说明见 [PRIVACY.md](./PRIVACY.md) 与 [SECURITY.md](./SECURITY.md)。

## Web 本地开发

要求：

- Node.js 20.19+、22.12+ 或更新版本
- pnpm 10.34.4

```powershell
pnpm install
pnpm dev
```

默认地址通常为 <http://localhost:5173>。项目不需要 `.env`、服务端 API Key 或其他运行时环境变量；首次打开后在设置中填写 Endpoint 与 API Key，模型固定为 `gpt-image-2`。

## Web 校验与构建

```powershell
pnpm check
pnpm build
```

静态文件输出到 `dist/`。

## Desktop 开发与构建

除 Node.js 与 pnpm 外，还需要 Rust 1.88 和 Tauri 2 对应的平台构建环境。Windows 请安装原生 MSVC Rust 工具链与 WebView2 开发依赖；macOS 需要 Xcode Command Line Tools；Linux 需要 WebKitGTK 4.1、Ayatana AppIndicator、D-Bus、libxdo、OpenSSL、librsvg、pkg-config 与 patchelf 等系统依赖。

```powershell
pnpm desktop:check
pnpm desktop:dev
pnpm desktop:build
```

`desktop:dev` 会启动 Vite 与桌面窗口，应由开发者在本机主动运行。GitHub Actions 的 `Desktop CI` 会在 Windows x64、macOS Intel、macOS Apple Silicon 与 Linux x64 上执行前端检查、Web 构建、`cargo check --locked` 与 Tauri bundle 构建。

## 发布

### Cloudflare Pages

连接 GitHub 仓库并使用：

- Production branch：`main`
- Build command：`pnpm build`
- Build output directory：`dist`
- Root directory：仓库根目录
- Environment variables：不需要

`public/_headers` 提供静态安全头和缓存策略，`public/_redirects` 提供 SPA fallback。部署平台可按需要配置自定义域名；仓库不代表任何特定部署地址。

### Desktop Release 与生产更新

推送 `v*` 标签或手动运行 `Desktop Release` 工作流，会为 Windows x64、macOS Intel、macOS Apple Silicon 和 Linux x64 构建并发布 Tauri 安装包与签名更新元数据。生产桌面端只在用户确认后下载并重启安装；Web 端继续使用 Vite HMR，开发态不会加载 updater。

首次启用生产更新前，在仓库设置中配置：

- Actions Secret `TAURI_SIGNING_PRIVATE_KEY`：由 `pnpm exec tauri signer generate` 生成的私钥内容。
- Actions Secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：签名私钥密码（可为空，但建议设置）。
- Actions Variable `TAURI_UPDATER_PUBLIC_KEY`：与上述私钥配对的公钥内容。

私钥只放在 GitHub Actions Secret，不能提交到仓库。发布工作流会把公钥写入一次性的 `src-tauri/tauri.release.conf.json` 覆盖配置（该文件已被 Git 忽略），应用从 GitHub Release 的 `latest.json` 校验更新包。正式面向用户发布前，仍需另外配置 Windows Authenticode、macOS Developer ID 与 notarization；这些是系统代码签名，不等同于 updater 包签名。

生成密钥示例：

```powershell
pnpm exec tauri signer generate -w .\scenemeld-updater.key
```

不要把生成的私钥文件提交到 Git；将命令输出的公钥保存为 `TAURI_UPDATER_PUBLIC_KEY`，并把私钥内容复制到 `TAURI_SIGNING_PRIVATE_KEY`。

## 公开仓库注意事项

- 保护 `main` 分支并要求 Web 与 Desktop CI 通过
- 审核依赖与 `pnpm-lock.yaml` 变更
- 不在 Issue、截图、构建日志或示例配置中提交 API Key、私有 Endpoint、提示词或图片
- 不把 Cloudflare Token、签名证书、证书密码或更新私钥提交到仓库

## License

[MIT](./LICENSE)

## No affiliation

SceneMeld 是独立的开源项目，不隶属于、也不代表 OpenAI（包括 `gpt-image-2` 名称所对应的模型）、任何其他模型提供商、Endpoint 运营者、Apple、Ant Group 或 Cloudflare。产品和模型名称仅用于描述兼容性，不表示授权、赞助或背书。

`SceneMeld` 名称与图标采用提供商中立的原创方向；公开发布前已做基础名称冲突筛查，但这不等同于目标司法辖区的正式商标检索。商业发布前仍建议针对软件与在线服务相关类别完成专业检索。
