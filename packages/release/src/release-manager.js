import { createHash } from 'node:crypto';
import { RELEASE_CHANNELS, CHANNEL_CONFIGS, STAGED_ROLLOUT_STAGES, TARGET_PLATFORMS } from './channels.js';
import { RollbackMonitor } from './rollback-trigger.js';

export class ReleaseManager {
  constructor(options = {}) {
    this.currentChannel = options.channel || RELEASE_CHANNELS.STABLE;
    this.currentVersion = options.currentVersion || '0.1.0';
    this.activeManifest = null;
    this.rollbackMonitor = new RollbackMonitor(options.rollbackOptions);
    this.installedPackages = new Map();
  }

  setChannel(channel) {
    if (!Object.values(RELEASE_CHANNELS).includes(channel)) {
      throw new Error(`Invalid release channel: ${channel}`);
    }
    this.currentChannel = channel;
  }

  getChannel() {
    return this.currentChannel;
  }

  /**
   * Deterministically assigns a client ID to a staged rollout bucket [0.0, 1.0].
   */
  getCohortScore(clientId) {
    const hash = createHash('sha256').update(clientId).digest('hex');
    const integer = parseInt(hash.slice(0, 8), 16);
    return integer / 0xffffffff;
  }

  /**
   * Evaluates if a given client should receive an update at the current staged rollout percentage.
   */
  isClientEligibleForRollout(clientId, rolloutPercentage) {
    if (rolloutPercentage >= 1.0) return true;
    if (rolloutPercentage <= 0) return false;
    const score = this.getCohortScore(clientId);
    return score <= rolloutPercentage;
  }

  /**
   * Registers a signed release manifest for distribution.
   */
  registerReleaseManifest(manifest) {
    if (!manifest.version || !manifest.channel || !manifest.artifacts || !manifest.signature) {
      throw new Error('Manifest is missing required fields (version, channel, artifacts, signature).');
    }

    if (!Object.values(RELEASE_CHANNELS).includes(manifest.channel)) {
      throw new Error(`Manifest has unsupported channel: ${manifest.channel}`);
    }

    // Verify all target platform artifacts have sha256 checksums
    for (const [platformKey, artifactInfo] of Object.entries(manifest.artifacts)) {
      if (!artifactInfo.checksum || !artifactInfo.url) {
        throw new Error(`Artifact for platform ${platformKey} is missing checksum or url.`);
      }
    }

    this.activeManifest = manifest;
    return true;
  }

  /**
   * Checks for updates for a specific client on a given platform.
   */
  checkForUpdate({ clientId, platform, clientVersion = this.currentVersion }) {
    if (!this.activeManifest) {
      return { updateAvailable: false, reason: 'No active release manifest' };
    }

    if (this.rollbackMonitor.isRollbackTriggered()) {
      return {
        updateAvailable: false,
        reason: `Rollout halted due to automatic rollback: ${this.rollbackMonitor.getRollbackReason()}`
      };
    }

    if (this.activeManifest.channel !== this.currentChannel) {
      return { updateAvailable: false, reason: `Manifest channel does not match active channel ${this.currentChannel}` };
    }

    if (this.activeManifest.version === clientVersion) {
      return { updateAvailable: false, reason: 'Client already on latest version' };
    }

    const rolloutStage = this.activeManifest.rolloutPercentage ?? 1.0;
    const isEligible = this.isClientEligibleForRollout(clientId, rolloutStage);

    if (!isEligible) {
      return {
        updateAvailable: false,
        reason: `Client cohort is outside current rollout stage (${(rolloutStage * 100).toFixed(0)}%)`
      };
    }

    const platformArtifact = this.activeManifest.artifacts[platform];
    if (!platformArtifact) {
      return { updateAvailable: false, reason: `No artifact published for platform: ${platform}` };
    }

    return {
      updateAvailable: true,
      version: this.activeManifest.version,
      channel: this.activeManifest.channel,
      artifact: platformArtifact,
      signature: this.activeManifest.signature
    };
  }

  /**
   * Verifies an installer payload against the registered sha256 checksum.
   */
  verifyArtifactIntegrity(buffer, expectedSha256) {
    const hash = createHash('sha256').update(buffer).digest('hex');
    return hash.toLowerCase() === expectedSha256.toLowerCase();
  }
}
