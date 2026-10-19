import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeGoogleUrl, resolveOmniboxDestination } from '../src/omnibox-resolver.js';

describe('Google IFrame Integration & igu=1 Normalization Suite', () => {
  it('normalizes top-level google shortcuts to webhp?igu=1', () => {
    assert.strictEqual(normalizeGoogleUrl('google'), 'https://www.google.com/webhp?igu=1');
    assert.strictEqual(normalizeGoogleUrl('google.com'), 'https://www.google.com/webhp?igu=1');
    assert.strictEqual(normalizeGoogleUrl('www.google.com'), 'https://www.google.com/webhp?igu=1');
    assert.strictEqual(normalizeGoogleUrl('https://www.google.com'), 'https://www.google.com/webhp?igu=1');
    assert.strictEqual(normalizeGoogleUrl('https://google.com/'), 'https://www.google.com/webhp?igu=1');
  });

  it('injects igu=1 parameter into Google Search query URLs', () => {
    const searchUrl = 'https://www.google.com/search?q=openbrowser';
    const normalized = normalizeGoogleUrl(searchUrl);
    const parsed = new URL(normalized);
    assert.strictEqual(parsed.searchParams.get('igu'), '1');
    assert.strictEqual(parsed.searchParams.get('q'), 'openbrowser');
    assert.strictEqual(parsed.hostname, 'www.google.com');
  });

  it('preserves existing parameters when injecting igu=1', () => {
    const complexUrl = 'https://www.google.com/search?q=agentic+ai&hl=en&gl=us';
    const normalized = normalizeGoogleUrl(complexUrl);
    const parsed = new URL(normalized);
    assert.strictEqual(parsed.searchParams.get('igu'), '1');
    assert.strictEqual(parsed.searchParams.get('q'), 'agentic ai');
    assert.strictEqual(parsed.searchParams.get('hl'), 'en');
    assert.strictEqual(parsed.searchParams.get('gl'), 'us');
  });

  it('does not alter non-Google URLs', () => {
    assert.strictEqual(normalizeGoogleUrl('https://github.com/fsferdows/OpenBrowser'), 'https://github.com/fsferdows/OpenBrowser');
    assert.strictEqual(normalizeGoogleUrl('https://news.ycombinator.com'), 'https://news.ycombinator.com');
    assert.strictEqual(normalizeGoogleUrl('https://www.youtube.com'), 'https://www.youtube.com');
  });

  it('resolves omnibox destination with embeddable option enabled for Google', () => {
    const direct = resolveOmniboxDestination('google', { embeddable: true });
    assert.strictEqual(direct.type, 'direct_site');
    assert.strictEqual(direct.url, 'https://www.google.com/webhp?igu=1');

    const search = resolveOmniboxDestination('autonomous browsing', { searchEngine: 'google', embeddable: true });
    assert.strictEqual(search.type, 'search');
    assert.strictEqual(search.searchEngine, 'google');
    assert.ok(search.url.includes('igu=1'));
    assert.ok(search.url.includes('autonomous%20browsing'));
  });
});
