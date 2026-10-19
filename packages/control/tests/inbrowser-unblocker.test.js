import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveOmniboxDestination, normalizeGoogleUrl } from '../src/omnibox-resolver.js';

describe('In-Browser Unblocker & Autonomous Destination Routing Tests', () => {
  it('identifies and resolves Google searches with igu=1 embeddability', () => {
    const dest = resolveOmniboxDestination('how to build ai agent', {
      searchEngine: 'google',
      embeddable: true
    });
    assert.strictEqual(dest.type, 'search');
    assert.strictEqual(dest.searchEngine, 'google');
    assert.ok(dest.url.includes('igu=1'));
    assert.ok(dest.url.includes('how%20to%20build%20ai%20agent'));
  });

  it('normalizes Google direct inputs to webhp?igu=1', () => {
    assert.strictEqual(normalizeGoogleUrl('https://www.google.com'), 'https://www.google.com/webhp?igu=1');
    assert.strictEqual(normalizeGoogleUrl('google'), 'https://www.google.com/webhp?igu=1');
  });

  it('resolves top-level social and media destinations for autonomous use', () => {
    const fb = resolveOmniboxDestination('facebook');
    assert.strictEqual(fb.type, 'direct_site');
    assert.strictEqual(fb.url, 'https://www.facebook.com');

    const yt = resolveOmniboxDestination('youtube');
    assert.strictEqual(yt.type, 'direct_site');
    assert.strictEqual(yt.url, 'https://www.youtube.com');

    const gh = resolveOmniboxDestination('github');
    assert.strictEqual(gh.type, 'direct_site');
    assert.strictEqual(gh.url, 'https://github.com');
  });

  it('correctly maps agent task commands without treating them as search queries', () => {
    const task = resolveOmniboxDestination('agent: open youtube and search music');
    assert.strictEqual(task.type, 'agent');
    assert.strictEqual(task.goal, 'open youtube and search music');

    const automate = resolveOmniboxDestination('automate login to portal');
    assert.strictEqual(automate.type, 'agent');
    assert.strictEqual(automate.goal, 'automate login to portal');
  });
});
