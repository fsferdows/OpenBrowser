# ADR-0005: Skill Engine and Self-Repair Subsystem Architecture

## Status
Accepted

## Date
2026-10-18

## Context
Phase 4 implements the learning, reuse, and self-repair capabilities of the Agentic Browser. The primary value proposition is:
"Users describe a task once. The agent performs it, learns the workflow, saves it as a versioned skill, and repairs it when sites change."

Requirements:
1. When a task is performed a second time, the agent must match and run the existing skill directly, executing stable steps without replanning or consuming unnecessary LLM inference tokens.
2. Demonstration recorder must capture actions while automatically redacting passwords, auth cookies, and sensitive form inputs.
3. When a target website alters its DOM or changes element selectors, the Self-Repair engine must detect the broken step, evaluate candidate semantic replacements via the accessibility tree and site intelligence, verify the replacement, and save an updated semver version (e.g. `1.0.0` -> `1.0.1`).

## Decision

1. **Skill Library & Intent Matcher (`packages/skill-engine/src/skill-library.js`)**:
   - Manages stored skills conforming to `skill.schema.json`.
   - Matches user goals against registered triggers and domain constraints using lexical and semantic scoring.
   - Enforces schema migrations across version bumps.

2. **Skill Runner (`packages/skill-engine/src/skill-runner.js`)**:
   - Executes pre-compiled skill steps deterministically.
   - Substitutes typed user parameters (e.g., `{{query}}`).
   - Stable steps execute with zero LLM inference, achieving sub-second speed and zero token expenditure.

3. **Demonstration Recorder (`packages/skill-engine/src/skill-recorder.js`)**:
   - Intercepts input events from CDP.
   - Masks sensitive input types (`type="password"`, `autocomplete="current-password"`, credit card regexes).
   - Extracts parameterized variables and outputs a validated skill manifest.

4. **Self-Repair Engine (`packages/skill-engine/src/self-repair.js`)**:
   - When a step fails (selector not found or timeout), the repairer:
     1. Fetches the current full accessibility tree.
     2. Identifies semantic candidate matches using accessible name, role, proximity, and REA-assisted DOM destination heuristics.
     3. Dispatches a candidate action against the page to verify post-condition fulfillment.
     4. Upon successful test pass, generates an updated skill version with an incremented patch version and updated changelog.

## Consequences
- Repeated tasks run deterministically and fast without consuming model quotas.
- Sites with changing class names or dynamic CSS frameworks (Tailwind/CSS modules) do not permanently break learned skills.
- Sensitive credentials never leak into generated skill manifests.
