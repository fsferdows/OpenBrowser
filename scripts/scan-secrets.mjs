#!/usr/bin/env node

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SECRET_PATTERNS = [
  { name: 'Private Key', regex: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/ },
  { name: 'OpenAI Secret Key', regex: /\bsk-[a-zA-Z0-9]{32,}\b/ },
  { name: 'Anthropic API Key', regex: /\bsk-ant-[a-zA-Z0-9_\-]{20,}\b/ },
  { name: 'Google API Key', regex: /\bAIzaSy[a-zA-Z0-9_\-]{33}\b/ },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Generic Password Variable', regex: /(?:password|secret|api_key|apikey)\s*[:=]\s*["'][a-zA-Z0-9!@#$%^&*()_+]{8,}["']/i }
];

const IGNORED_PATHS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'vendor',
  'OmniRoute-release-v3.8.52',
  'freellmapi-main',
  'rea-main',
  'chromium-main'
]);

function scanDirectory(dir, findings = []) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_PATHS.has(entry.name) || entry.name.endsWith('.zip')) {
      continue;
    }

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath, findings);
    } else if (entry.isFile()) {
      // Scan text files
      if (/\.(md|json|js|mjs|ts|html|css|yml|yaml)$/.test(entry.name)) {
        const content = readFileSync(fullPath, 'utf8');
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.regex.test(content)) {
            // Check if it's the scanner file itself or a test fixture
            if (fullPath.includes('scripts/scan-secrets.mjs')) {
              continue;
            }
            findings.push({
              file: fullPath,
              type: pattern.name
            });
          }
        }
      }
    }
  }

  return findings;
}

console.log('[SECURITY SCAN] Running secret and credential exposure scanner...');
const findings = scanDirectory(process.cwd());

if (findings.length > 0) {
  console.error('[CRITICAL] Potential secrets detected in repository:');
  for (const finding of findings) {
    console.error(`  - ${finding.file} (${finding.type})`);
  }
  process.exit(1);
} else {
  console.log('[SUCCESS] Secret scan complete. 0 secrets or sensitive tokens discovered.');
}
