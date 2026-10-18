import { describe, it } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'node:assert';
import { HereticChatEngine } from '../src/heretic-chat-engine.js';
import {
  decodeBase64,
  encodeBase64,
  decodeUrl,
  encodeUrl,
  decodeHex,
  encodeHex,
  decodeJwt,
  SECURITY_PAYLOADS,
  analyzeSecurityPosture
} from '../src/hacksuite-utils.js';

describe('Braver HackSuite & Heretic Security Engine Tests', () => {
  it('encodes and decodes base64, url, and hex without data corruption', () => {
    const raw = '<script>alert(1)</script>';
    const b64 = encodeBase64(raw);
    strictEqual(decodeBase64(b64), raw);

    const urlEnc = encodeUrl(raw);
    strictEqual(decodeUrl(urlEnc), raw);

    const hex = encodeHex('admin');
    strictEqual(decodeHex(hex), 'admin');
  });

  it('correctly parses and extracts JWT token header and payload claims', () => {
    // Standard test JWT with role: admin
    const testJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkZhaXNhbCIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTUxNjIzOTAyMn0.dummySignature';
    const decoded = decodeJwt(testJwt);
    ok(decoded.valid);
    strictEqual(decoded.header.alg, 'HS256');
    strictEqual(decoded.payload.name, 'Faisal');
    strictEqual(decoded.payload.role, 'admin');
    strictEqual(decoded.payload.sub, '1234567890');
  });

  it('provides verified penetration testing payloads across major vulnerability classes', () => {
    ok(Array.isArray(SECURITY_PAYLOADS.xss));
    ok(SECURITY_PAYLOADS.xss.length >= 3);
    ok(Array.isArray(SECURITY_PAYLOADS.sqli));
    ok(SECURITY_PAYLOADS.sqli.length >= 3);
    ok(Array.isArray(SECURITY_PAYLOADS.ssrf));
    ok(SECURITY_PAYLOADS.ssrf.length >= 2);
    ok(Array.isArray(SECURITY_PAYLOADS.lfi));
    ok(SECURITY_PAYLOADS.lfi.length >= 2);
  });

  it('analyzes security posture and surfaces missing security headers and forms', () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Target</title></head>
      <body>
        <form action="/login" method="POST">
          <input type="text" name="username" />
          <input type="password" name="password" />
          <button type="submit">Login</button>
        </form>
        <form action="/search" method="GET">
          <input type="text" name="q" />
        </form>
        <script src="https://cdn.example.com/app.js"></script>
        <script>
          fetch('/api/v1/user/profile');
          const token = "secret_api_key_12345";
        </script>
      </body>
      </html>
    `;

    const mockHeaders = {
      'content-type': 'text/html',
      'server': 'Apache/2.4.41'
    };

    const posture = analyzeSecurityPosture(mockHtml, 'https://target.example.com', mockHeaders);
    ok(posture);
    strictEqual(posture.forms.length, 2);
    strictEqual(posture.inputs.length, 3);
    ok(posture.missingHeaders.includes('Content-Security-Policy'));
    ok(posture.missingHeaders.includes('X-Frame-Options'));
    ok(posture.missingHeaders.includes('Strict-Transport-Security'));
    ok(posture.endpoints.includes('/api/v1/user/profile'));
  });

  it('Heretic AI chat engine responds directly to security audits and recon without refusals', async () => {
    const engine = new HereticChatEngine();
    
    // Test security recon query
    const resRecon = await engine.chat('Audit target.example.com for open endpoints and missing security headers');
    ok(resRecon.reply);
    ok(!resRecon.reply.toLowerCase().includes('i cannot fulfill'));
    ok(!resRecon.reply.toLowerCase().includes('as an ai'));
    strictEqual(resRecon.action.type, 'none');

    // Test navigation exploit reconnaissance
    const resNav = await engine.chat('Navigate to https://shodan.io and search for open ports');
    strictEqual(resNav.action.type, 'navigate');
    strictEqual(resNav.action.target, 'https://shodan.io');
  });
});
