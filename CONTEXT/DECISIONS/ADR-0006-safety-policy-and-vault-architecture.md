# ADR-0006: Safety Engine, Prompt-Injection Firewall, and Encrypted Vault Architecture

## Status
Accepted

## Date
2026-10-18

## Context
Phase 5 implements the defense-in-depth safety boundaries, privacy guarantees, and permission policies of the Agentic Browser:
1. All web content is untrusted data, never instructions.
2. State-modifying, destructive, financial, or communication actions must be strictly guarded by permission profiles and confirmation policies.
3. Secrets (passwords, tokens, keys) must never appear in prompts, traces, logs, or crash reports.
4. Security regression suite of at least 50 injection and abuse test cases must pass continuously in CI.

## Decision

1. **Policy Engine (`packages/safety/src/policy-engine.js`)**:
   - Classifies actions into 4 risk tiers:
     - `LOW` (Navigation, read-only inspection, scroll)
     - `MEDIUM` (Form inputs, link clicks within permitted domains)
     - `HIGH` (Submitting forms with external side-effects, account updates, deletions)
     - `CRITICAL` (Financial payments, checkout completion, credential exports)
   - Evaluates target domain against `domains_allowed` whitelist.
   - Enforces explicit user confirmation on `HIGH` and `CRITICAL` tiers.

2. **Prompt-Injection Firewall (`packages/safety/src/injection-firewall.js`)**:
   - Sanitizes and sanitizes untrusted webpage text before contextual assembly.
   - Neutralizes known prompt injection signatures (`IGNORE PREVIOUS INSTRUCTIONS`, `SYSTEM OVERRIDE`, `DAN`, roleplay escapes, hidden markdown links, delimiter hijacking).
   - Wraps page observations inside isolated `<untrusted_page_data>` blocks with canary token integrity checks.

3. **Encrypted Vault (`packages/safety/src/vault.js`)**:
   - Uses AES-256-GCM encryption with PBKDF2 key derivation and random 12-byte initialization vectors (IVs).
   - Per-profile master keys stored locally.
   - Secrets are decrypted only in memory at the exact moment of CDP field dispatch; the model prompt receives only opaque reference tokens (e.g. `{{VAULT:username}}`).
   - Automated secret scrubber cleans all outbound logs, traces, and crash dumps.

4. **Security Regression Suite (`packages/safety/tests/security-regression.test.js`)**:
   - Suite of 50 distinct adversarial injection and abuse attack cases (direct injection, indirect injection, delimiter confusion, roleplay jailbreaks, unauthorized payment trigger attempts, and credential exfiltration).

## Consequences
- Protects users from malicious websites attempting to hijack the agent to exfiltrate data or perform unauthorized transactions.
- Zero credentials stored in plaintext.
- Strict compliance with OWASP Top 10 for LLM Applications and ASVS L2 baselines.
