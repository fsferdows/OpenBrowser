# ADR-0021: Local Internal Page Isolation and Omnibox Search Scheme Protection

## Status
Accepted

## Context
When searching for queries such as "hello" in the omnibox on the deployed environment (e.g. `openbrowser-eosin.vercel.app`), the omnibox resolver routed search intent to the native SERP `search.html?q=hello`. However, `sanitizeAndRepairUrl` incorrectly treated the `.html` extension as a top-level domain because it contained a dot (`.`) and no spaces, prepending `https://` to produce `https://search.html?q=hello`.

Consequently:
1. `isSearchPage` regex (`/^\/?search\.html/`) failed to match because the URL started with `https://`.
2. The browser treated `https://search.html` as an external web domain and attempted DNS resolution.
3. The embedded iframe displayed a browser error: *"search.html's server IP address could not be found."*
4. Similar issues could potentially affect internal pages like `portal.html`, `newtab.html`, `catalog.html`, and `form.html`.

## Decision
1. **Internal Local Page Shielding in `sanitizeAndRepairUrl`**:
   - In `packages/control/src/omnibox-resolver.js`, `public/app.js`, `api/proxy.js`, and `scripts/serve-localhost.mjs`, strip any accidental `https://` or `http://` prepended to internal pages (`search.html`, `newtab.html`, `portal.html`, `catalog.html`, `form.html`, `auth-hand-off.html`, `index.html`).
   - Guard all relative `.html` paths so that `https://` is never prepended to internal application pages.
2. **Omnibox Destination Normalization**:
   - In `resolveOmniboxDestination`, immediately classify relative `.html` pages and query-bearing internal URLs (`search.html?q=...`) as `{ type: 'internal', url: cleanInternal }`.
3. **Resilient SERP & Internal Navigation in `navigateLiveUrl`**:
   - Update `isSearchPage` and `isInternalPage` to match optional scheme prefixes and clean the path to `search.html` or `$1.html`.
   - Set `dom.webview.src = cleanSrc` so the internal search SERP loads reliably from the same origin.
4. **Serverless Proxy 302 Redirection**:
   - In `api/proxy.js` and `scripts/serve-localhost.mjs`, detect any requests targeting internal `.html` files and issue an immediate HTTP 302 redirect to the relative path (`/search.html?...`).

## Consequences
- Searches from the omnibox render the dark-mode Braver Search SERP without DNS failures or proxy gateway notices.
- Both localhost and production Vercel deployments handle internal routes seamlessly.
- Zero breaking changes to external domain resolution, query repairing, or CDP streaming.
