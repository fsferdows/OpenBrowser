import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentStateMachine, AGENT_STATES } from '../src/state-machine.js';
import { ACTIONS, RISK_LEVELS } from '@agentic-browser/shared';

describe('Chaos & Failure Injection Test Suite', () => {
  it('handles mid-flight CDP connection loss cleanly without unhandled rejection', async () => {
    let callCount = 0;
    const mockDriver = {
      async getObservation() {
        callCount++;
        if (callCount === 3) {
          throw new Error('CDP connection lost: WebSocket closed abnormally (code 1006)');
        }
        return {
          url: 'https://example.com/checkout',
          summary: 'Billing form active',
          elementVisible: true
        };
      },
      async executeAction() {
        return { success: true };
      }
    };

    const mockPlan = [
      { action: ACTIONS.FILL, target: '#name', value: 'John', expect: {}, risk_level: RISK_LEVELS.LOW },
      { action: ACTIONS.CLICK, target: '#submit', expect: {}, risk_level: RISK_LEVELS.MEDIUM }
    ];

    const logs = [];
    const sm = new AgentStateMachine({
      controlDriver: mockDriver,
      onLog: (lvl, msg) => logs.push({ lvl, msg })
    });

    const result = await sm.runTask('Complete checkout form', mockPlan);

    assert.strictEqual(sm.state, AGENT_STATES.FAILED);
    assert.strictEqual(result.status, AGENT_STATES.FAILED);
    assert.ok(result.error.includes('CDP connection lost'));
    // Step 1 checkpoint was committed before failure
    assert.strictEqual(result.checkpoints.length, 1);
    assert.strictEqual(result.checkpoints[0].action, ACTIONS.FILL);

    // Can recover from preserved trace
    const traceJson = sm.checkpointManager.exportTrace();
    const freshSm = new AgentStateMachine({ controlDriver: mockDriver });
    const recovered = freshSm.recoverFromCheckpoint(traceJson);

    assert.strictEqual(freshSm.state, AGENT_STATES.PAUSED);
    assert.strictEqual(recovered.action, ACTIONS.FILL);
  });

  it('handles browser tab crash cleanly', async () => {
    const mockDriver = {
      async getObservation() {
        return { url: 'https://example.com/heavy', summary: 'Canvas page' };
      },
      async executeAction() {
        const crashErr = new Error('Target.targetCrashed: Renderer process terminated unexpectedly');
        crashErr.name = 'TargetCrashedError';
        throw crashErr;
      }
    };

    const mockPlan = [
      { action: ACTIONS.CLICK, target: '#heavy-render', expect: {}, risk_level: RISK_LEVELS.LOW }
    ];

    const logs = [];
    const sm = new AgentStateMachine({
      controlDriver: mockDriver,
      onLog: (lvl, msg) => logs.push({ lvl, msg })
    });

    const result = await sm.runTask('Render 3D chart', mockPlan);

    assert.strictEqual(sm.state, AGENT_STATES.FAILED);
    assert.strictEqual(result.faultType, 'TargetCrashedError');
    assert.ok(result.error.includes('Renderer process terminated'));
  });

  it('handles DOM element detachment during action execution', async () => {
    const mockDriver = {
      async getObservation() {
        return { url: 'https://example.com/dynamic', summary: 'Dynamic SPA' };
      },
      async executeAction(step) {
        throw new Error(`NodeDetachedError: Element ${step.target} was removed from the DOM by a client re-render`);
      }
    };

    const mockPlan = [
      { action: ACTIONS.CLICK, target: '#stale-button', expect: {}, risk_level: RISK_LEVELS.LOW }
    ];

    const sm = new AgentStateMachine({ controlDriver: mockDriver });
    const result = await sm.runTask('Click stale button', mockPlan);

    assert.strictEqual(result.status, AGENT_STATES.FAILED);
    assert.ok(result.error.includes('NodeDetachedError'));
  });

  it('handles complete model gateway failure or HTTP 429 exhaustion', async () => {
    const mockDriver = {
      async getObservation() {
        return { url: 'https://example.com', summary: 'Search page' };
      }
    };

    const failingGateway = {
      async requestStep() {
        const err = new Error('GatewayError: All 3 upstream providers exhausted: HTTP 429 Too Many Requests');
        err.name = 'GatewayCircuitBreakerOpen';
        throw err;
      }
    };

    const sm = new AgentStateMachine({
      controlDriver: mockDriver,
      gatewayClient: failingGateway
    });

    const result = await sm.runTask('Search for query without mock plan');

    assert.strictEqual(result.status, AGENT_STATES.FAILED);
    assert.strictEqual(result.faultType, 'GatewayCircuitBreakerOpen');
    assert.ok(result.error.includes('HTTP 429'));
  });

  it('enforces step budget timeout when tasks fail to complete', async () => {
    const mockDriver = {
      async getObservation() {
        return { url: 'https://example.com', summary: 'Infinite loop simulation' };
      },
      async executeAction() {
        return { success: true };
      }
    };

    // Alternating actions to avoid critic 3-step loop detection
    const mockPlan = [
      { action: ACTIONS.SCROLL, target: '#c1', expect: {}, risk_level: RISK_LEVELS.LOW },
      { action: ACTIONS.WAIT, target: '#c2', expect: {}, risk_level: RISK_LEVELS.LOW },
      { action: ACTIONS.SCROLL, target: '#c3', expect: {}, risk_level: RISK_LEVELS.LOW }
    ];

    const sm = new AgentStateMachine({
      controlDriver: mockDriver,
      maxSteps: 3
    });

    const result = await sm.runTask('Endless exploration', mockPlan);

    assert.strictEqual(sm.state, AGENT_STATES.FAILED);
    assert.strictEqual(result.error, 'Step budget exceeded');
    assert.strictEqual(result.totalSteps, 3);
  });
});
