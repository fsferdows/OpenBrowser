# ADR-0017: Elimination of Mock Templates and Real-Time Live SPA Pipeline

## Status
Accepted

## Context
When navigating to `https://www.youtube.com/`, the browser displayed a hardcoded mock page titled "YouTube - Braver Clean Web View" with four static cards and stock photos linking to Rick Astley (`dQw4w9WgXcQ`), rather than rendering the live website.

This violated the core project rule defined in `GEMINI.md`:
> *"No placeholder files, empty stubs, TODOs in shipped paths, or mocks presented as real."*

Investigation revealed:
1. `scripts/serve-localhost.mjs` intercepted any YouTube URL without a `videoId` and returned a hardcoded mock HTML catalog.
2. `api/proxy.js` contained an identical mock catalog block ("YouTube - OpenBrowser Theater").
3. Client-side Single Page Applications (SPAs) like YouTube, GitHub, and Twitter make dynamic `window.fetch` and `XMLHttpRequest` calls (e.g. `/youtubei/v1/browse`) that failed when embedded in an iframe unless relative API paths are resolved against the target origin and proxied through `/api/proxy`.
4. `public/search.html` and `public/portal.html` contained hardcoded fallback redirects to simulated portal views.

## Decision
1. **Remove All Mock Templates from Proxy Handlers**:
   - In both `scripts/serve-localhost.mjs` and `api/proxy.js`, remove the static mock catalog HTML.
   - For specific YouTube video URLs (`/watch?v=...`, `youtu.be/...`), continue to embed the official ad-free nocookie player (`https://www.youtube-nocookie.com/embed/${videoId}`).
   - For all non-video YouTube URLs (homepage, search results, channels) and other web destinations, allow requests to fall through to live upstream fetching and CDP rendering.
2. **Transparent Client-Side Fetch & XHR Proxying**:
   - Injected bridge scripts (`bridgeScript` and `antiFrameBustShim`) intercept `window.fetch` and `XMLHttpRequest.prototype.open` to resolve relative API URLs against `window.__BRAVE_PROXY_URL__` and route them through `/api/proxy?url=...`.
   - `/api/proxy` supports `POST` and forwards request bodies and Content-Type headers to support modern SPA backends.
3. **Eliminate Simulated Fallback Interfaces**:
   - Replace simulated mock cards in `public/portal.html` with an honest, authentic Shielded Gateway notice that directly links to live proxy unblocking and new-tab navigation.
   - In `public/search.html`, navigate directly through `/api/proxy` rather than routing to `portal.html`.

## Consequences
- No fake mock pages or placeholder cards are ever presented as real.
- The browser renders real live websites (YouTube, Google, Facebook, GitHub, Wikipedia, etc.) seamlessly in both Web View and Live Chrome CDP modes.
- Full compliance with `GEMINI.md` code quality and authenticity rules.
