# Agentic Browser: Operations Runbooks

This document provides operational runbooks for incident response, credential rotation, release management, and browser engine updates.

---

## Runbook 1: Incident Response for Provider Outage or HTTP 429 Throttle

### Symptoms
- Telemetry alerts showing elevated `GatewayCircuitBreakerOpen` exceptions.
- Agent tasks failing during planning stage with `GatewayError: All providers failed`.

### Procedure
1. **Inspect Gateway Health**:
   ```bash
   curl http://127.0.0.1:8080/health
   ```
2. **Review Active Provider Status**:
   Inspect OmniRoute dashboard (`http://127.0.0.1:8080/dashboard`) to determine which provider has exhausted rate limits.
3. **Trigger Emergency Local Failover**:
   Update `packages/gateway/src/gateway-client.js` provider order to elevate local offline LLMs (e.g. Ollama `llama3.2` on port 11434).
4. **Notify Users**:
   The gateway client automatically marks degraded mode in the side-panel status indicator.

---

## Runbook 2: Encrypted Vault Key Rotation

### Objective
Rotate the master encryption key used by the `EncryptedVault` without losing stored credentials.

### Procedure
1. Ensure the agent daemon is in idle state (`npm stop` or pause all background schedules).
2. Export all secrets using the current master key:
   ```javascript
   import { EncryptedVault } from '@agentic-browser/safety';
   const oldVault = new EncryptedVault(currentPassword);
   // Decrypt all entries in memory
   ```
3. Initialize the new vault instance with the new master password:
   ```javascript
   const newVault = new EncryptedVault(newPassword);
   for (const [key, secret] of entries) {
     newVault.setSecret(key, secret);
   }
   ```
4. Verify audit log: Confirm all `VAULT_SET` events are recorded.
5. Overwrite the persistent encrypted vault file on disk.
6. Verify access by executing test credential retrieval.

---

## Runbook 3: Release Rollout and Automated Rollback

### Staged Rollout Execution
Releases proceed through automated staged cohorts:
- Stage 1: 5% of devices (monitoring period: 2 hours).
- Stage 2: 25% of devices (monitoring period: 4 hours).
- Stage 3: 50% of devices (monitoring period: 12 hours).
- Stage 4: 100% full production rollout.

### Automated Rollback Trigger
The `RollbackMonitor` continuously analyzes telemetry during the first 2 hours of any rollout.
- **Trigger Condition**: Error rate regression > 1.0% (0.01) over baseline.
- **Automatic Action**: The release distribution immediately halts, updates `updateAvailable: false`, and reverts eligible clients to the prior signed stable release.

### Manual Emergency Rollback
If an unmonitored critical vulnerability or breaking regression is discovered:
1. Issue an immediate manifest revocation:
   ```bash
   npm run release:revoke -- --version <current_version>
   ```
2. Publish prior release manifest as emergency update with higher patch version.

---

## Runbook 4: Monthly Chromium Security Rebase

### Cadence
Every 30 days or immediately following a critical Google Chrome zero-day security bulletin (CVE).

### Procedure
1. Verify latest upstream stable Chromium tag:
   ```bash
   git -C vendor/chromium fetch --tags
   ```
2. Inspect CDP protocol definitions for breaking changes:
   Diff `third_party/blink/public/devtools_protocol/browser_protocol.pdl`.
3. Run monorepo CDP control layer e2e test suite:
   ```bash
   node --test packages/control/tests/control.test.js packages/control/tests/e2e.test.js
   ```
4. Update `CONTEXT/REPO_MAP_chromium.md` with new pinned tag/commit.
5. Update `CHANGELOG.md` and commit with `chore(chromium): rebase stable to <version>`.
