# ADR-0002: Monorepo Architecture and Toolchain

## Status
Accepted

## Date
2026-10-18

## Context
Phase 0 requires establishing a scalable, maintainable monorepo with strict package boundaries, typed contracts, automated linting, testing, and continuous integration. The architecture must adhere to the core principles:
1. Process isolation between the Agent Core, Control Layer, Gateway Client, and Extension UI.
2. Typed interfaces at every boundary with runtime schema validation.
3. Clean dependency hygiene with zero decorative or unmaintained dependencies.
4. Lean disk and memory footprint to remain stable within host machine constraints.

## Decision

We establish an npm/Node.js workspace monorepo configured with:
- **Language**: TypeScript 5.x targeting ES2022 / Node.js 22 LTS with native ES modules (`"type": "module"`).
- **Test Framework**: Node.js native test runner (`node:test`, `node:assert`) combined with deterministic unit and integration test harnesses. This avoids heavy external test runners and keeps dependency overhead minimal.
- **Validation**: Schema-first validation using strict JSON Schemas and typed parsers for all external model outputs and skill files.
- **Package Hierarchy**:
  - `packages/shared`: Common types, telemetry contracts, error definitions, and JSON schemas (`skill.schema.json`, `gateway.schema.json`).
  - `packages/control`: Chrome DevTools Protocol (CDP) client driver, accessibility tree query engine, multi-strategy element targeting, and action primitives.
  - `packages/gateway`: Client interface to the OmniRoute gateway daemon, FreeLLMAPI adapter, timeout management, failover logic, and output validation.
  - `packages/agent-core`: State machine orchestrator, Planner, Executor, Verifier, Critic, and Checkpoint/Replay manager.
  - `packages/skill-engine`: Skill loader, intent matcher, demonstration recorder, and self-repair subsystem.
  - `packages/extension`: Manifest V3 browser extension hosting the side panel UI and command palette.

## Consequences
- Every subsystem can be independently tested, built, and versioned.
- The Agent Core has no direct dependency on browser rendering contexts, enforcing process isolation.
- Fast execution cycles: the test suite runs in seconds without heavy transpilation or bundled VM overhead.
- Clear separation between stable public schemas and internal implementation details.
