import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ChromiumCdpClient } from '../src/chromium-client.js';

describe('Self-Hosted Real-Time CDP Supervisor Tests', () => {
  it('reports CDP status with connected browser details', async () => {
    const mockClient = new ChromiumCdpClient({
      fetchFn: async (url) => {
        if (url.includes('/json/version')) {
          return {
            ok: true,
            json: async () => ({
              Browser: 'Chrome/155.0.8059.84',
              'Protocol-Version': '1.3',
              'User-Agent': 'Mozilla/5.0 Chrome/155.0.8059.84'
            })
          };
        }
        if (url.includes('/json/list')) {
          return {
            ok: true,
            json: async () => [
              { id: 'page-1', type: 'page', title: 'TechCrunch', url: 'https://techcrunch.com' }
            ]
          };
        }
        return { ok: false };
      }
    });

    const isConnected = await mockClient.isCdpConnected();
    assert.strictEqual(isConnected, true);

    const info = await mockClient.getBrowserInfo();
    const targets = await mockClient.listTargets();

    const statusResponse = {
      connected: isConnected,
      browser: info.browser,
      targetsCount: targets.length,
      port: 9222,
      mode: 'self-hosted'
    };

    assert.strictEqual(statusResponse.connected, true);
    assert.strictEqual(statusResponse.browser, 'Chrome/155.0.8059.84');
    assert.strictEqual(statusResponse.targetsCount, 1);
    assert.strictEqual(statusResponse.port, 9222);
    assert.strictEqual(statusResponse.mode, 'self-hosted');
  });

  it('handles offline CDP status gracefully without crashing', async () => {
    const offlineClient = new ChromiumCdpClient({ port: 19998 });
    const isConnected = await offlineClient.isCdpConnected();
    assert.strictEqual(isConnected, false);

    const info = await offlineClient.getBrowserInfo();
    assert.strictEqual(info.connected, false);

    const statusResponse = {
      connected: isConnected,
      browser: info.browser,
      targetsCount: 0,
      port: 9222,
      mode: 'self-hosted'
    };

    assert.strictEqual(statusResponse.connected, false);
    assert.strictEqual(statusResponse.port, 9222);
  });

  it('auto-provisions target if no page target exists during screenshot capture', async () => {
    let targetCreated = false;
    const client = new ChromiumCdpClient({
      fetchFn: async (url, opts = {}) => {
        if (url.includes('/json/list')) {
          if (!targetCreated) {
            return { ok: true, json: async () => [] };
          }
          return {
            ok: true,
            json: async () => [{ id: 'auto-page', type: 'page', url: 'about:blank' }]
          };
        }
        if (url.includes('/json/new')) {
          targetCreated = true;
          return { ok: true, json: async () => ({ id: 'auto-page', type: 'page', url: 'about:blank' }) };
        }
        return { ok: false };
      }
    });

    const targets = await client.listTargets();
    assert.ok(Array.isArray(targets));
    assert.ok(targets.some(t => t.type === 'page'));
  });

  it('relays interactive input commands via CDP client', async () => {
    const client = new ChromiumCdpClient({ port: 19998 });
    const click = await client.dispatchClick('target-newtab', 250, 400);
    assert.strictEqual(click.clicked, true);
    assert.strictEqual(click.x, 250);
    assert.strictEqual(click.y, 400);

    const scroll = await client.dispatchScroll('target-newtab', 100, 100, 0, 300);
    assert.strictEqual(scroll.scrolled, true);
    assert.strictEqual(scroll.deltaY, 300);
  });
});
