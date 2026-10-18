# ADR-0008: Hardening, Chaos Testing, Fuzzing, and Release Engineering

## Status
Accepted

## Date
2026-10-18

## Context
Phase 7 hardens the system against edge-case failures, unhandled exceptions, and operational downtime. The system must maintain reliability under hostile input conditions and infrastructure faults:
1. **Fuzzing & Parser Hardening**: Parsers (skill validator, recorder, model output validator, i18n interpolator) must not crash or leak memory on malformed, oversized, deeply nested, or adversarial JSON inputs.
2. **Chaos Engineering**: The agent execution pipeline must handle injected DOM mutations, mid-flight CDP disconnects, transient HTTP 429/500 faults, and resource limits without crashing or corrupting state.
3. **Release Packaging & Channels**: Users on enterprise and consumer environments require deterministic release packaging, clear channel definitions (`lts`, `stable`, `beta`), staged rollouts, and automatic rollback triggers.
4. **Documentation & Runbooks**: Complete production documentation for operators, developers, and skill authors.

## Decision

1. **Parser Fuzz Testing (`packages/safety/tests/fuzz.test.js`)**:
   - Implement automated property-based fuzz generator producing:
     - Oversized JSON payloads (>1MB).
     - Prototype pollution keys (`__proto__`, `constructor`, `prototype`).
     - Malformed unicode, surrogate pairs, and non-printable control characters.
     - Deeply nested structures (>50 levels).
     - Extreme numbers (`NaN`, `Infinity`, `Number.MAX_SAFE_INTEGER + 100`).
   - Assert all parsers reject malformed input cleanly via typed `ValidationError` without unhandled exceptions or prototype contamination.

2. **Chaos and Fault Injection (`packages/agent-core/tests/chaos.test.js`)**:
   - Simulate CDP disconnects and tab crashes: verify state machine transitions cleanly to `FAILED` with checkpoint preserved for recovery.
   - Injected DOM detachment: verify target resolver detects missing elements and triggers retry or self-repair rather than crashing.
   - Model gateway rate-limiting: verify automatic failover or circuit breaking.

3. **Packaging, Channels & Rollback (`packages/release/` & scripts)**:
   - Release channels:
     - `LTS`: 12-month support window, backported security fixes, monthly Chromium security rebases.
     - `Stable`: Default production channel, bi-weekly release cadence.
     - `Beta`: Staging channel for evaluation harness verification.
   - Automated rollback trigger: if telemetry reports error rate regression > 1.0% in the first 2 hours of a staged release (5% / 25%), rollout halts immediately and reverts to the prior signed release.

4. **Production Documentation Set**:
   - `README.md`: High-level system overview, quickstart, and architecture.
   - `docs/USER_GUIDE.md`: Task execution, voice commands, and scheduled jobs.
   - `docs/DEVELOPER_GUIDE.md`: Monorepo structure, CDP control layer, and adding provider adapters.
   - `docs/SKILL_AUTHORING_GUIDE.md`: Skill JSON schema specification and self-repair authoring rules.
   - `docs/RUNBOOKS.md`: Incident response, key rotation, and rollback procedures.
   - `docs/SUPPORT.md`, `docs/CONTRIBUTING.md`, `docs/CODE_OF_CONDUCT.md`.

## Consequences
- Guaranteed system resilience against unexpected runtime inputs and network outages.
- Clear, reproducible operational procedures for deployments and incident triage.
- Predictable long-term support lifecycle for enterprise deployments.
