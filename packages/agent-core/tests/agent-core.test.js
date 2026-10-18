import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AgentStateMachine, AGENT_STATES, CheckpointManager } from '../src/index.js';
import { ACTIONS, RISK_LEVELS } from '@agentic-browser/shared';

describe('Agent Core State Machine & Loop Execution Tests', () => {
  function makeMockDriver() {
    let obsCount = 0;
    return {
      getObservation: async () => {
        obsCount++;
        return {
          currentUrl: 'http://127.0.0.1/catalog.html',
          summary: `[searchbox] "Search Products" value="${obsCount > 1 ? 'laptop' : ''}"\n[button] "Search"`
        };
      },
      executeAction: async (step) => {
        return { success: true };
      }
    };
  }

  test('executes autonomous goal run and commits checkpoints to completion', async () => {
    const driver = makeMockDriver();
    const mockPlan = [
      {
        action: ACTIONS.FILL,
        target: { role: 'searchbox', name: 'Search Products' },
        value: 'laptop',
        expected_outcome: 'Query entered',
        risk_level: RISK_LEVELS.LOW,
        expect: { condition: 'url_contains:catalog.html' }
      },
      {
        action: ACTIONS.CLICK,
        target: { role: 'button', name: 'Search' },
        expected_outcome: 'Results filtered',
        risk_level: RISK_LEVELS.LOW
      },
      {
        action: ACTIONS.FINISH,
        thought: 'Results successfully retrieved'
      }
    ];

    const agent = new AgentStateMachine({
      controlDriver: driver
    });

    const result = await agent.runTask('Search products for laptop', mockPlan);

    assert.equal(result.status, AGENT_STATES.COMPLETED);
    assert.equal(result.totalSteps, 3);
    assert.equal(result.checkpoints.length, 2); // 2 action checkpoints committed
    assert.equal(result.checkpoints[0].action, ACTIONS.FILL);
    assert.equal(result.checkpoints[1].action, ACTIONS.CLICK);
  });

  test('Critic detects infinite action loop and halts execution', async () => {
    const driver = makeMockDriver();
    // Repeating exact same click action 4 times
    const infinitePlan = [
      { action: ACTIONS.CLICK, target: { role: 'button', name: 'Submit' }, risk_level: 'low' },
      { action: ACTIONS.CLICK, target: { role: 'button', name: 'Submit' }, risk_level: 'low' },
      { action: ACTIONS.CLICK, target: { role: 'button', name: 'Submit' }, risk_level: 'low' },
      { action: ACTIONS.CLICK, target: { role: 'button', name: 'Submit' }, risk_level: 'low' }
    ];

    const agent = new AgentStateMachine({
      controlDriver: driver
    });

    const result = await agent.runTask('Infinite task', infinitePlan);

    assert.equal(result.status, AGENT_STATES.FAILED);
    assert.ok(result.error.includes('Critic detected infinite action loop'));
  });

  test('pause, resume, and kill controls update state machine accurately', () => {
    const agent = new AgentStateMachine();
    agent.state = AGENT_STATES.RUNNING;

    agent.pause();
    assert.equal(agent.state, AGENT_STATES.PAUSED);

    agent.resume();
    assert.equal(agent.state, AGENT_STATES.RUNNING);

    agent.kill();
    assert.equal(agent.state, AGENT_STATES.ABORTED);
  });

  test('recovers state machine from serialized checkpoint trace', () => {
    const manager = new CheckpointManager({ goal: 'Original Goal' });
    manager.saveCheckpoint({ action: 'navigate', target: { role: 'page', name: 'Home' }, verifierPassed: true });
    manager.saveCheckpoint({ action: 'click', target: { role: 'button', name: 'Login' }, verifierPassed: true });

    const traceJson = manager.exportTrace();

    const agent = new AgentStateMachine();
    const recovered = agent.recoverFromCheckpoint(traceJson);

    assert.ok(recovered);
    assert.equal(recovered.index, 2);
    assert.equal(recovered.action, 'click');
    assert.equal(agent.state, AGENT_STATES.PAUSED);
  });

  test('deterministic replay reproduces recorded trace without live model calls', async () => {
    const manager = new CheckpointManager({ goal: 'Replayable Task' });
    manager.saveCheckpoint({ action: 'fill', target: { role: 'searchbox', name: 'Search' }, value: 'laptop', verifierPassed: true });
    manager.saveCheckpoint({ action: 'click', target: { role: 'button', name: 'Search' }, verifierPassed: true });

    const executedSteps = [];
    const mockExecutor = async (step) => {
      executedSteps.push(step);
      return { success: true };
    };

    const replayResult = await manager.replay(mockExecutor);

    assert.equal(replayResult.success, true);
    assert.equal(replayResult.totalReplayed, 2);
    assert.equal(executedSteps.length, 2);
    assert.equal(executedSteps[0].action, 'fill');
    assert.equal(executedSteps[0].value, 'laptop');
    assert.equal(executedSteps[1].action, 'click');
  });
});
