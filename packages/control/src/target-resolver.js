/**
 * Multi-strategy element target resolution implementing accessibility-first targeting.
 */
export class TargetResolver {
  constructor(a11yTree = null, domQueryFn = null) {
    this.a11yTree = a11yTree;
    this.domQueryFn = domQueryFn;
  }

  setAccessibilityTree(a11yTree) {
    this.a11yTree = a11yTree;
  }

  /**
   * Resolves target element using prioritized strategies.
   */
  async resolve(targetDescriptor) {
    const { role, name, selector, text } = targetDescriptor;

    // Strategy 1: Accessibility Tree (Role + Name)
    if (this.a11yTree && role && name) {
      const a11yMatch = this.a11yTree.findByRoleAndName(role, name);
      if (a11yMatch) {
        return {
          strategy: 'accessibility_tree',
          node: a11yMatch,
          confidence: 1.0
        };
      }
    }

    // Strategy 2: CSS Selector via DOM query
    if (this.domQueryFn && selector) {
      const domMatch = await this.domQueryFn(selector);
      if (domMatch) {
        return {
          strategy: 'css_selector',
          node: domMatch,
          confidence: 0.85
        };
      }
    }

    // Strategy 3: Accessible name substring match fallback
    if (this.a11yTree && name) {
      const fallbackMatch = this.a11yTree.findByRoleAndName('*', name);
      if (fallbackMatch) {
        return {
          strategy: 'a11y_fallback_any_role',
          node: fallbackMatch,
          confidence: 0.70
        };
      }
    }

    return null;
  }
}
