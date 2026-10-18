# ADR-0003: Browser Shell and Side Panel UI Architecture

## Status
Accepted

## Date
2026-10-18

## Context
Phase 1 mandates a branded Chromium-based shell interface with a persistent side panel, modal command bar, voice input integration point, and deterministic local test fixtures for end-to-end verification.

According to Chrome Extensions Manifest V3 specifications, `chrome.sidePanel` is the standardized, native capability for rendering persistent sidebars that share browser window context without modifying webpage DOM or injecting obstructive floating overlays.

## Decision

1. **Manifest V3 Extension Layer (`packages/extension`)**:
   - Manifest V3 extension configuration with minimum necessary permissions: `sidePanel`, `activeTab`, `storage`, `scripting`.
   - The side panel UI is implemented using semantic HTML5, Vanilla CSS, and modern clientside JavaScript, avoiding heavy bundler overhead to maintain instant load times (<50ms).
   - Conforms strictly to WCAG 2.2 AA standards: visible focus states, ARIA landmarks, screen-reader live regions (`aria-live="polite"`), and full keyboard navigation.
   - Implements persistent states:
     - Header: Active profile indicator, connection status to agent core, emergency kill-switch.
     - Command Bar: Natural-language task input, voice input toggle, recent skill suggestions.
     - Execution Stream: Real-time action log with plan step numbers, risk badges, and target summaries.
     - Hand-off Banner: High-visibility alert that triggers when a CAPTCHA, 2FA, or irreversible confirmation is encountered, pausing automation and resuming upon completion.

2. **Deterministic Local Test Harness (`packages/control/tests/fixtures/`)**:
   - Built-in zero-dependency HTTP server utilizing Node.js `node:http`.
   - Serves deterministic test scenarios for end-to-end validation:
     - `/catalog.html`: Product list with accessible table, searchbox, and pagination.
     - `/form.html`: Complex multi-input form with checkboxes, radio buttons, and validation banners.
     - `/auth-hand-off.html`: Login view with simulated 2FA verification step to test human hand-off protocol.

## Consequences
- The browser interface operates smoothly alongside normal user browsing without viewport occlusion.
- End-to-end testing runs deterministically in CI and local development without flaky external internet dependencies.
- Zero extra memory or CPU overhead introduced into host tabs.
