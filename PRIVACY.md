# Privacy

SceneMeld is designed as a local-first application with Web and Desktop editions. The project does not provide an image-generation API, relay, proxy, account system, analytics service, or server-side content store.

Here, “local-first” means the workspace is intended to use the current browser or desktop WebView's local storage when available. It does not promise offline operation, permanent backup, or retention practices at the configured Endpoint.

## SceneMeld Web data flow

- The application sends the API Key, prompt, generation settings, and optional reference images to the Endpoint configured by the user.
- SceneMeld does not provide an image-request relay; static hosting is used to serve application assets.
- The configured Endpoint is a separate service with its own privacy policy, terms, logging, retention, content rules, and billing.
- The static hosting provider may process ordinary HTTP metadata while serving application assets, such as an IP address, user agent, requested asset, and timestamp.

## SceneMeld Desktop data flow

- The desktop application initiates generation requests from the user's device to the configured Endpoint through its native HTTP client.
- SceneMeld does not provide an image-request relay for those requests.
- Remote image URLs returned by an Endpoint are downloaded without forwarding the API Authorization header.
- The current desktop client does not intentionally log API Keys, prompts, reference images, generated images, or Authorization headers; operating-system and Endpoint logs remain outside the project's control.

## Local storage

- Endpoint, model, image size, quality, appearance, and navigation preferences may be stored locally.
- In Web, the API Key is stored in localStorage only after the user explicitly enables the remember option. It is not encrypted and may be readable by same-origin scripts or browser extensions.
- In Desktop, the application attempts to store a remembered API Key in the operating-system credential manager; the protection provided depends on the operating system and account configuration.
- Conversations, prompts, reference images, and generated images are stored locally in IndexedDB or the desktop WebView's local application data when storage is available.
- Local storage is not a permanent backup and may be cleared by the user, browser, operating system, WebView, or storage policy.

## Your choices

Users can keep API Key persistence disabled, clear connection settings, delete individual messages or conversations, or clear all local creation records. Clearing site or application data removes locally stored workspace data; operating-system credential entries may need to be removed through SceneMeld settings or the system credential manager.

## No affiliation

SceneMeld is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by OpenAI (including the provider associated with the `gpt-image-2` model name), any other model provider, Endpoint operator, Apple, Ant Group, or Cloudflare. Product and model names are used only to describe compatibility.
