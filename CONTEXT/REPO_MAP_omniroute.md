# Vendor Repository Map: OmniRoute

## Overview
- **Repository**: OmniRoute (`https://github.com/diegosouzapw/OmniRoute`)
- **Pinned Commit**: `89ebf6ae26b9dd8726392a0180c970c2976dbae9` (Release v3.8.52)
- **Role in Project**: Unified Model Gateway providing intelligent routing, fallback, retry logic, load balancing, and prompt compression behind a single OpenAI-compatible endpoint.
- **License**: MIT License (Copyright 2026 diegosouzapw). Verified in `OmniRoute-release-v3.8.52/LICENSE`.

## Source Code Entry Points
- **Package Manifest**: `package.json` — Defines package version `3.8.52`, ES module runtime (`"type": "module"`), and binary entry points `bin/omniroute.mjs` and `bin/reset-password.mjs`.
- **CLI Entry Point**: `bin/omniroute.mjs` — Provides fast-path argument parsing, environment verification, native binary compatibility checks (`scripts/build/native-binary-compat.mjs`), and launches the Commander application.
- **MCP Mode**: `bin/omniroute.mjs --mcp` — Initializes stdio-based Model Context Protocol server exposing model routing tools directly to AI agents.
- **Server and Domain Routing**:
  - `src/server/` — HTTP server configuration, authentication, and endpoint multiplexing.
  - `src/domain/` — Core routing business logic, quota tracking, health evaluation, and provider fallback graphs.
  - `open-sse/` — High-performance Server-Sent Events (SSE) streaming engine for token streaming responses.
  - `src/mitm/` — Optional interception and proxy handlers for routing external tool calls.

## Build and Run Commands
- **Launch Gateway Daemon**:
  ```bash
  node bin/omniroute.mjs start
  ```
- **Launch MCP Server over Stdio**:
  ```bash
  node bin/omniroute.mjs --mcp
  ```
- **Run Test Suite**:
  ```bash
  npm test
  ```

## Public Interfaces and Endpoints
- **Unified Chat Completions**: `POST /v1/chat/completions` — OpenAI-compatible interface accepting standard JSON chat payloads, streaming SSE chunks, and function/tool-calling schemas.
- **Model Catalog**: `GET /v1/models` — Aggregated catalog of available models across configured providers.
- **Dashboard & Health**: `GET /health`, `GET /dashboard` — Metrics, active provider status, and latency counters.
- **Model Context Protocol (MCP)**: JSON-RPC over stdio interface for tool execution and provider inspection.

## How Integrated into Agentic Browser
The Agentic Browser communicates with AI models **exclusively through OmniRoute as an external service boundary**:
1. The Agent Core initializes a versioned `GatewayClient` pointing to OmniRoute's local endpoint (default `http://127.0.0.1:8080/v1`).
2. When the Planner or Critic requests an inference step, the request is dispatched to OmniRoute.
3. OmniRoute resolves the optimal provider (e.g. FreeLLMAPI for classification, Gemini/Claude for complex planning, Ollama for offline execution), handles transient failures or rate limits with automatic retries, and returns the response.
4. The Agent Core validates the returned JSON against local schemas.

## Known Risks and Mitigations
- **Process Decoupling**: If the OmniRoute daemon crashes or is unavailable, the Agent Core must not hang indefinitely. Mitigated by client-level circuit breakers, 30s request timeouts, and direct fallback adapters for emergency local offline execution.
- **Storage and Footprint**: OmniRoute's complete distribution is substantial (~773MB uncompressed). For resource-constrained deployments, the core runtime is decoupled from docs and test fixtures, running as a lean Node.js daemon.
