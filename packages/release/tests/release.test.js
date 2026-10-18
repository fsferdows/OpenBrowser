import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  ReleaseManager,
  RollbackMonitor,
  RELEASE_CHANNELS,
  CHANNEL_CONFIGS,
  TARGET_PLATFORMS
} from '../src/index.js';

describe('Release Engineering & Staged Rollout Suite', () => {
  describe('Release Channels & Configuration', () => {
    it('initializes with STABLE channel by default and allows switching', () => {
      const manager = new ReleaseManager();
      assert.strictEqual(manager.getChannel(), RELEASE_CHANNELS.STABLE);

      manager.setChannel(RELEASE_CHANNELS.LTS);
      assert.strictEqual(manager.getChannel(), RELEASE_CHANNELS.LTS);

      manager.setChannel(RELEASE_CHANNELS.BETA);
      assert.strictEqual(manager.getChannel(), RELEASE_CHANNELS.BETA);

      assert.throws(() => manager.setChannel('invalid-channel'), /Invalid release channel/);
    });

    it('verifies channel configurations conform to operational SLAs', () => {
      assert.strictEqual(CHANNEL_CONFIGS[RELEASE_CHANNELS.LTS].supportWindowMonths, 12);
      assert.strictEqual(CHANNEL_CONFIGS[RELEASE_CHANNELS.STABLE].cadenceDays, 14);
      assert.strictEqual(CHANNEL_CONFIGS[RELEASE_CHANNELS.BETA].autoRolloutEnabled, false);
    });
  });

  describe('Staged Rollout & Cohort Eligibility', () => {
    const manager = new ReleaseManager();

    it('calculates deterministic cohort scores between 0.0 and 1.0', () => {
      const score1 = manager.getCohortScore('client-device-alpha');
      const score2 = manager.getCohortScore('client-device-alpha');
      const score3 = manager.getCohortScore('client-device-beta');

      assert.strictEqual(score1, score2); // Deterministic
      assert.notStrictEqual(score1, score3);
      assert.ok(score1 >= 0 && score1 <= 1.0);
      assert.ok(score3 >= 0 && score3 <= 1.0);
    });

    it('enforces cohort gates at 5% and 100% rollout stages', () => {
      // 100% rollout allows every client
      assert.strictEqual(manager.isClientEligibleForRollout('random-client-1', 1.0), true);
      assert.strictEqual(manager.isClientEligibleForRollout('random-client-2', 1.0), true);

      // 0% rollout blocks every client
      assert.strictEqual(manager.isClientEligibleForRollout('random-client-1', 0.0), false);

      // Verify distribution among 100 diverse client IDs at 25% stage
      let eligibleCount = 0;
      for (let i = 0; i < 100; i++) {
        if (manager.isClientEligibleForRollout(`client-${i}`, 0.25)) {
          eligibleCount++;
        }
      }
      // With 100 pseudo-random hashes, 25% should yield between 15 and 35
      assert.ok(eligibleCount >= 15 && eligibleCount <= 35, `Eligible count was ${eligibleCount}`);
    });
  });

  describe('Signed Manifest & Installer Integrity', () => {
    const manager = new ReleaseManager({ currentVersion: '0.1.0' });
    const dummyPayload = Buffer.from('MOCK_INSTALLER_BINARY_DATA_2026');
    const dummyHash = createHash('sha256').update(dummyPayload).digest('hex');

    const validManifest = {
      version: '0.2.0',
      channel: RELEASE_CHANNELS.STABLE,
      rolloutPercentage: 0.25,
      signature: 'ED25519_SIG_VALID_12345678',
      artifacts: {
        MACOS_ARM64: {
          url: 'https://releases.agenticbrowser.org/darwin-arm64/AgenticBrowser-0.2.0-arm64.dmg',
          checksum: dummyHash,
          sizeBytes: dummyPayload.length
        },
        WINDOWS_X64: {
          url: 'https://releases.agenticbrowser.org/win32-x64/AgenticBrowser-Setup-0.2.0.exe',
          checksum: dummyHash,
          sizeBytes: dummyPayload.length
        }
      }
    };

    it('registers valid signed manifest successfully', () => {
      assert.strictEqual(manager.registerReleaseManifest(validManifest), true);
    });

    it('rejects manifest with missing required fields or unsupported channel', () => {
      assert.throws(() => manager.registerReleaseManifest({ version: '0.2.0' }), /missing required fields/);
      assert.throws(
        () => manager.registerReleaseManifest({ ...validManifest, channel: 'unsupported' }),
        /unsupported channel/
      );
    });

    it('verifies artifact binary against sha256 checksum', () => {
      assert.strictEqual(manager.verifyArtifactIntegrity(dummyPayload, dummyHash), true);

      const corruptedPayload = Buffer.from('TAMPERED_BINARY');
      assert.strictEqual(manager.verifyArtifactIntegrity(corruptedPayload, dummyHash), false);
    });

    it('checks for update and returns platform-specific artifact', () => {
      manager.registerReleaseManifest({ ...validManifest, rolloutPercentage: 1.0 });

      const check = manager.checkForUpdate({
        clientId: 'test-mac-user',
        platform: 'MACOS_ARM64',
        clientVersion: '0.1.0'
      });

      assert.strictEqual(check.updateAvailable, true);
      assert.strictEqual(check.version, '0.2.0');
      assert.strictEqual(check.artifact.checksum, dummyHash);
    });
  });

  describe('Automated Rollback Engine', () => {
    it('does not trigger rollback when error rate is within normal baseline', () => {
      const monitor = new RollbackMonitor({ maxRegressionThreshold: 0.01, evaluationWindowHours: 2.0 });

      // 1000 sessions, 5 failures = 0.5% error rate (equal to baseline)
      const res = monitor.evaluate({
        releaseVersion: '0.2.0',
        totalSessions: 1000,
        failedSessions: 5,
        elapsedHours: 1.0,
        baselineErrorRate: 0.005
      });

      assert.strictEqual(res.action, 'PROCEED');
      assert.strictEqual(monitor.isRollbackTriggered(), false);
    });

    it('Phase 7 Gate: triggers automatic rollback when error regression exceeds 1.0% in first 2 hours', () => {
      const monitor = new RollbackMonitor({ maxRegressionThreshold: 0.01, evaluationWindowHours: 2.0 });

      // 500 sessions, 15 failures = 3.0% error rate (baseline is 0.5%, regression is 2.5% > 1.0%)
      const res = monitor.evaluate({
        releaseVersion: '0.2.0',
        totalSessions: 500,
        failedSessions: 15,
        elapsedHours: 1.5,
        baselineErrorRate: 0.005
      });

      assert.strictEqual(res.action, 'ROLLBACK');
      assert.strictEqual(monitor.isRollbackTriggered(), true);
      assert.ok(monitor.getRollbackReason().includes('exceeds max threshold'));
    });

    it('halts active distribution when rollback monitor flags regression', () => {
      const manager = new ReleaseManager();
      manager.registerReleaseManifest({
        version: '0.2.0',
        channel: RELEASE_CHANNELS.STABLE,
        rolloutPercentage: 1.0,
        signature: 'SIG',
        artifacts: {
          MACOS_ARM64: { url: 'http://test', checksum: 'abc' }
        }
      });

      // Inject regression into manager's rollback monitor
      manager.rollbackMonitor.evaluate({
        releaseVersion: '0.2.0',
        totalSessions: 200,
        failedSessions: 10, // 5% error rate
        elapsedHours: 0.5,
        baselineErrorRate: 0.005
      });

      assert.strictEqual(manager.rollbackMonitor.isRollbackTriggered(), true);

      // Subsequent update check must be rejected immediately
      const check = manager.checkForUpdate({
        clientId: 'any-client',
        platform: 'MACOS_ARM64',
        clientVersion: '0.1.0'
      });

      assert.strictEqual(check.updateAvailable, false);
      assert.ok(check.reason.toLowerCase().includes('automatic rollback'));
    });
  });
});
