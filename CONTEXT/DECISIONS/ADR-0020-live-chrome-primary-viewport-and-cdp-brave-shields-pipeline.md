# ADR-0020: Live Chrome Primary Viewport and CDP Brave Shields Ad-Blocking Pipeline

## Status
Accepted

## Context
The user requested: *"everything should be run onto Braver Shield: Live Chrome but there will be no ads on anywhere, it should be run smoothly and perfectly"*.

Prior to this decision:
1. **Secondary / Manual Viewport Mode**:
   The default viewport in `public/app.js` was set to `viewportMode = 'web'` (iframe proxy). The user had to manually locate and click the "Live Chrome" button to engage the interactive Google Chrome CDP session.
2. **Asymmetric Ad-Blocking**:
   While the HTTP webview proxy had `#brave-shields-adblock` stylesheet injection and script strippers, headless Google Chrome running on CDP port `9222` did not have native ad blocking attached. External websites loaded directly in Chrome (such as YouTube, TechCrunch, and media outlets) downloaded banner ads, tracking scripts, and video pre-roll ads.
3. **Stream Jitter & Stutter**:
   The screenshot stream in `public/app.js` used a fixed 150ms timer with a low failure threshold (`cdpFailures >= 2`), which could briefly flicker the connection fallback card while Chrome executed heavy multi-second navigations.

## Decision

1. **Live Chrome as Primary Default Viewport**:
   - In `public/app.js`, set `viewportMode = 'cdp'` by default when running on a local host (`localhost` / `127.0.0.1`), ensuring the browser boots directly into **Braver Shield: Live Chrome**.
   - Sync omnibox navigation, forward clicks, key presses, and wheel scrolls directly to the live Chrome session in real time.

2. **Native Brave Shields Ad-Blocking at the CDP Basement**:
   - In `packages/control/src/chromium-client.js`, implement `enableBraveShields(targetId)`:
     - **CDP Socket-Level URL Blocking (`Network.setBlockedURLs`)**: Intercept and block ad networks, tracking beacons, and analytics scripts (DoubleClick, GoogleSyndication, GoogleAdServices, Criteo, Taboola, Outbrain, Amazon Ad System, Xandr/AppNexus, Admiral, Facebook tracking pixels, and YouTube ad tracking endpoints) directly at the browser network socket with zero network transfer.
     - **DOM-Level Ad Hiding & Overlay Suppression (`Page.addScriptToEvaluateOnNewDocument`)**: Automatically inject `#brave-shields-cdp-adblock` styles hiding all ad slots (`ins.adsbygoogle`, `.ytp-ad-module`, `ytd-ad-slot-renderer`, `#masthead-ad`, etc.) and anti-adblock walls (`.DCDOr`).
     - **YouTube Video Ad Auto-Skipper**: Periodically evaluate and immediately click YouTube skip buttons (`.ytp-ad-skip-button`, `.ytp-skip-ad-button`) and fast-forward in-stream video ads (`video.currentTime = video.duration`) to eliminate pre-roll and mid-roll interruptions.
     - **Anti-Adblock Defusers**: Inject stubs for Google Publisher Tag (`googletag`), AdSense, and CMP (`__tcfapi`) to prevent anti-adblock detection.
   - Automatically invoke `enableBraveShields` upon session creation and target navigation.

3. **Smooth Self-Pacing Screencast Pipeline**:
   - Refactor `refreshCdpStream()` in `public/app.js` from a fixed interval to a self-pacing double-buffered loop: as soon as a frame finishes rendering (`onload`), schedule the next frame with low latency (~60ms).
   - Prevent stream jitter by preserving the previous rendered frame and increasing the error tolerance threshold before displaying fallback warnings, guaranteeing zero flicker during heavy page transitions.

## Consequences
- Every website browsed runs directly inside the live, hardware-accelerated Google Chrome session with full JavaScript, WASM, and media playback fidelity.
- Display ads, banners, sponsored widgets, tracking beacons, and video ads are completely eliminated at both the network and DOM levels.
- The screencast stream runs at a smooth, buttery frame rate with zero visual flicker or premature error warnings.
