import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GatewayClient, GatewayError } from '../src/index.js';
import { ACTIONS, RISK_LEVELS } from '@agentic-browser/shared';

describe('Model Gateway Client & Failover Tests', () => {
  const validStepPayload = {
    thought: 'The username textbox is visible and focused.',
    action: ACTIONS.FILL,
    target: { role: 'textbox', name: 'Username', selector: '#user' },
    value: 'alice',
    expected_outcome: 'Username field filled with alice',
    risk_level: RISK_LEVELS.LOW
  };

  test('executes successful structured step via primary provider', async () => {
    const mockFetch = async (url, opts) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(validStepPayload)
              }
            }
          ]
        })
      };
    };

    const client = new GatewayClient({ fetchFn: mockFetch });
    const response = await client.requestStep([{ role: 'user', content: 'Type username' }]);

    assert.ok(response);
    assert.equal(response.providerId, 'omniroute-primary');
    assert.equal(response.result.action, ACTIONS.FILL);
    assert.equal(response.result.value, 'alice');
  });

  test('triggers automatic failover when primary provider returns HTTP 500', async () => {
    let callCount = 0;
    const mockFetch = async (url, opts) => {
      callCount++;
      if (url.includes('8080')) {
        // omniroute-primary fails with 500
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal Server Error' })
        };
      }
      // freellmapi-fallback succeeds
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validStepPayload) } }]
        })
      };
    };

    const client = new GatewayClient({ fetchFn: mockFetch });
    const response = await client.requestStep([{ role: 'user', content: 'Type username' }]);

    assert.equal(callCount, 2);
    assert.equal(response.providerId, 'freellmapi-fallback');
    assert.equal(response.result.action, ACTIONS.FILL);
  });

  test('rejects schema-invalid model output and fails over', async () => {
    let callCount = 0;
    const mockFetch = async (url, opts) => {
      callCount++;
      if (callCount === 1) {
        // Returns schema-invalid response (missing action and target)
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ thought: 'Missing action' }) } }]
          })
        };
      }
      // Second provider returns valid schema
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validStepPayload) } }]
        })
      };
    };

    const client = new GatewayClient({ fetchFn: mockFetch });
    const response = await client.requestStep([{ role: 'user', content: 'Type username' }]);

    assert.equal(callCount, 2);
    assert.equal(response.providerId, 'freellmapi-fallback');
    assert.equal(response.result.action, ACTIONS.FILL);
  });

  test('throws GatewayError when all providers fail', async () => {
    const mockFetch = async () => {
      return {
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service Unavailable' })
      };
    };

    const client = new GatewayClient({ fetchFn: mockFetch });
    await assert.rejects(
      async () => client.requestStep([{ role: 'user', content: 'Test' }]),
      GatewayError
    );
  });
});
