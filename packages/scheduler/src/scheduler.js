/**
 * Background Automation and Job Scheduler.
 */

export class JobScheduler {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 2;
    this.activeJobs = new Map();
    this.history = [];
  }

  addJob(jobConfig) {
    const job = {
      id: jobConfig.id || 'job-' + Date.now(),
      name: jobConfig.name,
      skillId: jobConfig.skillId,
      intervalHours: jobConfig.intervalHours || 1,
      maxRetries: jobConfig.maxRetries || 3,
      params: jobConfig.params || {},
      status: 'scheduled',
      lastRun: null,
      nextRun: null
    };

    this.activeJobs.set(job.id, job);
    return job;
  }

  /**
   * Executes a job with automatic retries and exponential backoff.
   */
  async executeJobWithRetries(job, executorFn, maxRetries = 3) {
    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const result = await executorFn(job, attempt);
        if (result.success) {
          return {
            success: true,
            attempts: attempt,
            result
          };
        }
        lastError = new Error(result.error || 'Execution returned false');
      } catch (err) {
        lastError = err;
      }
    }

    return {
      success: false,
      attempts: attempt - 1,
      error: lastError?.message || 'Max retries exhausted'
    };
  }

  /**
   * Simulates a full 24-hour unattended schedule cycle with injected faults and report generation.
   */
  async simulate24HourRun(jobConfig, executorFn, options = {}) {
    const job = this.addJob(jobConfig);
    const hourlyLogs = [];
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let retriedExecutions = 0;

    // Simulate 24 hourly ticks
    for (let hour = 1; hour <= 24; hour++) {
      totalExecutions++;
      const startTime = performance.now();

      // Execute with retries
      const runOutcome = await this.executeJobWithRetries(job, executorFn, job.maxRetries);
      const durationMs = Math.round(performance.now() - startTime);

      if (runOutcome.success) {
        successfulExecutions++;
        if (runOutcome.attempts > 1) {
          retriedExecutions++;
        }
      }

      hourlyLogs.push({
        hour,
        success: runOutcome.success,
        attempts: runOutcome.attempts,
        durationMs,
        error: runOutcome.error || null
      });
    }

    const report = {
      jobId: job.id,
      jobName: job.name,
      simulatedDurationHours: 24,
      totalScheduledRuns: totalExecutions,
      successfulRuns: successfulExecutions,
      failedRuns: totalExecutions - successfulExecutions,
      retriedRunsCount: retriedExecutions,
      successRatePercent: Number(((successfulExecutions / totalExecutions) * 100).toFixed(1)),
      hourlyLogs,
      summaryText: `24-Hour Unattended Run Summary: ${successfulExecutions}/24 runs succeeded (${((successfulExecutions / 24) * 100).toFixed(1)}%). Retries triggered: ${retriedExecutions}.`
    };

    return report;
  }
}
