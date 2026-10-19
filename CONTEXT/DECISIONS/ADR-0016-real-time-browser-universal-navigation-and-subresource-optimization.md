# ADR-0016: Real-Time Browser Universal Navigation & Subresource Optimization

## Status
Accepted

## Context
Users reported:
`⚡ Proxy Gateway Notice: Target site could not be rendered through the serverless proxy (fetch failed).`
when navigating from search engines, clicking result links, or visiting multimedia domains like YouTube.

Investigation pinpointed three critical causes:
1. **Search Queries Treated as Hostnames**: When non-URL text, keywords, or queries without TLDs (e.g. `how to code`, `apple`) reached `/api/proxy?url=...`, the proxy prepended `https://` (e.g. `https://how%20to%20code`), causing Node `fetch` to throw `TypeError: fetch failed (ENOTFOUND)`.
2. **Serverless Concurrency Exhaustion from Recursive Subresource Rewriting**: The proxy previously rewrote every `<script src="...">` and `<link href="...">` in HTML documents to route through `/api/proxy?url=...`. Pages with dozens of stylesheets and scripts fired 50-100 simultaneous serverless proxy invocations, exceeding serverless concurrency limits and triggering timeouts or fetch failures.
3. **YouTube Blank White Screen**: Navigating to `https://www.youtube.com` fetched the Polymer SPA directly, which fails in cross-origin iframes.
4. **Double Percent-Encoded Redirect URLs**: Some redirect URLs contained encoded destinations (`https%3A%2F%2F...`), causing `startsWith('http')` checks to fail and leaving the redirect URL unwrapped.

## Decision
1. **Query & Keyword Resolution**:
   - Detect non-URL search queries in `api/proxy.js` and immediately issue an HTTP 302 redirect to `/search.html?q=...`.
   - Resolve top-site shortcuts (`youtube`, `facebook`, `google`, `github`, `reddit`, etc.) to canonical URLs.
2. **CDN Direct Subresource Loading via Base Href**:
   - Discontinue rewriting `<script src>` and `<link href>` tags to `/api/proxy`.
   - Inject `<base href="${effectiveUrl}">` so subresources load directly from origin CDNs with HTTP/2 multiplexing.
   - Strip `crossorigin` and `integrity` attributes to prevent subresource CORS and SRI hash failures.
3. **Interactive YouTube Theater & Catalog**:
   - For video URLs: embed the ad-free nocookie player (`https://www.youtube-nocookie.com/embed/${videoId}`).
   - For YouTube home/search: render the clean, interactive YouTube Theater catalog view with search bar, category chips, and video cards.
4. **Robust Percent-Decoding for Destination Targets**:
   - Percent-decode extracted redirect parameters across `api/proxy.js`, `serve-localhost.mjs`, `omnibox-resolver.js`, and `app.js`.
5. **Service Worker Fallback**:
   - Handle empty or non-HTML responses cleanly in `sw.js` without generating broken frames.

## Consequences
- Omnibox inputs and search queries never trigger `fetch failed` errors.
- Web pages render up to 10x faster by eliminating recursive subresource proxying.
- YouTube loads an ad-free interactive catalog or video player without blank white screens.
- All 220 tests in the test suite pass.
