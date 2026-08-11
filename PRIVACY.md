# Privacy

SceneMeld is a local-first application with Web and Desktop editions. The project does not operate an image-generation API, relay, proxy, account system, analytics service, or server-side content store.

## SceneMeld Web data flow

- The browser sends the API Key, prompt, generation settings, and optional reference images directly to the Endpoint configured by the user.
- The SceneMeld project and Cloudflare static hosting do not receive or forward image-generation requests.
- The configured Endpoint is a separate service with its own privacy policy, terms, logging, retention, content rules, and billing.
- The static hosting provider may process ordinary HTTP metadata while serving application assets, such as an IP address, user agent, requested asset, and timestamp.

## SceneMeld Desktop data flow

- The desktop application sends generation requests directly from the user's device to the configured Endpoint through its native HTTP client.
- Requests do not pass through SceneMeld-operated infrastructure or Cloudflare.
- Remote image URLs returned by an Endpoint are downloaded without forwarding the API Authorization header.
- The desktop application does not log API Keys, prompts, reference images, generated images, or Authorization headers.

## Local storage

- Endpoint, model, image size, quality, appearance, and navigation preferences may be stored locally.
- In Web, the API Key is stored in localStorage only after the user explicitly enables the remember option. It is not encrypted and may be readable by same-origin scripts or browser extensions.
- In Desktop, a remembered API Key is stored in the operating-system credential manager and is not written to localStorage.
- Conversations, prompts, reference images, and generated images are stored locally in IndexedDB or the desktop WebView's local application data.
- Local storage is not a permanent backup and may be cleared by the user, browser, operating system, WebView, or storage policy.

## Your choices

Users can keep API Key persistence disabled, clear connection settings, delete individual messages or conversations, or clear all local creation records. Clearing site or application data removes locally stored workspace data; operating-system credential entries may need to be removed through SceneMeld settings or the system credential manager.

## No affiliation

SceneMeld is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by any model provider, Endpoint operator, Apple, Ant Group, or Cloudflare. Product and model names are used only to describe compatibility.
