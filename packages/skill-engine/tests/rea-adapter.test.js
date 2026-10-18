import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ReaAnalysisAdapter } from '../src/rea-adapter.js';

describe('REA Analysis Adapter Tests', () => {
  const adapter = new ReaAnalysisAdapter();

  const mockHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Demo Store</title>
        <script src="https://google-analytics.com/analytics.js"></script>
        <script src="https://telemetry.example.com/beacon.js"></script>
      </head>
      <body>
        <main>
          <h1>Store Catalog</h1>
          <input type="search" id="search-input" name="q" aria-label="Search Catalog" />
          <button id="search-btn" aria-label="Submit Search">Search</button>
          <a href="/cart" role="link">View Cart</a>
          <button id="buy-item" class="btn primary">Buy Now</button>
        </main>
      </body>
    </html>
  `;

  it('inspectPage accurately discovers interactive elements and detects tracking scripts', () => {
    const result = adapter.inspectPage(mockHtml, 'https://shop.example.com');
    assert.strictEqual(result.summary.totalInteractive, 4);
    assert.strictEqual(result.summary.trackersDetected, 2);
    assert.ok(result.interactiveElements.some(e => e.id === 'search-input' && e.accessibleName === 'Search Catalog'));
    assert.ok(result.interactiveElements.some(e => e.id === 'buy-item' && e.role === 'button'));
  });

  it('discoverWebMcpTools generates semantic tool contracts', () => {
    const mcp = adapter.discoverWebMcpTools(mockHtml, 'https://shop.example.com');
    assert.strictEqual(mcp.protocol, 'WebMCP/1.0');
    assert.ok(mcp.toolsCount >= 3);
    assert.ok(mcp.tools.some(t => t.name === 'dom_fill_search_input'));
    assert.ok(mcp.tools.some(t => t.name === 'dom_click_buy_item' && t.risk_level === 'high'));
  });

  it('observeNetworkAndShields blocks trackers and tallies privacy metrics', () => {
    const requests = [
      { url: 'https://shop.example.com/api/products', method: 'GET' },
      { url: 'https://google-analytics.com/collect', method: 'POST' },
      { url: 'https://telemetry.example.com/track', method: 'POST' },
      { url: 'http://shop.example.com/assets/logo.png', method: 'GET' }
    ];

    const shields = adapter.observeNetworkAndShields(requests, true);
    assert.strictEqual(shields.totalRequests, 4);
    assert.strictEqual(shields.trackersBlocked, 2);
    assert.strictEqual(shields.httpsUpgrades, 1);
    assert.ok(shields.bandwidthSavedKB > 0);
  });

  it('compareWebCaptures computes semantic DOM mutation delta', () => {
    const beforeHtml = `<div><button id="cart-btn">Cart (0)</button></div>`;
    const afterHtml = `<div><button id="cart-btn">Cart (1)</button><div id="notification">Item Added</div></div>`;

    const diff = adapter.compareWebCaptures(beforeHtml, afterHtml);
    assert.strictEqual(diff.hasMutated, true);
    assert.ok(diff.textLengthDelta > 0);
  });

  it('synthesizeGoalTrajectory dynamically binds to URLs and page elements without static fallbacks', () => {
    // 1. Direct URL navigation goal
    const urlTrajectory = adapter.synthesizeGoalTrajectory('https://news.ycombinator.com', mockHtml, 'https://shop.example.com');
    assert.strictEqual(urlTrajectory[0].action, 'navigate');
    assert.strictEqual(urlTrajectory[0].url, 'https://news.ycombinator.com');

    // 2. Dynamic search query extraction
    const searchTrajectory = adapter.synthesizeGoalTrajectory('search for mechanical keyboards', mockHtml, 'https://shop.example.com');
    assert.strictEqual(searchTrajectory[0].action, 'fill');
    assert.strictEqual(searchTrajectory[0].value, 'mechanical keyboards');
    assert.strictEqual(searchTrajectory[1].action, 'click');
    assert.strictEqual(searchTrajectory[1].selector, '#search-btn');
  });
});
