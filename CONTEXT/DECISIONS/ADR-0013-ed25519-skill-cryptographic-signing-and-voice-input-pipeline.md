# ADR-0013: Ed25519 Skill Cryptographic Signing, Verification, and Voice Input Pipeline

## Status
Accepted

## Context
As specified in `master_prompt_v2_production.json` (lines 61, 95, 104) and tracked in `CONTEXT/OPEN_QUESTIONS.md` (`OQ-003`, `OQ-004`):
1. **OQ-004 (Skill Signing Authority)**: Skills can be created, exported, imported, and shared between user instances or published to repositories. Without cryptographic verification, imported skills could be tampered with or contain malicious instructions (DOM manipulation, unauthorized data exfiltration, or rogue payment steps). We need a zero-dependency, tamper-proof signature scheme and a safe import review protocol.
2. **OQ-003 (Voice Input Pipeline)**: Hands-free voice instruction is a core product requirement across the command bar and the search experience. While the browser side-panel command bar had Web Speech API integration in `public/app.js`, the search results page (`public/search.html`) had an unhooked `#btn-voice` button without speech recognition listeners or accessible feedback.

## Decision

### 1. Skill Cryptographic Signing & Verification (`packages/skill-engine/src/skill-crypto.js`)
- **Algorithm**: Standard Ed25519 digital signatures using Node.js native `node:crypto` (`crypto.generateKeyPairSync('ed25519')`, `crypto.sign(null, payload, privateKey)`, and `crypto.verify(null, payload, publicKey, signature)`). Zero external dependencies.
- **Canonical Serialization**: To guarantee deterministic signatures regardless of property ordering or formatting differences, the skill object is canonically serialized (keys sorted alphabetically, omitting the `signature` field itself).
- **Signature Format**: `ed25519:<hex_signature>:<hex_public_key>` stored in the canonical `signature` property conforming to `skill.schema.json`.
- **Keyring & Trust Profiles**:
  - A `SkillKeyring` maintains user-trusted public keys and aliases.
  - Skills signed by a trusted key with `low` or `medium` risk and `requires_confirmation: false` can be registered directly.
  - Skills signed by an unknown key, unsigned skills, or skills marked `high` / `critical` risk or `requires_confirmation: true` mandate an explicit interactive review step (`reviewCallback`) prior to library registration or execution.
  - If a skill payload has been modified in transit, cryptographic signature verification fails immediately with a `SignatureVerificationError`.

### 2. Voice Input Integration (`public/search.html`)
- Integrate `window.SpeechRecognition` / `window.webkitSpeechRecognition` directly on `#btn-voice` in `public/search.html`.
- Maintain visual state (`.listening` pulse styling on the microphone button).
- Support English (`en-US`) and Bangla (`bn-BD`) language recognition according to active user locale.
- Populate `#serp-input` in real-time as speech is recognized and execute query navigation upon speech termination.
- Non-blocking accessible toast notifications when microphone permission is denied or Speech API is unavailable.

## Consequences
- **Positive**:
  - Resolves `OQ-004` and `OQ-003` definitively.
  - Complete tamper resistance for portable skills with zero new third-party dependencies.
  - Transparent human-in-the-loop safety gate for untrusted external skills.
  - Accessible voice input across both Side Panel and Search views.
- **Constraints**:
  - Ed25519 keys require PEM/DER or 32-byte raw hex representation.
