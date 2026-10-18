/**
 * Agentic Browser Side Panel UI Controller
 */

export class SidePanelController {
  constructor(doc = document) {
    this.doc = doc;
    this.isRunning = false;
    this.isPaused = false;
    this.tokensUsed = 0;
    this.startTime = 0;
    this._initElements();
    this._bindEvents();
  }

  _initElements() {
    this.taskForm = this.doc.getElementById('task-form');
    this.taskInput = this.doc.getElementById('task-input');
    this.voiceBtn = this.doc.getElementById('voice-btn');
    this.runBtn = this.doc.getElementById('run-task-btn');
    this.pauseBtn = this.doc.getElementById('pause-btn');
    this.killBtn = this.doc.getElementById('kill-switch-btn');
    this.actionStream = this.doc.getElementById('action-stream');
    this.emptyState = this.doc.getElementById('empty-state');
    this.statusDot = this.doc.getElementById('status-dot');
    this.handoffBanner = this.doc.getElementById('handoff-banner');
    this.handoffResumeBtn = this.doc.getElementById('handoff-resume-btn');
    this.tokenCounter = this.doc.getElementById('token-counter');
    this.latencyCounter = this.doc.getElementById('latency-counter');
  }

  _bindEvents() {
    if (this.taskForm) {
      this.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.startTask(this.taskInput.value.trim());
      });
    }

    if (this.killBtn) {
      this.killBtn.addEventListener('click', () => this.emergencyStop());
    }

    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('click', () => this.togglePause());
    }

    if (this.handoffResumeBtn) {
      this.handoffResumeBtn.addEventListener('click', () => this.resolveHandoff());
    }

    if (this.voiceBtn) {
      this.voiceBtn.addEventListener('click', () => this.startVoiceInput());
    }
  }

  startTask(goal) {
    if (!goal || this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.statusDot?.classList.add('running');
    if (this.emptyState) this.emptyState.style.display = 'none';
    if (this.pauseBtn) this.pauseBtn.disabled = false;
    if (this.runBtn) this.runBtn.disabled = true;

    this.appendLog('PLAN', `Goal received: "${goal}"`, 'low');
  }

  togglePause() {
    if (!this.isRunning) return;
    this.isPaused = !this.isPaused;
    if (this.pauseBtn) this.pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
    this.appendLog('AGENT', this.isPaused ? 'Execution paused by user.' : 'Execution resumed.', 'low');
  }

  emergencyStop() {
    this.isRunning = false;
    this.isPaused = false;
    this.statusDot?.classList.remove('running');
    if (this.pauseBtn) {
      this.pauseBtn.disabled = true;
      this.pauseBtn.textContent = 'Pause';
    }
    if (this.runBtn) this.runBtn.disabled = false;
    this.hideHandoff();
    this.appendLog('ABORT', 'Emergency stop engaged. Agent terminated immediately.', 'high');
  }

  triggerHandoff(title, description) {
    if (this.handoffBanner) {
      this.handoffBanner.classList.remove('hidden');
      const titleEl = this.doc.getElementById('handoff-title');
      const descEl = this.doc.getElementById('handoff-desc');
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = description;
    }
    this.appendLog('HANDOFF', `Human action requested: ${title}`, 'high');
  }

  hideHandoff() {
    if (this.handoffBanner) {
      this.handoffBanner.classList.add('hidden');
    }
  }

  resolveHandoff() {
    this.hideHandoff();
    this.appendLog('RESUME', 'Human verification completed. Resuming autonomous flow.', 'low');
  }

  startVoiceInput() {
    const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.appendLog('NOTICE', 'Voice input (Web Speech API) not supported on this host.', 'low');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        this.voiceBtn?.classList.add('recording');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript && this.taskInput) {
          this.taskInput.value = transcript;
        }
      };

      recognition.onerror = (event) => {
        this.appendLog('ERROR', `Voice recognition error: ${event.error}`, 'medium');
      };

      recognition.onend = () => {
        this.voiceBtn?.classList.remove('recording');
      };

      recognition.start();
    } catch (err) {
      this.appendLog('ERROR', `Failed to start voice listener: ${err.message}`, 'medium');
    }
  }

  appendLog(action, targetDesc, risk = 'low') {
    if (!this.actionStream) return;

    const entry = this.doc.createElement('div');
    entry.className = `log-entry ${risk === 'high' ? 'high-risk' : ''}`;

    const header = this.doc.createElement('div');
    header.className = 'log-header';

    const actionSpan = this.doc.createElement('span');
    actionSpan.className = 'log-action';
    actionSpan.textContent = action;

    const timeSpan = this.doc.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = new Date().toLocaleTimeString();

    header.appendChild(actionSpan);
    header.appendChild(timeSpan);

    const targetDiv = this.doc.createElement('div');
    targetDiv.className = 'log-target';
    targetDiv.textContent = targetDesc;

    entry.appendChild(header);
    entry.appendChild(targetDiv);

    this.actionStream.appendChild(entry);
    this.actionStream.scrollTop = this.actionStream.scrollHeight;
  }
}

// Auto-bootstrap in browser document context
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new SidePanelController(document);
  });
}
