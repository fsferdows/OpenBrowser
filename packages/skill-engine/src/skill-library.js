import { validateSkill, ValidationError } from '@agentic-browser/shared';
import { SkillMigrator } from './skill-migrator.js';

export class SkillLibrary {
  constructor() {
    this.skills = new Map();
  }

  registerSkill(skill) {
    const canonicalSkill = SkillMigrator.migrate(skill);
    validateSkill(canonicalSkill);
    this.skills.set(canonicalSkill.id, JSON.parse(JSON.stringify(canonicalSkill)));
    return true;
  }

  getSkill(id) {
    const skill = this.skills.get(id);
    return skill ? JSON.parse(JSON.stringify(skill)) : null;
  }

  getAllSkills() {
    return Array.from(this.skills.values()).map(s => JSON.parse(JSON.stringify(s)));
  }

  /**
   * Matches user prompt and domain to existing registered skill.
   */
  matchSkill(goal, domain = null) {
    const goalLower = goal.toLowerCase();
    let bestMatch = null;
    let highestScore = 0;

    for (const skill of this.skills.values()) {
      if (domain && skill.domains_allowed && skill.domains_allowed.length > 0) {
        const domainAllowed = skill.domains_allowed.some(d => domain.includes(d) || d.includes(domain));
        if (!domainAllowed) continue;
      }

      for (const trigger of skill.triggers) {
        const triggerLower = trigger.toLowerCase();
        if (goalLower.includes(triggerLower) || triggerLower.includes(goalLower)) {
          const score = triggerLower.length;
          if (score > highestScore) {
            highestScore = score;
            bestMatch = skill;
          }
        }
      }
    }

    return bestMatch ? JSON.parse(JSON.stringify(bestMatch)) : null;
  }

  /**
   * Increments patch version of a skill and logs the change.
   */
  upgradeSkill(skillId, stepIndex, newTarget, changeNote) {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill ${skillId} not found in library`);

    // Bump semver patch (e.g. 1.0.0 -> 1.0.1)
    const semverParts = skill.version.split('.');
    semverParts[2] = String(Number(semverParts[2] || 0) + 1);
    const newVersion = semverParts.join('.');

    skill.version = newVersion;
    if (skill.steps[stepIndex]) {
      skill.steps[stepIndex].target = { ...skill.steps[stepIndex].target, ...newTarget };
    }

    skill.changelog.push({
      version: newVersion,
      date: new Date().toISOString().split('T')[0],
      notes: changeNote || `Self-repair updated selector on step ${stepIndex + 1}`
    });

    this.registerSkill(skill);
    return skill;
  }
}
