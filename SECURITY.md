# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities through GitHub's private security advisory
feature for this repository. Do not include API Keys, prompts, images, Endpoint
credentials, or other sensitive data in a public issue.

Public issues are appropriate for non-sensitive bugs and compatibility reports.

## Security boundary

GPT Image 2 Studio is a static browser application. It does not operate a relay or API.
Users are responsible for trusting the Endpoint they configure. The browser sends the
user's API Key and generation content directly to that Endpoint.

Only HTTPS Endpoints are accepted in production. Localhost HTTP is allowed during local
development. Endpoints must provide their own CORS policy, authentication, abuse
protection, content policy, availability, and data handling.

## Supported version

Security fixes are applied to the latest version on the `main` branch.
