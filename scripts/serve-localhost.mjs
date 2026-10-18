#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PolicyEngine } from '../packages/safety/src/policy-engine.js';
import { EncryptedVault } from '../packages/safety/src/vault.js';
import { SkillLibrary, SelfRepairEngine, ReaAnalysisAdapter } from '../packages/skill-engine/src/index.js';
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
const reaAdapter = new ReaAnalysisAdapter();

// Cumulative Brave Shields Statistics
const shieldsStats = {
  trackersBlocked: 2481,
  fingerprintingBlocked: 142,
  httpsUpgrades: 389,
  bandwidthSavedMB: 34.2,
  timeSavedSec: 2.4,
  shieldsActive: true
};

function getTrajectoryForScenario(scenario, goal) {
  if (scenario === 'form') {
    return [
      {
        thought: 'Inspecting developer registration page structure with REA. Discovered #username-field.',
        action: 'fill',
        selector: '#username-field',
        targetDesc: 'input#username-field',
        value: 'alice_agent',
        risk_level: 'low',
        tokens: 120,
        verifiedText: 'Value populated: alice_agent',
        reaVerified: true
      },
      {
        thought: 'Filling email input field with validated developer contact address.',
        action: 'fill',
        selector: '#email-field',
        targetDesc: 'input#email-field',
        value: 'alice@agenticbrowser.org',
        risk_level: 'low',
        tokens: 110,
        verifiedText: 'Email format valid',
        reaVerified: true
      },
      {
        thought: 'Selecting Lead Systems Engineer role from account dropdown selector.',
        action: 'select',
        selector: '#role-dropdown',
        targetDesc: 'select#role-dropdown',
        value: 'lead-engineer',
        risk_level: 'low',
        tokens: 95,
        verifiedText: 'Role set to Lead Systems Engineer',
        reaVerified: true
      },
      {
        thought: 'Checking terms of service agreement checkbox.',
        action: 'click',
        selector: '#terms-agree',
        targetDesc: 'input#terms-agree',
        risk_level: 'low',
        tokens: 80,
        verifiedText: 'Terms checkbox checked',
        reaVerified: true
      },
      {
        thought: 'Submitting registration form. Form creation is medium risk.',
        action: 'click',
        selector: '#create-account-btn',
        targetDesc: 'button#create-account-btn',
        risk_level: 'medium',
        tokens: 165,
        verifiedText: 'Success alert displayed: Account registered',
        reaVerified: true
      }
    ];
  }

  if (scenario === 'handoff') {
    return [
      {
        thought: 'Inspecting security gate interface for authentication barriers using REA packet inspector.',
        action: 'navigate',
        selector: null,
        targetDesc: 'https://auth.example.com/auth-hand-off.html',
        risk_level: 'low',
        tokens: 140,
        verifiedText: 'Navigation complete',
        reaVerified: true
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
        handoffDesc: 'The autonomous browser agent halted automated actions. Please solve the security prompt in the tab to resume.',
        verifiedText: 'User verification confirmed',
        reaVerified: true
      },
      {
        thought: 'Human operator completed challenge. Resuming session with protected dashboard.',
        action: 'verify_auth',
        selector: '#protected-area',
        targetDesc: 'div#protected-area',
        risk_level: 'low',
        tokens: 90,
        verifiedText: 'Vault access authorized',
        reaVerified: true
      }
    ];
  }

  if (scenario === 'repair') {
    return [
      {
        thought: 'Attempting execution using legacy cached CSS selector: button.old-v1-search.',
        action: 'click',
        selector: '#broken-selector-search',
        targetDesc: 'button.old-v1-search (BROKEN)',
        risk_level: 'low',
        tokens: 130,
        verifiedText: 'DOM failure: Element not found with old selector',
        reaVerified: false
      },
      {
        thought: 'Triggering Autonomous Self-Repair Engine. Invoking REA DOM diff analyzer & Accessibility Tree.',
        action: 'self_repair',
        selector: null,
        targetDesc: 'REA AX Match: [searchbox] "Search Products"',
        risk_level: 'medium',
        tokens: 210,
        verifiedText: 'Repaired target identified! Bumped skill version from 1.0.0 -> 1.0.1',
        reaVerified: true
      },
      {
        thought: 'Executing repaired step with dynamic accessibility target.',
        action: 'fill',
        selector: '#search-input',
        targetDesc: 'input#search-input (repaired)',
        value: 'headphones',
        risk_level: 'low',
        tokens: 125,
        verifiedText: 'Query populated: headphones',
        reaVerified: true
      },
      {
        thought: 'Triggering catalog search.',
        action: 'click',
        selector: '#search-btn',
        targetDesc: 'button#search-btn',
        risk_level: 'low',
        tokens: 110,
        verifiedText: 'Filtered 1 item: Noise-Canceling Headphones ($299.00)',
        reaVerified: true
      }
    ];
  }

  // Default: catalog search scenario
  return [
    {
      thought: `Parsing goal: "${goal}". Inspecting catalog accessibility tree with REA.`,
      action: 'perceive',
      selector: null,
      targetDesc: 'REA Accessibility Tree snapshot',
      risk_level: 'low',
      tokens: 150,
      verifiedText: 'Catalog searchbox and 4 product cards identified',
      reaVerified: true
    },
    {
      thought: 'Focusing search input and entering query "headphones".',
      action: 'fill',
      selector: '#search-input',
      targetDesc: 'input#search-input',
      value: 'headphones',
      risk_level: 'low',
      tokens: 135,
      verifiedText: 'Input populated with "headphones"',
      reaVerified: true
    },
    {
      thought: 'Triggering product catalog search filter.',
      action: 'click',
      selector: '#search-btn',
      targetDesc: 'button#search-btn',
      risk_level: 'low',
      tokens: 110,
      verifiedText: 'Live results updated: Showing 1 of 4 products',
      reaVerified: true
    },
    {
      thought: 'Adding matched Noise-Canceling Headphones to cart.',
      action: 'click',
      selector: '#buy-headphones',
      targetDesc: 'button#buy-headphones',
      risk_level: 'medium',
      tokens: 160,
      verifiedText: 'Item added: Noise-Canceling Headphones ($299.00)',
      reaVerified: true
    }
  ];
}

const server = createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = parsedUrl.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

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

        // Update shields stats slightly for dynamic feel
        if (shieldsStats.shieldsActive) {
          shieldsStats.trackersBlocked += 2;
          shieldsStats.bandwidthSavedMB = parseFloat((shieldsStats.bandwidthSavedMB + 0.1).toFixed(1));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'SUCCESS',
          goal,
          scenario,
          trajectory,
          shields: shieldsStats
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // REA Deep Page Inspection API
  if (req.method === 'GET' && pathname === '/api/rea/inspect') {
    const pageName = parsedUrl.searchParams.get('page') || 'catalog';
    const filename = pageName.endsWith('.html') ? pageName : `${pageName}.html`;
    const targetFile = join(PUBLIC_DIR, filename);

    try {
      let html = '';
      if (existsSync(targetFile)) {
        html = await readFile(targetFile, 'utf8');
      } else {
        html = '<html><body><h1>Empty target</h1></body></html>';
      }

      const inspection = reaAdapter.inspectPage(html, `http://localhost:3000/${filename}`);
      const mcpTools = reaAdapter.discoverWebMcpTools(html, `http://localhost:3000/${filename}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'OK',
        targetUrl: inspection.url,
        summary: inspection.summary,
        interactiveElements: inspection.interactiveElements,
        discoveredScripts: inspection.discoveredScripts,
        trackersFound: inspection.trackersFound,
        webMcp: mcpTools
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Brave Shields Live Stats API
  if (req.method === 'GET' && pathname === '/api/shields/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(shieldsStats));
    return;
  }

  // Toggle Brave Shields API
  if (req.method === 'POST' && pathname === '/api/shields/toggle') {
    shieldsStats.shieldsActive = !shieldsStats.shieldsActive;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, shieldsActive: shieldsStats.shieldsActive }));
    return;
  }

  // Model Gateway & OmniRoute/FreeLLMAPI Status API
  if (req.method === 'GET' && pathname === '/api/gateway/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      activeProvider: 'OmniRoute-Cluster',
      circuitBreaker: 'CLOSED',
      providers: [
        { name: 'OmniRoute Multi-Model Router', endpoint: 'http://127.0.0.1:8080/v1', status: 'HEALTHY', activeModel: 'claude-3-5-sonnet' },
        { name: 'FreeLLMAPI Tier Fallback', endpoint: 'http://127.0.0.1:8081/v1', status: 'HEALTHY', activeModel: 'gemini-1.5-flash' },
        { name: 'Local Ollama CDP', endpoint: 'http://127.0.0.1:11434/v1', status: 'STANDBY', activeModel: 'llama3.2' }
      ],
      totalRequestsServed: 1840,
      averageLatencyMs: 42
    }));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      brand: 'Brave Autonomous Browser',
      channel: 'v0.1.0 LTS',
      uptimeSec: Math.round(process.uptime()),
      memoryHeapMB: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(1),
      registeredSkills: skillLibrary.getAllSkills().length,
      shields: shieldsStats
    }));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/skills') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      skills: skillLibrary.getAllSkills()
    }));
    return;
  }

  // Static File Serving
  let targetPath = pathname === '/' ? 'index.html' : pathname;
  if (targetPath.startsWith('/')) targetPath = targetPath.slice(1);
  const filePath = join(PUBLIC_DIR, targetPath);

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
  console.log(`🦁 Brave Autonomous Browser Studio running on http://localhost:${PORT}`);
  console.log(`   UI/UX: Brave Browser with Shields & Autonomous Copilot`);
  console.log(`   Engine: REA, OmniRoute, FreeLLMAPI, and Chromium CDP`);
  console.log(`============================================================\n`);
});
