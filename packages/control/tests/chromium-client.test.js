import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ChromiumCdpClient } from '../src/chromium-client.js';

describe('Chromium CDP Client Tests', () => {
  const client = new ChromiumCdpClient();

  it('lists Chromium browser targets with simulated fallback', async () => {
    // Test explicit offline client for simulated fallback
    const offlineClient = new ChromiumCdpClient({ port: 19999 });
    const targets = await offlineClient.listTargets();
    assert.ok(Array.isArray(targets));
    assert.ok(targets.length >= 3);
    assert.ok(targets.some(t => t.id === 'target-newtab'));
  });

  it('creates and closes browser targets', async () => {
    const offlineClient = new ChromiumCdpClient({ port: 19999 });
    const newTab = await offlineClient.createTarget('https://shop.example.com');
    assert.ok(newTab.id);
    assert.ok(newTab.url.startsWith('https://shop.example.com'));

    const closed = await offlineClient.closeTarget(newTab.id);
    assert.strictEqual(closed, true);
  });

  it('dispatches synthetic mouse click and keyboard events via CDP', async () => {
    const clickRes = await client.dispatchClick('target-newtab', 120, 240);
    assert.strictEqual(clickRes.clicked, true);
    assert.strictEqual(clickRes.x, 120);
    assert.strictEqual(clickRes.y, 240);

    const typeRes = await client.dispatchType('target-newtab', 'Brave Autonomous');
    assert.strictEqual(typeRes.typed, true);
    assert.strictEqual(typeRes.textLength, 16);
  });

  it('checks live CDP connection status reliably', async () => {
    // When port 9222 is closed/offline, returns false cleanly without unhandled rejection
    const isLive = await client.isCdpConnected();
    assert.strictEqual(typeof isLive, 'boolean');

    // With a responsive mock fetch function, returns true
    const mockClient = new ChromiumCdpClient({
      fetchFn: async () => ({ ok: true, json: async () => ({ Browser: 'Brave/124.0.0.0' }) })
    });
    assert.strictEqual(await mockClient.isCdpConnected(), true);
  });

  it('retrieves browser metadata and version info', async () => {
    const mockClient = new ChromiumCdpClient({
      fetchFn: async () => ({
        ok: true,
        json: async () => ({
          Browser: 'Chrome/155.0.8059.84',
          'Protocol-Version': '1.3',
          'User-Agent': 'Mozilla/5.0 Chrome/155.0.8059.84'
        })
      })
    });
    const info = await mockClient.getBrowserInfo();
    assert.strictEqual(info.connected, true);
    assert.strictEqual(info.browser, 'Chrome/155.0.8059.84');
    assert.strictEqual(info.protocolVersion, '1.3');
  });

  it('navigates targets and captures live DOM metrics', async () => {
    const client = new ChromiumCdpClient();
    const navResult = await client.navigateTarget('target-catalog', 'https://www.youtube.com');
    assert.strictEqual(navResult.success, true);
    assert.strictEqual(navResult.url, 'https://www.youtube.com');

    const liveData = await client.captureLivePage('target-catalog');
    assert.ok(liveData);
    assert.strictEqual(typeof liveData.title, 'string');
    assert.strictEqual(typeof liveData.elementCount, 'number');
    assert.ok(liveData.url);
  });

  it('captures screenshots and rendered DOM with graceful fallback', async () => {
    const offlineClient = new ChromiumCdpClient({ port: 19999 });
    const shot = await offlineClient.captureScreenshot('target-newtab');
    assert.strictEqual(shot.targetId, 'target-newtab');
    assert.strictEqual(shot.format, 'jpeg');

    const html = await offlineClient.captureRenderedHtml('target-newtab');
    assert.strictEqual(html, null);

    const rendered = await offlineClient.navigateAndRender('https://news.ycombinator.com', 0);
    assert.strictEqual(rendered.success, true);
    assert.ok(rendered.url);
    assert.ok(rendered.html);
  });
});

