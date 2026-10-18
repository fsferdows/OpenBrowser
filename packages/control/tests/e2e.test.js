import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './fixtures/test-server.js';
import { AccessibilityTree, TargetResolver } from '../src/index.js';

describe('Control Layer End-to-End Local Integration Suite', () => {
  let serverInstance = null;

  before(async () => {
    serverInstance = await startTestServer(0);
  });

  after(async () => {
    if (serverInstance) {
      await serverInstance.stop();
    }
  });

  test('local test server boots and responds with deterministic catalog page', async () => {
    const res = await fetch(`${serverInstance.url}/catalog.html`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Product Catalog'));
    assert.ok(html.includes('MacBook Pro'));
  });

  test('parses simulated CDP accessibility tree from catalog page under latency budget', async () => {
    const startTime = performance.now();

    // Simulated CDP Accessibility Tree payload matching /catalog.html
    const cdpNodes = [
      { nodeId: '1', role: { value: 'WebArea' }, name: { value: 'Mock Product Catalog' } },
      { nodeId: '2', role: { value: 'heading' }, name: { value: 'Product Catalog' } },
      { nodeId: '3', role: { value: 'searchbox' }, name: { value: 'Search Products' }, value: { value: '' } },
      { nodeId: '4', role: { value: 'button' }, name: { value: 'Search' } },
      { nodeId: '5', role: { value: 'table' }, name: { value: 'Products Table' } }
    ];

    const a11yTree = new AccessibilityTree(cdpNodes);
    const resolver = new TargetResolver(a11yTree);

    const searchInput = await resolver.resolve({
      role: 'searchbox',
      name: 'Search Products',
      selector: '#search-box'
    });

    const searchButton = await resolver.resolve({
      role: 'button',
      name: 'Search',
      selector: '#search-btn'
    });

    const duration = performance.now() - startTime;

    assert.ok(searchInput);
    assert.equal(searchInput.strategy, 'accessibility_tree');
    assert.equal(searchInput.node.id, '3');

    assert.ok(searchButton);
    assert.equal(searchButton.strategy, 'accessibility_tree');
    assert.equal(searchButton.node.id, '4');

    // Budget check: action target resolution must take <50ms (well under the 800ms SLO)
    assert.ok(duration < 50, `Resolution latency ${duration.toFixed(2)}ms exceeded 50ms budget`);
  });

  test('detects security hand-off challenge on auth page', async () => {
    const res = await fetch(`${serverInstance.url}/auth-hand-off.html`);
    const html = await res.text();

    const containsSecurityChallenge = html.includes('Security Challenge Required') || html.includes('role="alert"');
    assert.equal(containsSecurityChallenge, true);

    const cdpNodes = [
      { nodeId: '10', role: { value: 'alert' }, name: { value: 'Security Challenge Required' } },
      { nodeId: '11', role: { value: 'button' }, name: { value: 'I am human' } }
    ];

    const a11yTree = new AccessibilityTree(cdpNodes);
    const alertNode = a11yTree.interactiveNodes.find(n => n.role === 'alert' || n.name.includes('Security Challenge'));
    assert.ok(alertNode);
  });
});
