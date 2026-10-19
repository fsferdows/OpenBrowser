# ADR-0018: Malformed URL Query Repair and Anti-Adblock Neutralization Pipeline

## Status
Accepted

## Context
Two critical browsing usability issues were reported:

1. **Malformed URL Generation (`https://www.youtube.com&themeRefresh=1`)**:
   When navigating or when client-side SPAs (such as YouTube's theme refresh, form submissions, or relative redirects) append parameters to URLs lacking a trailing path or query delimiter, the parameter was appended with an ampersand (`&`) directly after the domain (e.g. `https://www.youtube.com&themeRefresh=1`).
   In standard URL parsing, everything between the scheme and the first `/` or `?` is treated as the host. Consequently, WHATWG URL and Node.js `fetch` attempted a DNS lookup for `www.youtube.com&themerefresh=1`, which failed with `ENOTFOUND` (`fetch failed`), displaying the error:
   > *"Braver Shield: Live Connection Notice. The destination at https://www.youtube.com&themeRefresh=1 restricted standard iframe proxying (fetch failed)."*

2. **Publisher Anti-Adblock Script Overlays (TechCrunch / Admiral)**:
   When navigating to `https://techcrunch.com/latest/`, third-party anti-adblock detection scripts (Admiral / BlockThrough via `castlereach.com` and `succeedscene.com`) detected that Brave Shields blocked ad network endpoints and bait CSS classes.
   The anti-adblock script dynamically inserted a full-screen blocking overlay (`.DCDOr`) with the message:
   > *"Something went wrong. Disable your adblocker on TechCrunch. It looks like your adblocker is attempting to interfere with the intended operation of this site."*
   This prevented user interaction and locked scrolling, despite the underlying article content having successfully loaded.

## Decision

1. **Robust URL Sanitization & Query Delimiter Repair**:
   - Create and export `sanitizeAndRepairUrl(rawUrl)` in `packages/control/src/omnibox-resolver.js` and `packages/control/src/index.js`.
   - The sanitizer detects URLs containing an ampersand (`&`) without an initial question mark (`?`). If the ampersand immediately follows the host (e.g. `https://www.youtube.com&themeRefresh=1`), it repairs the delimiter to `/?` (yielding `https://www.youtube.com/?themeRefresh=1`). If within a path (e.g. `/results&q=test`), it normalizes the first ampersand to `?`.
   - Apply `sanitizeAndRepairUrl` consistently in `scripts/serve-localhost.mjs`, `api/proxy.js`, `public/app.js`, and `resolveOmniboxDestination`.
   - When extracting `url` query parameters in `/api/proxy`, properly associate any additional unencoded query parameters with the destination target rather than corrupting the URL structure.

2. **Publisher Anti-Adblock Neutralization**:
   - **HTML Script Stripping**: In both `scripts/serve-localhost.mjs` and `api/proxy.js`, strip obfuscated Admiral / anti-adblock script tags matching known signatures (`castlereach`, `succeedscene`, `getadmiral`, `pubgifs`, `_afsr`, `Disable your adblocker`) before sending HTML to the client.
   - **CSS Shield Rules**: Update the injected `#brave-shields-adblock` stylesheet to suppress known anti-adblock overlay containers (`.DCDOr`, `[class*="a__s1p0xe8r"]`, `div[class*="adblock"]`, `iframe[src*="getadmiral"]`, `.adblock-overlay`) and enforce `html, body { overflow: auto !important; position: static !important; }`.
   - **Bait & API Defuser Stubs**: In the client-side injection shim, inject stubs for Google Publisher Tag (`window.googletag`), AdSense (`window.adsbygoogle`), and CMP (`window.__tcfapi`), while disarming Admiral flags (`window['_afsr'] = false`).
   - **Dynamic Mutation Removal**: Implement a MutationObserver in the shim to automatically detach any delayed anti-adblock overlay DOM elements and ensure body scroll remains unlocked.

## Consequences
- URLs with malformed query parameters (e.g. `https://www.youtube.com&themeRefresh=1`) automatically repair to valid destinations and fetch successfully without proxy gateway notices.
- Content on publisher websites using Admiral anti-adblock (such as TechCrunch) renders smoothly and interactively without blocking dialogs or scrolling locks.
- Brave Shields maintains aggressive tracker and ad blocking while eliminating false positive lockout walls.
