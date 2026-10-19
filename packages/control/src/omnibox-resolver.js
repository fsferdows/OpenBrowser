/**
 * Omnibox Destination & Search Resolution Engine
 * Handles user input in the browser address bar with intelligent routing:
 * 1. Top site shortcuts (facebook, youtube, google, reddit, etc.)
 * 2. Domains with TLDs (example.com, news.ycombinator.com)
 * 3. Fully qualified URLs (http://, https://, brave://)
 * 4. Autonomous agent commands (agent:, automate, fill, scrape, etc.)
 * 5. General web search (Brave Search / Google Search)
 */

export const TOP_SITE_MAP = {
  facebook: 'https://www.facebook.com',
  fb: 'https://www.facebook.com',
  youtube: 'https://www.youtube.com',
  yt: 'https://www.youtube.com',
  google: 'https://www.google.com',
  reddit: 'https://www.reddit.com',
  twitter: 'https://x.com',
  x: 'https://x.com',
  github: 'https://github.com',
  wikipedia: 'https://www.wikipedia.org',
  amazon: 'https://www.amazon.com',
  instagram: 'https://www.instagram.com',
  linkedin: 'https://www.linkedin.com',
  tiktok: 'https://www.tiktok.com',
  netflix: 'https://www.netflix.com',
  gmail: 'https://mail.google.com',
  chatgpt: 'https://chatgpt.com',
  hackernews: 'https://news.ycombinator.com',
  ycombinator: 'https://news.ycombinator.com'
};

const AGENT_PREFIX_REGEX = /^(agent:\s*|run\s+agent:\s*|task:\s*)/i;
const AGENT_VERB_REGEX = /^(automate|scrape|fill\s+(out\s+)?|buy\s+|checkout\s+)/i;
const TLD_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/;

/**
 * Resolves raw Omnibox user input into an actionable destination object.
 * @param {string} rawInput 
 * @param {object} options
 * @returns {{ type: 'direct_site'|'domain'|'url'|'internal'|'search'|'agent', url?: string, goal?: string, searchEngine?: string, query?: string }}
 */
export function resolveOmniboxDestination(rawInput, options = {}) {
  const input = (rawInput || '').trim();
  if (!input) {
    return { type: 'internal', url: 'brave://newtab' };
  }

  // 1. Explicit internal schemes
  if (input.startsWith('brave://') || input.startsWith('chrome://') || input.startsWith('about:')) {
    return { type: 'internal', url: input };
  }

  // 2. Explicit Agent Directives
  if (AGENT_PREFIX_REGEX.test(input)) {
    const goal = input.replace(AGENT_PREFIX_REGEX, '').trim();
    return { type: 'agent', goal };
  }
  if (AGENT_VERB_REGEX.test(input) && !input.includes('.')) {
    return { type: 'agent', goal: input };
  }

  // 3. Fully qualified URLs
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return { type: 'url', url: input };
  }

  // 4. Localhost ports
  if (/^localhost(:\d+)?(\/.*)?$/i.test(input)) {
    return { type: 'domain', url: `http://${input}` };
  }

  // 5. Top site shortcuts (case-insensitive)
  const normalizedKey = input.toLowerCase();
  if (TOP_SITE_MAP[normalizedKey]) {
    const rawUrl = TOP_SITE_MAP[normalizedKey];
    const finalUrl = (options.embeddable && normalizedKey.includes('google'))
      ? normalizeGoogleUrl(rawUrl)
      : rawUrl;
    return {
      type: 'direct_site',
      url: finalUrl,
      siteName: normalizedKey
    };
  }

  // 6. Domains with TLDs
  if (TLD_REGEX.test(input) && !input.includes(' ')) {
    const rawDomain = `https://${input}`;
    const finalDomain = options.embeddable && input.toLowerCase().includes('google.')
      ? normalizeGoogleUrl(rawDomain)
      : rawDomain;
    return {
      type: 'domain',
      url: finalDomain
    };
  }

  // 7. Default: Web Search via Brave Search (or configured provider)
  const searchEngine = options.searchEngine || 'brave';
  const encodedQuery = encodeURIComponent(input);
  let searchUrl;
  if (searchEngine === 'google') {
    searchUrl = options.useLocalSerp
      ? `search.html?q=${encodedQuery}&engine=google`
      : (options.embeddable
          ? `https://www.google.com/search?igu=1&q=${encodedQuery}`
          : `https://www.google.com/search?q=${encodedQuery}`);
  } else {
    searchUrl = options.useLocalSerp
      ? `search.html?q=${encodedQuery}`
      : `https://search.brave.com/search?q=${encodedQuery}`;
  }

  return {
    type: 'search',
    url: searchUrl,
    searchEngine,
    query: input
  };
}

/**
 * Normalizes Google URLs to include the igu=1 iframe embed parameter.
 * This prevents "www.google.com refused to connect" error by instructing Google
 * not to emit X-Frame-Options: SAMEORIGIN.
 * @param {string} rawUrl 
 * @returns {string}
 */
export function normalizeGoogleUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  const str = rawUrl.trim();
  const lower = str.toLowerCase();
  if (lower === 'google' || lower === 'google.com' || lower === 'www.google.com' ||
      lower === 'https://google.com' || lower === 'https://www.google.com' ||
      lower === 'http://google.com' || lower === 'http://www.google.com' ||
      lower === 'https://www.google.com/' || lower === 'https://google.com/') {
    return 'https://www.google.com/webhp?igu=1';
  }

  try {
    const parsed = new URL(str.startsWith('http://') || str.startsWith('https://') ? str : `https://${str}`);
    if (parsed.hostname === 'google.com' || parsed.hostname === 'www.google.com' || parsed.hostname.endsWith('.google.com')) {
      const destParam = parsed.searchParams.get('url') || parsed.searchParams.get('q');
      if (destParam && (destParam.startsWith('http://') || destParam.startsWith('https://'))) {
        return destParam;
      }
      if (parsed.pathname === '/' || parsed.pathname === '' || parsed.pathname === '/webhp') {
        return 'https://www.google.com/webhp?igu=1';
      }
      if (!parsed.searchParams.has('igu')) {
        parsed.searchParams.set('igu', '1');
      }
      return parsed.toString();
    }
  } catch (_) {}

  return str;
}

