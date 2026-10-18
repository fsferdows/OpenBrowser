# Agentic Browser: Developer Guide

This document describes the monorepo architecture, design principles, package boundaries, and development workflows for engineers contributing to the Agentic Browser.

---

## 1. Monorepo Organization

The project is structured as an npm/Node.js workspace monorepo enforcing strict process isolation:

```text
packages/
├── shared/         # JSON Schemas (skill, gateway), i18n manager, enums, error types
├── control/        # Chrome DevTools Protocol (CDP) client, Accessibility Tree parser, target resolver
├── gateway/        # OmniRoute client, FreeLLMAPI adapter, structured output validation, failover
├── agent-core/     # State machine, Planner, Executor, Verifier, Critic, checkpoints & eval harness
├── skill-engine/   # Skill library, matcher, runner, demonstration recorder, self-repair engine
├── safety/         # Policy risk engine, prompt injection firewall, AES-256-GCM vault, fuzz tests
├── scheduler/      # Background job scheduler, retry queues, unattended runner
├── release/        # Release channels (LTS/Stable/Beta), staged rollouts, rollback monitor
└── extension/      # Manifest V3 extension: side panel UI, background service worker, command bar
```

---

## 2. Core Architectural Principles

1. **Accessibility Tree First**: Element perception prioritizes the semantic accessibility tree (`Accessibility.getFullAXTree`) over fragile CSS selectors. Target resolvers use multi-strategy ranking (ARIA name/role > data-testid > text content > CSS path).
2. **Process Isolation**: The Agent Core, Gateway Client, and Skill Runner execute outside the browser renderer process.
3. **Untrusted Web Data**: All web page content is treated strictly as untrusted data, passed through the `PromptInjectionFirewall` inside delimited `<untrusted_page_data>` blocks with canary token verification.
4. **Deterministic Replay**: CheckpointManager serializes state after every action step, allowing interrupted runs to be replayed or resumed from any step.

---

## 3. Integrating Model Providers via OmniRoute

All model requests route through OmniRoute's local OpenAI-compatible endpoint (`http://127.0.0.1:8080/v1`):

```javascript
import { GatewayClient } from '@agentic-browser/gateway';

const gateway = new GatewayClient({
  baseUrl: 'http://127.0.0.1:8080/v1',
  providers: [
    { id: 'primary-freellmapi', endpoint: 'http://127.0.0.1:8080/v1', priority: 1 },
    { id: 'secondary-ollama', endpoint: 'http://127.0.0.1:11434/v1', priority: 2 }
  ],
  timeoutMs: 15000
});

const response = await gateway.requestStep(promptMessages);
```

### Adding a New Provider Adapter
1. In `packages/gateway/src/`, implement a new provider adapter implementing the `requestCompletion(prompt)` interface.
2. Register the adapter in `GatewayClient` provider hierarchy.
3. Validate output against `packages/shared/src/schemas/gateway.schema.json`.

---

## 4. Element Targeting and Self-Repair

When a web page DOM redesign invalidates a selector:
1. `TargetResolver.resolveTarget(pageState, target)` attempts multi-strategy matching:
   - Level 1: Primary CSS selector.
   - Level 2: Semantic ARIA role and accessible name.
   - Level 3: Text content and proximity.
2. If primary matching fails but an alternative strategy succeeds, the `SelfRepairEngine` updates the skill's target definitions and bumps the minor version number.

---

## 5. Testing and Validation Workflows

Run the complete CI test suite:
```bash
npm run ci
```

### Running Individual Subsystem Suites
```bash
# Unit & integration tests
npm test

# Fuzz testing suite (parsers, prototype pollution, oversized inputs)
node --test packages/safety/tests/fuzz.test.js

# Chaos & fault injection tests (CDP disconnects, crashes)
node --test packages/agent-core/tests/chaos.test.js

# 32-task golden evaluation harness
node --test packages/agent-core/tests/eval.test.js

# SLO and performance budget verification
npm run slo:verify

# Security secrets scan & license audit
npm run security:scan
npm run licenses:audit
```
