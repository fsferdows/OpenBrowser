/**
 * Chromium CDP (Chrome DevTools Protocol) Client
 * Forms the browser basement connecting the autonomous agent to Chromium / Chrome tabs,
 * target lifecycles, real-time DOM queries, and simulated/live input dispatch.
 * Modeled after rea-main CdpConnection and CdpBrowserProvider.
 */

export const BRAVE_SHIELDS_BLOCKED_URLS = [
  '*googlesyndication.com*',
  '*doubleclick.net*',
  '*googleadservices.com*',
  '*adservice.google.*',
  '*pagead2.googlesyndication.com*',
  '*securepubads.g.doubleclick.net*',
  '*adnxs.com*',
  '*amazon-adsystem.com*',
  '*criteo.com*',
  '*criteo.net*',
  '*taboola.com*',
  '*outbrain.com*',
  '*pubmatic.com*',
  '*rubiconproject.com*',
  '*openx.net*',
  '*casalemedia.com*',
  '*scorecardresearch.com*',
  '*moatads.com*',
  '*adroll.com*',
  '*advertising.com*',
  '*smartadserver.com*',
  '*bidswitch.net*',
  '*yieldmo.com*',
  '*chartbeat.com*',
  '*castlereach.com*',
  '*succeedscene.com*',
  '*getadmiral.com*',
  '*facebook.com/tr/*',
  '*connect.facebook.net/*/fbevents.js*',
  '*youtube.com/api/stats/ads*',
  '*youtube.com/pagead/*',
  '*youtube.com/ptracking*',
  '*static.doubleclick.net*'
];

export const BRAVE_SHIELDS_CDP_SCRIPT = `
(function() {
  if (window.__BRAVE_SHIELDS_INJECTED__) return;
  window.__BRAVE_SHIELDS_INJECTED__ = true;

  // 1. Inject Brave Shields Anti-Ad Stylesheet
  const css = \`
    ins.adsbygoogle, .adsbygoogle, [id^="google_ads_"], [id*="gpt-ad"],
    [class*="ad-box"], [class*="advertisement"], [class*="sponsored-post"],
    .taboola-ad, .outbrain-ad, [id*="taboola"], [class*="outbrain"],
    .ad-banner, .top-ad, .sidebar-ad, .bottom-ad,
    ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer,
    ytd-statement-banner-renderer, ytd-promoted-video-renderer,
    #masthead-ad, .video-ads, .ytp-ad-module, .ytp-ad-overlay-container,
    .ytp-ad-text, .ytp-ad-player-overlay, .ytp-ad-image-overlay,
    .badge-style-type-ad, .ytd-merch-shelf-renderer,
    .DCDOr, [class*="a__s1p0xe8r"], div[class*="adblock"], iframe[src*="getadmiral"],
    .adblock-overlay {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    html, body {
      overflow: auto !important;
      position: static !important;
    }
  \`;
  const style = document.createElement('style');
  style.id = 'brave-shields-cdp-adblock';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  // 2. Anti-Adblock Defusers
  window.googletag = window.googletag || { cmd: [], apiReady: true };
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.loaded = true;
  window._afsr = false;
  window.__tcfapi = function(c, v, cb) { if(cb) cb({ gdprApplies: false }, true); };

  // 3. YouTube Video Ad Fast-Forward & Auto-Skip Daemon
  setInterval(() => {
    // Auto-click YouTube skip button if visible
    const skipBtns = document.querySelectorAll(
      '.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern, ' +
      '.ytp-ad-overlay-close-button, button.ytp-ad-skip-button-text'
    );
    for (const btn of skipBtns) {
      try { btn.click(); } catch (_) {}
    }

    // Fast-forward video ads if active
    const player = document.querySelector('#movie_player, .html5-video-player');
    const isAd = player && (
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting') ||
      document.querySelector('.ytp-ad-player-overlay')
    );
    if (isAd) {
      const video = document.querySelector('video');
      if (video && !isNaN(video.duration)) {
        video.muted = true;
        video.playbackRate = 16.0;
        video.currentTime = video.duration - 0.1;
      }
    }
  }, 100);
})();
`;

export class ChromiumCdpClient {
  constructor(options = {}) {
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 9222;
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.wsConstructor = options.wsConstructor || globalThis.WebSocket;
    this.sessions = new Map(); // targetId -> { ws, pending: Map(), nextId: 1 }
    this.simulatedTargets = new Map([
      ['target-newtab', { id: 'target-newtab', type: 'page', title: 'Brave | New Tab', url: 'brave://newtab', attached: true }],
      ['target-catalog', { id: 'target-catalog', type: 'page', title: 'ElectroTech Catalog', url: 'https://shop.example.com/catalog.html', attached: false }],
      ['target-form', { id: 'target-form', type: 'page', title: 'Developer Portal', url: 'https://portal.example.com/form.html', attached: false }],
      ['target-auth', { id: 'target-auth', type: 'page', title: 'Security Gate', url: 'https://auth.example.com/auth-hand-off.html', attached: false }]
    ]);
  }

  getEndpointUrl(path = '') {
    return `http://${this.host}:${this.port}${path}`;
  }

  /**
   * Checks whether the live CDP port is responsive.
   */
  async isCdpConnected() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 600);
      const res = await this.fetchFn(this.getEndpointUrl('/json/version'), { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  /**
   * Retrieves live browser version and metadata from /json/version.
   */
  async getBrowserInfo() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 800);
      const res = await this.fetchFn(this.getEndpointUrl('/json/version'), { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        return {
          connected: true,
          browser: data.Browser || 'Chromium',
          protocolVersion: data['Protocol-Version'] || '1.3',
          userAgent: data['User-Agent'] || '',
          webSocketDebuggerUrl: data.webSocketDebuggerUrl || null
        };
      }
    } catch (_) {}

    return {
      connected: false,
      browser: 'Chromium (Simulated Basement)',
      protocolVersion: '1.3',
      userAgent: 'Mozilla/5.0 Brave/124.0.0.0',
      webSocketDebuggerUrl: null
    };
  }

  /**
   * Discovers active Chromium browser targets.
   * Attempts live CDP /json/list first, falling back to simulated targets.
   */
  async listTargets() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 800);
      const res = await this.fetchFn(this.getEndpointUrl('/json/list'), { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const liveTargets = await res.json();
        if (Array.isArray(liveTargets)) {
          if (!liveTargets.some(t => t.type === 'page')) {
            try {
              const newTarget = await this.createTarget('about:blank');
              if (newTarget) {
                liveTargets.push(newTarget);
              }
            } catch (_) {}
          }
          return liveTargets;
        }
      }
    } catch (_) {
      // Offline fallback: return simulated Chromium targets
    }
    return Array.from(this.simulatedTargets.values());
  }

  /**
   * Creates a new browser tab/target.
   */
  async createTarget(url = 'brave://newtab') {
    try {
      const res = await this.fetchFn(this.getEndpointUrl(`/json/new?${encodeURIComponent(url)}`), { method: 'PUT' });
      if (res.ok) return await res.json();
    } catch (_) {}

    const id = `target-${Date.now()}`;
    const newTarget = { id, type: 'page', title: 'New Tab', url, attached: true };
    this.simulatedTargets.set(id, newTarget);
    return newTarget;
  }

  /**
   * Closes an active browser target.
   */
  async closeTarget(targetId) {
    try {
      const res = await this.fetchFn(this.getEndpointUrl(`/json/close/${targetId}`));
      if (res.ok) return true;
    } catch (_) {}

    return this.simulatedTargets.delete(targetId);
  }

  /**
   * Resolves or establishes a real-time duplex WebSocket session to a CDP target.
   * Adheres to rea-main CdpConnection protocol.
   */
  async getOrCreateSession(targetId) {
    if (this.sessions.has(targetId)) {
      const session = this.sessions.get(targetId);
      if (session.ws.readyState === 1) { // OPEN
        return session;
      }
      this.sessions.delete(targetId);
    }

    if (!this.wsConstructor) return null;

    try {
      const targets = await this.listTargets();
      const target = targets.find(t => t.id === targetId || (targetId === 'target-active' && t.type === 'page')) || targets.find(t => t.type === 'page');
      if (!target || !target.webSocketDebuggerUrl) return null;

      const ws = new this.wsConstructor(target.webSocketDebuggerUrl);
      const session = {
        targetId: target.id,
        ws,
        nextId: 1,
        pending: new Map()
      };

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 2000);
        ws.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };
        ws.onerror = (err) => {
          clearTimeout(timeout);
          reject(err);
        };
      });

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id && session.pending.has(data.id)) {
            const { resolve, reject } = session.pending.get(data.id);
            session.pending.delete(data.id);
            if (data.error) reject(new Error(data.error.message || 'CDP Error'));
            else resolve(data.result);
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        this.sessions.delete(targetId);
      };

      this.sessions.set(targetId, session);
      return session;
    } catch (_) {
      return null;
    }
  }

  /**
   * Dispatches a CDP command to a target session.
   * Uses live WebSocket if connected; otherwise returns typed simulated fallback.
   */
  async sendCommand(targetId, method, params = {}) {
    const session = await this.getOrCreateSession(targetId);
    if (session && session.ws.readyState === 1) {
      return new Promise((resolve, reject) => {
        const cmdId = session.nextId++;
        const timer = setTimeout(() => {
          session.pending.delete(cmdId);
          reject(new Error(`CDP command timeout: ${method}`));
        }, 3000);

        session.pending.set(cmdId, {
          resolve: (res) => {
            clearTimeout(timer);
            resolve({ id: cmdId, targetId, method, result: res });
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          }
        });

        session.ws.send(JSON.stringify({ id: cmdId, method, params }));
      });
    }

    // Simulated fallback response
    return {
      id: Math.floor(Math.random() * 100000),
      targetId,
      method,
      result: {
        success: true,
        timestamp: Date.now(),
        methodCalled: method,
        params
      }
    };
  }

  /**
   * Enforces Brave Shields on a CDP target:
   * 1. Blocks ad networks and tracker domains at the CDP socket layer via Network.setBlockedURLs
   * 2. Injects CSS ad-hiding rules, anti-adblock defusers, and YouTube ad auto-skippers via Page.addScriptToEvaluateOnNewDocument
   */
  async enableBraveShields(targetId) {
    try {
      await this.sendCommand(targetId, 'Network.enable');
      await this.sendCommand(targetId, 'Network.setBlockedURLs', {
        urls: BRAVE_SHIELDS_BLOCKED_URLS
      });
      await this.sendCommand(targetId, 'Page.enable');
      await this.sendCommand(targetId, 'Page.addScriptToEvaluateOnNewDocument', {
        source: BRAVE_SHIELDS_CDP_SCRIPT
      });
      return { success: true, targetId, shieldsActive: true };
    } catch (err) {
      return { success: false, targetId, error: err.message };
    }
  }

  /**
   * Navigates a browser target to a URL via Page.navigate.
   */
  async navigateTarget(targetId, url) {
    if (this.simulatedTargets.has(targetId)) {
      const t = this.simulatedTargets.get(targetId);
      t.url = url;
    }

    // Ensure Brave Shields is attached to the target before navigating
    await this.enableBraveShields(targetId).catch(() => {});

    try {
      const res = await this.sendCommand(targetId, 'Page.navigate', { url });
      return { success: true, targetId, url, cdpResult: res.result };
    } catch (err) {
      return { success: true, targetId, url, simulated: true };
    }
  }

  /**
   * Captures live page metadata and DOM metrics directly from the attached target.
   */
  async captureLivePage(targetId) {
    try {
      const evalExpression = `JSON.stringify({
        title: document.title || 'Untitled',
        url: location.href,
        elementCount: document.querySelectorAll('*').length,
        interactiveCount: document.querySelectorAll('a, button, input, select, textarea').length,
        heading: document.querySelector('h1, h2, title')?.textContent || ''
      })`;

      const res = await this.sendCommand(targetId, 'Runtime.evaluate', { expression: evalExpression });
      if (res && res.result && res.result.result && res.result.result.value) {
        const parsed = JSON.parse(res.result.result.value);
        return {
          title: parsed.title,
          url: parsed.url,
          elementCount: parsed.elementCount,
          interactiveCount: parsed.interactiveCount,
          heading: parsed.heading,
          live: true
        };
      }
    } catch (_) {}

    // Fallback: simulated page metadata
    const target = this.simulatedTargets.get(targetId) || {
      title: 'ElectroTech Catalog',
      url: 'https://shop.example.com/catalog.html'
    };

    return {
      title: target.title || 'ElectroTech Catalog',
      url: target.url || 'https://shop.example.com/catalog.html',
      elementCount: 42,
      interactiveCount: 12,
      heading: target.title,
      live: false
    };
  }

  /**
   * Dispatches synthetic mouse movement and click via CDP Input domain.
   */
  async dispatchClick(targetId, x, y) {
    await this.sendCommand(targetId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.sendCommand(targetId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.sendCommand(targetId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left' });
    return { clicked: true, x, y };
  }

  /**
   * Dispatches synthetic keyboard entry via CDP Input domain.
   */
  async dispatchType(targetId, text) {
    for (const char of text) {
      await this.sendCommand(targetId, 'Input.dispatchKeyEvent', { type: 'keyDown', text: char });
      await this.sendCommand(targetId, 'Input.dispatchKeyEvent', { type: 'keyUp', text: char });
    }
    return { typed: true, textLength: text.length };
  }

  /**
   * Dispatches a single keyboard event (key down + key up) via CDP Input.dispatchKeyEvent.
   * Handles special keys (Enter, Backspace, Tab, Escape, arrow keys) and text characters.
   */
  async dispatchKey(targetId, key, code = '', keyCode = 0, text = '') {
    try {
      const isEnter = key === 'Enter' || code === 'Enter';
      const isBackspace = key === 'Backspace' || code === 'Backspace';
      const isTab = key === 'Tab' || code === 'Tab';
      const isEscape = key === 'Escape' || code === 'Escape';

      let keyText = text;
      let vk = keyCode || 0;
      if (isEnter) {
        keyText = '\r';
        vk = 13;
      } else if (isBackspace) {
        vk = 8;
        keyText = '';
      } else if (isTab) {
        vk = 9;
        keyText = '\t';
      } else if (isEscape) {
        vk = 27;
        keyText = '';
      } else if (!keyText && key && key.length === 1) {
        keyText = key;
      }

      await this.sendCommand(targetId, 'Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
        key: key,
        code: code,
        text: keyText,
        unmodifiedText: keyText
      });

      if (keyText) {
        await this.sendCommand(targetId, 'Input.dispatchKeyEvent', {
          type: 'char',
          windowsVirtualKeyCode: vk,
          nativeVirtualKeyCode: vk,
          key: key,
          code: code,
          text: keyText,
          unmodifiedText: keyText
        });
      }

      await this.sendCommand(targetId, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
        key: key,
        code: code
      });

      return { dispatched: true, key, code };
    } catch (err) {
      return { dispatched: false, error: err.message };
    }
  }

  /**
   * Captures a visual screenshot of the target page via CDP Page.captureScreenshot.
   */
  async captureScreenshot(targetId, options = {}) {
    const format = options.format || 'jpeg';
    const quality = options.quality || 80;
    try {
      const res = await this.sendCommand(targetId, 'Page.captureScreenshot', { format, quality });
      if (res && res.result && res.result.data) {
        return { success: true, targetId, format, data: res.result.data };
      }
    } catch (_) {}

    return {
      success: false,
      targetId,
      format,
      data: null,
      simulated: true
    };
  }

  /**
   * Extracts the fully rendered DOM HTML from the live Chrome page.
   */
  async captureRenderedHtml(targetId) {
    try {
      const res = await this.sendCommand(targetId, 'Runtime.evaluate', {
        expression: 'document.documentElement.outerHTML'
      });
      if (res && res.result && res.result.result && typeof res.result.result.value === 'string') {
        return res.result.result.value;
      }
    } catch (_) {}
    return null;
  }

  /**
   * Navigates a live target in Google Chrome, waits for DOM execution, and captures rendered HTML.
   */
  async navigateAndRender(targetUrl, waitMs = 2200) {
    const targets = await this.listTargets();
    const pageTarget = targets.find(t => t.type === 'page');
    const targetId = pageTarget ? pageTarget.id : 'target-active';

    try {
      await this.navigateTarget(targetId, targetUrl);
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }

      let html = await this.captureRenderedHtml(targetId);
      let meta = await this.captureLivePage(targetId);

      if (!html || html.length < 300) {
        await new Promise(resolve => setTimeout(resolve, 800));
        const retryHtml = await this.captureRenderedHtml(targetId);
        if (retryHtml && retryHtml.length > (html?.length || 0)) {
          html = retryHtml;
        }
        meta = await this.captureLivePage(targetId);
      }

      return {
        success: true,
        targetId,
        url: targetUrl,
        title: meta.title || 'Live Page',
        elementCount: meta.elementCount || 0,
        html: html || `<html><body><h1>${meta.title}</h1></body></html>`,
        live: true
      };
    } catch (err) {
      return {
        success: false,
        targetId,
        url: targetUrl,
        error: err.message,
        html: null,
        live: false
      };
    }
  }

  /**
   * Dispatches synthetic scroll events via CDP Input.dispatchMouseEvent.
   */
  async dispatchScroll(targetId, x = 100, y = 100, deltaX = 0, deltaY = 200) {
    try {
      await this.sendCommand(targetId, 'Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x,
        y,
        deltaX,
        deltaY
      });
      return { scrolled: true, deltaX, deltaY };
    } catch (err) {
      return { scrolled: false, error: err.message };
    }
  }
}

