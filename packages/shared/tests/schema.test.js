import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateSkill, validateGatewayResponse, ValidationError, RISK_LEVELS, ACTIONS } from '../src/index.js';

describe('Skill Schema and Specification Tests', () => {
  const validCanonicalSkill = {
    id: 'search-and-extract-prices',
    name: 'Search and Extract Product Prices',
    description: 'Searches an e-commerce catalog for a query keyword and extracts product names and prices.',
    version: '1.0.0',
    schema_version: '1.0.0',
    parameters: {
      query: {
        type: 'string',
        description: 'Search keyword',
        required: true,
        default: 'laptop'
      }
    },
    triggers: ['search product prices', 'find price for item'],
    domains_allowed: ['example.com', 'shop.example.com'],
    steps: [
      {
        id: 'step-1',
        action: 'navigate',
        target: { role: 'page', name: 'Home' },
        value: 'https://shop.example.com',
        expect: { condition: 'url_contains:shop.example.com', timeout_ms: 5000 },
        on_fail: { strategy: 'retry' }
      },
      {
        id: 'step-2',
        action: 'fill',
        target: { role: 'searchbox', name: 'Search Catalog', selector: 'input[name="q"]' },
        value: '{{query}}',
        expect: { condition: 'value_equals:{{query}}', timeout_ms: 2000 },
        on_fail: { strategy: 'repair' }
      }
    ],
    risk_level: RISK_LEVELS.LOW,
    requires_confirmation: false,
    tests: [
      {
        test_id: 't-001',
        input_params: { query: 'headphones' },
        expected_terminal_state: 'products_listed'
      }
    ],
    success_metrics: {
      max_duration_ms: 15000,
      max_steps: 10,
      expected_items_count: 5
    },
    provenance: {
      author: 'engineering-team',
      created_at: '2026-10-18T20:00:00Z',
      source_type: 'human_authored'
    },
    signature: 'ed25519:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    changelog: [
      {
        version: '1.0.0',
        date: '2026-10-18',
        notes: 'Initial release'
      }
    ]
  };

  test('accepts valid canonical skill conforming to all 16 schema fields', () => {
    assert.doesNotThrow(() => validateSkill(validCanonicalSkill));
  });

  test('rejects skill missing required fields', () => {
    const invalid = { ...validCanonicalSkill };
    delete invalid.signature;
    assert.throws(() => validateSkill(invalid), ValidationError);
  });

  test('rejects skill with invalid semver version string', () => {
    const invalid = { ...validCanonicalSkill, version: 'v1-invalid' };
    assert.throws(() => validateSkill(invalid), ValidationError);
  });

  test('rejects skill with empty steps array', () => {
    const invalid = { ...validCanonicalSkill, steps: [] };
    assert.throws(() => validateSkill(invalid), ValidationError);
  });

  test('rejects step missing required properties', () => {
    const invalid = {
      ...validCanonicalSkill,
      steps: [{ id: 'step-1', action: 'click' }]
    };
    assert.throws(() => validateSkill(invalid), ValidationError);
  });
});

describe('Gateway Structured Output Schema Tests', () => {
  const validGatewayResponse = {
    thought: 'The search input field is visible on the page. We will type the query.',
    action: ACTIONS.FILL,
    target: { role: 'searchbox', name: 'Search', selector: '#search-box' },
    value: 'macbook pro',
    expected_outcome: 'Query entered into searchbox',
    risk_level: RISK_LEVELS.LOW
  };

  test('validates correct structured gateway model output', () => {
    assert.doesNotThrow(() => validateGatewayResponse(validGatewayResponse));
  });

  test('rejects gateway response missing thought or action', () => {
    const invalid = { ...validGatewayResponse };
    delete invalid.thought;
    assert.throws(() => validateGatewayResponse(invalid), ValidationError);
  });

  test('rejects gateway response with invalid action type', () => {
    const invalid = { ...validGatewayResponse, action: 'invented_action_not_in_enum' };
    assert.throws(() => validateGatewayResponse(invalid), ValidationError);
  });

  test('rejects gateway response with invalid risk level', () => {
    const invalid = { ...validGatewayResponse, risk_level: 'extreme_danger' };
    assert.throws(() => validateGatewayResponse(invalid), ValidationError);
  });
});
