# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities through GitHub's private security advisory feature for this repository. Do not include API Keys, prompts, images, Endpoint credentials, signing material, or other sensitive data in a public issue.

Public issues are appropriate for non-sensitive bugs and compatibility reports.

## Security boundary

SceneMeld does not provide an image-generation relay or API. Users are responsible for assessing the Endpoint they configure and for reviewing its privacy policy, terms, content rules, billing, and data retention.

SceneMeld Web sends requests from the browser and therefore requires Endpoint CORS support. SceneMeld Desktop initiates requests from the native application and does not require browser CORS.

Both editions enforce HTTPS in production and allow localhost HTTP only during development. Client reference images are limited to 16 files, 20 MB per file, and 50 MB total; returned images are limited to 25 MB. Image content is validated as PNG, JPEG, WebP, or GIF. API Keys echoed by an upstream error are redacted before the message reaches the interface. A configured Endpoint may apply stricter limits.

Desktop native commands are limited to image generation, image editing, cancellation, and operating-system credential storage. The application does not enable arbitrary shell execution, unrestricted filesystem access, global shortcuts, or broad plugin permissions.

## Desktop distribution

Unsigned Windows installers may trigger Microsoft SmartScreen. Draft artifacts should be treated as development builds until code signing is configured. Signing certificates, passwords, Cloudflare credentials, API Keys, and updater private keys must never be committed to the repository.

## Supported version

Security fixes are applied to the latest version on the `main` branch.

## No affiliation

SceneMeld is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by OpenAI (including the provider associated with the `gpt-image-2` model name), any other model provider, Endpoint operator, Apple, Ant Group, or Cloudflare.
