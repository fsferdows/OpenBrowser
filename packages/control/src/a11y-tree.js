/**
 * Parses and indexes Chrome DevTools Protocol Accessibility Tree nodes.
 */
export class AccessibilityTree {
  constructor(rawNodes = []) {
    this.rawNodes = rawNodes;
    this.nodeMap = new Map();
    this.interactiveNodes = [];
    this._indexNodes();
  }

  _indexNodes() {
    const INTERACTIVE_ROLES = new Set([
      'button', 'link', 'textbox', 'searchbox', 'checkbox',
      'radio', 'combobox', 'menuitem', 'tab', 'switch'
    ]);

    for (const node of this.rawNodes) {
      const id = node.nodeId || node.backendDOMNodeId;
      const role = (node.role?.value || node.role || '').toLowerCase();
      const name = (node.name?.value || node.name || '').trim();
      const description = node.description?.value || '';
      const value = node.value?.value || '';

      const properties = {};
      if (Array.isArray(node.properties)) {
        for (const prop of node.properties) {
          properties[prop.name] = prop.value?.value ?? true;
        }
      }

      const parsedNode = {
        id,
        backendDOMNodeId: node.backendDOMNodeId,
        role,
        name,
        description,
        value,
        disabled: Boolean(properties.disabled),
        expanded: Boolean(properties.expanded),
        focused: Boolean(properties.focused),
        checked: properties.checked
      };

      const NON_INTERACTIVE_ROLES = new Set(['webarea', 'rootwebarea', 'none', 'presentation', 'generic']);

      this.nodeMap.set(id, parsedNode);

      if (INTERACTIVE_ROLES.has(role) || (!NON_INTERACTIVE_ROLES.has(role) && name.length > 0 && role.length > 0)) {
        this.interactiveNodes.push(parsedNode);
      }
    }
  }

  /**
   * Find node by accessibility role and accessible name.
   */
  findByRoleAndName(role, name) {
    const targetRole = role.toLowerCase();
    const targetName = name.toLowerCase().trim();

    return this.interactiveNodes.find(node => {
      const matchesRole = node.role === targetRole || targetRole === '*' || targetRole === 'any';
      const matchesName = node.name.toLowerCase() === targetName || node.name.toLowerCase().includes(targetName);
      return matchesRole && matchesName;
    }) || null;
  }

  /**
   * Generate an agent observation prompt summarizing visible interactive elements.
   */
  toObservationSummary() {
    return this.interactiveNodes
      .filter(n => !n.disabled && n.name.length > 0)
      .map(n => `[${n.role}] "${n.name}"${n.value ? ` value="${n.value}"` : ''}`)
      .join('\n');
  }
}
