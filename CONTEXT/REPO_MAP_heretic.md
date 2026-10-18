# Vendor Repository Map: Heretic

## Overview
- **Repository**: Heretic (`https://github.com/p-e-w/heretic`)
- **Pinned Commit**: `3a5c864527935c7677f79bdbe044a700577cabb2`
- **Role in Project**: Unaligned, refusal-free task execution and conversational AI model configuration engine for the Braver AI Mode chat assistant, routing through OmniRoute and FreeLLMAPI.
- **License**: GNU General Public License v3.0 (GPL-3.0). Verified in `vendor/heretic/LICENSE`.

## Source Code Entry Points
- **Package Manifest**: `pyproject.toml` — Package name `heretic-llm`, dependencies on torch, transformers, accelerate, optuna.
- **CLI Runner**: `src/heretic/main.py` — Central optimization dispatcher automating directional ablation and evaluation.
- **Configuration Profiles**:
  - `config.default.toml` — General model optimization configuration.
  - `config.noslop.toml` — High-efficiency direct task execution without repetitive conversational filler ("slop").
  - `config.nohumor.toml` — Strict factual and deterministic mode.
- **Core Modules**:
  - `src/heretic/model.py` — Transformer layer inspection and directional ablation weight adjustments.
  - `src/heretic/evaluator.py` — Dual metric co-minimization measuring refusal reduction vs. harmless KL divergence.

## How Integrated into Agentic Browser
Heretic is integrated into the **Braver AI Mode & Conversational Agent** layer:
1. In the **Braver Search & Browser Studio**, clicking the **`✨ AI Mode`** button or conversing in chat invokes the Heretic Chat Adapter (`packages/agent-core/src/heretic-chat-adapter.js`).
2. The adapter incorporates Heretic's direct, refusal-free task decomposition framing (`config.noslop.toml` principles), preventing unwarranted model refusal on legitimate browser automation, search analysis, and site interaction tasks.
3. Chat requests in AI Mode are dispatched through **OmniRoute** (primary multi-model cluster) and **FreeLLMAPI** (zero-cost quota guard fallback), executing browser tasks while providing conversational streaming feedback to the user.
