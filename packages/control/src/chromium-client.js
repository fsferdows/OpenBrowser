/**
 * Chromium CDP (Chrome DevTools Protocol) Client
 * Forms the browser basement connecting the autonomous agent to Chromium / Chrome tabs,
 * target lifecycles, real-time DOM queries, and simulated/live input dispatch.
 * Modeled after rea-main CdpConnection and CdpBrowserProvider.
 */

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
        return await res.json();
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
      const target = targets.find(t => t.id === targetId || (targetId === 'target-active' && t.type === 'page'));
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
   * Navigates a browser target to a URL via Page.navigate.
   */
  async navigateTarget(targetId, url) {
    if (this.simulatedTargets.has(targetId)) {
      const t = this.simulatedTargets.get(targetId);
      t.url = url;
    }

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
}
