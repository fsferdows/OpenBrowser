/**
 * Vercel Serverless Function: Cloud Unblocking Proxy
 * Strips X-Frame-Options and Content-Security-Policy frame-ancestors
 * to allow live site embedding inside OpenBrowser without connection refusal.
 */

export default async function handler(req, res) {
  // Extract query parameters
  const targetUrl = req.query?.url || new URL(req.url, 'http://localhost').searchParams.get('url');

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Missing url query parameter. Usage: /api/proxy?url=https://example.com');
  }

  let finalUrl = targetUrl.trim();

  // Normalize protocol
  if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    finalUrl = `https://${finalUrl}`;
  }

  // Google iframe embedding normalization (igu=1)
  if (finalUrl.includes('google.com') && !finalUrl.includes('igu=1')) {
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${separator}igu=1`;
  }

  // YouTube embed player normalization
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
  <iframe src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0" allowfullscreen allow="autoplay; encrypted-media"></iframe>
</body>
</html>`);
    } else {
      res.statusCode = 302;
      res.setHeader('Location', `/portal.html?url=${encodeURIComponent(finalUrl)}&site=youtube`);
      return res.end();
    }
  }

  // Facebook interactive portal redirection
  if (finalUrl.includes('facebook.com') || finalUrl.includes('fb.com')) {
    res.statusCode = 302;
    res.setHeader('Location', `/portal.html?url=${encodeURIComponent(finalUrl)}&site=facebook`);
    return res.end();
  }

  // GitHub portal redirection for non-raw destinations
  if (finalUrl.includes('github.com') && !finalUrl.includes('raw.githubusercontent.com') && !finalUrl.includes('/raw/')) {
    res.statusCode = 302;
    res.setHeader('Location', `/portal.html?url=${encodeURIComponent(finalUrl)}&site=github`);
    return res.end();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9500);

    const response = await fetch(finalUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

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
            const absUrl = new URL(href, finalUrl).href;
            return `${prefix}/api/proxy?url=${encodeURIComponent(absUrl)}${suffix}`;
          } catch (_) {
            return match;
          }
        }
        return match;
      });

      bodyText = bodyText.replace(/(<script[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, src, suffix) => {
        try {
          const absUrl = new URL(src, finalUrl).href;
          return `${prefix}/api/proxy?url=${encodeURIComponent(absUrl)}${suffix}`;
        } catch (_) {
          return match;
        }
      });

      // 4. Base tag insertion for relative assets and link/form interceptors
      const baseTag = `<base href="${finalUrl}">`;
      const antiFrameBustShim = `<script>
        try {
          window.top = window.self;
          window.parent = window.self;
        } catch (_) {}
        document.addEventListener('click', function(e) {
          var link = e.target.closest('a');
          if (link && link.href && !link.href.startsWith('javascript:') && !link.href.startsWith('#')) {
            if (link.target === '_blank') return;
            e.preventDefault();
            window.location.href = '/api/proxy?url=' + encodeURIComponent(link.href);
          }
        }, true);
        document.addEventListener('submit', function(e) {
          var form = e.target;
          if (form && form.action && (form.method || 'get').toLowerCase() === 'get') {
            e.preventDefault();
            var formData = new FormData(form);
            var searchParams = new URLSearchParams(formData);
            var target = form.action + (form.action.includes('?') ? '&' : '?') + searchParams.toString();
            window.location.href = '/api/proxy?url=' + encodeURIComponent(target);
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
      const jsBase = new URL('.', finalUrl).href;

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
          const abs = new URL('/' + path, finalUrl).href;
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
    return res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Proxy Error - OpenBrowser</title>
  <style>
    body { background: #0f1013; color: #f1f5f9; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .card { background: #181920; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 480px; }
    h2 { color: #f87171; margin-top: 0; }
    a.btn { display: inline-block; background: #fb542b; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚡ Proxy Gateway Notice</h2>
    <p>Target site could not be rendered through the serverless proxy (${err.name === 'AbortError' ? 'Connection timed out' : err.message}).</p>
    <a href="${finalUrl}" target="_blank" rel="noopener noreferrer" class="btn">↗ Open in Live Tab</a>
  </div>
</body>
</html>`);
  }
}
