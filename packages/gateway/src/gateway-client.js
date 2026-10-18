import { validateGatewayResponse, ValidationError } from '@agentic-browser/shared';

export class GatewayError extends Error {
  constructor(message, provider = 'unknown', cause = null) {
    super(message);
    this.name = 'GatewayError';
    this.provider = provider;
    this.cause = cause;
  }
}

/**
 * Robust Model Gateway Client with automatic multi-provider failover,
 * timeout circuit breaking, and strict output schema validation.
 */
export class GatewayClient {
  constructor(options = {}) {
    this.providers = options.providers || [
      { id: 'omniroute-primary', baseUrl: 'http://127.0.0.1:8080/v1', model: 'claude-3-5-sonnet' },
      { id: 'freellmapi-fallback', baseUrl: 'http://127.0.0.1:8081/v1', model: 'gemini-1.5-flash' },
      { id: 'local-ollama', baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2' }
    ];
    this.timeoutMs = options.timeoutMs || 10000;
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.activeProviderIndex = 0;
    this.providerFailureCounts = new Map();
    this.metricsHistory = [];
  }

  getCurrentProvider() {
    return this.providers[this.activeProviderIndex];
  }

  _recordFailure(providerId) {
    const current = this.providerFailureCounts.get(providerId) || 0;
    this.providerFailureCounts.set(providerId, current + 1);
  }

  _advanceProvider() {
    this.activeProviderIndex = (this.activeProviderIndex + 1) % this.providers.length;
    return this.getCurrentProvider();
  }

  /**
   * Dispatches a structured inference prompt to the active provider with automatic failover.
   */
  async requestStep(messages, options = {}) {
    let lastError = null;
    const initialIndex = this.activeProviderIndex;

    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      const provider = this.getCurrentProvider();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);

      try {
        const startTime = performance.now();
        const payload = {
          model: options.model || provider.model,
          messages,
          temperature: 0.1,
          response_format: { type: 'json_object' }
        };

        const response = await this.fetchFn(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timer);

        if (!response.ok) {
          throw new GatewayError(`HTTP error ${response.status} from provider ${provider.id}`, provider.id);
        }

        const data = await response.json();
        const contentStr = data.choices?.[0]?.message?.content;
        if (!contentStr) {
          throw new GatewayError(`Empty response content from provider ${provider.id}`, provider.id);
        }

        const parsedContent = typeof contentStr === 'string' ? JSON.parse(contentStr) : contentStr;

        // Strict schema validation of the model's action plan
        validateGatewayResponse(parsedContent);

        const latencyMs = Math.round(performance.now() - startTime);
        const promptTokens = data.usage?.prompt_tokens || Math.max(1, Math.round(JSON.stringify(messages).length / 4));
        const completionTokens = data.usage?.completion_tokens || Math.max(1, Math.round(contentStr.length / 4));
        const totalTokens = promptTokens + completionTokens;

        // Estimated cost based on model rate tier (Free providers are $0)
        const isFree = provider.id.includes('free') || provider.id.includes('local');
        const estimatedCostUsd = isFree ? 0 : Number(((promptTokens * 0.000003) + (completionTokens * 0.000015)).toFixed(6));

        const metrics = {
          latencyMs,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd
        };

        this.metricsHistory.push({
          timestamp: new Date().toISOString(),
          providerId: provider.id,
          model: provider.model,
          ...metrics
        });

        return {
          providerId: provider.id,
          model: provider.model,
          result: parsedContent,
          metrics
        };
      } catch (err) {
        clearTimeout(timer);
        this._recordFailure(provider.id);
        lastError = err;

        // Advance to next provider in failover ring
        this._advanceProvider();
      }
    }

    throw new GatewayError(`All ${this.providers.length} gateway providers failed. Last error: ${lastError?.message}`, 'all', lastError);
  }
}
