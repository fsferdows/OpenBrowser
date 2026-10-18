/**
 * REA (Reverse Engineer Anything) Adapter
 * Interfaces the Agentic Browser Skill Engine and Brave Shields with REA's
 * reverse engineering, runtime observation, and DOM artifact analysis capabilities.
 */

export class ReaAnalysisAdapter {
  constructor(options = {}) {
    this.knownTrackerPatterns = options.knownTrackerPatterns || [
      /google-analytics\.com/i,
      /doubleclick\.net/i,
      /facebook\.net/i,
      /analytics\./i,
      /telemetry\./i,
      /fingerprint/i,
      /tracker/i,
      /adservice/i,
      /tracking-beacon/i
    ];
  }

  /**
   * Deeply inspects an active web page HTML structure and extracts interactive targets,
   * accessibility mappings, and embedded third-party script signatures.
   */
  inspectPage(html, url = 'http://localhost:3000') {
    if (!html || typeof html !== 'string') {
      return {
        url,
        interactiveElements: [],
        discoveredScripts: [],
        trackersFound: [],
        summary: { totalInteractive: 0, totalScripts: 0, trackersDetected: 0 }
      };
    }

    const interactiveElements = [];
    const discoveredScripts = [];
    const trackersFound = [];

    // 1. Extract interactive form controls and links
    const elementRegex = /<(button|input|select|a|form)\b([^>]*)>(?:([\s\S]*?)<\/\1>)?/gi;
    let match;
    while ((match = elementRegex.exec(html)) !== null) {
      const tag = match[1].toLowerCase();
      const attrsStr = match[2];
      const innerText = (match[3] || '').replace(/<[^>]+>/g, '').trim();

      const idMatch = attrsStr.match(/\bid=["']([^"']+)["']/i);
      const classMatch = attrsStr.match(/\bclass=["']([^"']+)["']/i);
      const roleMatch = attrsStr.match(/\brole=["']([^"']+)["']/i);
      const ariaLabelMatch = attrsStr.match(/\baria-label=["']([^"']+)["']/i);
      const typeMatch = attrsStr.match(/\btype=["']([^"']+)["']/i);
      const nameMatch = attrsStr.match(/\bname=["']([^"']+)["']/i);

      const id = idMatch ? idMatch[1] : null;
      const role = roleMatch ? roleMatch[1] : (tag === 'button' ? 'button' : tag === 'a' ? 'link' : tag === 'input' ? 'textbox' : tag);
      const accessibleName = ariaLabelMatch ? ariaLabelMatch[1] : innerText || (nameMatch ? nameMatch[1] : (id || ''));
      const selector = id ? `#${id}` : (classMatch ? `${tag}.${classMatch[1].split(' ')[0]}` : tag);

      interactiveElements.push({
        tag,
        id,
        role,
        accessibleName,
        selector,
        type: typeMatch ? typeMatch[1] : null
      });
    }

    // 2. Extract script tags and detect tracking beacons
    const scriptRegex = /<script\b([^>]*)>(?:([\s\S]*?)<\/script>)?/gi;
    while ((match = scriptRegex.exec(html)) !== null) {
      const attrs = match[1];
      const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
      const src = srcMatch ? srcMatch[1] : null;
      const inlineSnippet = (match[2] || '').trim();

      const scriptInfo = {
        src,
        isExternal: Boolean(src),
        isTracker: false
      };

      const testTarget = src || inlineSnippet;
      const isTracker = this.knownTrackerPatterns.some(pattern => pattern.test(testTarget));
      if (isTracker) {
        scriptInfo.isTracker = true;
        trackersFound.push({
          source: src || 'inline-telemetry',
          reason: 'Matches tracking or fingerprinting heuristic signature'
        });
      }

      discoveredScripts.push(scriptInfo);
    }

    return {
      url,
      interactiveElements,
      discoveredScripts,
      trackersFound,
      summary: {
        totalInteractive: interactiveElements.length,
        totalScripts: discoveredScripts.length,
        trackersDetected: trackersFound.length
      }
    };
  }

  /**
   * Discovers WebMCP (Model Context Protocol) candidate tools and action contracts from the page.
   */
  discoverWebMcpTools(html, url = 'http://localhost:3000') {
    const inspection = this.inspectPage(html, url);
    const tools = [];

    // Synthesize semantic tool contracts from elements
    for (const el of inspection.interactiveElements) {
      if (el.tag === 'button' && el.id) {
        tools.push({
          name: `dom_click_${el.id.replace(/-/g, '_')}`,
          description: `Click ${el.accessibleName || el.id} on ${url}`,
          action: 'click',
          selector: el.selector,
          risk_level: el.id.includes('buy') || el.id.includes('delete') ? 'high' : 'low'
        });
      } else if (el.tag === 'input' && el.id && (el.type === 'text' || el.type === 'email' || el.type === 'search')) {
        tools.push({
          name: `dom_fill_${el.id.replace(/-/g, '_')}`,
          description: `Fill text into ${el.accessibleName || el.id}`,
          action: 'fill',
          selector: el.selector,
          risk_level: el.type === 'password' ? 'high' : 'low'
        });
      }
    }

    return {
      url,
      protocol: 'WebMCP/1.0',
      toolsCount: tools.length,
      tools
    };
  }

  /**
   * Observes network requests, flags trackers for Brave Shields, and tallies blocked stats.
   */
  observeNetworkAndShields(requests = [], activeShields = true) {
    let trackersBlocked = 0;
    let fingerprintingBlocked = 0;
    let httpsUpgrades = 0;
    let bandwidthSavedKB = 0;

    const evaluatedRequests = requests.map(req => {
      const url = req.url || '';
      const isTracker = this.knownTrackerPatterns.some(pattern => pattern.test(url));
      const isFingerprint = /fingerprint/i.test(url);
      const isHttp = url.startsWith('http://');

      let blocked = false;
      let upgradedHttps = false;

      if (activeShields) {
        if (isTracker) {
          trackersBlocked++;
          blocked = true;
          bandwidthSavedKB += (req.estimatedSizeKB || 14.2);
        }
        if (isFingerprint) {
          fingerprintingBlocked++;
          blocked = true;
        }
        if (isHttp) {
          upgradedHttps = true;
          httpsUpgrades++;
        }
      }

      return {
        url,
        method: req.method || 'GET',
        blocked,
        upgradedHttps,
        reason: blocked ? (isFingerprint ? 'Fingerprinting prevention' : 'Tracker/Ad blocking') : 'Allowed'
      };
    });

    return {
      shieldsActive: activeShields,
      totalRequests: requests.length,
      trackersBlocked,
      fingerprintingBlocked,
      httpsUpgrades,
      bandwidthSavedKB: parseFloat(bandwidthSavedKB.toFixed(1)),
      evaluatedRequests
    };
  }

  /**
   * Compares pre-action and post-action DOM snapshots for structural changes,
   * verifying whether an agent step mutated the DOM as expected.
   */
  compareWebCaptures(beforeHtml = '', afterHtml = '') {
    const beforeInspection = this.inspectPage(beforeHtml);
    const afterInspection = this.inspectPage(afterHtml);

    const beforeSelectors = new Set(beforeInspection.interactiveElements.map(e => e.selector));
    const afterSelectors = new Set(afterInspection.interactiveElements.map(e => e.selector));

    const addedElements = afterInspection.interactiveElements.filter(e => !beforeSelectors.has(e.selector));
    const removedElements = beforeInspection.interactiveElements.filter(e => !afterSelectors.has(e.selector));

    const textLengthDelta = afterHtml.length - beforeHtml.length;
    const hasMutated = addedElements.length > 0 || removedElements.length > 0 || Math.abs(textLengthDelta) > 10;

    return {
      hasMutated,
      addedCount: addedElements.length,
      removedCount: removedElements.length,
      addedElements: addedElements.map(e => e.selector),
      removedElements: removedElements.map(e => e.selector),
      textLengthDelta
    };
  }
}
