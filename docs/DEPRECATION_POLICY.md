# Agentic Browser: Deprecation and Compatibility Policy

This document defines our public interface stability commitment, skill schema migration policies, deprecation timelines, and Long-Term Support (LTS) lifecycle.

---

## 1. Semantic Versioning Specification

The Agentic Browser strictly follows [Semantic Versioning 2.0.0](https://semver.org/):
- **MAJOR (`X.0.0`)**: Incompatible API changes, skill schema breaking changes, or minimum runtime requirement increases.
- **MINOR (`0.Y.0`)**: Backwards-compatible new features, skill schema additions, or new provider adapters.
- **PATCH (`0.0.Z`)**: Backwards-compatible bug fixes, security patches, or performance improvements.

---

## 2. Deprecation Period Requirement

Any feature, configuration key, or skill manifest field marked for removal **MUST** observe a mandatory deprecation window:
- **Minimum Notice**: A minimum of **two minor releases** (or 6 months, whichever is longer) of formal deprecation warning prior to removal.
- **Runtime Warnings**: When deprecated APIs or schema keys are accessed, the system outputs non-fatal diagnostic warnings linking to the migration guide.
- **Changelog Record**: All deprecations must be explicitly listed under a `### Deprecated` section in `CHANGELOG.md`.

---

## 3. Skill Schema Evolution and Migrations

1. **Backwards Compatibility**: Skills authored under any earlier `schema_version` must continue to execute without manual user intervention.
2. **Automated Schema Migrations**: The `SkillMigrator` component automatically translates legacy skill formats into the active schema upon load:
   - Preserves original cryptographic signatures in `provenance.legacy_signature`.
   - Records the migration history in the skill's `changelog`.
3. **No Silent Drops**: The parser will never silently discard unknown or legacy fields without a typed warning.

---

## 4. Release Channel Lifecycle and Support Windows

| Channel | Cadence | Support Window | Security Fixes | Target Audience |
| :--- | :--- | :--- | :--- | :--- |
| **LTS (Long-Term Support)** | 12 months | 12 months active + 6 months maintenance | Backported monthly | Enterprise, automated fleet runners |
| **Stable** | 2 weeks | Until next minor release | Shipped bi-weekly | General users, daily workflows |
| **Beta** | Weekly / Continuous | Latest commit | Active evaluation | Skill authors, developers |

---

## 5. Chromium Rebase Cadence

- **Stable Channel**: Rebased against upstream Chromium stable within 7 days of each major Chromium milestone.
- **LTS Channel**: Receives backported Chromium security patches without changing major Chromium milestones.
