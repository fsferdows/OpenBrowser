import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SidePanelController } from '../sidepanel.js';

function createMockDocument() {
  const elements = new Map();

  function makeEl(id, tag = 'div') {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      style: {},
      value: '',
      disabled: false,
      textContent: '',
      listeners: {},
      children: [],
      addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
      },
      dispatch(event, data) {
        const fns = this.listeners[event] || [];
        for (const fn of fns) fn(data);
      },
      appendChild(child) {
        this.children.push(child);
      }
    };
    elements.set(id, el);
    return el;
  }

  // Pre-populate expected element IDs
  makeEl('task-form', 'form');
  makeEl('task-input', 'input');
  makeEl('voice-btn', 'button');
  makeEl('run-task-btn', 'button');
  makeEl('pause-btn', 'button');
  makeEl('kill-switch-btn', 'button');
  makeEl('action-stream', 'div');
  makeEl('empty-state', 'div');
  makeEl('status-dot', 'span');
  makeEl('handoff-banner', 'section');
  makeEl('handoff-title', 'h2');
  makeEl('handoff-desc', 'p');
  makeEl('handoff-resume-btn', 'button');
  makeEl('token-counter', 'span');
  makeEl('latency-counter', 'span');

  return {
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tag) {
      return makeEl('dynamic-' + Math.random(), tag);
    }
  };
}

describe('Extension Side Panel UI State Machine Tests', () => {
  test('initializes with default stopped state', () => {
    const doc = createMockDocument();
    const controller = new SidePanelController(doc);

    assert.equal(controller.isRunning, false);
    assert.equal(controller.isPaused, false);
  });

  test('starts task and transitions state indicators', () => {
    const doc = createMockDocument();
    const controller = new SidePanelController(doc);

    controller.startTask('Search products');

    assert.equal(controller.isRunning, true);
    assert.equal(doc.getElementById('status-dot').classList.contains('running'), true);
    assert.equal(doc.getElementById('run-task-btn').disabled, true);
    assert.equal(doc.getElementById('pause-btn').disabled, false);
    assert.equal(doc.getElementById('empty-state').style.display, 'none');
  });

  test('toggles pause and resume correctly', () => {
    const doc = createMockDocument();
    const controller = new SidePanelController(doc);

    controller.startTask('Run report');
    controller.togglePause();
    assert.equal(controller.isPaused, true);
    assert.equal(doc.getElementById('pause-btn').textContent, 'Resume');

    controller.togglePause();
    assert.equal(controller.isPaused, false);
    assert.equal(doc.getElementById('pause-btn').textContent, 'Pause');
  });

  test('emergency stop terminates immediately and resets controls', () => {
    const doc = createMockDocument();
    const controller = new SidePanelController(doc);

    controller.startTask('Process batch');
    controller.emergencyStop();

    assert.equal(controller.isRunning, false);
    assert.equal(doc.getElementById('status-dot').classList.contains('running'), false);
    assert.equal(doc.getElementById('run-task-btn').disabled, false);
    assert.equal(doc.getElementById('pause-btn').disabled, true);
  });

  test('triggers handoff alert and resumes on completion', () => {
    const doc = createMockDocument();
    const controller = new SidePanelController(doc);

    controller.startTask('Checkout payment');
    controller.triggerHandoff('2FA Code Required', 'Please enter SMS code.');

    assert.equal(doc.getElementById('handoff-banner').classList.contains('hidden'), false);
    assert.equal(doc.getElementById('handoff-title').textContent, '2FA Code Required');

    controller.resolveHandoff();
    assert.equal(doc.getElementById('handoff-banner').classList.contains('hidden'), true);
  });
});
