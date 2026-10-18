import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SkillLibrary, SkillRunner, SkillMigrator } from '../src/index.js';
import { validateSkill } from '@agentic-browser/shared';

describe('Skill Format Backward-Compatibility & Migration Suite', () => {
  const legacyV08Skill = {
    id: 'legacy-form-fill',
    name: 'Legacy Form Submitter',
    description: 'Ancient skill from schema v0.8 without required security fields',
    version: '1.0.0',
    schema_version: '0.8.0',
    parameters: {
      user: { type: 'string' }
    },
    triggers: ['fill legacy form'],
    domains_allowed: ['legacy.example.com'],
    steps: [
      { action: 'fill', target: '#name', value: '{{user}}' }
    ],
    risk_level: 'low'
  };

  const legacyV09Skill = {
    id: 'legacy-nav-extract',
    name: 'Legacy Navigation & Extractor',
    description: 'Skill created under schema v0.9 missing changelog and success_metrics',
    version: '2.1.0',
    schema_version: '0.9.0',
    parameters: {},
    triggers: ['extract legacy data'],
    domains_allowed: ['data.example.com'],
    steps: [
      { id: 'custom-step-1', action: 'navigate', target: 'https://data.example.com' },
      { action: 'extract', target: '.data-row' }
    ],
    risk_level: 'medium',
    requires_confirmation: false
  };

  it('migrates legacy schema v0.8 skill to canonical 1.0.0 specification', () => {
    const migrated = SkillMigrator.migrate(legacyV08Skill);

    assert.strictEqual(migrated.schema_version, '1.0.0');
    assert.strictEqual(migrated.requires_confirmation, false);
    assert.ok(migrated.success_metrics);
    assert.ok(migrated.provenance);
    assert.ok(migrated.signature);
    assert.ok(Array.isArray(migrated.changelog));
    assert.ok(migrated.changelog.some(c => c.notes.includes('0.8.0 to 1.0.0')));

    // Steps normalized
    assert.strictEqual(migrated.steps[0].id, 'step-1');
    assert.strictEqual(migrated.steps[0].on_fail, 'retry');

    // Validates against official schema validator
    assert.doesNotThrow(() => validateSkill(migrated));
  });

  it('migrates legacy schema v0.9 skill and preserves custom step IDs', () => {
    const migrated = SkillMigrator.migrate(legacyV09Skill);

    assert.strictEqual(migrated.schema_version, '1.0.0');
    assert.strictEqual(migrated.steps[0].id, 'custom-step-1');
    assert.strictEqual(migrated.steps[1].id, 'step-2');
    assert.ok(migrated.changelog.some(c => c.notes.includes('0.9.0 to 1.0.0')));

    assert.doesNotThrow(() => validateSkill(migrated));
  });

  it('SkillLibrary transparently migrates and registers legacy skills', () => {
    const library = new SkillLibrary();

    // Registering legacy v0.8 skill without manual migration
    assert.strictEqual(library.registerSkill(legacyV08Skill), true);

    const stored = library.getSkill('legacy-form-fill');
    assert.strictEqual(stored.schema_version, '1.0.0');
    assert.strictEqual(stored.steps[0].id, 'step-1');

    // Matches via trigger
    const matched = library.matchSkill('fill legacy form now', 'legacy.example.com');
    assert.ok(matched);
    assert.strictEqual(matched.id, 'legacy-form-fill');
  });

  it('SkillRunner executes transparently migrated legacy skill', async () => {
    const library = new SkillLibrary();
    library.registerSkill(legacyV08Skill);

    const actionLog = [];
    const mockDriver = {
      async executeAction(step) {
        actionLog.push(step);
        return { success: true };
      }
    };

    const runner = new SkillRunner({
      skillLibrary: library,
      controlDriver: mockDriver
    });

    const skill = library.getSkill('legacy-form-fill');
    const result = await runner.executeSkill(skill, { user: 'Bob' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(actionLog.length, 1);
    assert.strictEqual(actionLog[0].value, 'Bob');
  });
});
