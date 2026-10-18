# Vendor Repository Map: Chromium

## Overview
- **Repository**: Chromium (`https://github.com/chromium/chromium`)
- **Pinned Commit**: `d15c7054891604504f6d8a96fbed1682a671ffae`
- **Role in Project**: Browser engine and execution host for web automation.
- **License**: BSD 3-Clause License (The Chromium Authors / Google LLC). Verified in `chromium-main/LICENSE`.

## Source Code Entry Points
- **Browser Main**: `chrome/app/chrome_main.cc` — Initial execution entry point for the browser process.
- **Extension Side Panel API**:
  - `chrome/browser/extensions/api/side_panel/side_panel_api.cc` — Implements `chrome.sidePanel` extension APIs.
  - `chrome/browser/extensions/api/side_panel/side_panel_service.cc` — Coordinates side panel view lifecycle and per-tab panel registration.
  - `chrome/browser/extensions/side_panel_helper.cc` — Helper utilities for side panel window embedding.
- **DevTools Protocol Definition**:
  - `third_party/blink/public/devtools_protocol/browser_protocol.pdl` — Source specification for CDP domains: `Accessibility`, `DOM`, `Page`, `Runtime`, `Network`, `Input`.
- **Accessibility Subsystem**:
  - `content/browser/accessibility/` — Accessibility tree creation, AX event dispatching, and serialized tree snapshots.

## Build and Run Commands
- **Phase A (Standard Host & Extension Integration)**:
  - Launch with remote debugging enabled:
    ```bash
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
      --remote-debugging-port=9222 \
      --user-data-dir="/tmp/agentic-browser-profile" \
      --no-first-run --no-default-browser-check
    ```
- **Phase B (Source Build — Dedicated High-Capacity Infrastructure Only)**:
  - Prerequisites: depot_tools, 100GB+ disk space, 16GB+ RAM.
  ```bash
  gn gen out/Default --args='is_debug=false is_component_build=false symbol_level=0'
  autoninja -C out/Default chrome
  ```

## Public Interfaces and Protocols
1. **Chrome DevTools Protocol (CDP)**:
   - `Accessibility.enable`, `Accessibility.getFullAXTree`: Retrieve the comprehensive accessibility tree.
   - `DOM.getDocument`, `DOM.querySelector`, `DOM.describeNode`: Inspect DOM structures.
   - `Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`: Dispatch synthetic hardware input events.
   - `Page.navigate`, `Page.captureScreenshot`: Control navigation and visual state capture.
2. **Manifest V3 Extension APIs**:
   - `chrome.sidePanel.open`, `chrome.sidePanel.setOptions`: Manage persistent side panel UI.
   - `chrome.debugger.attach`, `chrome.debugger.sendCommand`: In-extension CDP communication where external ports are restricted.

## Integration Architecture
The Agentic Browser integrates with Chromium using the **Phase A Strategy**:
The agent engine controls Chromium externally through the Chrome DevTools Protocol over a dedicated local WebSocket. A companion Manifest V3 extension provides the persistent side panel and command palette interface, communicating with the agent core via bidirectional local IPC.

## Known Risks and Mitigations
- **Hardware Footprint**: Compiling Chromium from source requires >100GB disk space and hours of compilation. On resource-constrained host machines (such as 8GB RAM and limited free disk), compiling from source will fail with disk exhaustion. Phase A leverages the existing stable runtime binary, completely eliminating build footprint.
- **Protocol Drift**: Chromium CDP domain definitions evolve across releases. Mitigated by maintaining a version-pinned CDP client contract with runtime capability checks.
