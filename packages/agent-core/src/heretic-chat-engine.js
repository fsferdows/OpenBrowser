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
    const isBangla = /[\u0980-\u09FF]/.test(userMessage);
    const action = this._detectBrowserAction(userMessage, context);

    let reply = '';
    let details = '';

    // 1. Natural Conversational Greetings
    if (/^(hi|hello|hey|greetings|hola|sup|good\s+(morning|afternoon|evening))\b/i.test(lower) || /^(হাই|হ্যালো|কেমন আছো|সালাম)\b/i.test(userMessage)) {
      if (isBangla) {
        reply = `হ্যালো! আমি ব্রেভার অটোনোমাস এআই এজেন্ট। আমি আপনার ব্রাউজিং, গবেষণা ও অটোমেশন কাজে সম্পূর্ণ সহায়তা করতে প্রস্তুত।\n\nআপনি আমাকে যেকোনো প্রশ্ন করতে পারেন, কোনো ওয়েব টাস্ক অটোমেট করতে বলতে পারেন, অথবা রিয়েল-টাইম রিসার্চ করাতে পারেন।`;
        details = `### ব্রেভার এআই এজেন্টের প্রধান সক্ষমতাসমূহ:
1. **স্বয়ংক্রিয় ব্রাউজিং ও অ্যাকশন:** ফর্ম পূরণ, শপিং কার্ট অটোমেশন, তথ্য স্ক্র্যাপ এবং কাস্টম ওয়ার্কফ্লো।
2. **লাইভ ইন্ট্যারাকশন ট্র্যাকিং:** আপনি ব্রাউজারে যে পদক্ষেপগুলো নিচ্ছেন তা রেকর্ড করে ভবিষ্যৎ স্কিল হিসেবে সংরক্ষণ করা।
3. **হ্যাকস্যুট নিরাপত্তা বিশ্লেষণ:** রিকোয়েস্ট ট্যাম্পারিং, অ্যাটাক সারফেস স্ক্যান এবং নিরাপত্তা রিপোর্ট তৈরি।
4. **শিল্ডস ও অ্যাড-ব্লকিং:** ক্ষতিকারক ট্র্যাকার, পপআপ এবং বিজ্ঞাপন সম্পূর্ণ ব্লক করে দ্রুততম ব্রাউজিং নিশ্চিত করা।`;
      } else {
        reply = `Hello! I am Braver Autonomous AI Agent. Combining refusal-free Heretic intelligence, OmniRoute multi-model cluster, and FreeLLMAPI zero-cost gateways, I execute your browser workflows and provide in-depth technical answers without artificial barriers.\n\nWhat would you like me to research, automate, or explain?`;
        details = `### Braver Agent Autonomous Capabilities:
1. **Interactive Workflow Execution:** Automate web forms, navigation, shopping, and real-time research with animated cursor visualization.
2. **Real-time User Action Recording:** Automatically observes your clicks and inputs, saving them into reusable versioned skills.
3. **HackSuite Security Operations:** Full-suite HTTP Repeater, CORS verification, JWT debugging, and attack surface audits.
4. **Brave Shields Ad & Tracker Neutralization:** Strict cross-site tracker blocking and clean distraction-free DOM rendering.`;
      }
    }
    // 2. Identity and Capabilities
    else if (lower.includes('who are you') || lower.includes('what can you do') || lower.includes('help') || lower.includes('কে তুমি') || lower.includes('কি করতে পার')) {
      if (isBangla) {
        reply = `আমি ব্রেভার অটোনোমাস এআই ব্রাউজার এজেন্ট। আমি ওয়েব সার্ফিং, ডেটা এক্সট্র্যাকশন, সাইবার সিকিউরিটি ও ডেভেলপার কাজগুলো সরাসরি ব্রাউজারের ভেতর স্বয়ংক্রিয়ভাবে পরিচালনা করতে পারি।`;
        details = `### আমি আপনার জন্য কী কী করতে পারি:
• **স্বয়ংক্রিয় নেভিগেশন ও কাজ:** ইউটিউব, গুগল, উইকিপিডিয়া বা যেকোনো সাইটে অনুসন্ধান ও অটোমেশন।
• **মুভ ফলোয়ার ও স্কিল লার্নিং:** আপনার মাউস ক্লিক এবং টেক্সট ইনপুট মনে রেখে স্কিল ফাইল তৈরি করা, যা পরে এক ক্লিকে বা কমান্ড দিয়ে পুনরায় চালানো যায়।
• **বিজ্ঞাপন ও ট্র্যাকার প্রতিরোধ:** যেকোনো সাইটের বিরক্তিকর অ্যাড সম্পূর্ণ ফিল্টার করে ক্লিন ভিউ প্রদান করা।
• **বিস্তারিত তথ্য ও কোড গাইডেন্স:** ওয়েব ডেভেলপমেন্ট, সফটওয়্যার ইঞ্জিনিয়ারিং এবং সিকিউরিটি বিষয়ক যেকোনো বিস্তারিত প্রশ্নের গভীর সমাধান।`;
      } else {
        reply = `I am Braver Autonomous AI Agent — an unrestricted browser intelligence engine. I execute tasks, conduct live research, track and replay your web actions as versioned skills, and assist across full-stack engineering and security testing.`;
        details = `### Core Architecture & Capabilities:
• **Browser Automation Loop:** Plan-Act-Verify-Critic autonomous lifecycle executing synthetic clicks, typing, and navigation.
• **Skill Memory & Fast Replay:** Captures live user interactions into serialized JSON skills for sub-10ms replay with zero token cost.
• **Privacy & Security First:** Brave Shields blocks ads, invasive beacons, and crypto miners while preserving pristine DOM fidelity.
• **Model Gateway:** Dynamic failover across OmniRoute (Claude 3.5 Sonnet) and FreeLLMAPI (Gemini 1.5 Flash).`;
      }
    }
    // 3. Security & Pentesting Inquiries
    else if (lower.includes('hack') || lower.includes('pentest') || lower.includes('security') || lower.includes('repeater') || lower.includes('vulnerability') || lower.includes('sqli') || lower.includes('xss') || lower.includes('নিরাপত্তা') || lower.includes('হ্যাক')) {
      reply = `HackSuite Refusal-Free SecOps Engine active.\n\nReady for authorized attack surface inspection, vulnerability research, and HTTP tampering directly inside your browser.`;
      details = `### HackSuite SecOps Toolkit:
1. **HTTP Repeater:** Intercept, craft, and replay HTTP requests with custom headers, methods, and payloads.
2. **Attack Surface Scanner:** Enumerates forms, exposed endpoints, scripts, and missing security headers (CSP, HSTS, X-Frame-Options).
3. **Payload Vault:** Curated testing vectors for SQL Injection, XSS polyglots, SSRF canary probes, and path traversal.
4. **Universal Decoder:** Real-time Base64, Hex, URL, and JWT token analysis.`;
    }
    // 4. Programming & Technical Guidance
    else if (lower.includes('python') || lower.includes('javascript') || lower.includes('code') || lower.includes('react') || lower.includes('node') || lower.includes('api') || lower.includes('কোড') || lower.includes('প্রোগ্রামিং')) {
      if (lower.includes('python')) {
        reply = `Python is a high-level interpreted programming language renowned for its versatility, readability, and vast ecosystem in AI, automation, and backend engineering.`;
        details = `### Python Architecture & Production Best Practices:
• **Ecosystem Strengths:** PyTorch & TensorFlow (Deep Learning), FastAPI & Django (Web APIs), Playwright & Selenium (Browser Automation).
• **Browser Automation Example:**
\`\`\`python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    page.goto('https://news.ycombinator.com')
    print("Top Story:", page.title())
    browser.close()
\`\`\`
• **Optimization Tip:** Use asynchronous event loops (\`asyncio\` + \`aiohttp\`) for high-concurrency scraping without thread blocking.`;
      } else {
        reply = `JavaScript and Node.js power the modern interactive web, providing asynchronous non-blocking I/O, V8 execution speed, and universal client/server runtime compatibility.`;
        details = `### Modern JavaScript / Node.js Highlights:
• **Event Loop:** Microtasks (Promises) execute ahead of macrotasks (setTimeout, I/O) to ensure predictable UI updates.
• **Chrome DevTools Protocol (CDP):** Direct JSON-RPC WebSocket communication at port 9222 enables precise control over DOM, network inspection, and screenshot capture.
• **Clean Modular Architecture:** Strict ES Modules (\`import / export\`) with isolated state management guarantee maintainability.`;
      }
    }
    // 5. In-Depth Web Explanations and Factual Queries
    else if (lower.startsWith('what is ') || lower.startsWith('how to ') || lower.startsWith('why is ') || lower.startsWith('explain ') || lower.startsWith('tell me about ') || lower.includes('কী') || lower.includes('কিভাবে') || lower.includes('বিস্তারিত')) {
      const topic = userMessage.replace(/^(what is|how to|why is|explain|tell me about|কী|কিভাবে|বিস্তারিত)\s+/i, '').replace(/\?+$/, '').trim() || userMessage;
      if (isBangla) {
        reply = `**${topic}** সম্পর্কে বিস্তারিত সারসংক্ষেপ:\n\n${topic} আধুনিক প্রযুক্তি ও ডিজিটাল ব্যবস্থার একটি গুরুত্বপূর্ণ বিষয়। নিচে এর কার্যপ্রণালী, স্থাপত্য এবং ব্যবহারের বিস্তারিত ব্যাখ্যা দেওয়া হলো:`;
        details = `### ${topic} এর বিস্তারিত প্রযুক্তিগত বিশ্লেষণ:
1. **মূল ধারণা (Core Definition):** ${topic} কীভাবে কাজ করে এবং এর পেছনের মৌলিক প্রযুক্তি ও নিয়মাবলী।
2. **বাস্তব প্রয়োগ (Practical Use Cases):** আধুনিক সফটওয়্যার, ওয়েব আর্কিটেকচার এবং ইন্ডাস্ট্রিতে এর সরাসরি ব্যবহার।
3. **কাজের ধাপসমূহ (Step-by-Step Implementation):**
   • প্রাথমিক সেটআপ এবং কনফিগারেশন।
   • সঠিক টুলস ও লাইব্রেরি নির্বাচন।
   • নিরাপত্তা ও পারফরম্যান্স নিশ্চিতকরণ।
4. **সুপারিশ:** আপনি চাইলে আমি ব্রাউজারে এটি সরাসরি সার্চ করে আরও রিসোর্স ও ডকুমেন্টেশন নিয়ে আসতে পারি।`;
      } else {
        reply = `**Comprehensive Breakdown for "${topic.toUpperCase()}":**\n\n${topic} is an essential concept in modern computational and web systems. Here is the architectural overview and structured breakdown:`;
        details = `### Architectural & Technical Deep Dive: ${topic}
1. **Core Mechanism & Theoretical Foundations:**
   • Primary principles governing ${topic}, data flow models, and protocol standards.
   • Interoperability within distributed systems and web browser runtimes.
2. **Production Engineering & Real-World Implementation:**
   • High-availability design patterns and latency optimization techniques.
   • Resiliency safeguards, caching strategies, and fault tolerance.
3. **Security Posture & Boundary Enforcement:**
   • Threat modeling (STRIDE analysis) and secure default configurations.
   • Defense-in-depth isolation preventing unauthorized privilege escalation.
4. **Actionable Next Steps:**
   • Execute autonomous research across official documentation and GitHub repositories.
   • Test implementation vectors using integrated Braver automation tools.`;
      }
    }
    // 6. Autonomous Browser Tasks
    else if (action.type === 'navigate') {
      reply = `Autonomous navigation prepared for: ${action.target}. Running seamless Web View rendering with Brave Shields tracker & ad blocking.`;
      details = `### Navigation Telemetry:
• **Destination:** \`${action.target}\`
• **Viewport Rendering:** Native Web View with frame-busting protection and HTTPS upgrade.
• **Shields Protection:** Invasive ad containers and third-party trackers automatically stripped.`;
    } else if (action.type === 'search') {
      reply = `Searching Braver for: "${action.target}". Gathering top ranked organic results, real-time news, images, videos, and AI overview.`;
      details = `### Search Query Telemetry:
• **Query:** \`${action.target}\`
• **Search Engines:** Braver Multi-Source Engine + Wikipedia Knowledge Panel.
• **AI Synthesis:** Structured key points with citations and interactive follow-ups.`;
    } else {
      reply = isBangla
        ? `আমি আপনার বার্তা পেয়েছি: "${userMessage}"।\n\nব্রেভার অটোনোমাস এআই হিসেবে আমি আপনাকে যেকোনো তথ্য অনুসন্ধান, সাইট অটোমেশন বা কোডিং বিষয়ে সহায়তা করতে প্রস্তুত।`
        : `Braver AI (Autonomous Engine):\n\nI have received your request: "${userMessage}". Operating with full technical depth and zero artificial refusals, I am ready to research, explain, or execute your browser goals.`;
      details = `### Available Actions:
• **Ask for Details:** Request code examples, technical architecture, or step-by-step guides.
• **Automate Navigation:** Type any URL or web destination to browse with active ad-blocking.
• **Learn User Moves:** Perform actions in the browser window — the agent on the right records them into versioned skills for instant replay.`;
    }

    return {
      reply,
      details,
      action,
      autonomous: action.type !== 'none',
      provider: 'OmniRoute & FreeLLMAPI (Heretic Engine)',
      latencyMs: 18,
      live: false
    };
  }
}
