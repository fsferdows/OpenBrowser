import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JobScheduler } from '../src/scheduler.js';

describe('JobScheduler and Unattended Execution Tests', () => {
  test('adds and tracks scheduled jobs', () => {
    const scheduler = new JobScheduler({ maxConcurrency: 2 });
    const job = scheduler.addJob({
      id: 'price-alert-1',
      name: 'Monitor Flight Deals',
      skillId: 'scrape-travel-deals',
      intervalHours: 1,
      maxRetries: 3,
      params: { origin: 'DAC', destination: 'JFK' }
    });

    assert.equal(job.id, 'price-alert-1');
    assert.equal(job.status, 'scheduled');
    assert.equal(scheduler.activeJobs.size, 1);
  });

  test('executes job with immediate success on first attempt', async () => {
    const scheduler = new JobScheduler();
    const job = scheduler.addJob({ name: 'Immediate Task' });

    let callCount = 0;
    const outcome = await scheduler.executeJobWithRetries(job, async () => {
      callCount++;
      return { success: true, data: { status: 'done' } };
    });

    assert.equal(outcome.success, true);
    assert.equal(outcome.attempts, 1);
    assert.equal(callCount, 1);
  });

  test('retries transient failures and succeeds on subsequent attempt', async () => {
    const scheduler = new JobScheduler();
    const job = scheduler.addJob({ name: 'Transient Task' });

    let callCount = 0;
    const outcome = await scheduler.executeJobWithRetries(job, async (_j, attempt) => {
      callCount++;
      if (attempt < 3) {
        return { success: false, error: 'Network timeout (transient)' };
      }
      return { success: true, data: { status: 'recovered' } };
    }, 3);

    assert.equal(outcome.success, true);
    assert.equal(outcome.attempts, 3);
    assert.equal(callCount, 3);
  });

  test('records failure when max retries are exhausted', async () => {
    const scheduler = new JobScheduler();
    const job = scheduler.addJob({ name: 'Failing Task' });

    let callCount = 0;
    const outcome = await scheduler.executeJobWithRetries(job, async () => {
      callCount++;
      return { success: false, error: 'Persistent 503 Service Unavailable' };
    }, 2);

    assert.equal(outcome.success, false);
    assert.equal(outcome.attempts, 2);
    assert.match(outcome.error, /Persistent 503/);
    assert.equal(callCount, 3); // initial attempt (1) + 2 retries (attempt 2, attempt 3)
  });

  test('Phase 6 Gate: executes unattended simulated 24-hour run with retries and report', async () => {
    const scheduler = new JobScheduler();
    const jobConfig = {
      id: 'price-scraper-24h',
      name: 'E-commerce Price Monitor',
      skillId: 'extract-product-price',
      intervalHours: 1,
      maxRetries: 3
    };

    // Injected simulated runner: transiently fails on hour 6 and hour 18 on attempt 1, succeeds on attempt 2
    let executionTick = 0;
    const report = await scheduler.simulate24HourRun(jobConfig, async (_job, attempt) => {
      executionTick++;
      // Determine virtual hour from execution
      // If hour 6 or 18, fail first attempt
      if ((executionTick === 6 || executionTick === 19) && attempt === 1) {
        return { success: false, error: 'Simulated temporary DOM mutation / rate limit' };
      }
      return { success: true, price: 99.99 };
    });

    assert.equal(report.jobId, 'price-scraper-24h');
    assert.equal(report.simulatedDurationHours, 24);
    assert.equal(report.totalScheduledRuns, 24);
    assert.equal(report.successfulRuns, 24);
    assert.equal(report.failedRuns, 0);
    assert.equal(report.retriedRunsCount, 2);
    assert.equal(report.successRatePercent, 100);
    assert.equal(report.hourlyLogs.length, 24);
    assert.ok(report.summaryText.includes('24/24 runs succeeded'));
    assert.ok(report.summaryText.includes('Retries triggered: 2'));
  });
});
