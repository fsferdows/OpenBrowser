import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ChromiumCdpClient,
  BRAVE_SHIELDS_BLOCKED_URLS,
  BRAVE_SHIELDS_CDP_SCRIPT
} from '../src/chromium-client.js';

describe('Live Chrome CDP Brave Shields Ad-Blocking Pipeline Tests (ADR-0020)', () => {
  it('defines comprehensive ad network and tracking domain blocklists', () => {
    assert.ok(Array.isArray(BRAVE_SHIELDS_BLOCKED_URLS));
    assert.ok(BRAVE_SHIELDS_BLOCKED_URLS.length >= 20);

    const requiredPatterns = [
      '*doubleclick.net*',
      '*googlesyndication.com*',
      '*googleadservices.com*',
      '*taboola.com*',
      '*outbrain.com*',
      '*criteo.com*',
      '*castlereach.com*',
      '*youtube.com/pagead/*',
      '*facebook.com/tr/*'
    ];

    for (const pat of requiredPatterns) {
      assert.ok(
        BRAVE_SHIELDS_BLOCKED_URLS.includes(pat),
        `Expected ${pat} to be blocked in BRAVE_SHIELDS_BLOCKED_URLS`
      );
    }
  });

  it('defines CDP document evaluation script with ad hiding, anti-adblock defusers, and video skip daemon', () => {
    assert.strictEqual(typeof BRAVE_SHIELDS_CDP_SCRIPT, 'string');
    assert.ok(BRAVE_SHIELDS_CDP_SCRIPT.length > 200);

    // Ad element hiding rules
    assert.ok(BRAVE_SHIELDS_CDP_SCRIPT.includes('adsbygoogle'));
    assert.ok(BRAVE_SHIELDS_CDP_SCRIPT.includes('ytd-ad-slot-renderer'));
    assert.ok(BRAVE_SHIELDS_CDP_SCRIPT.includes('.ytp-ad-module'));
    assert.ok(BRAVE_SHIELDS_CDP_SCRIPT.includes('#masthead-ad'));

    // Anti-adblock defusers
    assert.ok(BRAVE_SHIELDS_CDP_SCRIPT.includes('googletag'));
    assert.ok(BRAVE_SHIELDS_CDP_SCRIPT.includes('__tcfapi'));

    // YouTube ad auto-skipper
    assert.ok(BRAVE_SHIELDS_CDP_SCRIPT.includes('.ytp-ad-skip-button'));
    assert.ok(BRAVE_SHIELDS_CDP_SCRIPT.includes('currentTime'));
  });

  it('enables Brave Shields via CDP commands (Network.setBlockedURLs and Page.addScriptToEvaluateOnNewDocument)', async () => {
    const executedCommands = [];
    const mockClient = new ChromiumCdpClient({
      fetchFn: async () => ({
        ok: true,
        json: async () => [{ id: 'target-test', type: 'page', url: 'about:blank' }]
      })
    });

    // Mock sendCommand to track calls
    mockClient.sendCommand = async (targetId, method, params = {}) => {
      executedCommands.push({ targetId, method, params });
      return { id: 1, targetId, method, result: { success: true } };
    };

    const res = await mockClient.enableBraveShields('target-test');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.shieldsActive, true);

    const methods = executedCommands.map(c => c.method);
    assert.ok(methods.includes('Network.enable'));
    assert.ok(methods.includes('Network.setBlockedURLs'));
    assert.ok(methods.includes('Page.enable'));
    assert.ok(methods.includes('Page.addScriptToEvaluateOnNewDocument'));

    const setBlocked = executedCommands.find(c => c.method === 'Network.setBlockedURLs');
    assert.deepStrictEqual(setBlocked.params.urls, BRAVE_SHIELDS_BLOCKED_URLS);
  });

  it('automatically applies Brave Shields when navigating a target', async () => {
    let shieldsApplied = false;
    const mockClient = new ChromiumCdpClient({
      fetchFn: async () => ({
        ok: true,
        json: async () => [{ id: 'target-nav', type: 'page', url: 'about:blank' }]
      })
    });

    mockClient.enableBraveShields = async (targetId) => {
      if (targetId === 'target-nav') shieldsApplied = true;
      return { success: true, targetId, shieldsActive: true };
    };

    mockClient.sendCommand = async (targetId, method, params) => {
      return { id: 2, targetId, method, result: { success: true } };
    };

    const nav = await mockClient.navigateTarget('target-nav', 'https://techcrunch.com');
    assert.strictEqual(nav.success, true);
    assert.strictEqual(shieldsApplied, true);
  });
});
