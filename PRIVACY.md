# Privacy

GPT Image 2 Studio is a static web application. The published site contains no API,
relay, proxy, server function, analytics script, advertising script, or account system.

## Data flow

- The browser sends the API Key, prompt, generation settings, and optional reference
  images directly to the Endpoint configured by the user.
- The site operator and Cloudflare do not receive or forward image-generation requests.
- The configured Endpoint is a separate service with its own privacy policy and terms.
- The static hosting provider may process ordinary HTTP metadata when serving the site,
  such as IP address, user agent, requested asset, and timestamp.

## Local browser storage

- Endpoint, model, image size, quality, appearance, and navigation preferences may be
  stored in localStorage.
- The API Key is stored in localStorage only after the user explicitly enables the
  remember option. It is not encrypted and may be readable by same-origin scripts or
  browser extensions.
- Conversations, prompts, reference images, and generated images are stored locally in
  IndexedDB. Browser storage is not a permanent backup and may be cleared by the user,
  browser, operating system, or storage policy.

## Your choices

You can keep API Key persistence disabled, clear connection settings, delete individual
conversations, or clear all local creation records from the settings panel. Clearing site
data in the browser removes all locally stored application data.

## No affiliation

This is an independent open-source project. It is not affiliated with, endorsed by, or
sponsored by OpenAI, Apple, Ant Group, or Cloudflare.
