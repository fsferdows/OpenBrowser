# ADR-0014: Vercel CLI Deployment, Artifact Filtering, and Serverless Edge Pipeline

## Status
Accepted

## Context
1. **Multi-Target Cloud Deployment**: OpenBrowser was initially configured for localhost Node.js operation (`localhost:3000`) and static GitHub Pages hosting (`fsferdows.github.io/OpenBrowser/`). The user requested deployment to Vercel using the Vercel CLI (`vercel build` / `vercel`).
2. **Payload Size Constraints**: The project repository contains large vendor source trees (`chromium-main` at 5.4 GB, `OmniRoute-release-v3.8.52` at 786 MB, `freellmapi-main` at 20 MB, `rea-main` at 61 MB, and media assets `1.mp4` at 66 MB). Without explicit ignore rules, Vercel CLI packaging exceeds the 100 MB upload limit and fails immediately.
3. **Static Routing & Service Worker Headers**: OpenBrowser uses an autonomous in-browser backend running via `public/sw.js`. On Vercel, static routing must serve `public/` directly as the root application with `Service-Worker-Allowed: /` and clean URLs enabled.
4. **Cloud Unblocking Proxy**: On static hosting, framing-restricted domains (YouTube, GitHub, Facebook) rely on the Shielded Web Portal. On Vercel, we can additionally provide a Node.js Serverless Function (`api/proxy.js`) that strips `X-Frame-Options` and CSP `frame-ancestors` in the cloud, giving Vercel users a full live proxy equivalent to localhost.

## Decision

### 1. Vercel Payload Filtering (`.vercelignore`)
- Create `.vercelignore` to exclude large vendor directories (`chromium-main/`, `OmniRoute-release-v3.8.52/`, `freellmapi-main/`, `rea-main/`, `vendor/`), media binaries (`1.mp4`), and development caches (`node_modules/`, `.git/`, `.github/`).
- Reduces deployment package size from >6.3 GB to ~3.5 MB, ensuring instant upload and avoiding memory exhaustion.

### 2. Vercel Configuration (`vercel.json`)
- Configure `"outputDirectory": "public"` with `"cleanUrls": true`.
- Provide HTTP headers for `sw.js` (`Service-Worker-Allowed: /`, `Cache-Control: no-cache, no-store, must-revalidate`).
- Add security headers (`X-Content-Type-Options: nosniff`).

### 3. Serverless Unblocker Proxy Function (`api/proxy.js`)
- Implement a zero-dependency Vercel Serverless Function at `api/proxy.js`.
- Accepts `?url=<destination>`, resolves targets using omnibox rules, normalizes protocols, fetches target content with a 10s timeout, strips framing restrictions (`x-frame-options`, `content-security-policy`), injects `<base href="...">`, and streams response back to the client.

## Consequences
- **Positive**:
  - One-command deployment via Vercel CLI (`vercel` / `vercel --prod`) and local build verification (`vercel build`).
  - Fast, lightweight packaging (~3.5 MB) respecting Vercel quotas.
  - Serverless cloud proxy provides unblocked website framing on Vercel deployments.
  - Retains full client-side Service Worker v2 fallback compatibility.
- **Constraints**:
  - Serverless function timeout adheres to Vercel Hobby tier default (10 seconds).
