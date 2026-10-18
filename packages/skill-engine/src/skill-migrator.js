/**
 * SkillMigrator handles backwards-compatibility migrations across skill schema versions.
 */
export class SkillMigrator {
  /**
   * Migrates legacy skill formats (< 1.0.0) to canonical 1.0.0 specification.
   */
  static migrate(legacySkill) {
    if (!legacySkill || typeof legacySkill !== 'object') {
      return legacySkill;
    }

    const migrated = JSON.parse(JSON.stringify(legacySkill));
    const currentSchema = migrated.schema_version || '0.9.0';

    if (currentSchema === '1.0.0') {
      return migrated;
    }

    // Migration rule 1: Default missing top-level canonical fields
    migrated.schema_version = '1.0.0';
    migrated.parameters = migrated.parameters || {};
    migrated.triggers = migrated.triggers || [];
    migrated.domains_allowed = migrated.domains_allowed || [];
    migrated.risk_level = migrated.risk_level || 'low';
    migrated.requires_confirmation = migrated.requires_confirmation ?? (migrated.risk_level === 'high' || migrated.risk_level === 'critical');
    migrated.tests = migrated.tests || [];
    migrated.success_metrics = migrated.success_metrics || { verified: true };
    migrated.provenance = migrated.provenance || 'legacy_import';
    migrated.signature = migrated.signature || 'legacy_signature_placeholder';

    // Migration rule 2: Changelog tracking
    migrated.changelog = Array.isArray(migrated.changelog) ? migrated.changelog : [];
    migrated.changelog.push({
      version: migrated.version || '1.0.0',
      date: new Date().toISOString().split('T')[0],
      notes: `Automated schema migration from ${currentSchema} to 1.0.0`
    });

    // Migration rule 3: Normalize step definitions
    if (Array.isArray(migrated.steps)) {
      migrated.steps = migrated.steps.map((step, idx) => {
        if (!step || typeof step !== 'object') return step;
        return {
          id: step.id || `step-${idx + 1}`,
          action: step.action || 'click',
          target: step.target || { selector: 'body' },
          value: step.value ?? null,
          expect: step.expect || {},
          on_fail: step.on_fail || 'retry'
        };
      });
    }

    return migrated;
  }
}
