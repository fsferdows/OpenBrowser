# ADR-0010: Braver HackSuite Security Toolkit, Heretic Autonomous Agent, and Complete Localhost Standalone Web Access

## Status
Accepted

## Date
2026-10-19

## Context
Security researchers, ethical penetration testers, and bug bounty teams require a specialized autonomous browser environment running entirely on `localhost:3000` without reliance on external commercial browsers. Prior implementations faced three primary obstacles:
1. Standard web iframes are blocked by external target sites employing `X-Frame-Options: DENY`, `frame-ancestors 'none'`, Content Security Policies (CSP), and cross-origin fetch restrictions (CORS).
2. Existing AI browser agents often refuse security research prompts, vulnerability analysis, or test payload crafting due to generic safety alignment filters and moralizing refusal boilerplate.
3. Penetration testers frequently need to switch between an external browser, Burp Suite / Caido proxy repeater, JWT decoders, and terminal CDP scripts to test web applications.

To address these requirements cleanly without demo stubs or synthetic slop, we integrate:
- `p-e-w/heretic` refusal-free directional ablation prompt principles with OmniRoute (primary) and FreeLLMAPI (zero-cost quota guarded tier) for pure autonomous security workflows.
- A comprehensive in-browser **HackSuite** containing an HTTP Repeater (Burp-style), Live Attack Surface Analyzer (powered by REA), Security Payload / Decoder Workbench, and Chrome CDP Security Console.
- A hardened Localhost Proxy & Dual Viewport engine allowing 100% full web access from `localhost:3000` for any public or private domain.

## Decision

1. **Complete Standalone Web Access via Localhost Proxy (`scripts/serve-localhost.mjs`)**:
   - Upgrade `/api/proxy` to handle arbitrary external targets, streaming asset fetching (CSS, images, JS, WebFonts, JSON APIs), User-Agent / Referer spoofing, automatic anti-frame-busting shims, and cookie preservation.
   - Dual-Mode Viewport: Users can switch seamlessly between "🌐 Web View" (interactive DOM with REA inspection and Shields) and "⚡ Live Chrome" (direct 60fps streaming view of Google Chrome CDP on port 9222 with interactive click and scroll forwarding for aggressive bot-protected targets).

2. **Heretic Refusal-Free Autonomous Security Agent (`packages/agent-core/src/heretic-chat-engine.js`)**:
   - Utilize `p-e-w/heretic` directional ablation framing (`config.noslop.toml` principles): eliminate moralizing lectures, boilerplate warnings, and unwarranted refusals on defensive security testing.
   - Introduce specialized security modes:
     - `Recon & OSINT`: Endpoint enumeration, technology fingerprinting, subdomains, and script mapping.
     - `Vulnerability Audit`: Assessment of forms, headers, input reflection points, and authentication handoffs.
     - `Payload Crafting`: Construction of testing probes (XSS polyglots, SQLi escapes, SSRF metadata vectors, LFI traversals).
     - `Autonomous Navigation & Automation`: Live DOM actions (clicking, filling, testing, verifying) via OmniRoute and FreeLLMAPI.

3. **Integrated HackSuite Workstation (`public/index.html`, `public/app.js`)**:
   - Add a dedicated `⚡ HackSuite` tab and dock icon in the browser studio interface.
   - Sub-modules:
     - **📡 HTTP Repeater & Request Tamperer**: Craft arbitrary HTTP methods (`GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`, `PATCH`), custom headers, cookies, and body to any destination. Backend executes request via Node `fetch` (zero CORS limitations) and returns raw status, response headers, latency, and formatted response body.
     - **🔍 Live Attack Surface Analyzer (REA SecOps)**: Real-time discovery of input fields, hidden inputs, form actions, inline/external API endpoints, cookie security flags (`HttpOnly`, `Secure`, `SameSite`), and Content-Security-Policy strength.
     - **🧪 Payload & Decoder Workbench**: Instant Base64, URL, Hex, and HTML encoding/decoding; JWT token decoder (header, payload claims, exp expiry check); MD5/SHA256 hashing; and curated security probe vectors.
     - **💻 Chrome CDP Terminal**: Live commands to extract active cookies (`Network.getCookies`), clear storage, evaluate non-destructive JS, and capture high-res page evidence screenshots.

4. **Pure Autonomous Model Gateway Routing (`packages/gateway/src/gateway-client.js`)**:
   - All HackSuite tasks and conversational requests route through `GatewayClient` fronting OmniRoute (`http://127.0.0.1:8080/v1`) and FreeLLMAPI (`http://127.0.0.1:8081/v1`).
   - Zero mock data: real-time HTTP requests, real-time CDP execution, and real DOM extraction.

## Consequences
- Security researchers and ethical hackers can perform complete web assessments, proxy requests, and autonomous browser tasks directly inside `http://localhost:3000` without opening third-party tools.
- AI Mode chats and automation commands execute directly without refusals or lecturing boilerplate.
- All safety policies (human confirmation for irreversible financial transactions/credential deletion) remain intact while technical security testing is fully supported.
