# ADR-0019: Self-Hosted Real-Time Chrome CDP Auto-Supervision and Viewport Status Synchronization

## Status
Accepted

## Context
The user requested: *"make everything self hosted so that it works on real time"*.

In a production-grade autonomous AI browser, running 100% self-hosted locally on the user's workstation without relying on external cloud proxies, third-party mock fallbacks, or manual secondary terminal commands requires robust auto-supervision and runtime synchronization:

1. **Manual Launch Dependency & Socket Lock Contention**:
   Previously, running headless Google Chrome or Chromium with Chrome DevTools Protocol (CDP) enabled on port 9222 required running a separate bash script (`scripts/launch-chrome-cdp.sh`) in another terminal. If Chrome crashed or was abruptly terminated, orphaned `SingletonLock`, `SingletonSocket`, or `SingletonCookie` files in `/tmp/chrome-real-user-profile` caused subsequent launches to hang silently, preventing CDP from binding to `127.0.0.1:9222`.

2. **Missing Status Route Causing Erroneous Fallback Card**:
   In `public/app.js`, switching to "Live Chrome" mode issues a `fetch('/api/chrome/status')` check to determine whether the live canvas stream should be displayed or if the fallback connection card should be shown. Because `scripts/serve-localhost.mjs` only implemented `/api/chrome/live-data`, the call to `/api/chrome/status` failed with HTTP 404, prompting `public/app.js` to catch the error and display the "Live Google Chrome CDP session required" card even when Chrome was active.

3. **Autonomous Local Supervisor**:
   A truly self-hosted real-time browser must be self-contained: starting `npm start` must automatically supervise both the Node.js server and the underlying Chromium/Chrome engine, self-healing in the background if either process restarts or encounters errors.

## Decision

1. **Autonomous Chrome CDP Supervisor in `scripts/serve-localhost.mjs`**:
   - Implement `ensureChromeCdpSupervised(forceRestart = false)`:
     - Tests whether `127.0.0.1:9222` is responsive via `chromiumClient.isCdpConnected()`.
     - If disconnected, purges any stale lockfiles (`SingletonLock`, `SingletonSocket`, `SingletonCookie`) from `/tmp/chrome-real-user-profile`.
     - Automatically spawns `scripts/launch-chrome-cdp.sh` in detached, unreferenced background mode.
     - Polls port 9222 until active (or timeout).
   - Hook supervisor into server startup (`server.listen`) and attach a periodic heartbeat check (every 10 seconds) to ensure CDP stays connected indefinitely.
   - On on-demand operations (`/api/chrome/status`, `/api/chrome/navigate`, `/api/chrome/screenshot`), trigger auto-supervision if CDP connectivity is temporarily interrupted.

2. **CDP Status Endpoint Parity**:
   - Add `/api/chrome/status` and `/api/chrome/health` handlers in `scripts/serve-localhost.mjs`.
   - Return `{ connected: boolean, browser: string, targetsCount: number, port: 9222, mode: 'self-hosted' }`.
   - Auto-trigger `ensureChromeCdpSupervised()` if a status request arrives while disconnected, enabling instant recovery.

3. **Stale Lock Cleanup in `scripts/launch-chrome-cdp.sh`**:
   - Add explicit cleanup of `$USER_DATA_DIR/Singleton*` locks before invoking Google Chrome binary, preventing headless profile deadlocks.

4. **Real-Time Interactive Frame Streaming & Target Provisioning**:
   - In `/api/chrome/screenshot`, verify target availability; if no active page target exists, provision one via `chromiumClient.createTarget('about:blank')`.
   - Serve JPEG frames with `Cache-Control: no-cache, no-store` for 150ms screen polling in `public/app.js`.
   - Maintain input event forwarding (`click`, `key`, `type`, `scroll`) directly into the CDP basement.

5. **Local Emergency Fallback**:
   - In `/api/proxy`, whenever an external site fails standard fetch or displays anti-bot challenges, the serverless proxy uses the supervised local Chrome CDP instance via `chromiumClient.navigateAndRender` to generate full-fidelity DOM snapshots in real time.

## Consequences
- Launching the application (`npm start`) fully boots and supervises both the frontend/proxy server and the local Chromium engine with zero manual steps.
- The Live Chrome CDP viewport immediately displays real-time interactive frames without showing connection warning cards.
- Profile deadlocks from unclean shutdowns are eliminated.
- All proxying, rendering, and AI agent automation functions run 100% self-hosted on localhost with zero external cloud dependencies.
