# Project Glossary: Agentic Browser

This document defines normative terminology used across the codebase, documentation, schemas, and architecture records.

### Skill
A versioned, declarative specification describing a reusable automation workflow. A skill defines typed input parameters, permitted host domains, step sequences (actions, targets, expectations, and failure fallbacks), risk classification, confirmation requirements, validation tests, and cryptographic provenance. Skills conform to the canonical JSON Schema (`skill.schema.json`).

### Run
A single, discrete execution of a plan or skill against a target browser environment. A run records input parameters, intermediate checkpoints, executed actions, observation trees, timing benchmarks, token expenditure, and terminal status (completed, failed, paused, cancelled).

### Trace
An immutable, ordered log of events, telemetry spans, network calls, and CDP interactions captured during an agent session or run. Traces implement OpenTelemetry specifications and are stored locally in sanitized form with all secrets redacted.

### Policy
A set of declarative rules that govern what actions an agent may execute without user interaction. Policies define risk thresholds (Read-Only, Idempotent-Write, State-Modifying, High-Risk-Destructive), domain restrictions, financial caps, and mandatory human confirmation checkpoints.

### Profile
An isolated browser and agent state container encapsulating user preferences, stored skills, authorization policies, session cookies, and an independent cryptographic vault key. Actions taken in one profile do not leak into or interact with another profile.

### Gateway
The unified model routing and governance layer that abstracts underlying AI inference APIs. The gateway provides a single OpenAI-compatible `/v1` endpoint, managing intelligent model selection, automated failover across providers, rate-limit backoff, token budgeting, and output schema validation. In this system, OmniRoute serves as the upstream gateway.

### Provider
An external or local service that supplies Large Language Model inference (e.g., Anthropic, OpenAI, Google Gemini, Groq, Ollama, FreeLLMAPI). Providers are encapsulated behind standardized adapter interfaces that normalize request formatting, streaming chunks, and error responses.

### Observation
The structured perception of the current web page presented to the agent. An observation prioritizes accessibility tree nodes (roles, names, states, accessible descriptions), augmented by DOM structure, interactive element coordinates, and optional visual viewport screenshots.

### Step
The smallest atomic unit of agent action within a plan or skill. A step consists of an intentional action (e.g., `navigate`, `click`, `fill`, `select`, `extract`, `scroll`, `press_key`, `upload`), a targeted element descriptor, an expected post-condition, and an error recovery strategy.

### Verifier
The deterministic and semantic verification component that evaluates whether an executed step achieved its intended post-condition (e.g., verifying that a modal appeared, a URL changed, or a form field accepted value) before advancing the plan.

### Critic
The evaluation subsystem that inspects overall trajectory progress, detects execution loops or hallucinated states, scores efficiency against the goal, and recommends replanning or policy escalations.

### Checkpoint
A serialized snapshot of the agent state machine (current plan, executed steps, variable environment, and page reference) enabling pause, resume, undo, and crash recovery without restarting from scratch.

### Self-Repair
The autonomous mechanism that detects selector or DOM path obsolescence when a step fails on a target website, analyzes surrounding semantic and accessibility clues, calculates candidate replacements, verifies them against test assertions, and emits an updated, versioned skill.

### Hand-Off
A security and reliability protocol whereby the agent pauses execution and yields focus to the human user upon encountering an authentication gate, CAPTCHA, 2FA challenge, or payment confirmation. The agent detects completion and resumes automation cleanly.

### Secret Masking
The automated redaction of sensitive data (passwords, auth tokens, credit card numbers, PII) from demonstration recordings, user inputs, traces, and crash dumps prior to storage or model ingestion.
