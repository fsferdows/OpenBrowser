# Vendor Repository Map: REA (Reverse Engineer Anything)

## Overview
- **Repository**: REA (`https://github.com/morluto/rea`)
- **Pinned Commit**: `ceeff5a41788e47e5aee96a4baf191a6ce7fde4b` (Version 6.5.0)
- **Role in Project**: Authorized site, network, and application structure analysis engine assisting the Skill Engine during workflow generation and self-repair.
- **License**: MIT License (Copyright 2026 morluto). Verified in `rea-main/LICENSE`.

## Source Code Entry Points
- **Package Manifest**: `package.json` — Package name `rea-agents`, MCP identifier `io.github.morluto/rea`, binary paths `scripts/rea.mjs`.
- **CLI Runner**: `scripts/rea.mjs` — Central CLI dispatcher handling analysis workflows and MCP server lifecycles.
- **Analysis Modules and Verification**:
  - `scripts/verify-browser-dom-destinations.mjs` — Verifies mapping of interactive DOM destinations and targets.
  - `scripts/verify-browser-network.mjs` — Inspects HTTP/WebSocket network traces and API payload patterns.
  - `src/` — Static analysis, binary layout parsing, and abstract syntax tree traversal tools.
  - `scripts/lib/catalog-cli.mjs` — CLI tool catalog generation for agent consumption.

## Build and Run Commands
- **Compile Distribution**:
  ```bash
  npm run compile
  ```
- **Run Verification Tests**:
  ```bash
  npm run verify:browser:dom
  npm run verify:browser:network
  ```
- **Launch MCP Interface**:
  ```bash
  node scripts/rea.mjs mcp
  ```

## Public Interfaces
- **MCP Server (`io.github.morluto/rea`)**: Exposes structured JSON-RPC tools for AST parsing, binary string inspection, script decompilation, and network traffic mapping.
- **CLI Interface**: Standard terminal commands for inspecting bundle payloads, API schema extractions, and client-side web application routing tables.

## How Integrated into Agentic Browser
REA is integrated within the **Site Intelligence** component of the **Skill Engine (Phase 4)**:
1. When the agent records a user demonstration or repairs an obsolete skill, the Site Intelligence subsystem invokes REA analysis routines to inspect target client-side bundle structures and endpoint schemas.
2. REA correlates DOM element behaviors with background fetch calls, identifying the primary data parameters required to make the generated skill robust against minor CSS/DOM cosmetic redesigns.
3. Execution is strictly local and passive.

## Known Risks and Safety Boundaries
- **Strictly Authorized Analysis**: REA is utilized exclusively for understanding application UI structures and client API shapes on sites where the user is authorized.
- **Access Control Boundary**: REA must never be configured or invoked to bypass authentication, crack DRM/obfuscation, circumvent paywalls, or defeat anti-bot mitigations.
