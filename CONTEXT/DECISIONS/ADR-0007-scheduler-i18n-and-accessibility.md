# ADR-0007: Job Scheduler, Internationalization (i18n), and Accessibility (a11y) Architecture

## Status
Accepted

## Date
2026-10-18

## Context
Phase 6 delivers unattended automation, localization, and accessibility verification:
1. **Automation & Scheduler**: Users require recurring and triggered executions (e.g. scrape product prices every 6 hours, check flight deals daily). The scheduler must run unattended, manage retries with backoff, enforce resource concurrency limits, and emit summary reports.
2. **Internationalization (i18n)**: All UI strings must be externalized from day one. The project ships with English and Bangla (Bengali) first, with RTL bidirectional layout readiness.
3. **Accessibility**: All browser-owned user interfaces must strictly comply with WCAG 2.2 AA rules (contrast, screen reader landmarks, keyboard focus rings, touch targets).

## Decision

1. **Scheduler Engine (`packages/scheduler/src/scheduler.js`)**:
   - Manages job schedules defined by interval (ms) or cron expressions.
   - Resource-bounded parallel queue: limits concurrent active browser tasks to 2 to prevent host memory exhaustion.
   - Fault tolerance: Failed tasks retry up to 3 times with exponential backoff.
   - 24-hour simulation test harness: Advances virtual time to simulate 24 hours of scheduled recurring executions, testing unattended stability, retries, and reporting.

2. **Internationalization (`packages/shared/src/i18n/`)**:
   - Core locale dictionary structure supporting parameterized key interpolation.
   - Shipped locales:
     - `en.json` (English)
     - `bn.json` (Bangla)
   - Locale manager dynamically switches languages without UI reload.

3. **WCAG 2.2 AA Accessibility Auditing (`packages/extension/tests/a11y.test.js`)**:
   - Automated accessibility audit checking:
     - Explicit accessible labels on all interactive controls (`input`, `button`, `select`).
     - ARIA live region declarations (`aria-live="polite"` and `aria-live="assertive"`).
     - Color contrast ratio compliance (>= 4.5:1 for normal text).
     - Full keyboard navigability without mouse dependence.

## Consequences
- The browser agent can run background tasks autonomously for days without memory bloat or crash loops.
- Native multi-lingual user experience out of the box.
- Guaranteed usability for screen-reader and keyboard-only operators.
