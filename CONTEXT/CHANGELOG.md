# Changelog

All notable changes to the Agentic Browser project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Phase 8 (Continuous Sustainment):
  - `packages/skill-engine/src/skill-migrator.js`: Automated backwards-compatibility engine migrating legacy skill schema versions (`v0.8`, `v0.9`) to canonical `1.0.0` specification.
  - Transparent skill migration during registration in `SkillLibrary.registerSkill`.
  - Dedicated regression migration test suite (`packages/skill-engine/tests/migration.test.js`).
  - Monthly Chromium security rebase procedures and failure triage workflows in `docs/RUNBOOKS.md`.
  - Phase report: `PHASE_REPORT_8.md`.
  - Comprehensive final release document: `FINAL_REPORT.md`.
- Phase 7 (Hardening, Chaos Testing, and Release Engineering):
  - `packages/safety/tests/fuzz.test.js`: 35-test property-based fuzz testing suite covering skill schema, gateway output, i18n interpolation, prompt injection firewall, and encrypted vault against prototype pollution, malformed unicode, and oversized payloads.
  - `packages/agent-core/tests/chaos.test.js`: 5-test chaos engineering suite simulating mid-flight CDP connection drops, browser tab crashes, DOM element detachments, gateway 429 exhaustion, and step budget timeouts.
  - `packages/release`: Release management engine implementing `LTS`, `Stable`, and `Beta` channels, staged rollout cohort distribution (5%, 25%, 50%, 100%), installer checksum verification, and automatic rollback triggers (regression > 1.0% in first 2 hours).
  - `scripts/verify-slo-budgets.mjs`: Automated CI budget verification for cold start (< 500ms), step latency (< 100ms), memory overhead (< 150MB), task success rate (>= 95%), and crash-free session rate (>= 99.5%).
  - Complete production documentation suite: `README.md`, `docs/USER_GUIDE.md`, `docs/DEVELOPER_GUIDE.md`, `docs/SKILL_AUTHORING_GUIDE.md`, `docs/RUNBOOKS.md`, `docs/DEPRECATION_POLICY.md`, `docs/SUPPORT.md`, `docs/CONTRIBUTING.md`, `docs/CODE_OF_CONDUCT.md`.
  - Architecture Decision Record `CONTEXT/DECISIONS/ADR-0008-hardening-fuzzing-and-release-engineering.md`.
  - Phase report: `PHASE_REPORT_7.md`.
- Phase 6 (Automation, Scheduling, and UX):
  - `packages/scheduler`: Concurrency-bounded job scheduler supporting interval and cron execution, exponential backoff retries, and simulated 24-hour unattended test verification.
  - `packages/shared/src/i18n`: Externalized localization engine shipping English (`en`) and Bangla (`bn`) first with parameter interpolation and RTL text readiness.
  - `packages/extension/tests/a11y.test.js`: Automated WCAG 2.2 AA accessibility audit suite certifying semantic landmarks, accessible names, live regions, focus rings, and mathematical color contrast (>= 4.5:1).
  - Architecture Decision Record `CONTEXT/DECISIONS/ADR-0007-scheduler-i18n-and-accessibility.md`.
  - Phase report: `PHASE_REPORT_6.md`.
- Phase 5 (Safety, Privacy, and Policy):
  - `packages/safety`: 4-tier risk classification policy engine, indirect prompt-injection firewall, encrypted credential vault (AES-256-GCM), and append-only audit logger.
  - Mandatory confirmation policies for destructive actions, financial transactions, and credential alterations.
  - Dynamic canary tokens and delimiter escaping neutralizing untrusted webpage injection payloads.
  - 50-test adversarial security regression suite covering direct injection, DOM injection, delimiter breakout, exfiltration, and high-risk policy enforcement.
  - Automated secret scrubber stripping passwords and API keys from logs and traces.
  - Architecture Decision Record `CONTEXT/DECISIONS/ADR-0006-safety-policy-and-vault-architecture.md`.
  - Phase report: `PHASE_REPORT_5.md`.
- Phase 4 (Skill Engine and Learning):
  - `packages/skill-engine`: Skill library, parameterized skill runner, demonstration recorder with secret masking, and autonomous self-repair engine.
  - Zero-replanning execution for learned skills on stable steps.
  - Self-repair subsystem automatically detecting broken selectors via the accessibility tree, testing repairs, and saving updated semver versions.
  - Architecture Decision Record `CONTEXT/DECISIONS/ADR-0005-skill-engine-and-self-repair.md`.
  - Phase report: `PHASE_REPORT_4.md`.
- Phase 3 (Agent Core):
  - `packages/agent-core`: Plan-Act-Verify-Critic state machine with checkpointing and recovery.
  - Interactive operator controls: pause, resume, emergency stop kill switch, and checkpoint recovery.
  - CheckpointManager and deterministic replay engine reproducing recorded traces without live model inference.
  - Golden evaluation harness with 32 canonical tasks achieving 100% pass rate (exceeding 85% SLO threshold).
  - Architecture Decision Record `CONTEXT/DECISIONS/ADR-0004-agent-core-state-machine-and-replay.md`.
  - Phase report: `PHASE_REPORT_3.md`.
- Phase 2 (Model Gateway):
  - `packages/gateway`: Resilient model gateway client fronting OmniRoute and FreeLLMAPI with automatic multi-provider failover.
  - Request timeout enforcement and circuit breaker failure tracking.
  - Structured output validation against `gateway.schema.json`.
  - Latency, token, and estimated cost tracking per request.
  - Phase report: `PHASE_REPORT_2.md`.
- Phase 1 (Browser Shell and Control Layer):
  - `packages/extension`: Manifest V3 extension with persistent `chrome.sidePanel`, WCAG 2.2 AA accessible side panel UI, dark/light theme, emergency kill switch, and Web Speech API voice input integration.
  - `packages/control`: Multi-strategy target resolver prioritizing accessibility role/name, falling back to CSS selectors.
  - Deterministic zero-dependency local test server serving mock catalog, form, and security challenge pages.
  - End-to-end integration test suite (`packages/control/tests/e2e.test.js`).
  - Architecture Decision Record `CONTEXT/DECISIONS/ADR-0003-browser-shell-and-sidepanel-architecture.md`.
  - Phase report: `PHASE_REPORT_1.md`.
- Phase 0 foundation: repository context protocol and architecture baseline.
- `CONTEXT/PROJECT_BRIEF.md`: System mission, users, scope, non-goals, and target SLOs.
- `CONTEXT/ARCHITECTURE.md`: High-level multi-layer system architecture and Mermaid sequence diagrams.
- `CONTEXT/GLOSSARY.md`: Canonical project definitions for skill, run, trace, policy, profile, gateway, and provider.
- `CONTEXT/THREAT_MODEL.md`: STRIDE and OWASP Top 10 for LLM Applications security analysis.
- Vendor repository maps with source citations and verified licenses:
  - `CONTEXT/REPO_MAP_chromium.md` (BSD 3-Clause, commit `d15c7054891604504f6d8a96fbed1682a671ffae`)
  - `CONTEXT/REPO_MAP_freellmapi.md` (MIT, commit `d2e2615c1598d0fc1b0d7cd8fb361d037f407de9`)
  - `CONTEXT/REPO_MAP_omniroute.md` (MIT, commit `89ebf6ae26b9dd8726392a0180c970c2976dbae9`)
  - `CONTEXT/REPO_MAP_rea.md` (MIT, commit `ceeff5a41788e47e5aee96a4baf191a6ce7fde4b`)
- Architecture Decision Records:
  - `CONTEXT/DECISIONS/ADR-0001-chromium-strategy-and-hardware-constraints.md`: Selected Phase A (standard host Chromium + CDP + Manifest V3 extension) due to host hardware and disk constraints.
  - `CONTEXT/DECISIONS/ADR-0002-monorepo-structure-and-toolchain.md`: Established Node.js workspace monorepo, TypeScript, native test runner, and package hierarchy.
- `CONTEXT/OPEN_QUESTIONS.md`: Tracked disk footprint constraints and CDP connection mode.
- Root configuration: `master_prompt_v2_production.json`, `.gitignore`.
