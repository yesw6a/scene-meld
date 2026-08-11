# GPT Image 2 Studio

一个基于 React、StyleX 和 Ant Design X 的对话式图片生成工作台。它是完全静态的前端应用，浏览器会直接调用用户填写的 OpenAI 兼容图片 Endpoint，本站不提供 API、中转、代理或服务端存储。

```text
Browser ──直接请求──> {Endpoint}/images/generations
Browser ──直接请求──> {Endpoint}/images/edits
```

## 功能

- 多会话的对话式图片生成
- 文生图与上传参考图的图生图
- 横屏、竖屏和正方形画面比例
- 生成、停止、重新生成、继续修改、复制、下载与删除
- 同一会话图片图集预览
- 会话、参考图和生成图片保存在浏览器 IndexedDB
- Endpoint、模型和生成偏好保存在浏览器 localStorage
- API Key 默认只保留到刷新前，可由用户主动选择持久化
- 浅色、深色和跟随系统外观

## 安全与隐私边界

- API Key、提示词和图片直接从浏览器发送到用户配置的 Endpoint。
- 本项目和 Cloudflare 静态托管不会接收或转发生成请求。
- 生产环境只允许 HTTPS Endpoint；本地开发可使用 localhost HTTP。
- API Key 不会写入 URL、构建产物或仓库文件。
- 开启“保存 API Key 到此浏览器”后，Key 会以未加密形式保存到 localStorage。
- IndexedDB 是本地缓存，不是永久备份，浏览器可能清理其中的数据。

完整说明见 [PRIVACY.md](./PRIVACY.md) 和 [SECURITY.md](./SECURITY.md)。

## Endpoint 要求

由于本站没有中转服务，Endpoint 必须允许浏览器跨域请求：

- 支持 `OPTIONS` CORS 预检
- 允许 `POST`
- 允许 `Authorization` 与 `Content-Type` 请求头
- 实现 `/images/generations`
- 图生图时实现 `/images/edits` 和 multipart 请求
- 返回 `data[0].b64_json`，或返回浏览器可跨域读取的 `data[0].url`

如果 Endpoint 返回远程图片 URL，图片服务器也必须允许 CORS，应用才能把图片读取为 Blob、保存到 IndexedDB、下载或继续编辑。

## 本地开发

要求：

- Node.js 20.19+、22.12+ 或更新版本
- pnpm 10.34.4

```powershell
pnpm install
pnpm dev
```

默认访问地址通常为 <http://localhost:5173>。

项目不需要 `.env`、服务端 API Key 或其他运行时环境变量。首次打开后，在设置中填写 Endpoint、API Key 和模型名称。

## 校验与构建

```powershell
pnpm check
pnpm build
pnpm preview
```

生产静态文件输出到 `dist/`。

## Cloudflare Pages 自动部署

在 Cloudflare Dashboard 中创建 Pages 项目并连接 GitHub 仓库：

- Production branch：`main`
- Build command：`pnpm build`
- Build output directory：`dist`
- Root directory：仓库根目录
- Environment variables：不需要

连接完成后，推送 `main` 会触发生产部署，其他分支和 Pull Request 可生成 Preview Deployment。`public/_headers` 提供静态安全头和缓存策略，`public/_redirects` 提供 SPA fallback。

## 公开仓库建议

- 保护 `main` 分支并要求 CI 通过
- 依赖与 `pnpm-lock.yaml` 变更需要审核
- Cloudflare 构建使用冻结锁文件
- 不要在 Issue、截图或日志中提交 API Key、提示词或私有图片

## License

[MIT](./LICENSE)

## No affiliation

这是独立开源项目，与 OpenAI、Apple、Ant Group 或 Cloudflare 不存在官方关联、授权、赞助或背书关系。
