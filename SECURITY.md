# Security Policy

## Supported Versions

| Version | Supported          |
| :---    | :---               |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security and integrity of the Agentic Browser seriously. If you discover a vulnerability, security flaw, or potential information disclosure issue, please report it via coordinated disclosure:

1. **Do not file a public GitHub issue.**
2. Email full technical details, reproduction steps, and impact assessment to: `security@agentic-browser.local` (or file a private GitHub Advisory).
3. We acknowledge receipt of vulnerability reports within **24 hours**.

## Security Patch Service Level Agreements (SLAs)

- **Critical Severity (CVSS 9.0–10.0)**: Fix committed and emergency hotfix released within **48 hours**.
- **High Severity (CVSS 7.0–8.9)**: Fix committed and patch released within **7 calendar days**.
- **Medium Severity (CVSS 4.0–6.9)**: Fix included in the next scheduled minor/patch release (within **14 calendar days**).
- **Low Severity (CVSS 0.1–3.9)**: Addressed within **30 calendar days**.

## Security Architecture Principles

- **Zero-Trust Web Content**: Web pages are treated exclusively as untrusted data input, never as operational instructions.
- **Strict Vault Isolation**: Decryption of stored credentials occurs only at the target element input boundary via CDP; plaintext secrets never enter model context windows.
- **Automated Scanning in CI**: Every commit is scanned for secrets, outdated dependencies, and unauthorized license additions.
- **No Captcha/Anti-Bot Circumvention**: Captchas and 2FA are explicitly delegated to the human operator for that single step.
