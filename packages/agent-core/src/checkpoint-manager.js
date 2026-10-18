/**
 * Checkpoint Manager and Deterministic Replay Engine for Agent Trajectories.
 */

export class CheckpointManager {
  constructor(initialState = {}) {
    this.taskId = initialState.taskId || 'task-' + Date.now();
    this.goal = initialState.goal || '';
    this.checkpoints = [];
  }

  saveCheckpoint(stepData) {
    const checkpoint = {
      index: this.checkpoints.length + 1,
      timestamp: new Date().toISOString(),
      action: stepData.action,
      target: stepData.target,
      value: stepData.value || null,
      observationSummary: stepData.observationSummary || '',
      verifierPassed: Boolean(stepData.verifierPassed),
      riskLevel: stepData.riskLevel || 'low'
    };

    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  getCheckpoints() {
    return [...this.checkpoints];
  }

  getLatestCheckpoint() {
    return this.checkpoints[this.checkpoints.length - 1] || null;
  }

  exportTrace() {
    return JSON.stringify({
      taskId: this.taskId,
      goal: this.goal,
      totalSteps: this.checkpoints.length,
      checkpoints: this.checkpoints
    }, null, 2);
  }

  static fromTrace(jsonString) {
    const data = JSON.parse(jsonString);
    const manager = new CheckpointManager({ taskId: data.taskId, goal: data.goal });
    manager.checkpoints = data.checkpoints || [];
    return manager;
  }

  /**
   * Deterministically replays a sequence of checkpoints using an execution driver.
   */
  async replay(executorFn) {
    const replayLog = [];

    for (const cp of this.checkpoints) {
      const stepStartTime = performance.now();
      const executionResult = await executorFn({
        action: cp.action,
        target: cp.target,
        value: cp.value
      });

      replayLog.push({
        stepIndex: cp.index,
        action: cp.action,
        matchedOriginal: executionResult.success,
        durationMs: Math.round(performance.now() - stepStartTime)
      });

      if (!executionResult.success) {
        return {
          success: false,
          failedStep: cp.index,
          replayLog
        };
      }
    }

    return {
      success: true,
      totalReplayed: this.checkpoints.length,
      replayLog
    };
  }
}
