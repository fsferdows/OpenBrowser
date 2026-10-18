# Changelog

All notable changes to the Agentic Browser project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Phase 0 foundation: repository context protocol and architecture baseline.
- `CONTEXT/PROJECT_BRIEF.md`: System mission, users, scope, non-goals, and target SLOs.
- `CONTEXT/ARCHITECTURE.md`: High-level multi-layer system architecture and Mermaid sequence diagrams.
- `CONTEXT/GLOSSARY.md`: Canonical project definitions for skill, run, trace, policy, profile, gateway, and provider.
- `CONTEXT/THREAT_MODEL.md`: STRIDE and OWASP Top 10 for LLM Applications security analysis.
- Vendor repository maps with source citations and verified licenses:
  - `CONTEXT/REPO_MAP_chromium.md` (BSD 3-Clause, commit `d15c7054891604504f6d8a96fbed1682a671ffae`)
  - `CONTEXT/REPO_MAP_freellmapi.md` (MIT, commit `d2e2615c1598d0fc1b0d7cd8fb361d037f407de9`)
  - `CONTEXT/REPO_MAP_omniroute.md` (MIT, commit `89ebf6ae26b9dd8726392a0180c970c2976dbae9`)
  - `CONTEXT/REPO_MAP_rea.md` (MIT, commit `ceeff5a41788e47e5aee96a4baf191a6ce7fde4b`)
- Architecture Decision Records:
  - `CONTEXT/DECISIONS/ADR-0001-chromium-strategy-and-hardware-constraints.md`: Selected Phase A (standard host Chromium + CDP + Manifest V3 extension) due to host hardware and disk constraints.
  - `CONTEXT/DECISIONS/ADR-0002-monorepo-structure-and-toolchain.md`: Established Node.js workspace monorepo, TypeScript, native test runner, and package hierarchy.
- `CONTEXT/OPEN_QUESTIONS.md`: Tracked disk footprint constraints and CDP connection mode.
- Root configuration: `master_prompt_v2_production.json`, `.gitignore`.
