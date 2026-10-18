# Vendor Repository Map: FreeLLMAPI

## Overview
- **Repository**: FreeLLMAPI (`https://github.com/tashfeenahmed/freellmapi`)
- **Pinned Commit**: `d2e2615c1598d0fc1b0d7cd8fb361d037f407de9`
- **Role in Project**: Provider adapter supplying aggregated free-tier LLM endpoints behind the model gateway.
- **License**: MIT License (Copyright 2026 Tashfeen Ahmed). Verified in `freellmapi-main/LICENSE`.

## Source Code Entry Points
- **Monorepo Configuration**: `package.json` — Defines workspaces: `shared`, `server`, `client`, `cli`.
- **Server Entry Point**: `server/src/index.ts` — Initializes log redaction, process safety nets, SQLite database, background health check workers, and the HTTP server.
- **Application Factory**: `server/src/app.ts` — Express/Koa-style application setup configuring CORS, rate limiters, authentication middleware, and route mounting.
- **Provider Subsystem**:
  - `server/src/providers/index.ts` — Provider registry and dynamic factory mapping.
  - `server/src/providers/base.ts` — Abstract base provider class defining request normalization, token counting, and error translation.
  - `server/src/providers/openai-compat.ts` — Generic OpenAI-compatible adapter for standard `/v1/chat/completions` endpoints.
  - `server/src/providers/google.ts` — Native adapter for Google Gemini free-tier endpoints.
- **Security & Redaction**:
  - `server/src/lib/log-redaction.js` — Process-wide stdout/stderr interceptor stripping provider API keys and sensitive tokens before writing to console.

## Build and Run Commands
- **Development Server**:
  ```bash
  npm run dev -w server
  ```
- **Build Server**:
  ```bash
  npm run build -w server
  ```
- **Test Suite**:
  ```bash
  npm run test -w server
  ```

## Public Interfaces
- **OpenAI-Compatible HTTP API**:
  - `POST /v1/chat/completions`: Standard chat completion endpoint supporting streaming SSE and structured JSON mode.
  - `GET /v1/models`: Catalog listing active free-tier models and their availability status.
  - `POST /v1/embeddings`: Vector embedding generation endpoint.

## How Integrated into Agentic Browser
FreeLLMAPI is integrated strictly as an **upstream provider adapter** behind the OmniRoute model gateway. OmniRoute treats FreeLLMAPI as one of several routing targets, leveraging its catalog for non-latency-critical background planning and classification tasks, while maintaining instant circuit-breaker failover to alternative providers (such as local Ollama or direct API keys) if free quotas throttle or fail.

## Known Risks and Mitigations
- **Upstream Rate Limiting and Volatility**: Free-tier endpoints may throttle abruptly or alter response formats. Mitigated by OmniRoute's auto-failover, 15-second request timeouts, and client-side JSON Schema validation.
- **Terms of Service Compliance**: Must strictly adhere to upstream terms. The agent never pools keys or circumvents quotas; each user supplies their own credentials or utilizes public tier allowances within stated constraints.
