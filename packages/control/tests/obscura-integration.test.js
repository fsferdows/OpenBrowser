import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ChromiumCdpClient } from '../src/chromium-client.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = dirname(dirname(dirname(dirname(__filename))));
const OBSCURA_BIN = join(ROOT_DIR, 'bin', 'obscura');

describe('Obscura Native Headless Engine & Stealth CDP Pipeline Tests (ADR-0022)', () => {
  it('correctly parses and identifies Obscura browser metadata from CDP version payload', async () => {
    const mockObscuraVersion = {
      Browser: 'Chrome/145.0.0.0',
      'Protocol-Version': '1.3',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      'V8-Version': '14.5.0.0',
      'WebKit-Version': '537.36',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/browser'
    };

    const mockFetch = async (url) => {
      if (url.includes('/json/version')) {
        return {
          ok: true,
          json: async () => mockObscuraVersion
        };
      }
      return { ok: false };
    };

    const client = new ChromiumCdpClient({ port: 9222, fetchFn: mockFetch });
    const info = await client.getBrowserInfo();

    assert.equal(info.connected, true);
    assert.equal(info.engine, 'obscura');
    assert.equal(info.isObscura, true);
    assert.equal(info.rawBrowser, 'Chrome/145.0.0.0');
    assert.ok(info.browser.includes('Obscura'));
    assert.equal(info.webSocketDebuggerUrl, 'ws://127.0.0.1:9222/devtools/browser');
  });

  it('correctly maps sessionId and routes commands over flattened browser WebSocket session', async () => {
    const sentMessages = [];
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 1; // OPEN
        setTimeout(() => {
          if (this.onopen) this.onopen();
        }, 10);
      }

      send(data) {
        const parsed = JSON.parse(data);
        sentMessages.push(parsed);

        // Simulate CDP response
        setTimeout(() => {
          if (this.onmessage) {
            if (parsed.method === 'Target.createTarget') {
              this.onmessage({
                data: JSON.stringify({
                  id: parsed.id,
                  result: { targetId: 'page-obscura-1' }
                })
              });
            } else if (parsed.method === 'Target.attachToTarget') {
              this.onmessage({
                data: JSON.stringify({
                  id: parsed.id,
                  result: { sessionId: 'session-obscura-1' }
                })
              });
            } else if (parsed.method === 'Page.captureScreenshot') {
              this.onmessage({
                data: JSON.stringify({
                  id: parsed.id,
                  result: { data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }
                })
              });
            } else {
              this.onmessage({
                data: JSON.stringify({
                  id: parsed.id,
                  result: { success: true, methodCalled: parsed.method }
                })
              });
            }
          }
        }, 15);
      }
    }

    const mockFetch = async (url) => {
      if (url.includes('/json/version')) {
        return {
          ok: true,
          json: async () => ({
            Browser: 'Chrome/145.0.0.0',
            webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/browser'
          })
        };
      }
      if (url.includes('/json/list')) {
        return {
          ok: true,
          json: async () => [{
            id: 'page-obscura-1',
            type: 'page',
            url: 'about:blank',
            webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/page-obscura-1'
          }]
        };
      }
      return { ok: false };
    };

    const client = new ChromiumCdpClient({
      port: 9222,
      fetchFn: mockFetch,
      wsConstructor: MockWebSocket
    });

    const session = await client.getOrCreateSession('page-obscura-1');
    assert.ok(session, 'Session should be created');
    assert.equal(session.sessionId, 'session-obscura-1');

    const screenshot = await client.captureScreenshot('page-obscura-1');
    assert.equal(screenshot.success, true);
    assert.ok(screenshot.data.length > 20);

    // Verify sent messages included sessionId
    const screenshotMsg = sentMessages.find(m => m.method === 'Page.captureScreenshot');
    assert.ok(screenshotMsg, 'Page.captureScreenshot must be sent');
    assert.equal(screenshotMsg.sessionId, 'session-obscura-1');
  });

  it('verifies Obscura native launch script and CLI presence', () => {
    const launchScript = join(ROOT_DIR, 'scripts', 'launch-obscura-cdp.sh');
    assert.ok(existsSync(launchScript), 'launch-obscura-cdp.sh must exist');

    const repoMap = join(ROOT_DIR, 'CONTEXT', 'REPO_MAP_obscura.md');
    assert.ok(existsSync(repoMap), 'REPO_MAP_obscura.md must exist');

    const adr22 = join(ROOT_DIR, 'CONTEXT', 'DECISIONS', 'ADR-0022-obscura-native-headless-engine-and-stealth-cdp-pipeline.md');
    assert.ok(existsSync(adr22), 'ADR-0022 must exist');
  });

  it('runs live Obscura CDP server, verifies navigation, DOM extraction, and screenshot capture', async (t) => {
    const hasBin = existsSync(OBSCURA_BIN) || existsSync('/tmp/obscura_bin/obscura');
    if (!hasBin) {
      t.skip('Obscura binary not present in host environment, skipping live daemon test');
      return;
    }

    const binPath = existsSync(OBSCURA_BIN) ? OBSCURA_BIN : '/tmp/obscura_bin/obscura';
    const TEST_PORT = 9235;

    const proc = spawn(binPath, ['serve', '--port', String(TEST_PORT), '--allow-private-network'], {
      stdio: 'ignore'
    });

    try {
      // Wait for Obscura CDP server to bind
      let connected = false;
      const client = new ChromiumCdpClient({ port: TEST_PORT });
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (await client.isCdpConnected()) {
          connected = true;
          break;
        }
      }
      assert.equal(connected, true, 'Obscura CDP must start and connect on port ' + TEST_PORT);

      const info = await client.getBrowserInfo();
      assert.equal(info.isObscura, true);
      assert.equal(info.engine, 'obscura');

      const targets = await client.listTargets();
      assert.ok(targets.length > 0);

      const targetId = targets[0].id;
      const navRes = await client.navigateTarget(targetId, 'https://example.com');
      assert.equal(navRes.success, true);
      await new Promise(r => setTimeout(r, 800));

      // Verify DOM capture
      const page = await client.captureLivePage(targetId);
      assert.equal(page.live, true);
      assert.ok(page.title.includes('Example'));

      // Verify synthetic Input
      const clickRes = await client.dispatchClick(targetId, 10, 10);
      assert.equal(clickRes.clicked, true);

      const keyRes = await client.dispatchKey(targetId, 'Tab', 'Tab', 9);
      assert.equal(keyRes.dispatched, true);

      const scrollRes = await client.dispatchScroll(targetId, 10, 10, 0, 100);
      assert.equal(scrollRes.scrolled, true);

      // Verify Screenshot capture
      const shot = await client.captureScreenshot(targetId, { format: 'jpeg', quality: 80 });
      assert.equal(shot.success, true);
      assert.ok(shot.data && shot.data.length > 500);
    } finally {
      proc.kill();
    }
  });
});
