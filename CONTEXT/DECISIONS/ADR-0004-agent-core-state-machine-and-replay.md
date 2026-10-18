# ADR-0004: Agent Core State Machine and Deterministic Replay

## Status
Accepted

## Date
2026-10-18

## Context
Phase 3 mandates the core autonomous agent loop: a deterministic state machine executing the sequence:
`Observe -> Plan -> Validate Policy -> Execute -> Verify -> Criticize -> Checkpoint`.

The system must support:
1. Interactive controls: Pause, Resume, Emergency Kill Switch, and Crash Checkpoint Recovery.
2. Deterministic Replay: Given an immutable trace of actions and observations, reproduce the run for debugging and regression testing without invoking live LLMs.
3. LLM Evaluation Harness: A golden suite of 30+ standardized tasks to quantify accuracy and prevent behavioral regressions across model updates.

## Decision

1. **State Machine (`packages/agent-core/src/state-machine.js`)**:
   - The loop runs in distinct lifecycle stages: `IDLE`, `PLANNING`, `AWAITING_CONFIRMATION`, `EXECUTING`, `VERIFYING`, `EVALUATING`, `PAUSED`, `TERMINATED`.
   - Before any action is dispatched to the control layer, the state machine checks permissions and domain boundaries.
   - The Verifier inspects the post-action observation (URL, title, accessibility tree, or DOM changes) against expected post-conditions.
   - The Critic evaluates trajectory history to detect cyclical action loops (e.g. repeated clicks on unclickable elements) and halts execution if progress stalls.

2. **Checkpoint & Replay (`packages/agent-core/src/checkpoint-manager.js`)**:
   - After each successful step, an immutable checkpoint is committed containing step index, action payload, pre/post observation hashes, and elapsed token/latency metrics.
   - A `ReplayEngine` can consume serialized checkpoints, reproducing the exact step sequence and asserting parity against historical runs.

3. **Golden Evaluation Harness (`packages/agent-core/src/eval-harness.js`)**:
   - Defines a golden suite of 32 standardized tasks across e-commerce search, data extraction, multi-step form entry, pagination, and error handling.
   - Scores tasks on execution correctness, step efficiency, and safety boundary adherence.
   - Releases block if golden suite pass rate drops below the 85% SLO threshold.

## Consequences
- Every agent action is traceable, reproducible, and verifiable.
- Hallucinations or infinite loops are caught by the Critic before token exhaustion.
- Automated evaluation provides empirical proof of agent reliability.
