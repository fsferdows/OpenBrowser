import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HereticChatEngine } from '../src/heretic-chat-engine.js';

describe('Heretic Chat Engine Tests', () => {
  const engine = new HereticChatEngine();

  it('handles empty input gracefully', async () => {
    const res = await engine.chat('');
    assert.strictEqual(typeof res.reply, 'string');
    assert.strictEqual(res.action.type, 'none');
  });

  it('detects navigation intents and formats action', async () => {
    const res = await engine.chat('open https://www.facebook.com');
    assert.ok(res.reply);
    assert.strictEqual(res.action.type, 'navigate');
    assert.strictEqual(res.action.target, 'https://www.facebook.com');
  });

  it('detects search queries and formats action', async () => {
    const res = await engine.chat('search for latest AI models');
    assert.ok(res.reply);
    assert.strictEqual(res.action.type, 'search');
    assert.strictEqual(res.action.target, 'latest AI models');
  });

  it('executes chat with live mock gateway client', async () => {
    const mockGateway = {
      requestStep: async () => ({
        thought: 'Navigating to product catalog and selecting top laptop.',
        action: { type: 'navigate', target: 'https://shop.example.com/catalog.html' },
        provider: 'OmniRoute-Cluster',
        latencyMs: 35
      })
    };
    const mockEngine = new HereticChatEngine({ gatewayClient: mockGateway });
    const res = await mockEngine.chat('buy laptop on shop', [], { currentUrl: 'brave://newtab' });
    assert.strictEqual(res.provider, 'OmniRoute-Cluster');
    assert.strictEqual(res.action.type, 'navigate');
    assert.strictEqual(res.action.target, 'https://shop.example.com/catalog.html');
  });
});
