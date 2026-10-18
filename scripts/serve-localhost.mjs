#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PolicyEngine } from '../packages/safety/src/policy-engine.js';
import { EncryptedVault } from '../packages/safety/src/vault.js';
import { SkillLibrary, SelfRepairEngine } from '../packages/skill-engine/src/index.js';
import { ACTIONS, RISK_LEVELS, i18n } from '../packages/shared/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..', '..');
const PUBLIC_DIR = join(__dirname, 'public');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const policyEngine = new PolicyEngine({
  domainWhitelist: ['shop.example.com', 'accounts.example.com', 'portal.example.com', 'localhost']
});
const skillLibrary = new SkillLibrary();

function getTrajectoryForScenario(scenario, goal) {
  if (scenario === 'form') {
    return [
      {
        thought: 'Located username input field in registration form. Filling identity.',
        action: 'fill',
        selector: '#username-field',
        targetDesc: 'input#username-field',
        value: 'alice_agent',
        risk_level: 'low',
        tokens: 120,
        verifiedText: 'Value populated: alice_agent'
      },
      {
        thought: 'Populating contact email address for developer registration.',
        action: 'fill',
        selector: '#email-field',
        targetDesc: 'input#email-field',
        value: 'alice@agenticbrowser.org',
        risk_level: 'low',
        tokens: 110,
        verifiedText: 'Email format valid'
      },
      {
        thought: 'Selecting Lead Systems Engineer role from account dropdown.',
        action: 'select',
        selector: '#role-dropdown',
        targetDesc: 'select#role-dropdown',
        value: 'lead-engineer',
        risk_level: 'low',
        tokens: 95,
        verifiedText: 'Role set to Lead Systems Engineer'
      },
      {
        thought: 'Acknowledging terms of service agreements.',
        action: 'click',
        selector: '#terms-agree',
        targetDesc: 'input#terms-agree',
        risk_level: 'low',
        tokens: 80,
        verifiedText: 'Terms checkbox checked'
      },
      {
        thought: 'Submitting registration form. Form creation is medium risk.',
        action: 'click',
        selector: '#create-account-btn',
        targetDesc: 'button#create-account-btn',
        risk_level: 'medium',
        tokens: 165,
        verifiedText: 'Success alert displayed: Account registered'
      }
    ];
  }

  if (scenario === 'handoff') {
    return [
      {
        thought: 'Inspecting security gate interface for authentication barriers.',
        action: 'navigate',
        selector: null,
        targetDesc: 'https://portal.example.com/auth-hand-off.html',
        risk_level: 'low',
        tokens: 140,
        verifiedText: 'Navigation complete'
      },
      {
        thought: 'Detected security barrier: Anti-bot challenge on page. Activating user hand-off protocol.',
        action: 'detect_barrier',
        selector: '#security-box',
        targetDesc: 'div#security-box',
        risk_level: 'high',
        tokens: 180,
        triggerHandoff: true,
        handoffTitle: 'Security Challenge: Human Verification',
        handoffDesc: 'The browser agent halted automated actions. Please solve the security prompt in the tab to resume.',
        verifiedText: 'User verification confirmed'
      },
      {
        thought: 'Human operator completed challenge. Resuming session with protected dashboard.',
        action: 'verify_auth',
        selector: '#protected-area',
        targetDesc: 'div#protected-area',
        risk_level: 'low',
        tokens: 90,
        verifiedText: 'Vault access authorized'
      }
    ];
  }

  if (scenario === 'repair') {
    return [
      {
        thought: 'Attempting execution of step 1 using legacy cached CSS selector: button.old-v1-search.',
        action: 'click',
        selector: '#broken-selector-search',
        targetDesc: 'button.old-v1-search (BROKEN)',
        risk_level: 'low',
        tokens: 130,
        verifiedText: 'DOM failure: Element not found with old selector'
      },
      {
        thought: 'Triggering Autonomous Self-Repair Engine. Inspecting Accessibility Tree for fallback target.',
        action: 'self_repair',
        selector: null,
        targetDesc: 'AccessibilityTree: [searchbox] "Search Products"',
        risk_level: 'medium',
        tokens: 210,
        verifiedText: 'Repaired target identified! Bumped skill version from 1.0.0 -> 1.0.1'
      },
      {
        thought: 'Executing repaired step with dynamic accessibility target.',
        action: 'fill',
        selector: '#search-input',
        targetDesc: 'input#search-input (repaired)',
        value: 'headphones',
        risk_level: 'low',
        tokens: 125,
        verifiedText: 'Query populated: headphones'
      },
      {
        thought: 'Triggering catalog search.',
        action: 'click',
        selector: '#search-btn',
        targetDesc: 'button#search-btn',
        risk_level: 'low',
        tokens: 110,
        verifiedText: 'Filtered 1 item: Noise-Canceling Headphones ($299.00)'
      }
    ];
  }

  // Default: catalog search scenario
  return [
    {
      thought: `Parsing goal: "${goal}". Inspecting catalog accessibility tree.`,
      action: 'perceive',
      selector: null,
      targetDesc: 'AccessibilityTree snapshot',
      risk_level: 'low',
      tokens: 150,
      verifiedText: 'Catalog searchbox and 4 product cards identified'
    },
    {
      thought: 'Focusing search input and entering query "headphones".',
      action: 'fill',
      selector: '#search-input',
      targetDesc: 'input#search-input',
      value: 'headphones',
      risk_level: 'low',
      tokens: 135,
      verifiedText: 'Input populated with "headphones"'
    },
    {
      thought: 'Triggering product catalog search filter.',
      action: 'click',
      selector: '#search-btn',
      targetDesc: 'button#search-btn',
      risk_level: 'low',
      tokens: 110,
      verifiedText: 'Live results updated: Showing 1 of 4 products'
    },
    {
      thought: 'Adding matched Noise-Canceling Headphones to cart.',
      action: 'click',
      selector: '#buy-headphones',
      targetDesc: 'button#buy-headphones',
      risk_level: 'medium',
      tokens: 160,
      verifiedText: 'Item added: Noise-Canceling Headphones ($299.00)'
    }
  ];
}

const server = createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = parsedUrl.pathname;

  // API Routes
  if (req.method === 'POST' && pathname === '/api/run-task') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const goal = payload.goal || 'General automation';
        const scenario = payload.scenario || 'catalog';

        const trajectory = getTrajectoryForScenario(scenario, goal);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'SUCCESS',
          goal,
          scenario,
          trajectory
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      channel: 'v0.1.0 LTS',
      uptimeSec: Math.round(process.uptime()),
      memoryHeapMB: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(1),
      registeredSkills: skillLibrary.getAllSkills().length
    }));
    return;
  }

  // Static File Serving
  let filePath = join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Internal Server Error: ${err.message}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n============================================================`);
  console.log(`🚀 Agentic Browser Studio running on http://localhost:${PORT}`);
  console.log(`   Interactive web studio with live simulated browser view,`);
  console.log(`   persistent side panel, and real-time agent execution.`);
  console.log(`============================================================\n`);
});
