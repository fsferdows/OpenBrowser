import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = join(__filename, '..', '..', '..', '..');

describe('Vercel CLI Deployment & Configuration Suite (ADR-0014)', () => {
  it('validates vercel.json structure and outputDirectory setting', () => {
    const configPath = join(ROOT_DIR, 'vercel.json');
    assert.ok(existsSync(configPath), 'vercel.json must exist in project root');

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.strictEqual(config.version, 2, 'vercel.json version must be 2');
    assert.strictEqual(config.outputDirectory, 'public', 'outputDirectory must point to public');
    assert.strictEqual(config.cleanUrls, true, 'cleanUrls must be enabled');

    // Verify Service Worker header configuration
    const swHeaderRule = config.headers?.find(h => h.source === '/sw.js');
    assert.ok(swHeaderRule, 'Must include dedicated headers for /sw.js');
    const allowedHeader = swHeaderRule.headers?.find(h => h.key === 'Service-Worker-Allowed');
    assert.ok(allowedHeader, 'Service-Worker-Allowed header must be set');
    assert.strictEqual(allowedHeader.value, '/', 'Service-Worker-Allowed must be /');
  });

  it('validates .vercelignore excludes large vendor repos and heavy media assets', () => {
    const ignorePath = join(ROOT_DIR, '.vercelignore');
    assert.ok(existsSync(ignorePath), '.vercelignore must exist in project root');

    const ignoreContent = readFileSync(ignorePath, 'utf8');
    const lines = ignoreContent.split('\n').map(l => l.trim()).filter(Boolean);

    assert.ok(lines.some(l => l.startsWith('chromium-main')), 'Must ignore chromium-main');
    assert.ok(lines.some(l => l.startsWith('OmniRoute-release-v3.8.52')), 'Must ignore OmniRoute');
    assert.ok(lines.some(l => l.startsWith('freellmapi-main')), 'Must ignore freellmapi-main');
    assert.ok(lines.some(l => l.startsWith('rea-main')), 'Must ignore rea-main');
    assert.ok(lines.some(l => l.startsWith('1.mp4')), 'Must ignore 1.mp4');
    assert.ok(lines.some(l => l.startsWith('node_modules')), 'Must ignore node_modules');
  });

  it('validates api/proxy.js serverless unblocker handler', async () => {
    const proxyPath = join(ROOT_DIR, 'api', 'proxy.js');
    assert.ok(existsSync(proxyPath), 'api/proxy.js must exist');

    const proxyModule = await import(proxyPath);
    assert.strictEqual(typeof proxyModule.default, 'function', 'api/proxy.js must export a default handler');

    // Test missing url parameter returns 400
    let statusCode = 200;
    let headers = {};
    let responseBody = '';

    const mockRes = {
      set statusCode(val) { statusCode = val; },
      get statusCode() { return statusCode; },
      setHeader(key, val) { headers[key] = val; },
      end(data) { responseBody = data || ''; }
    };

    const mockReqMissing = {
      query: {},
      url: '/api/proxy',
      method: 'GET'
    };

    await proxyModule.default(mockReqMissing, mockRes);
    assert.strictEqual(statusCode, 400, 'Must return 400 when url is missing');
    assert.ok(responseBody.includes('Missing url query parameter'), 'Must indicate missing parameter');

    // Test YouTube watch URL returns embedded nocookie iframe HTML
    statusCode = 200;
    headers = {};
    responseBody = '';

    const mockReqYouTube = {
      query: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      url: '/api/proxy?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      method: 'GET'
    };

    await proxyModule.default(mockReqYouTube, mockRes);
    assert.strictEqual(statusCode, 200, 'Must return 200 for YouTube video');
    assert.ok(responseBody.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'Must embed nocookie player');
    assert.strictEqual(headers['X-Frame-Options'], 'ALLOWALL', 'Must allow iframe embedding');

    // Test Google redirect URL unwrapping
    statusCode = 200;
    headers = {};
    responseBody = '';

    const mockReqGoogleRedirect = {
      query: { url: 'https://www.google.com/url?sa=t&url=https%3A%2F%2Fexample.com' },
      url: '/api/proxy?url=https%3A%2F%2Fwww.google.com%2Furl%3Fsa%3Dt%26url%3Dhttps%253A%252F%252Fexample.com',
      method: 'GET'
    };

    await proxyModule.default(mockReqGoogleRedirect, mockRes);
    assert.strictEqual(statusCode, 200, 'Must return 200 for unwrapped Google redirect');
    assert.ok(responseBody.includes('Example Domain'), 'Must render unwrapped destination content');
    assert.strictEqual(headers['X-Frame-Options'], 'ALLOWALL', 'Must allow embedding');
    // Test search query resolution redirect
    statusCode = 200;
    headers = {};
    responseBody = '';

    const mockReqSearchQuery = {
      query: { url: 'how to build autonomous browser' },
      url: '/api/proxy?url=how%20to%20build%20autonomous%20browser',
      method: 'GET'
    };

    await proxyModule.default(mockReqSearchQuery, mockRes);
    assert.strictEqual(statusCode, 302, 'Must return 302 for non-URL search query');
    assert.ok(headers['Location'].includes('search.html?q='), 'Must redirect query to Braver Search');

    // Test YouTube home & catalog view
    statusCode = 200;
    headers = {};
    responseBody = '';

    const mockReqYouTubeHome = {
      query: { url: 'https://www.youtube.com' },
      url: '/api/proxy?url=https%3A%2F%2Fwww.youtube.com',
      method: 'GET'
    };

    await proxyModule.default(mockReqYouTubeHome, mockRes);
    assert.strictEqual(statusCode, 200, 'Must return 200 for YouTube home view');
    assert.ok(responseBody.includes('YouTube - OpenBrowser Theater'), 'Must render YouTube Theater view');
    assert.ok(responseBody.includes('Brave Shields: Zero-Ad Embed Active'), 'Must display ad-free badge');
  });
});
