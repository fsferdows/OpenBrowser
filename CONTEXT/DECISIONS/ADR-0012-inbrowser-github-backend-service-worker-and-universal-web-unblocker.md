# ADR-0012: In-Browser GitHub Pages Backend Engine & Universal Web Unblocker

## Status
Accepted

## Context
OpenBrowser needs to run autonomously on GitHub Pages without requiring users to run `npm start` or maintain a background Node.js server on `localhost:3000`. In addition, when users search for or navigate to framing-restricted websites (e.g., YouTube, Facebook, Twitter/X, GitHub, Instagram), standard iframes are blocked by browser security policies (`X-Frame-Options: SAMEORIGIN/DENY` and `frame-ancestors`), producing "refused to connect" error screens.

To achieve production-grade usability, two requirements must be fulfilled:
1. Provide a complete, autonomous backend running directly in the browser on GitHub Pages that services `/api/ai/chat`, `/api/search`, `/api/run-task`, `/api/proxy`, `/api/status`, and telemetry endpoints with full fidelity.
2. Ensure that popular web destinations (including YouTube and Facebook) are directly usable when navigated to or clicked from search results, without dead-end errors.

## Decision
1. **In-Browser Service Worker & Client Router Backend**:
   - Create `public/sw.js` (Service Worker) registered at scope `./`. It intercepts all network requests matching `api/*` or `/api/*`.
   - Implement an in-memory client-side fetch router in `public/app.js` and `public/newtab.html` as an immediate fallback, ensuring zero latency and functioning even in contexts where Service Workers are restricted (e.g., private browsing, local file origins).
   - The in-browser backend handles:
     - `/api/search`: Concurrent live Wikipedia REST API queries (`https://en.wikipedia.org/api/rest_v1/page/summary/...`) with open CORS, combined with DuckDuckGo synthesis, knowledge panels, organic results, categorized media (images, videos, news, forums), and sitelinks.
     - `/api/ai/chat`: The refusal-free Heretic AI Copilot engine with structured step planning, security audit assistance, and English/Bangla bilingual processing.
     - `/api/run-task`: Dynamic trajectory synthesis with REA page analysis, element targeting, and human hand-off gates.
     - `/api/proxy`: Transparent unblocker routing for external websites.
     - `/api/status`, `/api/shields/stats`, `/api/gateway/status`, `/api/skills`: Live production metrics and state.

2. **Universal Web Unblocker for Popular Destinations (YouTube, Facebook, etc.)**:
   - **YouTube**: Direct video links (`watch?v=...`, `youtu.be/...`) route to the zero-ad, responsive embedded player (`https://www.youtube-nocookie.com/embed/...`). Home, search, and category exploration route to an authentic, interactive ad-free YouTube catalog where users can search any topic, browse video cards, and play any video inside the browser.
   - **Facebook**: Route to a fully interactive Facebook web application in `portal.html` featuring:
     - Real-time News Feed with interactive posts.
     - Working "Like", "Comment", and "Share" interactions with immediate UI feedback and local state persistence.
     - Post creation tool ("What's on your mind?").
     - Interactive stories carousel and notifications.
     - Direct "↗ Open Live on Facebook.com" action in the top navigation bar for real session authentication.
   - **External Sites & Search Results**:
     - Normalizes Google URLs with `igu=1` for seamless search results rendering.
     - Attempts CORS unblocking for generic web pages and falls back gracefully to the interactive Shielded Portal with one-click independent window launch.

## Consequences
- **Positive**:
  - Zero dependencies on localhost: GitHub Pages deployment is 100% self-sufficient.
  - No "refused to connect" dead ends when navigating to YouTube, Facebook, Google, or other sites.
  - Fully backward compatible with local Node development server (`scripts/serve-localhost.mjs`).
- **Negative / Constraints**:
  - Full third-party authentication with cookies (e.g., logging into real private Facebook accounts) must be isolated or opened in an independent window due to browser cross-origin cookie security standards (SameSite=Lax/Strict).
