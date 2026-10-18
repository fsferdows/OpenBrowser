# Agentic Browser: User Guide

Welcome to the Agentic Browser. This guide walks you through executing automated web tasks, teaching new workflows, configuring credentials safely, and managing unattended schedules.

---

## 1. Getting Started with the Interface

The browser workspace provides two main interaction surfaces:
1. **Side Panel (`Ctrl+Shift+B` or `Cmd+Shift+B`)**: The primary control hub displaying active agent state, real-time thoughts, plan execution steps, and verification logs.
2. **Command Palette (`Ctrl+K` or `Cmd+K`)**: Fast-action overlay for natural language task entry, voice input, and skill search.

---

## 2. Running Autonomous Tasks

To run a task:
1. Open the command bar or side panel input.
2. State your objective clearly in natural language:
   - *"Find the latest quarterly report on company.com, download the PDF, and extract total revenue."*
   - *"Check my travel itinerary on the airline portal and copy the booking reference."*
3. Press **Enter** or click **Run Task**.
4. The Agent Core proceeds through four continuous stages:
   - **Perceive**: Inspects the accessibility tree and visual layout.
   - **Plan**: Evaluates target elements and selects next action.
   - **Act**: Dispatches synthetic mouse or keyboard events.
   - **Verify**: Confirms that post-conditions (e.g. page navigation or value update) were satisfied.

---

## 3. Teaching Workflows: Observe-and-Learn Mode

When a website requires specific human nuance or private sequences, you can demonstrate the workflow once:
1. In the side panel, click **Record New Skill**.
2. Perform the actions directly in the browser tab.
3. Sensitive password inputs are automatically recognized and replaced with credential parameters. Plaintext passwords never enter the skill file.
4. When finished, click **Stop & Compile**.
5. The Skill Engine analyzes DOM interactions, correlates them with network payloads using REA site intelligence, and saves a signed, versioned skill manifest in your local library.

---

## 4. Safety Hand-Offs and Confirmations

The agent is designed with non-negotiable safety boundaries:

### User Hand-off (CAPTCHAs & 2FA)
The agent **never** attempts to bypass or defeat CAPTCHAs, two-factor authentication (2FA), or biometric challenges. When a security challenge appears:
1. The agent pauses execution and displays a notification: *"Security challenge detected. Please complete this step in the tab."*
2. Complete the challenge in the browser tab.
3. The agent detects completion automatically and resumes execution from that exact step.

### Sensitive Action Confirmations
Any action classified as **HIGH** or **CRITICAL** risk (e.g., permanent deletions, financial payments, account changes) pauses execution and prompts for your explicit confirmation before proceeding.

---

## 5. Encrypted Vault and Credentials

Credentials and API keys are stored locally using AES-256-GCM encryption derived from your master password:
1. Open **Settings > Credential Vault**.
2. Add secrets with descriptive identifiers (e.g., `airline_portal_password`).
3. When running skills, reference secrets as parameters. Plaintext values are injected directly into password fields via memory-only CDP dispatches and scrubbed from all logs and telemetry.

---

## 6. Scheduled & Background Automation

To run recurring tasks automatically:
1. Go to **Settings > Scheduled Jobs**.
2. Select a saved skill and specify a cron expression (e.g. `0 9 * * 1-5` for weekdays at 9:00 AM).
3. The scheduler executes the workflow in the background, retries transient network hiccups with exponential backoff, and compiles execution reports.

---

## 7. Accessibility and Language Preferences

- **Screen Reader Support**: All side-panel UI components include ARIA attributes, semantic roles, and high-contrast color palettes meeting WCAG 2.2 AA standards.
- **Language Switching**: Change interface language in **Settings > Language**. English and Bangla (`bn`) are supported natively with automatic text interpolation.
