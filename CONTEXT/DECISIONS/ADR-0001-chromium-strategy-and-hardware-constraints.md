# ADR-0001: Chromium Strategy and Hardware Constraints

## Status
Accepted

## Date
2026-10-18

## Context
The specification defines two distinct options for the Chromium integration layer:
- **Phase A**: Chromium-based application with a Manifest V3 side-panel extension and Chrome DevTools Protocol (CDP) control over WebSocket.
- **Phase B**: Maintained patch-set on a pinned stable Chromium release, rebased on every security release, requiring full source builds.

Hardware inspection of the current host environment yielded:
- **Architecture**: Darwin ARM64 (Apple M1)
- **Memory**: 8 GB RAM (`hw.memsize: 8589934592`)
- **Available Disk Space**: ~230 MB free out of 228 GB total filesystem capacity.

A full Chromium source tree compilation requires a minimum of 100 GB of free disk space, 16–32 GB of RAM, and hours of compile time. Running a Phase B compile in this environment would immediately trigger catastrophic disk exhaustion and out-of-memory errors.

## Options Considered

### Option 1: Phase B — Source Compilation and Custom Chromium Fork
- *Pros*: Complete low-level C++ control over browser internals and internal IPC primitives.
- *Cons*: Strictly impossible on the current host machine due to hardware and disk limits (>100GB disk needed, <1GB available); massive maintenance overhead for upstream security rebases.

### Option 2: Phase A — Standard Chromium Host with Manifest V3 Side Panel & CDP
- *Pros*:
  - Fully compatible with current machine specs (uses existing Google Chrome 155.x installation or headless Chromium).
  - Fast developer startup and rapid CI execution.
  - Full automation control via standardized Chrome DevTools Protocol (`Accessibility`, `DOM`, `Page`, `Input`, `Runtime`).
  - Native extension side panel (`chrome.sidePanel`) provides an integrated user experience.
  - Automatic security patching provided by the stable browser channel without manual rebase compile cycles.
- *Cons*: Cannot modify low-level Blink/V8 C++ internals directly (though none are currently required by the product requirements).

## Decision
We select **Phase A**:
The Agentic Browser will operate as a standalone agent engine controlling a Chromium-based host (Google Chrome / Chromium) via the Chrome DevTools Protocol, coupled with a Manifest V3 extension that delivers the side panel UI, command palette, and user hand-off dialogs.

## Consequences
- The development environment and CI pipelines can build and execute without specialized build server infrastructure.
- Monorepo package structure focuses on TypeScript/Node.js, Web standards (HTML/CSS/JS), and CDP communication.
- Hardware requirements remain accessible to general developer machines (e.g. 8GB Apple Silicon).
- Phase B is deferred to future dedicated cloud compilation infrastructure if deep C++ modifications are ever mandated.
