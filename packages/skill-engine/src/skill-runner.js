import { SelfRepairEngine } from './self-repair.js';

export class SkillRunner {
  constructor(options = {}) {
    this.skillLibrary = options.skillLibrary;
    this.controlDriver = options.controlDriver;
    this.selfRepairEngine = new SelfRepairEngine(this.skillLibrary);
  }

  _interpolate(template, params = {}) {
    if (typeof template !== 'string') return template;
    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
      return params[key] !== undefined ? params[key] : `{{${key}}}`;
    });
  }

  /**
   * Executes a registered skill with parameter substitution and self-repair on failure.
   */
  async executeSkill(skill, params = {}) {
    const executedSteps = [];
    let repairedStepsCount = 0;
    let replannedStepsCount = 0; // Stable steps have 0 replanning

    for (let i = 0; i < skill.steps.length; i++) {
      let step = skill.steps[i];
      const interpolatedValue = this._interpolate(step.value, params);

      // Attempt execution
      let execResult = await this.controlDriver.executeAction({
        action: step.action,
        target: step.target,
        value: interpolatedValue
      });

      // Handle selector break via Self-Repair
      if (!execResult.success && step.on_fail?.strategy === 'repair') {
        const observation = await this.controlDriver.getObservation();
        const repairResult = await this.selfRepairEngine.repairStep(
          skill,
          i,
          observation.a11yTree,
          this.controlDriver.domQuery
        );

        if (repairResult.repaired) {
          repairedStepsCount++;
          step = repairResult.updatedSkill.steps[i];

          // Retry with repaired target
          execResult = await this.controlDriver.executeAction({
            action: step.action,
            target: step.target,
            value: interpolatedValue
          });
        }
      }

      executedSteps.push({
        stepIndex: i + 1,
        action: step.action,
        success: execResult.success
      });

      if (!execResult.success) {
        return {
          success: false,
          failedStep: i + 1,
          executedSteps,
          replannedStepsCount,
          repairedStepsCount
        };
      }
    }

    return {
      success: true,
      totalSteps: skill.steps.length,
      executedSteps,
      replannedStepsCount, // 0 for learned skills without replanning!
      repairedStepsCount,
      skillVersion: skill.version
    };
  }
}
