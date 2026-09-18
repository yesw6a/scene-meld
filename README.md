# SceneMeld

**A conversational image workspace for Web and Desktop.**

English | [简体中文](./README.zh-CN.md)

New to SceneMeld? Read the illustrated [English user guide](./docs/user-guide.md) or [中文使用教程](./docs/user-guide.zh-CN.md) for connection setup, image creation and editing, batches, storyboards, and troubleshooting.

SceneMeld is a conversational image workspace built with React, StyleX, and
Ant Design X. You bring a compatible Endpoint and API key. The project ships
Web and Desktop editions, but it does not provide an image API, relay or proxy,
account system, or server-side content storage.

Repository: <https://github.com/yesw6a/scene-meld>

Online Web App: <https://scene-meld.clovemu.com/>

## Choose your runtime

### SceneMeld Web

The Web edition is a fully static Vite application. Image requests go directly
from the browser to your configured Endpoint, which must allow the required
browser CORS access.

```text
Browser --> {Endpoint}/images/generations
Browser --> {Endpoint}/images/edits
```

Use it with an Endpoint that supports browser cross-origin requests and whose
privacy and content policies you trust. SceneMeld does not relay image
requests; a static hosting provider only distributes the application assets.

### SceneMeld Desktop

The Desktop edition uses Tauri 2 with the same React interface and sends image
requests through a local Rust HTTP client.

```text
Desktop device --> configured Endpoint
```

Desktop does not depend on browser CORS. When you choose to remember an API
key, the app attempts to save it in the operating system credential manager;
the actual protection depends on the operating system and account
configuration. The current desktop build matrix covers Windows x64, macOS
Intel, macOS Apple Silicon, and Linux x64. Run manual smoke tests on all three
operating system families before a public release.

### Desktop network proxy

Open **Connection settings → Network proxy**, choose **Use system proxy** (default), **No proxy**, or **Manual proxy configuration**, then save. Proxy settings can be saved without an API key.

- System mode reads Windows/macOS static system proxies and proxy environment variables. Linux uses `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, and `NO_PROXY`. Environment variables may override system settings. PAC scripts and automatic discovery are not supported; use manual configuration on PAC-only networks.
- No proxy explicitly disables system and environment proxies.
- Manual mode accepts HTTP, HTTPS, SOCKS5, and SOCKS5H addresses, such as `http://127.0.0.1:7890`. SOCKS addresses require a port; `socks5://` resolves destination names locally, while `socks5h://` resolves them through the proxy. Manual proxy authentication is not supported; credentials, paths, query strings, and fragments are rejected.

The policy covers desktop image generation, AI assistance, model discovery, generated image downloads, update checks, and update downloads. New operations use saved changes; running requests and their image downloads keep the original configuration. Manual proxy failures never fall back to direct connections. The gh-proxy update mirror follows the same network proxy policy.

Settings are stored separately in `network-proxy.json` in the application configuration directory and survive clearing API connection settings. Web users must configure their browser or operating system instead. Keep the actual service URL as the API Endpoint; TLS verification remains enabled.

## Features

- Multi-conversation image creation workspace
- Text-to-image and image-to-image with uploaded reference images
- Landscape, portrait, and square image formats
- Generate, stop, regenerate, continue editing, copy, download, and delete
- Image gallery preview for each conversation
- Conversations, reference images, and generated images are persisted locally
  in IndexedDB when possible
- Select an image model from the supported candidates (default: `gpt-image-2.5-flare`); you configure the Endpoint
- Endpoint settings, generation preferences, and appearance are stored locally
- Web API keys stay in memory by default, or can be saved to `localStorage`
  when you opt in
- Desktop API keys can be saved to the operating system credential manager when
  you opt in; actual protection depends on the operating system and account
  configuration
- Light, dark, and system appearance modes

## Compatible Endpoint contract

Your Endpoint must implement:

- The selected full image model ID (default: `gpt-image-2.5-flare`; availability depends on the target service)
- `POST /images/generations`
- `POST /images/edits` as a multipart image-to-image request
- `data[0].b64_json`, or a downloadable `data[0].url`
- PNG, JPEG, WebP, or GIF image content
- Up to 16 reference images, each no larger than 20 MB and no more than 50 MB
  in total. Your Endpoint may enforce stricter limits.

The Web edition also requires:

- `OPTIONS` CORS preflight support
- `POST` in allowed methods
- `Authorization` and `Content-Type` in allowed request headers
- Browser-readable CORS access from the image server when it returns a remote
  image URL

Desktop does not require CORS. Authenticated requests do not follow redirects,
and remote image downloads never forward `Authorization`. Production builds
only accept HTTPS Endpoints; local development builds may use localhost HTTP.

## Local data and security boundaries

"Local" means workspace data is written primarily to storage in the current
browser or desktop WebView. It does not promise offline availability, permanent
backup, or that the configured Endpoint retains no data.

- Image requests are sent to your configured Endpoint. SceneMeld provides no
  image-request relay.
- A static hosting provider only distributes application assets. The Endpoint
  operator determines its logging, retention, content rules, pricing, and
  availability.
- You are responsible for assessing the Endpoint operator, privacy policy,
  content rules, pricing, and availability.
- IndexedDB and WebView data are local caches, not permanent backups. Download
  important images separately.
- The repository and build artifacts do not contain API keys, Cloudflare
  credentials, code-signing certificates, or updater private keys.

See the English originals: [PRIVACY.md](./PRIVACY.md) and
[SECURITY.md](./SECURITY.md).

## Web development

Requirements:

- Node.js 20.19+, 22.12+, or newer
- pnpm 10.34.4

```powershell
pnpm install
pnpm dev
```

The default address is usually <http://localhost:5173>. The project needs no
`.env`, server-side API key, or other runtime environment variables. After the
first launch, configure an Endpoint and API key in connection settings, then select
an image model supported by your service. See the [user guide](./docs/user-guide.md) for details.

## Web validation and build

```powershell
pnpm check
pnpm build
```

Static output is written to `dist/`.

## Desktop development and build

In addition to Node.js and pnpm, install Rust 1.88 and the platform build
requirements for Tauri 2. On Windows, use the native MSVC Rust toolchain and
WebView2 development dependencies. macOS requires Xcode Command Line Tools.
Linux requires WebKitGTK 4.1, Ayatana AppIndicator, D-Bus, libxdo, OpenSSL,
librsvg, pkg-config, patchelf, and related system dependencies.

```powershell
pnpm desktop:check
pnpm desktop:dev
pnpm desktop:build
```

`desktop:dev` starts Vite and a desktop window, so run it deliberately on your
own machine. The GitHub Actions `Desktop CI` workflow runs frontend checks, a
Web build, `cargo check --locked`, and a Tauri bundle build for Windows x64,
macOS Intel, macOS Apple Silicon, and Linux x64.

## Deploy and release

### Cloudflare Pages

Connect the GitHub repository and use:

- Production branch: `main`
- Build command: `pnpm build`
- Build output directory: `dist`
- Root directory: repository root
- Environment variables: none

`public/_headers` supplies static security headers and cache policies;
`public/_redirects` supplies the SPA fallback. Configure a custom domain on the
hosting platform as needed. The current SceneMeld Web deployment is available
at <https://scene-meld.clovemu.com/>.

### Desktop releases and production updates

Pushing a `v*` tag, or manually running the `Desktop Release` workflow, builds
and publishes Tauri installers and signed update metadata for Windows x64,
macOS Intel, macOS Apple Silicon, and Linux x64. In production, the desktop app
downloads and restarts for an update only after user confirmation. The Web
edition continues to use Vite HMR, and development builds do not load the
updater.

Before enabling production updates for the first time, configure these
repository settings:

- Actions Secret `TAURI_SIGNING_PRIVATE_KEY`: private key generated by
  `pnpm exec tauri signer generate`.
- Actions Secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: private-key password.
  It can be empty, but setting one is recommended.
- Actions Variable `TAURI_UPDATER_PUBLIC_KEY`: public key paired with the
  private key above.

Keep the private key only in GitHub Actions Secrets. The release workflow writes
the public key to the one-time `src-tauri/tauri.release.conf.json` override,
which is ignored by Git. The app verifies update packages using `latest.json`
from GitHub Releases. Before a public release, also configure Windows
Authenticode and macOS Developer ID plus notarization. Those operating-system
signatures are separate from updater package signing.

Example key generation command:

```powershell
pnpm exec tauri signer generate -w .\scenemeld-updater.key
```

Do not commit the generated private key. Store the command's public-key output
as `TAURI_UPDATER_PUBLIC_KEY`, and copy the private-key contents to
`TAURI_SIGNING_PRIVATE_KEY`.

## Public repository safeguards

- Protect `main` and require Web and Desktop CI to pass.
- Review dependency and `pnpm-lock.yaml` changes.
- Never include API keys, private Endpoints, prompts, or images in issues,
  screenshots, build logs, or example configuration.
- Never commit Cloudflare tokens, signing certificates, certificate passwords,
  or updater private keys.

## License

[MIT](./LICENSE)

## No affiliation

SceneMeld is an independent open-source project. It is not affiliated with or
representative of OpenAI, including the provider associated with the
`gpt-image-2` model name; any other model provider; an Endpoint operator;
Apple; Ant Group; or Cloudflare. Product and model names are used only to
describe compatibility and do not imply authorization, sponsorship, or
endorsement.

The `SceneMeld` name and icon follow a provider-neutral, original direction. A
basic name-conflict review was performed before public release, but it is not a
formal trademark search in the relevant jurisdiction. Seek a professional
search for software and online-service classes before a commercial release.
