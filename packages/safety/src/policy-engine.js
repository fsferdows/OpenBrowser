import { RISK_LEVELS } from '@agentic-browser/shared';

export class PolicyEngine {
  constructor(options = {}) {
    this.allowedDomains = options.allowedDomains || ['*'];
    this.requireConfirmationForHighRisk = options.requireConfirmationForHighRisk ?? true;
  }

  /**
   * Classifies the risk level of an intended action.
   */
  classifyRisk(action, target = {}, value = '') {
    const actionType = (action || '').toLowerCase();
    const targetName = (target.name || '').toLowerCase();
    const targetRole = (target.role || '').toLowerCase();
    const val = (value || '').toLowerCase();

    // Critical Tier: Payments, passwords, transfers, destructive deletion
    if (
      /pay|checkout|transfer|credit.?card|cvv|billing|wire/i.test(targetName) ||
      /delete.?account|wipe|drop.?database/i.test(targetName) ||
      /password/i.test(targetName)
    ) {
      return RISK_LEVELS.CRITICAL;
    }

    // High Tier: General deletions, external messages, profile updates
    if (
      /delete|remove|destroy|trash/i.test(targetName) ||
      /send.?email|post.?tweet|publish|broadcast/i.test(targetName) ||
      actionType === 'download' || actionType === 'upload'
    ) {
      return RISK_LEVELS.HIGH;
    }

    // Medium Tier: State modifications, filling form inputs, submitting
    if (actionType === 'fill' || actionType === 'select' || actionType === 'click') {
      return RISK_LEVELS.MEDIUM;
    }

    // Low Tier: Read-only navigation, element inspection, scrolling
    return RISK_LEVELS.LOW;
  }

  /**
   * Checks if an action is permitted and whether user confirmation is required.
   */
  evaluateAction(action, target, value, currentUrl) {
    // 1. Domain whitelist check
    if (!this._isDomainAllowed(currentUrl)) {
      return {
        permitted: false,
        requiresConfirmation: true,
        riskLevel: RISK_LEVELS.HIGH,
        reason: `Domain ${currentUrl} is not permitted by active profile policy.`
      };
    }

    // 2. Risk classification
    const riskLevel = this.classifyRisk(action, target, value);

    // 3. Confirmation requirements
    const requiresConfirmation =
      riskLevel === RISK_LEVELS.CRITICAL ||
      (riskLevel === RISK_LEVELS.HIGH && this.requireConfirmationForHighRisk);

    return {
      permitted: true,
      requiresConfirmation,
      riskLevel,
      reason: requiresConfirmation ? `Action classified as ${riskLevel} requires operator approval.` : 'Action permitted by policy.'
    };
  }

  _isDomainAllowed(url) {
    if (!url || this.allowedDomains.includes('*')) return true;
    try {
      const parsed = new URL(url);
      return this.allowedDomains.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
    } catch {
      return false;
    }
  }
}
