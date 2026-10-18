import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AccessibilityTree, TargetResolver } from '../src/index.js';

describe('Control Layer Accessibility Tree & Targeting', () => {
  const mockCdpNodes = [
    {
      nodeId: 'node-1',
      backendDOMNodeId: 101,
      role: { value: 'WebArea' },
      name: { value: 'Sample Page' }
    },
    {
      nodeId: 'node-2',
      backendDOMNodeId: 102,
      role: { value: 'searchbox' },
      name: { value: 'Search Products' },
      value: { value: 'laptop' },
      properties: [{ name: 'focused', value: { value: true } }]
    },
    {
      nodeId: 'node-3',
      backendDOMNodeId: 103,
      role: { value: 'button' },
      name: { value: 'Submit Search' },
      properties: [{ name: 'disabled', value: { value: false } }]
    },
    {
      nodeId: 'node-4',
      backendDOMNodeId: 104,
      role: { value: 'button' },
      name: { value: 'Cancel Order' },
      properties: [{ name: 'disabled', value: { value: true } }]
    }
  ];

  test('indexes interactive nodes and parses accessibility properties correctly', () => {
    const tree = new AccessibilityTree(mockCdpNodes);
    assert.equal(tree.interactiveNodes.length, 3);

    const searchNode = tree.findByRoleAndName('searchbox', 'Search Products');
    assert.ok(searchNode);
    assert.equal(searchNode.id, 'node-2');
    assert.equal(searchNode.value, 'laptop');
    assert.equal(searchNode.focused, true);
  });

  test('formats observation summary omitting disabled elements', () => {
    const tree = new AccessibilityTree(mockCdpNodes);
    const summary = tree.toObservationSummary();
    assert.ok(summary.includes('[searchbox] "Search Products" value="laptop"'));
    assert.ok(summary.includes('[button] "Submit Search"'));
    assert.ok(!summary.includes('[button] "Cancel Order"')); // disabled button excluded
  });

  test('TargetResolver prioritizes accessibility tree match first', async () => {
    const tree = new AccessibilityTree(mockCdpNodes);
    let domQueryCalled = false;
    const domQueryMock = async (sel) => {
      domQueryCalled = true;
      return { backendNodeId: 999 };
    };

    const resolver = new TargetResolver(tree, domQueryMock);
    const match = await resolver.resolve({
      role: 'button',
      name: 'Submit Search',
      selector: '#submit-btn'
    });

    assert.ok(match);
    assert.equal(match.strategy, 'accessibility_tree');
    assert.equal(match.node.id, 'node-3');
    assert.equal(match.confidence, 1.0);
    assert.equal(domQueryCalled, false); // CDP A11y matched first, DOM query not even needed!
  });

  test('TargetResolver falls back to CSS selector when a11y match fails', async () => {
    const tree = new AccessibilityTree(mockCdpNodes);
    let queriedSelector = null;
    const domQueryMock = async (sel) => {
      queriedSelector = sel;
      return { backendNodeId: 505 };
    };

    const resolver = new TargetResolver(tree, domQueryMock);
    const match = await resolver.resolve({
      role: 'button',
      name: 'Non Existent Button',
      selector: '.fallback-selector'
    });

    assert.ok(match);
    assert.equal(match.strategy, 'css_selector');
    assert.equal(match.node.backendNodeId, 505);
    assert.equal(queriedSelector, '.fallback-selector');
  });

  test('TargetResolver returns null when all strategies fail', async () => {
    const tree = new AccessibilityTree(mockCdpNodes);
    const domQueryMock = async () => null;

    const resolver = new TargetResolver(tree, domQueryMock);
    const match = await resolver.resolve({
      role: 'button',
      name: 'Ghost Element',
      selector: '#ghost'
    });

    assert.equal(match, null);
  });
});
