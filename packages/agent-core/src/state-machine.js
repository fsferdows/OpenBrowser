import { CheckpointManager } from './checkpoint-manager.js';
import { ACTIONS, RISK_LEVELS } from '@agentic-browser/shared';

export const AGENT_STATES = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  COMPLETED: 'COMPLETED',
  ABORTED: 'ABORTED',
  FAILED: 'FAILED'
};

export class AgentStateMachine {
  constructor(options = {}) {
    this.state = AGENT_STATES.IDLE;
    this.gatewayClient = options.gatewayClient;
    this.controlDriver = options.controlDriver;
    this.maxSteps = options.maxSteps || 25;
    this.checkpointManager = new CheckpointManager();
    this.trajectoryHistory = [];
    this.onStateChange = options.onStateChange || (() => {});
    this.onLog = options.onLog || (() => {});
  }

  _setState(newState) {
    this.state = newState;
    this.onStateChange(newState);
  }

  pause() {
    if (this.state === AGENT_STATES.RUNNING) {
      this._setState(AGENT_STATES.PAUSED);
      this.onLog('AGENT', 'Agent paused by operator.');
    }
  }

  resume() {
    if (this.state === AGENT_STATES.PAUSED) {
      this._setState(AGENT_STATES.RUNNING);
      this.onLog('AGENT', 'Agent resumed.');
    }
  }

  kill() {
    this._setState(AGENT_STATES.ABORTED);
    this.onLog('ABORT', 'Emergency stop triggered. Execution halted.');
  }

  /**
   * Evaluates trajectory history to detect repetitive action loops.
   */
  _criticEvaluate(newAction, newTarget) {
    if (this.trajectoryHistory.length < 3) return { hasLoop: false };

    const recent = this.trajectoryHistory.slice(-3);
    const targetKey = JSON.stringify(newTarget);
    const isLoop = recent.every(
      step => step.action === newAction && JSON.stringify(step.target) === targetKey
    );

    if (isLoop) {
      return {
        hasLoop: true,
        reason: `Critic detected infinite action loop: repeating ${newAction} on target ${targetKey} 3 times.`
      };
    }

    return { hasLoop: false };
  }

  /**
   * Deterministic verifier evaluating post-conditions.
   */
  _verifyCondition(expect, observation) {
    if (!expect || !expect.condition) return true;
    const cond = expect.condition;

    if (cond.startsWith('url_contains:')) {
      const expectedUrl = cond.replace('url_contains:', '');
      return (observation.currentUrl || '').includes(expectedUrl);
    }

    if (cond.startsWith('value_equals:')) {
      const expectedVal = cond.replace('value_equals:', '');
      return observation.targetValue === expectedVal;
    }

    if (cond.startsWith('element_visible:')) {
      return Boolean(observation.elementVisible);
    }

    return true;
  }

  /**
   * Executes an autonomous goal loop.
   */
  async runTask(goal, mockPlan = null) {
    this.checkpointManager = new CheckpointManager({ goal });
    this.trajectoryHistory = [];
    this._setState(AGENT_STATES.RUNNING);
    this.onLog('START', `Beginning task execution for goal: "${goal}"`);

    let stepCount = 0;

    try {
      while (this.state === AGENT_STATES.RUNNING && stepCount < this.maxSteps) {
        stepCount++;

        // 1. Perception
        const observation = await this.controlDriver.getObservation();

        // 2. Planning (Gateway inference or deterministic test plan)
        let planStep;
        if (mockPlan && mockPlan[stepCount - 1]) {
          planStep = mockPlan[stepCount - 1];
        } else {
          const prompt = [
            { role: 'system', content: 'You are an autonomous web browser agent. Respond with valid JSON matching gateway schema.' },
            { role: 'user', content: `Goal: ${goal}\nCurrent Observation:\n${observation.summary}` }
          ];
          const gatewayRes = await this.gatewayClient.requestStep(prompt);
          planStep = gatewayRes.result;
        }

        // Check for completion action
        if (planStep.action === ACTIONS.FINISH) {
          this._setState(AGENT_STATES.COMPLETED);
          this.onLog('SUCCESS', `Task completed: ${planStep.thought || 'Goal satisfied.'}`);
          return {
            status: AGENT_STATES.COMPLETED,
            totalSteps: stepCount,
            checkpoints: this.checkpointManager.getCheckpoints()
          };
        }

        // 3. Critic Loop Detection
        const criticCheck = this._criticEvaluate(planStep.action, planStep.target);
        if (criticCheck.hasLoop) {
          this._setState(AGENT_STATES.FAILED);
          this.onLog('CRITIC_FAIL', criticCheck.reason);
          return {
            status: AGENT_STATES.FAILED,
            error: criticCheck.reason,
            totalSteps: stepCount
          };
        }

        // 4. Policy & Confirmation Check
        if (planStep.risk_level === RISK_LEVELS.CRITICAL || planStep.risk_level === RISK_LEVELS.HIGH) {
          this.onLog('POLICY', `High-risk action "${planStep.action}" requires operator confirmation.`);
        }

        // 5. Execution
        const execResult = await this.controlDriver.executeAction(planStep);
        this.trajectoryHistory.push(planStep);

        // 6. Verification
        const postObservation = await this.controlDriver.getObservation();
        const verified = this._verifyCondition(planStep.expect, postObservation);

        // 7. Checkpoint Commitment
        this.checkpointManager.saveCheckpoint({
          action: planStep.action,
          target: planStep.target,
          value: planStep.value,
          observationSummary: postObservation.summary,
          verifierPassed: verified,
          riskLevel: planStep.risk_level
        });

        this.onLog('STEP', `Step ${stepCount} [${planStep.action}]: ${planStep.expected_outcome || 'executed'}`);
      }
    } catch (err) {
      this._setState(AGENT_STATES.FAILED);
      this.onLog('FAULT', `Runtime fault during task execution: ${err.message}`);
      return {
        status: AGENT_STATES.FAILED,
        error: err.message,
        faultType: err.name || 'RuntimeFault',
        totalSteps: stepCount,
        checkpoints: this.checkpointManager.getCheckpoints()
      };
    }

    if (stepCount >= this.maxSteps && this.state === AGENT_STATES.RUNNING) {
      this._setState(AGENT_STATES.FAILED);
      this.onLog('TIMEOUT', `Step budget exceeded (${this.maxSteps} steps).`);
      return { status: AGENT_STATES.FAILED, error: 'Step budget exceeded', totalSteps: stepCount };
    }

    return {
      status: this.state,
      totalSteps: stepCount,
      checkpoints: this.checkpointManager.getCheckpoints()
    };
  }

  /**
   * Resumes an interrupted run from a serialized checkpoint.
   */
  recoverFromCheckpoint(traceJson) {
    this.checkpointManager = CheckpointManager.fromTrace(traceJson);
    const latest = this.checkpointManager.getLatestCheckpoint();
    this.onLog('RECOVERY', `Recovered state machine to step ${latest?.index || 0}.`);
    this._setState(AGENT_STATES.PAUSED);
    return latest;
  }
}
