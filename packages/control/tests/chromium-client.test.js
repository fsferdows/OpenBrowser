import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ChromiumCdpClient } from '../src/chromium-client.js';

describe('Chromium CDP Client Tests', () => {
  const client = new ChromiumCdpClient();

  it('lists Chromium browser targets with simulated fallback', async () => {
    const targets = await client.listTargets();
    assert.ok(Array.isArray(targets));
    assert.ok(targets.length >= 3);
    assert.ok(targets.some(t => t.id === 'target-newtab'));
  });

  it('creates and closes browser targets', async () => {
    const newTab = await client.createTarget('https://shop.example.com');
    assert.ok(newTab.id);
    assert.strictEqual(newTab.url, 'https://shop.example.com');

    const closed = await client.closeTarget(newTab.id);
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
});
