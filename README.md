# SceneMeld

**Local-first image workspace. Images, on your terms.**

SceneMeld 是一个基于 React、StyleX 与 Ant Design X 的对话式图片创作工作台。用户自行提供兼容的 Endpoint 与 API Key；项目提供 Web 和 Desktop 两个版本，但不运营图片 API、中转代理、账户系统或服务端内容存储。

## 两种运行方式

### SceneMeld Web

Web 版是完全静态的 Vite 应用。浏览器直接请求用户配置的 Endpoint，因此目标服务必须正确开放浏览器 CORS。

```text
Browser ──直接请求──> {Endpoint}/images/generations
Browser ──直接请求──> {Endpoint}/images/edits
```

适合已经支持浏览器跨域调用、且用户信任其隐私与内容条款的 Endpoint。Cloudflare Pages 只分发静态文件，不接收或转发图片生成请求。

### SceneMeld Desktop

Desktop 版使用 Tauri 2 复用同一套 React 界面，并通过本机 Rust HTTP 客户端直连 Endpoint。

```text
Desktop device ──原生直接请求──> configured Endpoint
```

Desktop 不依赖浏览器 CORS；选择记住 API Key 时，Key 保存到操作系统凭据管理器，不写入 localStorage。当前桌面构建矩阵覆盖 Windows x64、macOS Intel、macOS Apple Silicon 与 Linux x64，正式公开分发前仍需要在三类系统上做人工冒烟测试。

## 功能

- 多会话对话式图片生成
- 文生图与上传参考图的图生图
- 常规桌面横屏、手机竖屏和正方形画面比例
- 生成、停止、重新生成、继续修改、复制、下载与删除
- 同一会话图片图集预览
- 会话、参考图和生成图片保存在本地 IndexedDB
- Endpoint、模型、生成偏好与外观保存在本地偏好存储
- Web API Key 默认仅保留到刷新前，也可由用户主动保存到 localStorage
- Desktop API Key 可由用户主动保存到操作系统凭据管理器
- 浅色、深色和跟随系统外观

## Endpoint 契约

Endpoint 需要实现：

- `POST /images/generations`
- 图生图所需的 `POST /images/edits` multipart 请求
- `data[0].b64_json`，或可下载的 `data[0].url`
- 支持 PNG、JPEG、WebP 或 GIF 图片内容

Web 版额外要求：

- 支持 `OPTIONS` CORS 预检
- 允许 `POST`
- 允许 `Authorization` 与 `Content-Type` 请求头
- 如果返回远程图片 URL，图片服务器也要允许浏览器跨域读取

Desktop 版不要求 CORS。认证请求禁止重定向；远程图片下载不会转发 Authorization。生产构建只接受 HTTPS Endpoint，本地调试构建可使用 localhost HTTP。

## 本地数据与安全边界

- API Key、提示词、参考图和生成参数只会发送到用户配置的 Endpoint。
- SceneMeld 项目与静态托管方不接收或转发生成请求。
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

默认地址通常为 <http://localhost:5173>。项目不需要 `.env`、服务端 API Key 或其他运行时环境变量；首次打开后在设置中填写 Endpoint、API Key 与模型名称。

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

`public/_headers` 提供静态安全头和缓存策略，`public/_redirects` 提供 SPA fallback。推荐自定义域名：`scenemeld.clovemu.com`。

### Desktop Draft Release

推送 `v*` 标签或手动运行 `Desktop Draft Release` 工作流，会生成多平台 GitHub Draft Release。当前流程不包含 Windows 代码签名或 macOS 公证，因此安装包可能触发 Microsoft SmartScreen 或 Apple Gatekeeper；正式公开推广前应配置可信签名并验证发布校验值。

## 公开仓库注意事项

- 保护 `main` 分支并要求 Web 与 Desktop CI 通过
- 审核依赖与 `pnpm-lock.yaml` 变更
- 不在 Issue、截图、构建日志或示例配置中提交 API Key、私有 Endpoint、提示词或图片
- 不把 Cloudflare Token、签名证书、证书密码或更新私钥提交到仓库

## License

[MIT](./LICENSE)

## No affiliation

SceneMeld 是独立的开源项目，不隶属于、也不代表任何模型提供商、Endpoint 运营者、Apple、Ant Group 或 Cloudflare。产品和模型名称仅用于描述兼容性，不表示授权、赞助或背书。

`SceneMeld` 名称与图标采用提供商中立的原创方向；公开发布前已做基础名称冲突筛查，但这不等同于目标司法辖区的正式商标检索。商业发布前仍建议针对软件与在线服务相关类别完成专业检索。
