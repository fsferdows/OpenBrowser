import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveOmniboxDestination, TOP_SITE_MAP } from '../src/omnibox-resolver.js';

describe('Omnibox Destination & Search Resolution Tests', () => {
  it('resolves top website shortcuts directly to canonical HTTPS URLs', () => {
    const fb = resolveOmniboxDestination('facebook');
    assert.strictEqual(fb.type, 'direct_site');
    assert.strictEqual(fb.url, 'https://www.facebook.com');

    const yt = resolveOmniboxDestination('youtube');
    assert.strictEqual(yt.type, 'direct_site');
    assert.strictEqual(yt.url, 'https://www.youtube.com');

    const google = resolveOmniboxDestination('google');
    assert.strictEqual(google.type, 'direct_site');
    assert.strictEqual(google.url, 'https://www.google.com');

    const github = resolveOmniboxDestination('github');
    assert.strictEqual(github.type, 'direct_site');
    assert.strictEqual(github.url, 'https://github.com');

    const reddit = resolveOmniboxDestination('reddit');
    assert.strictEqual(reddit.type, 'direct_site');
    assert.strictEqual(reddit.url, 'https://www.reddit.com');
  });

  it('resolves domain names with TLDs to HTTPS URLs', () => {
    const res1 = resolveOmniboxDestination('news.ycombinator.com');
    assert.strictEqual(res1.type, 'domain');
    assert.strictEqual(res1.url, 'https://news.ycombinator.com');

    const res2 = resolveOmniboxDestination('developer.mozilla.org/en-US/');
    assert.strictEqual(res2.type, 'domain');
    assert.strictEqual(res2.url, 'https://developer.mozilla.org/en-US/');

    const res3 = resolveOmniboxDestination('localhost:3000');
    assert.strictEqual(res3.type, 'domain');
    assert.strictEqual(res3.url, 'http://localhost:3000');
  });

  it('preserves fully qualified URLs and internal brave:// schemes', () => {
    const http = resolveOmniboxDestination('http://example.com');
    assert.strictEqual(http.type, 'url');
    assert.strictEqual(http.url, 'http://example.com');

    const https = resolveOmniboxDestination('https://shop.example.com/catalog.html');
    assert.strictEqual(https.type, 'url');
    assert.strictEqual(https.url, 'https://shop.example.com/catalog.html');

    const brave = resolveOmniboxDestination('brave://settings');
    assert.strictEqual(brave.type, 'internal');
    assert.strictEqual(brave.url, 'brave://settings');
  });

  it('routes generic search queries to Brave Search', () => {
    const q1 = resolveOmniboxDestination('youtube trending music');
    assert.strictEqual(q1.type, 'search');
    assert.strictEqual(q1.url, 'https://search.brave.com/search?q=youtube%20trending%20music');
    assert.strictEqual(q1.searchEngine, 'brave');

    const q2 = resolveOmniboxDestination('facebook marketplace cars');
    assert.strictEqual(q2.type, 'search');
    assert.strictEqual(q2.url, 'https://search.brave.com/search?q=facebook%20marketplace%20cars');

    const q3 = resolveOmniboxDestination('how to build an agentic browser');
    assert.strictEqual(q3.type, 'search');
    assert.strictEqual(q3.url, 'https://search.brave.com/search?q=how%20to%20build%20an%20agentic%20browser');
  });

  it('identifies autonomous agent directives when explicitly flagged or command-prefixed', () => {
    const agentCmd = resolveOmniboxDestination('agent: buy red headphones');
    assert.strictEqual(agentCmd.type, 'agent');
    assert.strictEqual(agentCmd.goal, 'buy red headphones');

    const automateCmd = resolveOmniboxDestination('automate fill portal form');
    assert.strictEqual(automateCmd.type, 'agent');
    assert.strictEqual(automateCmd.goal, 'automate fill portal form');
  });

  it('repairs malformed query string delimiters (e.g. & without initial ? in YouTube themeRefresh)', () => {
    // Exact user issue: https://www.youtube.com&themeRefresh=1
    const yt1 = resolveOmniboxDestination('https://www.youtube.com&themeRefresh=1');
    assert.strictEqual(yt1.type, 'url');
    assert.strictEqual(yt1.url, 'https://www.youtube.com/?themeRefresh=1');

    // YouTube with slash and ampersand
    const yt2 = resolveOmniboxDestination('https://www.youtube.com/&themeRefresh=1');
    assert.strictEqual(yt2.type, 'url');
    assert.strictEqual(yt2.url, 'https://www.youtube.com/?themeRefresh=1');

    // Query in path without ? (e.g. results&search_query=hello)
    const yt3 = resolveOmniboxDestination('https://www.youtube.com/results&search_query=hello');
    assert.strictEqual(yt3.type, 'url');
    assert.strictEqual(yt3.url, 'https://www.youtube.com/results?search_query=hello');

    // Domain with malformed ampersand query string
    const yt4 = resolveOmniboxDestination('www.youtube.com&themeRefresh=1');
    assert.strictEqual(yt4.type, 'domain');
    assert.strictEqual(yt4.url, 'https://www.youtube.com/?themeRefresh=1');

    // Regular query strings are preserved intact
    const yt5 = resolveOmniboxDestination('https://www.youtube.com/?themeRefresh=1&another=2');
    assert.strictEqual(yt5.type, 'url');
    assert.strictEqual(yt5.url, 'https://www.youtube.com/?themeRefresh=1&another=2');
  });
});
