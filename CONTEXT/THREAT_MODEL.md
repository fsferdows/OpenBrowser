# Threat Model: Agentic Browser (STRIDE & OWASP LLM)

## Scope and Security Posture
This document establishes the threat model for the Agentic Browser. The application processes untrusted third-party web content, executes user-authorized browser automation actions, and communicates with external and local Large Language Model providers. The system adheres to the principle of least privilege, zero-trust content handling, and defense-in-depth.

## STRIDE Threat Analysis

| Threat Category | Potential Attack Vector | Mitigations Implemented | Severity |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates an upstream model provider or injection gateway. | TLS verification on all external endpoints; signature validation on imported skills and release bundles; authenticated local gateway sockets. | High |
| **Spoofing** | Malicious website mimics system confirmation dialogs or side panel UI. | Clear visual separation between browser content viewport and native extension/side-panel chrome; distinct OS-level modal dialogs for high-risk approvals. | High |
| **Tampering** | Injected JavaScript on a visited webpage alters DOM elements during execution to redirect agent actions. | Read-only observation via CDP; actions verify element fingerprints (AX role, name, hierarchy) immediately before dispatch; agent core runs in an isolated process. | Critical |
| **Tampering** | Modification of local skill definitions or configuration files on disk. | Cryptographic HMAC/signatures on stored skills; checksum verification; permissions restricted to the operating system user. | Medium |
| **Repudiation** | User denies authorizing an automated payment, transaction, or data deletion. | Immutable local audit log containing timestamp, exact prompt, plan step, risk classification, user confirmation timestamp, and target domain; tamper-evident append-only JSONL. | Medium |
| **Information Disclosure** | Untrusted webpage text prompts the agent to expose vault secrets, session cookies, or system files. | Strict input separation: page content is passed as raw data fields, never instructions; regex and entropy-based secret scrubber strips keys, passwords, and tokens before model prompts and log output. | Critical |
| **Information Disclosure** | Local profile store or telemetry leaks unencrypted credentials. | AES-256-GCM encryption for all vault secrets at rest; telemetry is strictly opt-in and local-first with zero PII/secret export. | High |
| **Denial of Service** | Visited webpage spawns infinite alert dialogs, heavy DOM mutations, or recursive redirects to exhaust agent memory/tokens. | Step timeouts (max 30s per action); maximum steps per task budget (configurable, default 50); rate limits and circuit breakers on CDP listeners and model tokens. | Medium |
| **Denial of Service** | Upstream LLM provider rate limit or outage stalls browser automation. | OmniRoute automatic provider failover; exponential backoff with jitter; graceful pause with user notification. | Medium |
| **Elevation of Privilege** | Indirect prompt injection in page content instructs the agent to download and execute an arbitrary binary or delete local files. | Strict capability boundaries: browser control layer only accesses CDP web APIs (no arbitrary shell execution); high-risk actions (downloads, file uploads, account changes) require explicit user confirmation. | Critical |

## OWASP Top 10 for LLM Applications Mitigation

### LLM01: Prompt Injection (Direct & Indirect)
- **Indirect Injection Defense**: Web content (HTML, page text, attributes) is parsed into structured data objects and wrapped in protective XML tags with strict system instructions that page text is untrusted data and must never be interpreted as commands.
- **Canary Tokens**: Insertion of dynamic canary tokens in prompt contexts to detect and abort if untrusted content causes token repetition or instruction divergence.

### LLM02: Sensitive Information Disclosure
- **Vault Isolation**: Credentials reside in the encrypted vault. The agent model receives only reference identifiers (e.g., `{{VAULT:email}}`), and actual values are injected by the execution driver directly into form fields via CDP, bypassing model context windows entirely.
- **Log Scrubber**: Outbound requests, traces, and logs pass through an automated redaction filter before emission.

### LLM05: Insecure Output Handling
- **Structured Schema Validation**: Model outputs must conform strictly to JSON schemas. Unstructured model text is never piped to `eval()` or shell interpreters. All actions are dispatched via typed CDP primitive functions with validated parameter types.

### LLM06: Excessive Agency
- **Action Risk Classification**:
  - *Tier 1 (Read-Only)*: Navigation, element inspection, reading text -> Auto-approved.
  - *Tier 2 (Idempotent Interaction)*: Clicking internal navigation links, selecting filters -> Auto-approved within allowed domains.
  - *Tier 3 (State-Modifying)*: Submitting forms, updating profile details -> Pre-authorized policy or passive notification.
  - *Tier 4 (High-Risk/Irreversible)*: Financial transactions, account deletions, sending external communications -> Mandatory human confirmation modal.
- **Single-Step Human Hand-off**: CAPTCHA, Cloudflare Turnstile, and 2FA prompts immediately pause execution and yield control to the human user.
