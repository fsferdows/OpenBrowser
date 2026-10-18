# Project Brief: Agentic Browser

## Mission
Build and maintain a production-grade, long-term-supported AI agentic browser. The browser enables users to declare an operational task once; the autonomous agent plans and executes the task across web pages, learns the underlying workflow structure, stores it as a versioned, schema-validated skill, and automatically repairs the skill when targeted websites update their layout or DOM tree. The system is designed for multi-year maintainability, local-first privacy, rigorous safety boundaries, and strict adherence to software engineering standards.

## Target Users
1. **Automators and Knowledge Workers**: Operators executing repetitive data extraction, multi-tab form submissions, report aggregations, and workflow orchestration.
2. **Technical Power Users**: Developers and engineers who inspect, audit, parameterize, and version browser automation scripts via code and declarative schemas.
3. **General Users**: End-users delegating multi-step navigation and transactions through natural language and voice input with clear explanations and safety gates.

## Scope
1. **Browser Shell and Interface**:
   - Chromium-based browser application hosting a persistent side panel, modal command palette, and audio/voice input pipeline.
   - Dual-mode operation: standard user browsing and autonomous agent mode.
   - Full accessibility conforming to WCAG 2.2 AA, including keyboard navigation, focus management, and screen-reader support.
   - Internationalization with externalized strings; English and Bangla shipped first, RTL architectural readiness.

2. **Control and Execution**:
   - Chrome DevTools Protocol (CDP) driver with an accessibility-tree-first observation model, supplemented by DOM snapshotting and vision/screenshot fallback.
   - Resilient multi-strategy element targeting (role/name, text, test IDs, semantic path, visual bounding box).

3. **Agent Core and Replay**:
   - Deterministic Planner -> Executor -> Verifier -> Critic state machine.
   - Safe execution controls: pause, resume, emergency kill switch, checkpoint recovery, and dry-run simulation.
   - Full session replay with DOM step logs, screenshots, token metrics, and action traceability.

4. **Skill Engine**:
   - Versioned, schema-validated skill manifests (`.skill.json` adhering to strict JSON Schema).
   - Demonstration recorder with automatic password and secret masking.
   - Autonomous skill matching from natural language prompts.
   - Self-repair engine detecting DOM drift and generating resilient selector patches.
   - Cryptographically signed skill export and import verification.

5. **Model Gateway and Provider Routing**:
   - External model gateway client interfacing with OmniRoute for fallback, circuit breaking, latency optimization, and rate-limit buffering.
   - Integration adapter for FreeLLMAPI free-tier aggregation and local LLM endpoints (Ollama / llama.cpp).
   - Strict output schema validation and repair for structured agent responses.

6. **Safety, Vault, and Security**:
   - Zero-trust untrusted web content boundary (page text and attributes treated exclusively as data, never instructions).
   - Local encrypted credential vault with per-profile AES-GCM encryption keys.
   - Categorized permission profiles (Low, Medium, High risk) with mandatory user confirmations for state-modifying actions (payments, account edits, deletions, communications).
   - Automated captcha and 2FA user hand-off protocol.

## Non-Goals
1. **Bypassing Access Controls**: The agent will not attempt to bypass CAPTCHAs, Cloudflare Turnstile, Cloudflare bot management, two-factor authentication, or rate limits. Such challenges are immediately handed off to the user.
2. **Account Pooling or Terms Evasion**: The system will not facilitate rotating unauthorized API accounts, pooling shared keys to evade rate limits, or abusing free provider terms.
3. **Full Custom C++ Browser Engine**: The project does not maintain a ground-up rendering engine. It builds upon Chromium via CDP and Manifest V3 extension architecture.
4. **Autonomous High-Risk Destructive Operations**: Unconfirmed deletions, external financial transactions, mass external messaging, and irreversible configuration changes are strictly forbidden without explicit human authorization.

## Success Metrics and Service Level Objectives (SLOs)
- **Task Success Rate**: >= 85% success on the standardized golden evaluation suite (30+ representative tasks).
- **Session Stability**: >= 99.5% crash-free agent sessions.
- **Action Execution Latency**: p95 <= 800ms per agent control step (excluding external LLM inference roundtrips).
- **Self-Repair Success Rate**: >= 70% automatic repair rate on simulated DOM selector deprecations without human intervention.
- **Zero Secrets Leakage**: 0 secrets, tokens, or plaintext credentials permitted in logs, traces, or telemetry.
- **Accessibility**: 100% compliance with automated WCAG 2.2 AA audit rules across all browser-owned UI surfaces.
