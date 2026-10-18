/**
 * Demonstration Recorder with Automated Secret and Password Masking.
 */
export class SkillRecorder {
  constructor(metadata = {}) {
    this.id = metadata.id || 'recorded-task-' + Date.now();
    this.name = metadata.name || 'Recorded Task Workflow';
    this.description = metadata.description || 'Workflow recorded from human user demonstration.';
    this.domainsAllowed = metadata.domainsAllowed || [];
    this.triggers = metadata.triggers || ['perform recorded task'];
    this.recordedActions = [];
    this.detectedParameters = {};
  }

  /**
   * Records a user action event with automated secret masking.
   */
  recordAction(rawEvent) {
    const isPasswordField = rawEvent.isPassword ||
      rawEvent.target?.type === 'password' ||
      /password|secret|token/i.test(rawEvent.target?.name || '');

    let value = rawEvent.value;

    // Secret masking: convert sensitive values to vault variables
    if (isPasswordField && value) {
      const paramName = 'password';
      this.detectedParameters[paramName] = {
        type: 'string',
        description: 'Masked credential from vault',
        required: true
      };
      value = `{{VAULT:${paramName}}}`;
    }

    const step = {
      id: `step-${this.recordedActions.length + 1}`,
      action: rawEvent.action,
      target: {
        role: rawEvent.target?.role || 'generic',
        name: rawEvent.target?.name || 'Interactive Element',
        selector: rawEvent.target?.selector
      },
      value: value || undefined,
      expect: {
        condition: rawEvent.expectCondition || 'element_visible:true',
        timeout_ms: 5000
      },
      on_fail: {
        strategy: 'repair'
      }
    };

    this.recordedActions.push(step);
    return step;
  }

  /**
   * Generates a canonical, schema-valid skill object.
   */
  generateSkillManifest() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version: '1.0.0',
      schema_version: '1.0.0',
      parameters: this.detectedParameters,
      triggers: this.triggers,
      domains_allowed: this.domainsAllowed.length > 0 ? this.domainsAllowed : ['*'],
      steps: this.recordedActions,
      risk_level: 'low',
      requires_confirmation: false,
      tests: [],
      success_metrics: {
        max_duration_ms: 30000,
        max_steps: this.recordedActions.length + 2
      },
      provenance: {
        author: 'demonstration_recorder',
        created_at: new Date().toISOString(),
        source_type: 'recorded_demonstration'
      },
      signature: 'ed25519:unsigned_local_recording',
      changelog: [
        {
          version: '1.0.0',
          date: new Date().toISOString().split('T')[0],
          notes: 'Generated from user demonstration with secrets masked.'
        }
      ]
    };
  }
}
