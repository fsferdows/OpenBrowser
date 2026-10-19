/**
 * Vercel Serverless Function: Cloud Unblocking Proxy
 * Strips X-Frame-Options and Content-Security-Policy frame-ancestors
 * to allow live site embedding inside OpenBrowser without connection refusal.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
  if (finalUrl.includes('/api/proxy?url=')) {
    const innerIdx = finalUrl.lastIndexOf('/api/proxy?url=');
    finalUrl = decodeURIComponent(finalUrl.slice(innerIdx + 15));
  }

  // Unwrap Google redirect URLs so search results navigate directly to destination
  if (finalUrl.includes('google.com/url') || finalUrl.startsWith('/url?') || finalUrl.includes('google.com/goto')) {
    try {
      const u = new URL(finalUrl.startsWith('http') ? finalUrl : `https://www.google.com${finalUrl}`);
      const destParam = u.searchParams.get('url') || u.searchParams.get('q');
      if (destParam && (destParam.startsWith('http://') || destParam.startsWith('https://'))) {
        finalUrl = destParam;
      }
    } catch (_) {}
  }

  // Normalize protocol
  if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    finalUrl = `https://${finalUrl}`;
  }

  // Google iframe embedding normalization (igu=1)
  if (finalUrl.includes('google.com') && !finalUrl.includes('google.com/url') && !finalUrl.includes('igu=1')) {
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${separator}igu=1`;
  }

  // YouTube embed player normalization for specific videos
  if (finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be')) {
    let videoId = null;
    try {
      const u = new URL(finalUrl);
      if (u.pathname.includes('/watch')) {
        videoId = u.searchParams.get('v');
      } else if (u.pathname.includes('/embed/')) {
        videoId = u.pathname.split('/embed/')[1];
      } else if (u.hostname.includes('youtu.be')) {
        videoId = u.pathname.slice(1);
      }
    } catch (_) {}

    if (videoId) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>YouTube - OpenBrowser Theater</title>
  <style>
    body, html { margin:0; padding:0; width:100%; height:100%; background:#0f0f0f; overflow:hidden; }
    iframe { width:100%; height:100%; border:none; }
  </style>
</head>
<body>
  <iframe src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
</body>
</html>`);
    }
  }

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Brave/124.0.0.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Chromium";v="130", "Brave";v="130", "Not?A_Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'no-cache'
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

      // 2. Strip crossorigin and integrity attributes so browser doesn't block subresources via CORS
      bodyText = bodyText.replace(/\scrossorigin(=["'][^"']*["'])?/gi, '');
      bodyText = bodyText.replace(/\sintegrity(=["'][^"']*["'])?/gi, '');

      // 3. Rewrite stylesheet, module script, and font URLs to load through /api/proxy
      bodyText = bodyText.replace(/(<link[^>]+href=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, href, suffix) => {
        if (match.includes('stylesheet') || match.includes('preload') || match.includes('icon')) {
          try {
            const absUrl = new URL(href, effectiveUrl).href;
            return `${prefix}/api/proxy?url=${encodeURIComponent(absUrl)}${suffix}`;
          } catch (_) {
            return match;
          }
        }
        return match;
      });

      bodyText = bodyText.replace(/(<script[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, src, suffix) => {
        try {
          const absUrl = new URL(src, effectiveUrl).href;
          return `${prefix}/api/proxy?url=${encodeURIComponent(absUrl)}${suffix}`;
        } catch (_) {
          return match;
        }
      });

      // 4. Base tag insertion for relative assets and full parent bridge link/window interceptors
      const baseTag = `<base href="${effectiveUrl}">`;
      const antiFrameBustShim = `<script>
        try {
          window.top = window.self;
        } catch (_) {}

        function handleProxyNavigate(destUrl) {
          if (!destUrl || destUrl.startsWith('javascript:') || destUrl.startsWith('#')) return;
          var clean = destUrl;
          if (clean.includes('/api/proxy?url=')) {
            try {
              var u = new URL(clean, window.location.origin);
              clean = u.searchParams.get('url') || clean;
            } catch (_) {}
          }
          if (clean.includes('google.com/url') || clean.includes('/url?')) {
            try {
              var gu = new URL(clean, window.location.origin);
              var realDest = gu.searchParams.get('url') || gu.searchParams.get('q');
              if (realDest) clean = realDest;
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
      </script>`;

      if (bodyText.includes('<head>')) {
        bodyText = bodyText.replace('<head>', `<head>${baseTag}${antiFrameBustShim}`);
      } else if (bodyText.includes('<head ')) {
        bodyText = bodyText.replace(/<head[^>]*>/, `$&${baseTag}${antiFrameBustShim}`);
      } else {
        bodyText = `${baseTag}${antiFrameBustShim}${bodyText}`;
      }

      res.statusCode = response.status;
      return res.end(bodyText);
    } else if (contentType.includes('javascript') || contentType.includes('ecmascript')) {
      let jsText = await response.text();
      const jsBase = new URL('.', effectiveUrl).href;

      // Rewrite dynamic imports and relative ES module imports
      jsText = jsText.replace(/import\((['"])\.\/([^'"]+)\1\)/g, (m, q, path) => {
        try {
          const abs = new URL(path, jsBase).href;
          return `import(${q}/api/proxy?url=${encodeURIComponent(abs)}${q})`;
        } catch (_) {
          return m;
        }
      });

      jsText = jsText.replace(/from\s+(['"])\.\/([^'"]+)\1/g, (m, q, path) => {
        try {
          const abs = new URL(path, jsBase).href;
          return `from ${q}/api/proxy?url=${encodeURIComponent(abs)}${q}`;
        } catch (_) {
          return m;
        }
      });

      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(jsText);
    } else if (contentType.includes('text/css')) {
      let cssText = await response.text();

      // Rewrite relative url(...) references in stylesheets
      cssText = cssText.replace(/url\((['"]?)\/([^'")]+)\1\)/g, (m, q, path) => {
        if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) return m;
        try {
          const abs = new URL('/' + path, effectiveUrl).href;
          return `url(${q}/api/proxy?url=${encodeURIComponent(abs)}${q})`;
        } catch (_) {
          return m;
        }
      });

      res.statusCode = response.status;
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(cssText);
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
