/**
 * Autonomous Self-Repair Subsystem for broken skill selectors.
 */
export class SelfRepairEngine {
  constructor(skillLibrary) {
    this.skillLibrary = skillLibrary;
  }

  /**
   * Attempts to repair a broken skill step when an element selector fails.
   */
  async repairStep(skill, stepIndex, a11yTree, currentDomQuery) {
    const brokenStep = skill.steps[stepIndex];
    if (!brokenStep) return { repaired: false, reason: 'Step index out of range' };

    const originalTarget = brokenStep.target;

    // Strategy 1: Match by Accessibility Role and Accessible Name in the current AX Tree
    if (a11yTree && originalTarget.name) {
      const candidate = a11yTree.findByRoleAndName(originalTarget.role || '*', originalTarget.name);
      if (candidate) {
        const repairedTarget = {
          role: candidate.role,
          name: candidate.name,
          selector: `[role="${candidate.role}"][name="${candidate.name}"]`
        };

        // Upgrade and persist repaired skill as a new version
        const updatedSkill = this.skillLibrary.upgradeSkill(
          skill.id,
          stepIndex,
          repairedTarget,
          `Self-repair resolved broken target "${originalTarget.selector || originalTarget.name}" to accessibility node "${candidate.name}"`
        );

        return {
          repaired: true,
          strategy: 'accessibility_tree_match',
          repairedTarget,
          newVersion: updatedSkill.version,
          updatedSkill
        };
      }
    }

    return { repaired: false, reason: 'No semantic candidate found in accessibility tree' };
  }
}
