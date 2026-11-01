# ADR-0022: Obscura Native Headless Engine and Stealth CDP Pipeline

## Status
Accepted

## Date
2026-11-02

## Context
OpenBrowser previously relied solely on external desktop browsers (Google Chrome or Brave) launched via `/Applications/Google Chrome.app` or OS-installed binaries on CDP port 9222.
While functional when a full desktop Chrome or Brave installation is available and user login profiles are synchronized (ADR-0019, ADR-0020), this approach presents significant operational hurdles:
1. **Heavy Resource Footprint**: Full Chromium requires 200–500+ MB RAM per instance, introduces high cold-start latency (~2000ms), and places heavy demands on constrained development environments (ADR-0001, Darwin M1 8GB RAM).
2. **Headless / Server Environments**: In CI runners, Docker containers, VPS instances, or minimal environments where desktop Google Chrome is not installed, CDP port 9222 remained disconnected, falling back to simulated targets.
3. **Bot & Anti-Scraping Defenses**: Standard headless Chrome is readily fingerprinted and blocked by modern anti-bot systems (Cloudflare, Akamai, Datadome).
4. **Local Native Chromium Compilation Constraints**: As documented in ADR-0001, local compilation of Chromium from source is impossible due to host disk constraints.

The `h4ckf0r0day/obscura` repository provides an independent, open-source (Apache-2.0), lightweight headless browser engine written in Rust:
- **Footprint**: ~30 MB memory consumption vs 200+ MB for headless Chrome; ~70 MB standalone executable.
- **Performance**: Sub-100ms startup latency and ~85ms page loads.
- **Native Rendering & CDP**: Uses V8 for JavaScript execution, features a native CSS/layout/paint rasterizer, and implements the Chrome DevTools Protocol (`ws://127.0.0.1:9222/devtools/browser`, `/json/version`, `/json/list`, `Page`, `Runtime`, `DOM`, `Input`, `Network`).
- **Stealth Transport**: Built-in TLS fingerprint impersonation, anti-detection primitives, and tracker blocking.

## Decision
We integrate `obscura` into OpenBrowser as the native headless browser engine and stealth CDP pipeline:
1. **Vendor Integration**: Map `h4ckf0r0day/obscura` into `/vendor/obscura` at pinned commit `8534b401898ed17b62f69bdc3d5eb186bffb0d60` with `/CONTEXT/REPO_MAP_obscura.md` and Apache-2.0 notice in `THIRD_PARTY_NOTICES.md`.
2. **Binary Distribution**: Place the precompiled native engine binary in `bin/obscura` (with fallback to system path or automated download from official GitHub release assets).
3. **Supervisor Autonomous Failover & Multi-Engine Control**:
   - Provide `scripts/launch-obscura-cdp.sh` to spawn `obscura serve --port 9222 --stealth --allow-private-network`.
   - Update `scripts/serve-localhost.mjs` supervisor to automatically launch Obscura when desktop Chrome is absent or when `CDP_ENGINE=obscura` is requested.
   - Expose active engine status in `/api/chrome/status` (`engine: "obscura" | "chrome" | "brave"`).
4. **Universal Flattened CDP Protocol in ChromiumCdpClient**:
   - Upgrade `ChromiumCdpClient` to support flattened CDP sessions (`sessionId`), seamlessly bridging both Obscura and standard Google Chrome / Chromium over `/devtools/browser` and `/devtools/page/*`.
   - Implement target creation, page navigation, script evaluation, DOM inspection, input dispatch (click, key, scroll), and live screencast/screenshot capture.
5. **Stealth Fetch & Anti-Bot Fallback**:
   - Provide high-performance stealth fetch capabilities leveraging Obscura's CLI transport for scraping and bot-guarded URL extraction.

## Consequences
- **Positive**:
  - OpenBrowser becomes 100% workable out of the box even without Google Chrome or Brave installed.
  - Startup latency drops to under 100ms and memory footprint drops to ~30MB.
  - Live CDP viewport streaming, DOM extraction, and synthetic interaction succeed reliably.
  - Stealth TLS impersonation prevents anti-bot blocks on protected sites.
  - All licenses remain fully compliant with project rules (Apache-2.0 permitted in `scripts/audit-licenses.mjs`).
- **Negative / Neutral**:
  - Complex WebGL / hardware-accelerated 3D features and proprietary DRM (Widevine) are not supported by Obscura's native paint rasterizer; full desktop Chrome remains supported as an alternate engine when DRM or extensions are required.
