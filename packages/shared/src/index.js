import skillSchema from './schemas/skill.schema.json' with { type: 'json' };
import gatewaySchema from './schemas/gateway.schema.json' with { type: 'json' };
import { i18n, I18nManager } from './i18n/index.js';

export { skillSchema, gatewaySchema, i18n, I18nManager };

export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export const ACTIONS = {
  NAVIGATE: 'navigate',
  CLICK: 'click',
  FILL: 'fill',
  SELECT: 'select',
  PRESS_KEY: 'press_key',
  SCROLL: 'scroll',
  EXTRACT: 'extract',
  WAIT: 'wait',
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
  FINISH: 'finish',
  FAIL: 'fail'
};

export class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Validates that an object satisfies required fields and types according to the skill specification.
 */
export function validateSkill(skill) {
  if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
    throw new ValidationError('Skill must be a non-null object.');
  }

  const required = [
    'id', 'name', 'description', 'version', 'schema_version',
    'parameters', 'triggers', 'domains_allowed', 'steps',
    'risk_level', 'requires_confirmation', 'tests', 'success_metrics',
    'provenance', 'signature', 'changelog'
  ];

  const missing = required.filter(field => !Object.prototype.hasOwnProperty.call(skill, field));
  if (missing.length > 0) {
    throw new ValidationError(`Skill is missing required fields: ${missing.join(', ')}`, missing);
  }

  if (typeof skill.id !== 'string' || !/^[a-z0-9-]+$/.test(skill.id)) {
    throw new ValidationError(`Invalid skill ID format: ${skill.id}. Must be lowercase alphanumeric with hyphens.`);
  }

  if (typeof skill.version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(skill.version)) {
    throw new ValidationError(`Invalid semver version: ${skill.version}`);
  }

  if (!Array.isArray(skill.steps) || skill.steps.length === 0) {
    throw new ValidationError('Skill must define at least one step in steps array.');
  }

  for (let i = 0; i < skill.steps.length; i++) {
    const step = skill.steps[i];
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      throw new ValidationError(`Step at index ${i} must be a valid non-null object.`);
    }
    if (!step.id || !step.action || !step.target || !step.expect || !step.on_fail) {
      throw new ValidationError(`Step at index ${i} is missing required fields (id, action, target, expect, on_fail).`);
    }
  }

  return true;
}

/**
 * Validates model gateway structured step response.
 */
export function validateGatewayResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new ValidationError('Gateway response must be a non-null object.');
  }

  const required = ['thought', 'action', 'target', 'expected_outcome', 'risk_level'];
  const missing = required.filter(field => !Object.prototype.hasOwnProperty.call(response, field));
  if (missing.length > 0) {
    throw new ValidationError(`Gateway response missing required fields: ${missing.join(', ')}`, missing);
  }

  if (!Object.values(ACTIONS).includes(response.action)) {
    throw new ValidationError(`Invalid action in gateway response: ${response.action}`);
  }

  if (!Object.values(RISK_LEVELS).includes(response.risk_level)) {
    throw new ValidationError(`Invalid risk_level in gateway response: ${response.risk_level}`);
  }

  return true;
}

