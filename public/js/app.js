/**
 * App — Main controller. Wires together Voice, Chat, Editor, and UI.
 */

(function () {
  // ===== DOM REFS =====
  const messagesEl = document.getElementById('messages');
  const textInput = document.getElementById('text-input');
  const sendBtn = document.getElementById('send-btn');
  const voiceBtn = document.getElementById('voice-btn');
  const voiceStatus = document.getElementById('voice-status');
  const voiceStatusText = voiceStatus?.querySelector('.voice-status-text');
  const codeToggleBtn = document.getElementById('code-toggle-btn');
  const toggleCodeBtn = document.getElementById('toggle-code-btn');
  const runCodeBtn = document.getElementById('run-code-btn');
  const clearCodeBtn = document.getElementById('clear-code-btn');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const themeToggle = document.getElementById('theme-toggle');
  const newSessionBtn = document.getElementById('new-session-btn');
  const xpValueEl = document.getElementById('xp-value');
  const levelValueEl = document.getElementById('level-value');
  const xpBarFill = document.getElementById('xp-bar-fill');
  const xpBarLabel = document.getElementById('xp-bar-label');
  const xpPopup = document.getElementById('xp-popup');
  const connectionBanner = document.getElementById('connection-banner');
  const connectionText = document.getElementById('connection-text');
  const connectionDismiss = document.getElementById('connection-dismiss');

  let currentXP = 0;
  let currentLevel = 1;
  let serverReady = false;

  // ===== INIT =====
  function init() {
    Chat.init(messagesEl);
    Editor.init();
    Voice.init();

    setupEventListeners();
    setupVoiceCallbacks();
    setupChatCallbacks();
    loadTheme();
    checkConnection();
    setupStartScreen();
  }

  // ===== START SCREEN (unlocks audio) =====
  function setupStartScreen() {
    const startScreen = document.getElementById('start-screen');
    if (!startScreen) return;

    startScreen.addEventListener('click', () => {
      // Play a silent audio to unlock browser audio context
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);

      // Fade out start screen
      startScreen.style.transition = 'opacity 0.3s';
      startScreen.style.opacity = '0';
      setTimeout(() => startScreen.remove(), 300);

      // Now trigger the greeting if server is ready
      if (serverReady) {
        setTimeout(() => {
          Chat.send('Hi! I just opened CodeBot for the first time.');
        }, 400);
      }
    }, { once: true });
  }

  // ===== EVENT LISTENERS =====
  function setupEventListeners() {
    sendBtn.addEventListener('click', sendTextMessage);
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendTextMessage();
      }
    });

    textInput.addEventListener('input', () => {
      textInput.style.height = 'auto';
      textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
    });

    // Voice button — tap to toggle
    voiceBtn.addEventListener('click', () => {
      Voice.toggleListening();
    });

    // Code editor toggles
    codeToggleBtn?.addEventListener('click', () => Editor.toggle());
    toggleCodeBtn?.addEventListener('click', () => Editor.toggle());
    runCodeBtn?.addEventListener('click', () => Editor.run());
    clearCodeBtn?.addEventListener('click', () => Editor.clear());

    // Sidebar
    sidebarToggle?.addEventListener('click', toggleSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // Theme
    themeToggle?.addEventListener('click', toggleTheme);

    // New session
    newSessionBtn?.addEventListener('click', async () => {
      if (confirm('Start a new session? This will reset all progress.')) {
        await Chat.reset();
        currentXP = 0;
        currentLevel = 1;
        updateXPDisplay();
        Editor.clear();
        // Trigger CodeBot's assessment greeting
        Chat.send('Hi! I just started CodeBot for the first time.');
      }
    });

    connectionDismiss?.addEventListener('click', () => {
      connectionBanner.classList.add('hidden');
    });
  }

  // ===== VOICE CALLBACKS =====
  function setupVoiceCallbacks() {
    Voice.onResult((text, isFinal) => {
      if (isFinal) {
        textInput.value = '';
        Chat.send(text);
      } else {
        textInput.value = text;
      }
    });

    Voice.onStatus((status, detail) => {
      switch (status) {
        case 'listening':
          voiceBtn.classList.add('active');
          voiceStatus.classList.remove('hidden');
          if (voiceStatusText) voiceStatusText.textContent = 'Listening...';
          break;
        case 'idle':
          voiceBtn.classList.remove('active');
          voiceStatus.classList.add('hidden');
          break;
        case 'error':
          voiceBtn.classList.remove('active');
          voiceStatus.classList.add('hidden');
          if (detail === 'not-allowed') {
            alert('Microphone access denied. Please allow microphone access in your browser settings.');
          }
          break;
        case 'unsupported':
          voiceBtn.style.opacity = '0.4';
          voiceBtn.title = 'Voice not supported in this browser. Use Chrome or Edge.';
          break;
      }
    });
  }

  // ===== CHAT CALLBACKS =====
  function setupChatCallbacks() {
    Chat.onCodeDetected((code) => {
      Editor.setCode(code);
    });

    // When Ryan runs code, auto-send result to CodeBot
    Editor.onRunComplete(({ code, output, success }) => {
      // Don't send if Chat is already streaming a response
      if (Chat.isStreaming) return;

      // Build a concise context message for CodeBot
      const trimmedCode = code.length > 300 ? code.slice(0, 300) + '...' : code;
      const trimmedOutput = output.length > 200 ? output.slice(0, 200) + '...' : output;

      let msg;
      if (success) {
        msg = `[Ryan ran this code]\n${trimmedCode}\n[Output]\n${trimmedOutput}`;
      } else {
        msg = `[Ryan ran this code and got an error]\n${trimmedCode}\n[Error]\n${trimmedOutput}`;
      }

      // Small delay so the output panel settles first
      setTimeout(() => Chat.send(msg), 600);
    });

    Chat.onXPUpdate((xp, level) => {
      const gained = xp - currentXP;
      currentXP = xp;
      currentLevel = level;
      updateXPDisplay();
      if (gained > 0) showXPPopup(gained);
    });

    // Stream speech: speak sentences as they arrive during streaming
    Chat.onSentenceReady((sentence) => {
      Voice.queueSpeak(sentence);
    });

    // When streaming is fully done, wait for speech queue to drain then show mic hint
    Chat.onResponseComplete(() => {
      Voice.onQueueEmpty(() => {
        if (Voice.isSupported) {
          if (voiceStatusText) voiceStatusText.textContent = 'Tap mic to reply';
          voiceStatus.classList.remove('hidden');
          setTimeout(() => {
            if (!Voice.isListening) voiceStatus.classList.add('hidden');
          }, 3000);
        }
      });
    });
  }

  // ===== ACTIONS =====
  function sendTextMessage() {
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = '';
    textInput.style.height = 'auto';
    Chat.send(text);
    if (Voice.isListening) Voice.stopListening();
  }

  // ===== XP =====
  function updateXPDisplay() {
    if (xpValueEl) xpValueEl.textContent = currentXP;
    if (levelValueEl) levelValueEl.textContent = currentLevel;
    const xpInLevel = currentXP % 1000;
    const percent = (xpInLevel / 1000) * 100;
    if (xpBarFill) xpBarFill.style.width = percent + '%';
    if (xpBarLabel) xpBarLabel.textContent = `${xpInLevel} / 1000 XP`;
  }

  function showXPPopup(amount) {
    if (!xpPopup) return;
    xpPopup.textContent = `+${amount} XP`;
    xpPopup.classList.remove('hidden');
    xpPopup.classList.add('show');
    setTimeout(() => {
      xpPopup.classList.remove('show');
      setTimeout(() => xpPopup.classList.add('hidden'), 400);
    }, 1500);
  }

  // ===== SIDEBAR =====
  function toggleSidebar() {
    sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('visible');
  }
  function closeSidebar() {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('visible');
  }

  // ===== THEME =====
  function loadTheme() { applyTheme('dark'); }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'light' ? 'dark' : 'light');
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const sun = document.getElementById('theme-icon-sun');
    const moon = document.getElementById('theme-icon-moon');
    if (sun && moon) {
      sun.style.display = theme === 'light' ? 'none' : 'block';
      moon.style.display = theme === 'light' ? 'block' : 'none';
    }
  }

  // ===== CONNECTION CHECK =====
  async function checkConnection() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();

      if (data.status === 'error') {
        showConnectionBanner(
          `Can't reach Ollama at ${data.ollamaHost}. Run "ollama serve" in your terminal.`,
          true
        );
      } else if (!data.modelReady) {
        showConnectionBanner(
          `Model "${data.model}" not found. Run "ollama pull ${data.model}" first.`,
          true
        );
      } else {
        // Server is good — mark ready, greeting will fire after start screen tap
        serverReady = true;
      }
    } catch (err) {
      showConnectionBanner(
        'Cannot reach CodeBot server. Make sure "npm start" is running.',
        true
      );
    }
  }

  function showConnectionBanner(text, isError) {
    if (!connectionBanner || !connectionText) return;
    connectionText.textContent = text;
    connectionBanner.classList.remove('hidden');
    if (isError) connectionBanner.classList.add('error');
  }

  // ===== START =====
  document.addEventListener('DOMContentLoaded', init);
})();
