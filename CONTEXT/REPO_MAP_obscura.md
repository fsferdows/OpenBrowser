# Vendor Repository Map: Obscura

## Overview
- **Repository**: Obscura (`https://github.com/h4ckf0r0day/obscura`)
- **Pinned Commit**: `8534b401898ed17b62f69bdc3d5eb186bffb0d60`
- **Role in Project**: Independent, lightweight, stealth native headless browser engine and Chrome DevTools Protocol (CDP) server providing sub-100ms startup, ~30MB memory footprint, native rendering, V8 JavaScript runtime, and stealth TLS fingerprinting without requiring external Chromium or Google Chrome binaries.
- **License**: Apache License 2.0 (Apache-2.0). Verified in `vendor/obscura/LICENSE`.

## Source Code Entry Points
- **Cargo Workspace**: `Cargo.toml` — Workspace with crates for CDP, rendering, JS execution (V8), networking, and CLI.
- **Crates**:
  - `crates/obscura-cli`: Command-line interface implementing `fetch`, `serve`, `scrape`, `mcp`.
  - `crates/obscura-cdp`: Chrome DevTools Protocol implementation (`server.rs`, `dispatch.rs`, domains: `Page`, `Runtime`, `DOM`, `Input`, `Network`, `Emulation`, `Target`).
  - `crates/obscura-render`: Native CSS layout, typography, and paint rasterizer outputting JPEG, PNG, and PDF.
  - `crates/obscura-js`: Deno core / V8 isolate management and DOM Web API bindings.
  - `crates/obscura-net`: Stealth TLS impersonation, HTTP/2 & HTTP/3 stack, and cookie jar.
- **CLI Commands**:
  - `obscura serve --port 9222 --stealth --allow-private-network`: Spawns the CDP server on port 9222.
  - `obscura fetch <url> --eval "<js>"`: Rapid headless page fetch and evaluation.
  - `obscura scrape <urls...>`: High-concurrency parallel scraper.

## How Integrated into Agentic Browser
1. **Headless Engine & Supervisor**:
   - `scripts/launch-obscura-cdp.sh` launches `obscura serve` with stealth enabled on port 9222.
   - `scripts/serve-localhost.mjs` CDP supervisor auto-detects Obscura, managing it as the primary or failover CDP engine when Google Chrome is not installed or when lightweight stealth mode is requested.
2. **Control Layer Protocol Compatibility**:
   - `packages/control/src/chromium-client.js` implements flattened CDP session multiplexing (`sessionId`) to communicate directly with Obscura over WebSocket JSON-RPC.
   - Captures live screenshots (`Page.captureScreenshot`), dispatches mouse and keyboard events (`Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`), evaluates scripts (`Runtime.evaluate`), and navigates targets (`Page.navigate`).
3. **Frontend Live Viewport**:
   - `public/app.js` displays real-time screencast streams and engine badges (`⚡ Obscura Stealth Engine`), providing instant interactive browsing with ad/tracker blocking.
