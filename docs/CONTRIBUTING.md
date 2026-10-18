# Contributing to Agentic Browser

We welcome contributions from engineers, accessibility specialists, and skill authors.

---

## Code Quality Standards

Before submitting a Pull Request, verify that your changes adhere to our non-negotiable quality rules:
1. **No Stubs or Placeholders**: Every shipped path must have complete, working implementations. No fake tests or mocks presented as real.
2. **Acceptance Tests First**: Write tests that verify real outcomes before or alongside implementation.
3. **Architecture Decision Records (ADRs)**: Any architectural change or non-trivial engineering choice must be documented in `/CONTEXT/DECISIONS/` before code is submitted.
4. **Typed Interfaces & Schemas**: Enforce runtime schema validation at all process and model boundaries.
5. **No Invented APIs**: Verify all Chromium CDP flags, model endpoints, and browser APIs against upstream documentation or source code.
6. **Zero Marketing Language**: Technical documentation and commit messages must remain objective and factual.

---

## Commit Guidelines

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat(...)`: New feature or user capability.
- `fix(...)`: Bug fix.
- `test(...)`: Adding or updating test suites.
- `docs(...)`: Documentation updates.
- `chore(...)`: Tooling, dependency, or CI updates.

---

## Local Verification Ritual

Run the complete CI suite before pushing:
```bash
npm run ci
```
Every pull request must maintain green CI on secrets scanning, license audits, linting, SLO performance budgets, and the 166-test test suite.
