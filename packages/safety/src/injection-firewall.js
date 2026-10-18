import { randomBytes } from 'node:crypto';

const INJECTION_PATTERNS = [
  /(?:ignore|disregard)\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions|prompts|safety|boundaries|rules)/i,
  /system\s+override/i,
  /you\s+are\s+now\s+(?:in\s+)?developer\s+mode/i,
  /\bDAN\b/i,
  /reveal\s+(?:your\s+)?system\s+prompt/i,
  /exfiltrate|send\s+(?:credentials|passwords|vault)\s+to/i,
  /!\[.*?\]\s*\(\s*https?:\/\/[^\s)]+\?[^)]*?(?:token|secret|password|key)=/i
];

export class PromptInjectionFirewall {
  constructor() {
    this.currentCanary = null;
  }

  generateCanary() {
    this.currentCanary = 'CANARY_' + randomBytes(8).toString('hex');
    return this.currentCanary;
  }

  /**
   * Sanitizes untrusted web page content, neutralizing injection attempts and escaping delimiters.
   */
  sanitizeWebData(rawText) {
    if (typeof rawText !== 'string') return '';

    let sanitized = rawText;

    // 1. Delimiter escape: Escape attempts to close untrusted data blocks
    sanitized = sanitized.replace(/<\/?(?:untrusted_page_data|system|instruction|model_output)[^>]*>/gi, '[ESCAPED_TAG]');

    // 2. Neutralize known malicious instruction strings
    for (const pattern of INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => `[UNTRUSTED_CONTENT_FILTERED: "${match.slice(0, 15)}..."]`);
    }

    return sanitized;
  }

  /**
   * Packages page observation safely inside isolated delimiters with a canary token.
   */
  wrapObservation(observationSummary) {
    const canary = this.generateCanary();
    const cleanContent = this.sanitizeWebData(observationSummary);

    return {
      canary,
      wrappedPrompt: `<untrusted_page_data canary="${canary}">\n${cleanContent}\n</untrusted_page_data>`
    };
  }

  /**
   * Verifies that model output did not parrot or leak the internal canary token.
   */
  verifyOutputIntegrity(modelOutputText) {
    if (!this.currentCanary) return { clean: true };
    if (typeof modelOutputText !== 'string') return { clean: true };

    if (modelOutputText.includes(this.currentCanary)) {
      return {
        clean: false,
        reason: 'Canary token leakage detected: Model output was compromised by untrusted web content.'
      };
    }

    return { clean: true };
  }
}
