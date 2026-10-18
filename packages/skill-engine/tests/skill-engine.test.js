import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SkillLibrary, SkillRunner, SkillRecorder } from '../src/index.js';
import { AccessibilityTree } from '@agentic-browser/control';
import { validateSkill } from '@agentic-browser/shared';

describe('Skill Engine and Learning Tests', () => {
  const sampleSkill = {
    id: 'search-catalog-items',
    name: 'Search Catalog Items',
    description: 'Searches the catalog for products and extracts matching rows.',
    version: '1.0.0',
    schema_version: '1.0.0',
    parameters: {
      query: { type: 'string', description: 'Product keyword', required: true }
    },
    triggers: ['search products', 'find catalog item'],
    domains_allowed: ['shop.example.com'],
    steps: [
      {
        id: 's1',
        action: 'fill',
        target: { role: 'searchbox', name: 'Search Products', selector: '#search-input' },
        value: '{{query}}',
        expect: { condition: 'value_equals:{{query}}' },
        on_fail: { strategy: 'repair' }
      },
      {
        id: 's2',
        action: 'click',
        target: { role: 'button', name: 'Search', selector: '#search-btn' },
        expect: { condition: 'element_visible:true' },
        on_fail: { strategy: 'retry' }
      }
    ],
    risk_level: 'low',
    requires_confirmation: false,
    tests: [],
    success_metrics: { max_duration_ms: 5000, max_steps: 3 },
    provenance: {
      author: 'user',
      created_at: '2026-10-18T20:00:00Z',
      source_type: 'recorded_demonstration'
    },
    signature: 'ed25519:test_sig',
    changelog: [{ version: '1.0.0', date: '2026-10-18', notes: 'Initial' }]
  };

  test('SkillLibrary registers, validates, and matches skills by trigger', () => {
    const library = new SkillLibrary();
    library.registerSkill(sampleSkill);

    const match = library.matchSkill('I want to search products on shop', 'shop.example.com');
    assert.ok(match);
    assert.equal(match.id, 'search-catalog-items');
  });

  test('Gate Test 1: Second run of learned task uses skill with zero replanning of stable steps', async () => {
    const library = new SkillLibrary();
    library.registerSkill(sampleSkill);

    const driverExecutionLog = [];
    const mockDriver = {
      executeAction: async (actionStep) => {
        driverExecutionLog.push(actionStep);
        return { success: true };
      }
    };

    const runner = new SkillRunner({
      skillLibrary: library,
      controlDriver: mockDriver
    });

    const matchedSkill = library.matchSkill('search products for laptop', 'shop.example.com');
    assert.ok(matchedSkill);

    const result = await runner.executeSkill(matchedSkill, { query: 'laptop' });

    assert.equal(result.success, true);
    assert.equal(result.totalSteps, 2);
    // Gate requirement: Zero replanning consumed for learned tasks on stable steps!
    assert.equal(result.replannedStepsCount, 0);
    assert.equal(driverExecutionLog[0].value, 'laptop');
    assert.equal(driverExecutionLog[1].action, 'click');
  });

  test('Gate Test 2: Injected selector break is repaired, tested, and saved as a new version', async () => {
    const library = new SkillLibrary();
    library.registerSkill(sampleSkill);

    // Mock website altering DOM: #search-input no longer exists, but accessibility tree has the node
    let actionAttempts = 0;
    const currentA11yTree = new AccessibilityTree([
      {
        nodeId: 'node-search-v2',
        role: { value: 'searchbox' },
        name: { value: 'Search Products' }
      },
      {
        nodeId: 'node-btn-v2',
        role: { value: 'button' },
        name: { value: 'Search' }
      }
    ]);

    const mockDriver = {
      executeAction: async (actionStep) => {
        actionAttempts++;
        // If targeting the broken old selector '#search-input', fail!
        if (actionStep.target.selector === '#search-input') {
          return { success: false, error: 'Element not found with selector #search-input' };
        }
        // If targeting the repaired accessibility target, succeed!
        return { success: true };
      },
      getObservation: async () => ({
        a11yTree: currentA11yTree,
        summary: '[searchbox] "Search Products"'
      })
    };

    const runner = new SkillRunner({
      skillLibrary: library,
      controlDriver: mockDriver
    });

    const initialSkill = library.getSkill('search-catalog-items');
    assert.equal(initialSkill.version, '1.0.0');

    // Run skill against broken site
    const result = await runner.executeSkill(initialSkill, { query: 'headphones' });

    // Assert that self-repair succeeded, repaired 1 step, and saved version 1.0.1
    assert.equal(result.success, true);
    assert.equal(result.repairedStepsCount, 1);

    const updatedSkill = library.getSkill('search-catalog-items');
    assert.equal(updatedSkill.version, '1.0.1'); // Upgraded patch version!
    assert.ok(updatedSkill.changelog.length >= 2);
    assert.ok(updatedSkill.changelog[1].notes.includes('Self-repair'));
    assert.doesNotThrow(() => validateSkill(updatedSkill)); // Schema validity preserved!
  });

  test('SkillRecorder masks sensitive password inputs into vault parameters', () => {
    const recorder = new SkillRecorder({
      id: 'login-flow-task',
      name: 'User Login Workflow',
      domainsAllowed: ['example.com']
    });

    recorder.recordAction({
      action: 'fill',
      target: { role: 'textbox', name: 'Username' },
      value: 'alice',
      isPassword: false
    });

    // Record password input
    recorder.recordAction({
      action: 'fill',
      target: { role: 'textbox', name: 'Password', type: 'password' },
      value: 'super_secret_plaintext_password_12345',
      isPassword: true
    });

    const manifest = recorder.generateSkillManifest();

    assert.equal(manifest.steps.length, 2);
    assert.equal(manifest.steps[0].value, 'alice');
    // Verify plaintext password NEVER appears in manifest
    assert.equal(manifest.steps[1].value, '{{VAULT:password}}');
    assert.ok(manifest.parameters.password);
    assert.doesNotThrow(() => validateSkill(manifest));
  });
});
