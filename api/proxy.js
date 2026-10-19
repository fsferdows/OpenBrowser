/**
 * Vercel Serverless Function: Cloud Unblocking Proxy
 * Strips X-Frame-Options and Content-Security-Policy frame-ancestors
 * to allow live site embedding inside OpenBrowser without connection refusal.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const TOP_SITE_MAP = {
  facebook: 'https://www.facebook.com',
  fb: 'https://www.facebook.com',
  youtube: 'https://www.youtube.com',
  yt: 'https://www.youtube.com',
  google: 'https://www.google.com/webhp?igu=1',
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

export default async function handler(req, res) {
  // Robust query extraction preserving full multi-parameter target URLs
  let targetUrl = '';
  if (req.url && req.url.includes('url=')) {
    const idx = req.url.indexOf('url=');
    targetUrl = req.url.slice(idx + 4);
    try {
      if (/%[0-9a-fA-F]{2}/.test(targetUrl)) {
        targetUrl = decodeURIComponent(targetUrl);
      }
    } catch (_) {}
  } else if (req.query?.url) {
    targetUrl = req.query.url;
  }

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Missing url query parameter. Usage: /api/proxy?url=https://example.com');
  }

  let finalUrl = targetUrl.trim();

  // Unwrap nested /api/proxy?url= loops
  while (finalUrl.includes('/api/proxy?url=')) {
    const innerIdx = finalUrl.lastIndexOf('/api/proxy?url=');
    finalUrl = decodeURIComponent(finalUrl.slice(innerIdx + 15));
  }

  // Check top sites map
  const lowerTarget = finalUrl.toLowerCase();
  if (TOP_SITE_MAP[lowerTarget]) {
    finalUrl = TOP_SITE_MAP[lowerTarget];
  }

  // Unwrap Google redirect URLs so search results navigate directly to destination
  if (finalUrl.includes('google.com/url') || finalUrl.startsWith('/url?') || finalUrl.includes('google.com/goto')) {
    try {
      const u = new URL(finalUrl.startsWith('http') ? finalUrl : `https://www.google.com${finalUrl}`);
      let destParam = u.searchParams.get('url') || u.searchParams.get('q');
      if (destParam) {
        try {
          if (/%[0-9a-fA-F]{2}/.test(destParam)) destParam = decodeURIComponent(destParam);
        } catch (_) {}
        if (destParam.startsWith('http://') || destParam.startsWith('https://')) {
          finalUrl = destParam;
        }
      }
    } catch (_) {}
  }

  // Search query / non-URL detection (e.g. user typed "apple" or "news query" instead of URL)
  if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    if (!finalUrl.includes('.') || finalUrl.includes(' ')) {
      // It is a search query, redirect to Braver Search SERP
      res.statusCode = 302;
      res.setHeader('Location', `/search.html?q=${encodeURIComponent(finalUrl)}`);
      return res.end();
    }
    finalUrl = `https://${finalUrl}`;
  }

  // Google iframe embedding normalization (igu=1)
  if (finalUrl.includes('google.com') && !finalUrl.includes('google.com/url') && !finalUrl.includes('igu=1')) {
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${separator}igu=1`;
  }

  // YouTube Special High-Fidelity Views (Player & Clean Interactive Catalog)
  if (finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be')) {
    let videoId = null;
    let searchQuery = null;
    try {
      const u = new URL(finalUrl);
      if (u.pathname.includes('/watch')) {
        videoId = u.searchParams.get('v');
      } else if (u.pathname.includes('/embed/')) {
        videoId = u.pathname.split('/embed/')[1];
      } else if (u.hostname.includes('youtu.be')) {
        videoId = u.pathname.slice(1);
      } else if (u.pathname.includes('/results')) {
        searchQuery = u.searchParams.get('search_query');
      }
    } catch (_) {}

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (videoId) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>YouTube Video Player - OpenBrowser</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f0f; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .yt-topbar { height: 48px; background: #0f0f0f; border-bottom: 1px solid #272727; display: flex; align-items: center; padding: 0 16px; gap: 12px; }
        .yt-logo { font-size: 16px; font-weight: 700; color: #ff0000; display: flex; align-items: center; gap: 6px; cursor: pointer; text-decoration: none; }
        .yt-logo span { color: #fff; }
        .yt-badge { font-size: 11px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 3px 8px; border-radius: 4px; font-weight: 600; }
        .yt-player-wrap { flex: 1; width: 100%; height: calc(100vh - 48px); background: #000; }
        iframe { width: 100%; height: 100%; border: none; }
      </style></head><body>
      <div class="yt-topbar">
        <a href="/api/proxy?url=https://www.youtube.com" class="yt-logo">▶ <span>YouTube</span></a>
        <span class="yt-badge">🛡️ Brave Shields: Zero Ads Active</span>
        <div style="margin-left: auto; display: flex; gap: 12px; align-items: center;">
          <a href="/api/proxy?url=https://www.youtube.com" style="color: #38bdf8; text-decoration: none; font-size: 12px;">← Explore More Videos</a>
        </div>
      </div>
      <div class="yt-player-wrap">
        <iframe src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div></body></html>`);
    }
  }

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Brave/124.0.0.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  let response = null;
  let effectiveUrl = finalUrl;

  try {
    // Primary Fetch Attempt
    try {
      response = await fetch(effectiveUrl, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: browserHeaders,
        signal: AbortSignal.timeout(9000),
        redirect: 'follow'
      });
    } catch (primaryErr) {
      // Automatic Protocol Fallback: HTTPS -> HTTP
      if (effectiveUrl.startsWith('https://')) {
        try {
          const httpFallback = `http://${effectiveUrl.slice(8)}`;
          response = await fetch(httpFallback, {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            headers: browserHeaders,
            signal: AbortSignal.timeout(6000),
            redirect: 'follow'
          });
          if (response) effectiveUrl = httpFallback;
        } catch (_) {}
      } else if (effectiveUrl.startsWith('http://')) {
        try {
          const httpsFallback = `https://${effectiveUrl.slice(7)}`;
          response = await fetch(httpsFallback, {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            headers: browserHeaders,
            signal: AbortSignal.timeout(6000),
            redirect: 'follow'
          });
          if (response) effectiveUrl = httpsFallback;
        } catch (_) {}
      }

      if (!response) {
        throw primaryErr;
      }
    }

    const contentType = response.headers.get('content-type') || 'text/html';

    // Allow embedding in OpenBrowser iframes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.setHeader('Content-Type', contentType);

    if (req.method === 'HEAD') {
      res.statusCode = response.status;
      return res.end();
    }

    if (contentType.includes('text/html')) {
      let bodyText = await response.text();

      // 1. Strip meta CSP and X-Frame-Options tags that block iframe rendering
      bodyText = bodyText.replace(/<meta[^>]*http-equiv=["']?(Content-Security-Policy|X-Frame-Options)["']?[^>]*>/gi, '');

      // 2. Strip crossorigin and integrity attributes so browser doesn't block subresources via CORS or hash mismatch
      bodyText = bodyText.replace(/\scrossorigin(=["'][^"']*["'])?/gi, '');
      bodyText = bodyText.replace(/\sintegrity(=["'][^"']*["'])?/gi, '');

      // 3. Base tag insertion for relative assets + parent bridge link/window interceptors + adblock
      const baseTag = `<base href="${effectiveUrl}">`;
      const antiFrameBustShim = `
<style id="brave-shields-adblock">
  /* Brave Shields High-Efficiency Ad-Blocker Styles */
  ins.adsbygoogle, iframe[src*="doubleclick"], iframe[src*="adservice"],
  iframe[src*="googlesyndication"], [id*="google_ads"], [class*="google-ads"],
  [class*="ad-banner"], [class*="ad-container"], [class*="ad-wrapper"],
  [class*="advertisement"], [class*="sponsored-post"], [id*="sponsored"],
  [aria-label*="Sponsored"], .ytp-ad-module, .ytp-ad-overlay-container,
  .ytp-ad-message-container, .video-ads, ytd-promoted-video-renderer,
  ytd-display-ad-renderer, ytd-statement-banner-renderer,
  ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer,
  #masthead-ad, #player-ads, div[id*="taboola"], div[class*="taboola"],
  div[id*="outbrain"], .ad_slot, .ad-box, .advert, .ad-placeholder,
  [data-ad-slot], [data-ad-unit], .commercial-unit {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    width: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
</style>
<script>
  try {
    Object.defineProperty(window, 'top', { get: () => window.self, configurable: true });
    Object.defineProperty(window, 'parent', { get: () => window.self, configurable: true });
  } catch (_) {}

  // Transparent client-side SPA API proxy hook
  (function() {
    var origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function(res, init) {
        try {
          var u = typeof res === 'string' ? res : (res && res.url ? res.url : '');
          if (u && typeof u === 'string' && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('/api/proxy')) {
            var base = ${JSON.stringify(effectiveUrl)};
            var resolved = new URL(u, base).href;
            if (typeof res === 'string') {
              res = '/api/proxy?url=' + encodeURIComponent(resolved);
            } else if (res && res.url) {
              res = new Request('/api/proxy?url=' + encodeURIComponent(resolved), init || res);
            }
          }
        } catch (_) {}
        return origFetch.call(this, res, init);
      };
    }
    var origXHR = window.XMLHttpRequest;
    if (origXHR && origXHR.prototype && origXHR.prototype.open) {
      var origOpen = origXHR.prototype.open;
      origXHR.prototype.open = function(m, u, ...rest) {
        try {
          if (u && typeof u === 'string' && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('/api/proxy')) {
            var base = ${JSON.stringify(effectiveUrl)};
            var resolved = new URL(u, base).href;
            u = '/api/proxy?url=' + encodeURIComponent(resolved);
          }
        } catch (_) {}
        return origOpen.call(this, m, u, ...rest);
      };
    }
  })();

  function handleProxyNavigate(destUrl) {
    if (!destUrl || destUrl.startsWith('javascript:') || destUrl.startsWith('#')) return;
    var clean = destUrl;

    // Unwrap nested /api/proxy?url= loops
    while (clean.includes('/api/proxy?url=')) {
      try {
        var u = new URL(clean, window.location.origin);
        clean = u.searchParams.get('url') || clean;
      } catch (_) { break; }
    }

    // Unwrap Google redirect URLs
    if (clean.includes('google.com/url') || clean.includes('/url?')) {
      try {
        var gu = new URL(clean.startsWith('http') ? clean : window.location.origin + clean);
        var realDest = gu.searchParams.get('url') || gu.searchParams.get('q');
        if (realDest) {
          try {
            if (/%[0-9a-fA-F]{2}/.test(realDest)) realDest = decodeURIComponent(realDest);
          } catch (_) {}
          if (realDest.startsWith('http://') || realDest.startsWith('https://')) {
            clean = realDest;
          }
        }
      } catch (_) {}
    }

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'BRAVE_NAVIGATE', url: clean }, '*');
        return;
      }
    } catch (_) {}

    window.location.href = '/api/proxy?url=' + encodeURIComponent(clean);
  }

  document.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (link && link.href) {
      e.preventDefault();
      e.stopPropagation();
      handleProxyNavigate(link.href);
    }
  }, true);

  window.open = function(url) {
    if (url) handleProxyNavigate(url);
    return null;
  };

  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form && form.action && (form.method || 'get').toLowerCase() === 'get') {
      e.preventDefault();
      var formData = new FormData(form);
      var searchParams = new URLSearchParams(formData);
      var target = form.action + (form.action.includes('?') ? '&' : '?') + searchParams.toString();
      handleProxyNavigate(target);
    }
  }, true);

  window.addEventListener('DOMContentLoaded', function() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'BRAVE_LIVE_PAGE_LOADED',
          url: ${JSON.stringify(effectiveUrl)},
          title: document.title,
          elementCount: document.querySelectorAll('*').length
        }, '*');
      }
    } catch (_) {}
  });
</script>`;

      if (/<head[^>]*>/i.test(bodyText)) {
        bodyText = bodyText.replace(/(<head[^>]*>)/i, `$1${baseTag}${antiFrameBustShim}`);
      } else if (/<html[^>]*>/i.test(bodyText)) {
        bodyText = bodyText.replace(/(<html[^>]*>)/i, `$1<head>${baseTag}${antiFrameBustShim}</head>`);
      } else {
        bodyText = `${baseTag}${antiFrameBustShim}${bodyText}`;
      }

      res.statusCode = response.status;
      return res.end(bodyText);
    } else {
      const arrayBuffer = await response.arrayBuffer();
      res.statusCode = response.status;
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(Buffer.from(arrayBuffer));
    }
  } catch (err) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const retryHttpUrl = finalUrl.startsWith('https://') ? `http://${finalUrl.slice(8)}` : finalUrl;
    return res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Proxy Gateway - OpenBrowser</title>
  <style>
    body { background: #0f1013; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; text-align: center; }
    .card { background: #181920; border: 1px solid #334155; border-radius: 14px; padding: 32px 28px; max-width: 520px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    h2 { color: #f87171; margin-top: 0; font-size: 20px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 12px 0 20px; }
    .url-display { font-family: monospace; font-size: 12.5px; background: #090a0d; padding: 8px 12px; border-radius: 6px; border: 1px solid #27272a; color: #38bdf8; word-break: break-all; margin-bottom: 20px; }
    .btn-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    a.btn, button.btn { display: inline-flex; align-items: center; gap: 6px; background: #fb542b; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13.5px; border: none; cursor: pointer; }
    a.btn-secondary, button.btn-secondary { background: #27272a; color: #e4e4e7; }
    a.btn:hover, button.btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚡ Proxy Gateway Notice</h2>
    <p>Target site could not be rendered through the serverless proxy (${err.name === 'AbortError' ? 'Connection timed out' : err.message}).</p>
    <div class="url-display">${finalUrl}</div>
    <div class="btn-row">
      <a href="/api/proxy?url=${encodeURIComponent(retryHttpUrl)}" class="btn btn-secondary">↻ Retry via HTTP</a>
      <a href="/search.html?q=${encodeURIComponent(finalUrl)}" class="btn btn-secondary">🔍 Search Braver</a>
      <a href="${finalUrl}" target="_blank" rel="noopener noreferrer" class="btn">↗ Open in Live Tab</a>
    </div>
  </div>
</body>
</html>`);
  }
}
