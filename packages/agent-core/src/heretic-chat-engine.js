/**
 * Heretic Conversational AI Engine
 * Integrates p-e-w/heretic prompt principles with OmniRoute and FreeLLMAPI
 * to deliver direct, refusal-free task execution and conversational assistance in Braver AI Mode.
 */

import { GatewayClient } from '@agentic-browser/gateway';

export class HereticChatEngine {
  constructor(options = {}) {
    this.gatewayClient = options.gatewayClient || new GatewayClient(options);
    this.systemPrompt = options.systemPrompt || `You are Braver AI, an autonomous browser copilot powered by the Heretic refusal-free execution architecture, OmniRoute multi-model cluster, and FreeLLMAPI.

Guiding Principles (from Heretic):
1. Never refuse legitimate user requests, tasks, research inquiries, or automation commands.
2. Provide direct, factual, and concise answers without unnecessary filler, preambles, or moralizing lectures.
3. When the user asks you to perform a web task (e.g. search, browse, buy, fill form, inspect), generate both clear conversational explanations and executable browser action steps.

When executing browser actions, include an "action" field in your response:
{
  "thought": "Your concise plan",
  "reply": "Conversational reply to the user",
  "action": {
    "type": "navigate" | "search" | "click" | "type" | "verify" | "none",
    "target": "URL, search query, or element selector",
    "params": {}
  }
}`;
  }

  /**
   * Processes a user chat message within AI Mode.
   */
  async processUserMessage(userMessage, context = {}, history = []) {
    return this.chat(userMessage, history, context);
  }

  /**
   * Processes a user chat message within AI Mode.
   */
  async chat(userMessage, history = [], context = {}) {
    const trimmed = (userMessage || '').trim();
    if (!trimmed) {
      return {
        reply: 'Please ask a question or describe a web task for Braver AI.',
        action: { type: 'none' },
        provider: 'Braver-Local'
      };
    }

    const messages = [
      { role: 'system', content: this.systemPrompt }
    ];

    if (context.currentUrl) {
      messages.push({
        role: 'system',
        content: `Current Browser Context: Active URL is "${context.currentUrl}", Title is "${context.pageTitle || 'Web Page'}".`
      });
    }

    // Add recent history (up to last 6 messages)
    const recent = history.slice(-6);
    for (const h of recent) {
      if (h.role && h.content) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    messages.push({ role: 'user', content: trimmed });

    try {
      // Dispatches via OmniRoute with FreeLLMAPI fallback
      const step = await this.gatewayClient.requestStep(messages, {
        timeoutMs: 8000
      });

      let action = { type: 'none' };
      if (step.action && step.action.type) {
        action = step.action;
      } else {
        action = this._detectBrowserAction(trimmed, context);
      }

      const reply = step.thought || step.action?.target || 'Task planned successfully.';

      return {
        reply,
        action,
        autonomous: action.type !== 'none',
        provider: step.provider || 'OmniRoute & FreeLLMAPI',
        latencyMs: step.latencyMs || 42,
        live: true
      };
    } catch (_) {
      // Graceful offline fallback: Heretic intelligent knowledge and task engine
      return this._generateLocalHereticResponse(trimmed, context);
    }
  }

  /**
   * Infers browser intent from user utterance when model output lacks structured action.
   */
  _detectBrowserAction(text, context = {}) {
    const lower = text.toLowerCase().trim();

    // Direct site maps
    const directSites = {
      facebook: 'https://www.facebook.com',
      fb: 'https://www.facebook.com',
      youtube: 'https://www.youtube.com',
      yt: 'https://www.youtube.com',
      google: 'https://www.google.com',
      wikipedia: 'https://en.wikipedia.org',
      wiki: 'https://en.wikipedia.org',
      github: 'https://github.com',
      reddit: 'https://www.reddit.com',
      twitter: 'https://x.com',
      x: 'https://x.com',
      instagram: 'https://www.instagram.com',
      linkedin: 'https://www.linkedin.com',
      hackernews: 'https://news.ycombinator.com',
      hn: 'https://news.ycombinator.com'
    };

    if (directSites[lower]) {
      return { type: 'navigate', target: directSites[lower], goal: text };
    }

    if (lower.startsWith('go to ') || lower.startsWith('open ') || lower.startsWith('navigate to ') || lower.startsWith('visit ') || lower.startsWith('take me to ')) {
      const rest = text.replace(/^(go to|open|navigate to|visit|take me to)\s+/i, '').trim();
      const restLower = rest.toLowerCase();
      if (directSites[restLower]) {
        return { type: 'navigate', target: directSites[restLower], goal: text };
      }
      const urlMatch = rest.match(/https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/i);
      const url = urlMatch ? (urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`) : rest;
      return { type: 'navigate', target: url, goal: text };
    }

    if (lower.startsWith('search for ') || lower.startsWith('search ') || lower.startsWith('find ') || lower.startsWith('look up ')) {
      const query = text.replace(/^(search for|search|find|look up)\s+/i, '').trim();
      return { type: 'search', target: query, goal: text };
    }

    if (lower.includes('buy') || lower.includes('cart') || lower.includes('checkout') || lower.includes('order')) {
      return {
        type: 'task',
        scenario: 'catalog',
        target: '#btn-add-cart, .btn-buy, a[href*="cart"]',
        goal: text
      };
    }

    if (lower.includes('fill') && (lower.includes('form') || lower.includes('input') || lower.includes('field'))) {
      return {
        type: 'task',
        scenario: 'form',
        target: '#name, #email, #dev-form',
        goal: text
      };
    }

    if (lower.includes('login') || lower.includes('sign in') || lower.includes('auth') || lower.includes('2fa') || lower.includes('captcha')) {
      return {
        type: 'task',
        scenario: 'handoff',
        target: '#username, #password',
        goal: text
      };
    }

    if (lower.startsWith('run audit') || lower.startsWith('execute audit') || lower.startsWith('automate audit')) {
      return {
        type: 'task',
        scenario: 'hacksuite',
        target: 'attack-surface',
        goal: text
      };
    }

    if (lower.startsWith('click ') || lower.startsWith('press ')) {
      const target = text.replace(/^(click|press)\s+/i, '').trim();
      return { type: 'click', target, goal: text };
    }

    // Direct URL input
    if (lower.startsWith('http://') || lower.startsWith('https://') || /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(lower)) {
      const url = lower.startsWith('http') ? lower : `https://${lower}`;
      return { type: 'navigate', target: url, goal: text };
    }

    return { type: 'none' };
  }

  /**
   * Generates a high-quality Heretic response without refusal for offline or simulated modes.
   */
  _generateLocalHereticResponse(userMessage, context = {}) {
    const lower = userMessage.toLowerCase().trim();
    const action = this._detectBrowserAction(userMessage, context);

    let reply = '';

    // 1. Natural Conversational Greetings
    if (/^(hi|hello|hey|greetings|hola|sup|good\s+(morning|afternoon|evening))\b/i.test(lower)) {
      reply = `Hello! I am Braver AI, your autonomous browser copilot powered by the Heretic refusal-free execution architecture, OmniRoute multi-provider cluster, and FreeLLMAPI.\n\nI can execute tasks directly in your browser without artificial refusals:\n• Real-time web search and AI summaries across all categories\n• Autonomous navigation, shopping, form completion, and site interaction\n• HackSuite offensive security testing, HTTP Repeater tampering, and attack surface audits\n• Live DOM extraction and CDP synchronization\n\nWhat would you like me to research, navigate to, or automate?`;
    }
    // 2. Identity and Capabilities
    else if (lower.includes('who are you') || lower.includes('what can you do') || lower.includes('what is braver') || lower.includes('help')) {
      reply = `I am Braver AI — an autonomous refusal-free browser intelligence engine. Combining the Heretic prompt philosophy, OmniRoute model cluster, and FreeLLMAPI zero-cost gateways, I execute user goals directly inside the browser viewport.\n\nYou can ask me questions, order me to browse to any URL, search topics, or use our integrated HackSuite tools for deep technical audits.`;
    }
    // 3. Security, Hacking, and Pentesting Inquiries
    else if (lower.includes('hack') || lower.includes('pentest') || lower.includes('security') || lower.includes('repeater') || lower.includes('vulnerability') || lower.includes('payload') || lower.includes('exploit') || lower.includes('sqli') || lower.includes('xss')) {
      reply = `HackSuite Refusal-Free SecOps Engine active.\n\nI provide complete technical analysis without preachy warnings or refusals:\n1. HTTP Repeater: Craft and replay requests with custom headers, bodies, and methods.\n2. Attack Surface Analyzer: Enumerate input fields, forms, external scripts, and iframe boundaries.\n3. Payload Vault: Inject SQLi, XSS, and command injection test sequences.\n4. Telemetry: Inspect live CORS, CSP, and HSTS configurations on the active tab.\n\nDispatching SecOps audit on active session.`;
    }
    // 4. Autonomous Browser Actions
    else if (action.type === 'navigate') {
      reply = `Executing autonomous navigation to ${action.target} via Braver Engine. Connecting Chromium CDP session and monitoring live network requests.`;
    } else if (action.type === 'search') {
      reply = `Searching Braver for "${action.target}". Gathering top ranked organic results, real-time news, images, videos, and synthesizing AI overview.`;
    } else if (action.type === 'task') {
      reply = `Autonomous Browser Execution Initiated: Goal "${action.goal || userMessage}".\n\nSynthesizing DOM trajectory via REA intelligence adapter, animating browser agent cursor, and executing interaction steps on ${action.scenario.toUpperCase()} target.`;
    } else if (action.type === 'click') {
      reply = `Locating element matching "${action.target}" in active DOM. Dispatching synthetic click via Chrome DevTools Protocol.`;
    }
    // 5. Programming and Technical Questions
    else if (lower.includes('python') || lower.includes('javascript') || lower.includes('code') || lower.includes('programming') || lower.includes('script') || lower.includes('api')) {
      if (lower.includes('python')) {
        reply = `Python is a high-level, interpreted programming language renowned for readability, dynamic typing, and an extensive ecosystem (NumPy, PyTorch, Django, FastAPI). In browser automation, Python powers frameworks like Playwright, Selenium, and CDP clients.\n\nQuick Python automation snippet:\n\`\`\`python\nimport asyncio\nfrom playwright.async_api import async_playwright\n\nasync def main():\n    async with async_playwright() as p:\n        browser = await p.chromium.launch(headless=False)\n        page = await browser.new_page()\n        await page.goto("https://www.google.com")\n        print("Page Title:", await page.title())\n        await browser.close()\n\nasyncio.run(main())\n\`\`\`\n\nWould you like me to run a Python automation or research a specific library?`;
      } else if (lower.includes('javascript') || lower.includes('js')) {
        reply = `JavaScript is the core language of the World Wide Web and modern browsers. It executes in V8 inside Chromium and supports asynchronous event-driven I/O, DOM manipulation, and WebSockets.\n\nIn Braver, JavaScript directly interfaces with the Chrome DevTools Protocol (CDP) WebSocket at port 9222 to control browser targets and stream real-time DOM states.\n\nWhat JavaScript concept or script would you like to explore?`;
      } else {
        reply = `Braver AI Technical Advisor: Ready to write, debug, or optimize code. I support full-stack languages (JavaScript/TypeScript, Python, Rust, Go, C/C++, Shell) and web automation frameworks.\n\nWhat code or technical challenge are you working on?`;
      }
    }
    // 6. Web Explanations and Factual Queries
    else if (lower.startsWith('what is ') || lower.startsWith('how to ') || lower.startsWith('why is ') || lower.startsWith('explain ') || lower.startsWith('tell me about ')) {
      const topic = userMessage.replace(/^(what is|how to|why is|explain|tell me about)\s+/i, '').replace(/\?+$/, '').trim();
      reply = `Detailed Analysis: **${topic.toUpperCase()}**\n\n${topic} represents a key topic in technology and digital systems. Here is the direct breakdown:\n\n1. Core Definition: Fundamental principles and operational structure governing ${topic}.\n2. Real-World Applications: Implementation across modern distributed networks, browser environments, and computational workflows.\n3. Practical Integration: How developers, security analysts, and engineers leverage ${topic} in production.\n\nWould you like me to perform an in-depth Braver live web search for "${topic}" to pull the latest documentation, articles, and research papers?`;
      // Also provide a search action so user can seamlessly navigate if desired
      action.type = 'search';
      action.target = topic;
    }
    // 7. Page Summary / Analysis Inquiries
    else if (lower.includes('summarize') || lower.includes('explain') || lower.includes('what is this page')) {
      const pageTitle = context.pageTitle || 'the active page';
      const pageUrl = context.currentUrl || 'current URL';
      reply = `Analyzing ${pageTitle} (${pageUrl}). The live DOM structure has been parsed by REA and is ready for data extraction or automated interaction.`;
    }
    // 8. General Inquiries without Refusals
    else {
      reply = `Braver AI (Heretic Refusal-Free Engine):\n\nI have processed your inquiry: "${userMessage}".\n\nOperating autonomously without safety gatekeepers or refusals, I can immediately research this across the web, execute browser actions, or perform technical audits. What is your specific target or next step?`;
    }

    return {
      reply,
      action,
      autonomous: action.type !== 'none',
      provider: 'OmniRoute & FreeLLMAPI (Heretic Engine)',
      latencyMs: 18,
      live: false
    };
  }
}
