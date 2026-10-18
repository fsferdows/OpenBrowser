export const RELEASE_CHANNELS = {
  LTS: 'lts',
  STABLE: 'stable',
  BETA: 'beta'
};

export const STAGED_ROLLOUT_STAGES = [0.05, 0.25, 0.50, 1.00];

export const CHANNEL_CONFIGS = {
  [RELEASE_CHANNELS.LTS]: {
    name: 'Long-Term Support',
    supportWindowMonths: 12,
    cadenceDays: 30, // Monthly security and Chromium rebases
    minTestingPeriodHours: 48,
    autoRolloutEnabled: true
  },
  [RELEASE_CHANNELS.STABLE]: {
    name: 'Production Stable',
    supportWindowMonths: 3,
    cadenceDays: 14, // Bi-weekly feature releases
    minTestingPeriodHours: 24,
    autoRolloutEnabled: true
  },
  [RELEASE_CHANNELS.BETA]: {
    name: 'Public Beta / Staging',
    supportWindowMonths: 1,
    cadenceDays: 3,
    minTestingPeriodHours: 2,
    autoRolloutEnabled: false
  }
};

export const TARGET_PLATFORMS = {
  MACOS_ARM64: { os: 'darwin', arch: 'arm64', artifact: 'AgenticBrowser-{version}-arm64.dmg' },
  MACOS_X64: { os: 'darwin', arch: 'x64', artifact: 'AgenticBrowser-{version}-x64.dmg' },
  WINDOWS_X64: { os: 'win32', arch: 'x64', artifact: 'AgenticBrowser-Setup-{version}.exe' },
  LINUX_X64: { os: 'linux', arch: 'x64', artifact: 'agentic-browser_{version}_amd64.deb' }
};
