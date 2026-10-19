# ADR-0015: Real-Time Browser Live Proxy Resilience and Navigation Pipeline

## Status
Accepted

## Context
When navigating to websites or clicking search results in the OpenBrowser interface, users encountered the notice:
`⚡ Proxy Gateway Notice: Target site could not be rendered through the serverless proxy (fetch failed).`

Investigation identified several core failure modes:
1. **Google Redirect URL Trapping**: Google Search links use redirect URLs (e.g. `https://www.google.com/url?sa=t&url=https%3A%2F%2F...` or `/url?q=...`). Both `api/proxy.js` and `omnibox-resolver.js` appended `&igu=1` to these redirect paths instead of unwrapping the actual destination URL (`finalUrl = destParam`). This caused the proxy to fetch Google's bot warning/consent page (`oi=unauthorizedredirect`) rather than the target website.
2. **Strict TLS Handshake Failures**: Node.js built-in `fetch` rejects certificates that are self-signed, expired, or missing intermediate chains with `TypeError: fetch failed` when `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` is omitted.
3. **Query Parameter Truncation**: Extracting target URLs using `new URL(req.url).searchParams.get('url')` truncated URLs containing unencoded ampersands (`&`), breaking multi-parameter destinations.
4. **Target `_blank` Escapes & Missing Parent Bridge**: Injected click listeners returned early when `link.target === '_blank'`, failing to intercept search engine links. In addition, clicked links did not post `BRAVE_NAVIGATE` messages to the parent window, leaving the omnibox and tab title out of sync with iframe navigation.
5. **Artificial Portal Lockout**: Facebook, GitHub, and YouTube non-video destinations were arbitrarily forced into static `portal.html` placeholders rather than allowing real-time live proxy browsing.

## Decision
1. **Unwrap Search Engine Redirects**: In `api/proxy.js`, `serve-localhost.mjs`, and `omnibox-resolver.js`, automatically extract the target URL from Google `/url` and `/goto` redirects before fetching.
2. **TLS Resilience & Protocol Failover**:
   - Set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` in `api/proxy.js`.
   - Send full desktop browser telemetry headers (`User-Agent`, `Accept`, `Sec-Ch-Ua`, etc.) to prevent anti-bot connection resets.
   - Implement automatic HTTPS-to-HTTP (and HTTP-to-HTTPS) fallback when the primary protocol fails.
3. **Lossless URL Extraction**: Extract target URLs directly from the raw `url=` query slice to preserve multi-parameter URLs intact.
4. **Universal Link & Window Interception**:
   - Update `antiFrameBustShim` to intercept all anchor clicks regardless of `target="_blank"`, `_top`, or `_self`.
   - Intercept `window.open` to route popups through the browser shell.
   - Post `BRAVE_NAVIGATE` to the parent window so the omnibox, active tab title, and navigation history reflect live page transitions.
   - Detect and unwrap any nested `/api/proxy?url=` occurrences.
5. **Real-Time Live Web View**: Remove mandatory portal redirections for GitHub, Facebook, and external domains on Vercel and localhost, allowing users to browse external sites live.

## Consequences
- Every website and search result link clicked inside OpenBrowser navigates directly to the live destination.
- Omnibox and tab states stay synchronized with iframe link clicks.
- Connection failures from TLS mismatches or HTTP/HTTPS protocol mismatches are eliminated.
- Automated tests verify Google redirect unwrapping, TLS resilience, and lossless query parameter preservation.
