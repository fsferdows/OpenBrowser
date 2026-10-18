export class RollbackMonitor {
  constructor(options = {}) {
    this.maxRegressionThreshold = options.maxRegressionThreshold ?? 0.01; // 1.0% error rate increase
    this.evaluationWindowHours = options.evaluationWindowHours ?? 2.0;
    this.minSampleSize = options.minSampleSize ?? 100;
    this.rollbackTriggered = false;
    this.rollbackReason = null;
    this.history = [];
  }

  /**
   * Evaluates telemetry from a staged release rollout.
   * If error rate exceeds baseline by > 1.0% within the evaluation window, flags immediate rollback.
   */
  evaluate({ releaseVersion, totalSessions, failedSessions, elapsedHours, baselineErrorRate = 0.005 }) {
    if (totalSessions < this.minSampleSize) {
      return {
        action: 'MONITORING',
        reason: `Sample size (${totalSessions}) below minimum required (${this.minSampleSize}).`,
        currentErrorRate: totalSessions > 0 ? failedSessions / totalSessions : 0,
        baselineErrorRate,
        regression: 0
      };
    }

    const currentErrorRate = failedSessions / totalSessions;
    const regression = currentErrorRate - baselineErrorRate;

    const evaluation = {
      timestamp: new Date().toISOString(),
      releaseVersion,
      totalSessions,
      failedSessions,
      elapsedHours,
      currentErrorRate,
      baselineErrorRate,
      regression
    };
    this.history.push(evaluation);

    // Check rollback condition: within evaluation window and error rate regression > threshold
    if (elapsedHours <= this.evaluationWindowHours && regression > this.maxRegressionThreshold) {
      this.rollbackTriggered = true;
      this.rollbackReason = `Error rate regression ${(regression * 100).toFixed(2)}% exceeds max threshold ${(this.maxRegressionThreshold * 100).toFixed(2)}% during first ${elapsedHours}h of rollout.`;

      return {
        action: 'ROLLBACK',
        releaseVersion,
        reason: this.rollbackReason,
        currentErrorRate,
        baselineErrorRate,
        regression
      };
    }

    return {
      action: 'PROCEED',
      releaseVersion,
      currentErrorRate,
      baselineErrorRate,
      regression
    };
  }

  isRollbackTriggered() {
    return this.rollbackTriggered;
  }

  getRollbackReason() {
    return this.rollbackReason;
  }
}
