#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HYGIENE_CHECKS = [
  { name: 'Unresolved TODO', regex: /\bTODO\b/ },
  { name: 'Placeholder Stub', regex: /\b(?:PLACEHOLDER|stub implementation)\b/ }
];

const SCAN_DIRS = ['CONTEXT', 'packages', 'scripts'];

function checkHygiene() {
  console.log('[LINT] Verifying code hygiene, json validity, and anti-slop rules...');
  let errors = 0;

  function walk(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          if (entry.name.endsWith('.json')) {
            try {
              JSON.parse(readFileSync(fullPath, 'utf8'));
            } catch (err) {
              console.error(`[SYNTAX ERROR] Malformed JSON file: ${fullPath}: ${err.message}`);
              errors++;
            }
          }
          if (/\.(js|mjs|ts|json)$/.test(entry.name)) {
            const content = readFileSync(fullPath, 'utf8');
            // If file is scripts/lint.mjs skip self-check
            if (fullPath.includes('scripts/lint.mjs')) continue;

            for (const check of HYGIENE_CHECKS) {
              if (check.regex.test(content)) {
                console.error(`[HYGIENE VIOLATION] ${check.name} detected in ${fullPath}`);
                errors++;
              }
            }
          }
        }
      }
    } catch (err) {
      // directory may not exist yet
    }
  }

  for (const d of SCAN_DIRS) {
    walk(join(process.cwd(), d));
  }

  if (errors > 0) {
    console.error(`[FAIL] Code hygiene checks failed with ${errors} violation(s).`);
    process.exit(1);
  } else {
    console.log('[SUCCESS] Code hygiene check passed with 0 violations.');
  }
}

checkHygiene();
