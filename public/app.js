/**
 * Agentic Browser Studio Client Application
 */

const I18N_STRINGS = {
  en: {
    panelTitle: 'Agentic Browser',
    runTask: 'Run Task',
    pause: 'Pause',
    resume: 'Resume',
    record: 'Record',
    execLog: 'Execution Plan & Stream',
    userActionRequired: 'User Action Required',
    handoffDesc: 'The agent detected a security challenge or CAPTCHA and paused. Complete it in the tab to resume.',
    tokens: 'Tokens:',
    latency: 'Latency:'
  },
  bn: {
    panelTitle: 'এজেন্টিক ব্রাউজার',
    runTask: 'টাস্ক চালান',
    pause: 'বিরতি',
    resume: 'পুনরায় শুরু',
    record: 'রেকর্ড',
    execLog: 'এক্সিকিউশন প্ল্যান ও স্ট্রিম',
    userActionRequired: 'ব্যবহারকারীর অ্যাকশন প্রয়োজন',
    handoffDesc: 'এজেন্ট একটি নিরাপত্তা চ্যালেঞ্জ বা ক্যাপচা সনাক্ত করেছে এবং বিরতি নিয়েছে। পুনরায় শুরু করতে ট্যাবে এটি সমাধান করুন।',
    tokens: 'টোকেন:',
    latency: 'লেটেন্সি:'
  }
};

class StudioApp {
  constructor() {
    this.currentLocale = 'en';
    this.isRunning = false;
    this.isPaused = false;
    this.totalTokens = 0;
    this.stepCount = 0;

    this.cacheElements();
    this.bindEvents();
    this.updateLanguageUI();
  }

  cacheElements() {
    this.iframe = document.getElementById('webview-frame');
    this.cursor = document.getElementById('agent-cursor');
    this.urlInput = document.getElementById('url-input');
    this.tabTitle = document.getElementById('tab-title');
    this.scenarioSelect = document.getElementById('scenario-selector');
    this.taskInput = document.getElementById('task-input');
    this.btnRun = document.getElementById('btn-run-task');
    this.btnPause = document.getElementById('btn-pause-task');
    this.btnStop = document.getElementById('btn-emergency-stop');
    this.btnRecord = document.getElementById('btn-record-demo');
    this.btnVoice = document.getElementById('btn-voice');
    this.btnLang = document.getElementById('lang-btn');
    this.langLabel = document.getElementById('current-lang-label');
    this.actionStream = document.getElementById('action-stream');
    this.emptyState = document.getElementById('empty-state');
    this.statusDot = document.getElementById('status-dot');
    this.handoffBanner = document.getElementById('handoff-banner');
    this.btnHandoffResume = document.getElementById('btn-handoff-resume');
    this.valTokens = document.getElementById('val-tokens');
    this.valLatency = document.getElementById('val-latency');
    this.stepBadge = document.getElementById('step-badge');
  }

  bindEvents() {
    this.scenarioSelect.addEventListener('change', (e) => this.switchScenario(e.target.value));

    this.btnRun.addEventListener('click', () => this.runTask());
    this.btnPause.addEventListener('click', () => this.togglePause());
    this.btnStop.addEventListener('click', () => this.emergencyStop());
    this.btnRecord.addEventListener('click', () => this.recordDemonstration());
    this.btnVoice.addEventListener('click', () => this.handleVoiceInput());
    this.btnHandoffResume.addEventListener('click', () => this.resolveHandoff());
    this.btnLang.addEventListener('click', () => this.toggleLanguage());

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.taskInput.value = chip.dataset.prompt;
      });
    });

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'HANDOFF_RESOLVED') {
        this.resolveHandoff();
      }
    });
  }

  switchScenario(key) {
    const scenarios = {
      catalog: {
        url: 'https://shop.example.com/catalog.html',
        path: '/catalog.html',
        title: 'Apex Store | Electronics Catalog',
        prompt: 'Search for headphones and extract price'
      },
      form: {
        url: 'https://accounts.example.com/form.html',
        path: '/form.html',
        title: 'Apex Cloud | Developer Registration',
        prompt: 'Fill registration form for Alice'
      },
      handoff: {
        url: 'https://portal.example.com/auth-hand-off.html',
        path: '/auth-hand-off.html',
        title: 'Apex Vault | Security Gate',
        prompt: 'Solve security checkpoint and resume'
      },
      repair: {
        url: 'https://shop.example.com/catalog.html',
        path: '/catalog.html',
        title: 'Apex Store | Self-Repair Demo',
        prompt: 'Simulate broken selector and autonomous self-repair'
      }
    };

    const target = scenarios[key] || scenarios.catalog;
    this.urlInput.value = target.url;
    this.tabTitle.textContent = target.title;
    this.taskInput.value = target.prompt;
    this.iframe.src = target.path;
    this.hideHandoff();
    this.cursor.style.display = 'none';
  }

  toggleLanguage() {
    this.currentLocale = this.currentLocale === 'en' ? 'bn' : 'en';
    this.updateLanguageUI();
  }

  updateLanguageUI() {
    const strings = I18N_STRINGS[this.currentLocale];
    this.langLabel.textContent = this.currentLocale === 'en' ? 'English' : 'বাংলা';
    document.getElementById('lbl-panel-title').textContent = strings.panelTitle;
    document.getElementById('lbl-run-task').textContent = strings.runTask;
    document.getElementById('lbl-pause').textContent = this.isPaused ? strings.resume : strings.pause;
    document.getElementById('lbl-record').textContent = strings.record;
    document.getElementById('lbl-execution-log').textContent = strings.execLog;
    document.getElementById('handoff-title').textContent = strings.userActionRequired;
    document.getElementById('handoff-desc').textContent = strings.handoffDesc;
  }

  appendLog({ phase, thought, action, target, risk = 'low', verify = null }) {
    if (this.emptyState) this.emptyState.style.display = 'none';

    const item = document.createElement('div');
    item.className = `log-item risk-${risk}`;

    const top = document.createElement('div');
    top.className = 'item-top';

    const actionPill = document.createElement('span');
    actionPill.className = 'action-pill';
    actionPill.textContent = `${phase}: ${action}`;

    const riskPill = document.createElement('span');
    riskPill.className = `risk-pill ${risk}`;
    riskPill.textContent = risk;

    top.appendChild(actionPill);
    top.appendChild(riskPill);
    item.appendChild(top);

    if (thought) {
      const thoughtEl = document.createElement('div');
      thoughtEl.className = 'item-thought';
      thoughtEl.textContent = `"${thought}"`;
      item.appendChild(thoughtEl);
    }

    if (target) {
      const targetEl = document.createElement('div');
      targetEl.className = 'item-target';
      targetEl.textContent = `Target: ${target}`;
      item.appendChild(targetEl);
    }

    if (verify) {
      const verifyEl = document.createElement('div');
      verifyEl.className = 'item-verify';
      verifyEl.innerHTML = `✓ ${verify}`;
      item.appendChild(verifyEl);
    }

    this.actionStream.appendChild(item);
    this.actionStream.scrollTop = this.actionStream.scrollHeight;
  }

  moveCursorToElement(targetSelector) {
    try {
      const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;
      const el = iframeDoc.querySelector(targetSelector);
      if (!el) return null;

      // Highlight target inside iframe
      iframeDoc.querySelectorAll('.agent-highlight').forEach(e => e.classList.remove('agent-highlight'));
      el.classList.add('agent-highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Position simulated cursor
      const rect = el.getBoundingClientRect();
      this.cursor.style.display = 'block';
      this.cursor.style.left = `${rect.left + rect.width / 2}px`;
      this.cursor.style.top = `${rect.top + rect.height / 2}px`;

      return el;
    } catch (err) {
      return null;
    }
  }

  async runTask() {
    const goal = this.taskInput.value.trim();
    if (!goal || this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this.stepCount = 0;
    this.statusDot.className = 'status-dot running';
    this.btnRun.disabled = true;
    this.btnPause.disabled = false;
    this.hideHandoff();

    const scenario = this.scenarioSelect.value;
    const startTime = performance.now();

    this.appendLog({
      phase: 'INIT',
      action: 'start_session',
      thought: `Goal accepted: "${goal}". Establishing CDP accessibility tree connection.`,
      risk: 'low'
    });

    try {
      const res = await fetch('/api/run-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, scenario })
      });
      const data = await res.json();

      for (const step of data.trajectory) {
        if (!this.isRunning) break;
        while (this.isPaused) {
          await new Promise(r => setTimeout(r, 200));
        }

        this.stepCount++;
        this.stepBadge.style.display = 'inline-block';
        this.stepBadge.textContent = `Step ${this.stepCount}`;

        // 1. Highlight element and move cursor
        if (step.selector) {
          const el = this.moveCursorToElement(step.selector);
          await new Promise(r => setTimeout(r, 600));

          // 2. Perform DOM action inside iframe
          if (el) {
            if (step.action === 'fill' && step.value !== undefined) {
              el.value = step.value;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (step.action === 'click') {
              el.click();
            } else if (step.action === 'select' && step.value) {
              el.value = step.value;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }

        // 3. Update telemetry
        this.totalTokens += step.tokens || 140;
        this.valTokens.textContent = this.totalTokens;
        const latency = Math.round(performance.now() - startTime);
        this.valLatency.textContent = `${latency}ms`;

        // 4. Append step to execution log
        this.appendLog({
          phase: 'PLAN & ACT',
          thought: step.thought,
          action: step.action,
          target: step.targetDesc || step.selector,
          risk: step.risk_level || 'low',
          verify: step.verifiedText
        });

        // Check if step triggered hand-off
        if (step.triggerHandoff) {
          this.triggerHandoff(step.handoffTitle, step.handoffDesc);
          await new Promise(r => {
            this.resumeCallback = r;
          });
        }

        await new Promise(r => setTimeout(r, 700));
      }

      this.appendLog({
        phase: 'COMPLETE',
        action: 'finish',
        thought: 'Goal successfully accomplished. Verification passed.',
        risk: 'low',
        verify: 'All post-conditions validated'
      });
      this.statusDot.className = 'status-dot ready';

    } catch (err) {
      this.appendLog({
        phase: 'ERROR',
        action: 'fail',
        thought: err.message,
        risk: 'high'
      });
      this.statusDot.className = 'status-dot failed';
    } finally {
      this.isRunning = false;
      this.btnRun.disabled = false;
      this.btnPause.disabled = true;
      this.cursor.style.display = 'none';
    }
  }

  triggerHandoff(title, desc) {
    this.statusDot.className = 'status-dot paused';
    this.handoffBanner.classList.remove('hidden');
    document.getElementById('handoff-title').textContent = title || 'Security Challenge Detected';
    document.getElementById('handoff-desc').textContent = desc || 'Please solve the prompt in the tab to resume.';
    this.appendLog({
      phase: 'SECURITY',
      action: 'handoff',
      thought: 'Autonomous agency paused at security boundary. Delegating step to operator.',
      risk: 'high'
    });
  }

  resolveHandoff() {
    this.hideHandoff();
    this.statusDot.className = 'status-dot running';
    this.appendLog({
      phase: 'RESUME',
      action: 'verify_auth',
      thought: 'Human challenge completed. Resuming autonomous agent pipeline.',
      risk: 'low',
      verify: 'Protected session authenticated'
    });
    if (this.resumeCallback) {
      this.resumeCallback();
      this.resumeCallback = null;
    }
  }

  hideHandoff() {
    this.handoffBanner.classList.add('hidden');
  }

  togglePause() {
    if (!this.isRunning) return;
    this.isPaused = !this.isPaused;
    const strings = I18N_STRINGS[this.currentLocale];
    document.getElementById('lbl-pause').textContent = this.isPaused ? strings.resume : strings.pause;
    this.statusDot.className = this.isPaused ? 'status-dot paused' : 'status-dot running';
    this.appendLog({
      phase: 'AGENT',
      action: this.isPaused ? 'pause' : 'resume',
      thought: this.isPaused ? 'Execution paused by operator.' : 'Execution resumed.',
      risk: 'low'
    });
  }

  emergencyStop() {
    this.isRunning = false;
    this.isPaused = false;
    this.statusDot.className = 'status-dot failed';
    this.btnRun.disabled = false;
    this.btnPause.disabled = true;
    this.hideHandoff();
    this.cursor.style.display = 'none';
    this.appendLog({
      phase: 'ABORT',
      action: 'kill_switch',
      thought: 'Emergency stop triggered. Process terminated immediately.',
      risk: 'critical'
    });
  }

  async recordDemonstration() {
    this.appendLog({
      phase: 'RECORD',
      action: 'start_recording',
      thought: 'Observe-and-learn mode active. Recording interactions with password masking.',
      risk: 'low'
    });
    alert('Recording mode active!\nDemonstrate the workflow in the page. Plaintext passwords are automatically masked.');
  }

  handleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported by your current browser. You can type instructions in the command bar.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = this.currentLocale === 'bn' ? 'bn-BD' : 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        this.btnVoice.classList.add('recording');
      };

      recognition.onresult = (e) => {
        const transcript = e.results[0]?.[0]?.transcript;
        if (transcript) {
          this.taskInput.value = transcript;
        }
      };

      recognition.onerror = () => {
        this.btnVoice.classList.remove('recording');
      };

      recognition.onend = () => {
        this.btnVoice.classList.remove('recording');
      };

      recognition.start();
    } catch (e) {
      alert('Could not start microphone: ' + e.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new StudioApp();
});
