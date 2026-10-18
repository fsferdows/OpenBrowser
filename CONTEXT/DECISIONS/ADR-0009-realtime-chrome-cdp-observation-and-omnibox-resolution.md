# ADR-0009: Real-Time Chrome CDP Observation and Omnibox Search Resolution

## Status
Accepted

## Date
2026-10-19

## Context
When users type queries such as `facebook`, `youtube`, or arbitrary search terms into the Omnibox, the browser studio previously treated all non-URL strings as autonomous agent goals without resolving domains or executing live web search. Furthermore, when Google Chrome is running locally, live browser tabs, DOM state, and navigation telemetry were not surfaced in real time.

Based on `rea-main`'s browser observation architecture (`CdpBrowserProvider`, `CdpPageCapture`, and `CdpConnection`), the system requires:
1. Intelligent Omnibox resolution supporting top domain shortcuts (`facebook`, `youtube`, etc.), TLD detection, and live web search routing (Brave Search / Google Search).
2. Live CDP WebSocket integration connecting directly to Google Chrome / Chromium targets to dispatch commands (`Page.navigate`, `Runtime.evaluate`, `DOM.getDocument`, `Page.captureScreenshot`).
3. Real-time extraction of live page metrics (DOM element count, interactive nodes, rendered titles) streamed via Server-Sent Events (SSE).
4. Automated Chrome CDP launch and tab synchronization in the browser studio interface.

## Decision

1. **Omnibox Resolution & Live Search Engine**:
   - Introduce `resolveOmniboxDestination(input)` in both client controller and server router:
     - Known site shortcuts (`facebook`, `fb`, `youtube`, `yt`, `google`, `reddit`, `twitter`, `x`, `github`, `wikipedia`, `amazon`, `instagram`, `linkedin`, `netflix`) expand directly to canonical HTTPS URLs.
     - Valid domain patterns (`word.tld`, `sub.domain.org`) expand to `https://${domain}`.
     - Multi-word phrases and search terms route to Brave Search (`https://search.brave.com/search?q=${encoded}`) with Google Search alternative.
     - Autocomplete dropdown renders distinct action items: Direct Site Navigation, Brave Web Search, and Autonomous Agent Goal.

2. **Real-Time CDP Protocol Engine (`packages/control/src/chromium-client.js`)**:
   - Recreate `rea-main`'s `CdpConnection` pattern using Node.js native `WebSocket`:
     - Maintain duplex WebSocket sessions with active Chrome/Chromium page targets.
     - Support live command dispatch (`Page.navigate`, `Runtime.evaluate`, `DOM.getDocument`, `Page.captureScreenshot`, `Accessibility.getFullAXTree`).
     - Support `captureLivePage(targetId)` to retrieve live title, URL, DOM element count, interactive elements, and screenshot without eval vulnerabilities.
     - Maintain graceful fallback when CDP port 9222 is offline.

3. **Google Chrome Process & Tab Sync API (`scripts/serve-localhost.mjs`)**:
   - Add `/api/chrome/live-data` endpoint to fetch real-time state of Chrome's active tab.
   - Add `/api/chrome/navigate` endpoint to navigate Google Chrome directly via CDP.
   - Add `/api/chrome/launch` endpoint and `scripts/launch-chrome-cdp.sh` to spawn `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` with `--remote-debugging-port=9222`.
   - Include live Chrome browser version, active tab, and tab list in the 1-second SSE telemetry stream (`/api/stream`).

4. **Brave Studio UI Integration (`public/app.js`, `public/index.html`)**:
   - Display real-time Chrome connection badge (`🟢 Chrome CDP: Live (Chrome 155.0)`) in the top navigation bar.
   - In Omnibox, immediate navigation or search on Enter key or suggestion click.
   - CDP Popover lists all live Chrome tabs with live preview and 1-click tab switching.

## Consequences
- Searching "facebook", "youtube", or any other term resolves immediately to live websites or search results.
- Real-time live data from Google Chrome (open tabs, active URL, DOM tree) streams continuously into the UI.
- Strict adherence to REA architecture: zero mock fallbacks when live Chrome is connected; typed, secure CDP communication.
