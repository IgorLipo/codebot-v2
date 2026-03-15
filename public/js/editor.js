/**
 * Code Editor module — lightweight code editor with Python execution via Pyodide.
 * Mobile-friendly with touch support and proper viewport handling.
 */

const Editor = (() => {
  let textarea = null;
  let outputEl = null;
  let outputTextEl = null;
  let panel = null;
  let pyodide = null;
  let pyodideLoading = false;
  let pyodideReady = false;

  function init() {
    textarea = document.getElementById('code-editor');
    outputEl = document.getElementById('code-output');
    outputTextEl = document.getElementById('code-output-text');
    panel = document.getElementById('code-panel');

    // Tab key support in textarea
    textarea.addEventListener('keydown', handleTab);

    // Auto-resize textarea on mobile
    textarea.addEventListener('input', autoResize);
  }

  function handleTab(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 4;
    }
  }

  function autoResize() {
    // Only on mobile
    if (window.innerWidth > 768) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 250) + 'px';
  }

  function setCode(code) {
    if (!textarea) return;
    textarea.value = code;
    show();
    // Flash effect to draw attention
    panel.style.transition = 'none';
    panel.style.boxShadow = '0 0 0 2px var(--accent)';
    setTimeout(() => {
      panel.style.transition = 'box-shadow 0.5s';
      panel.style.boxShadow = 'none';
    }, 100);
  }

  function getCode() {
    return textarea?.value || '';
  }

  function clear() {
    if (textarea) textarea.value = '';
    hideOutput();
  }

  function show() {
    panel?.classList.remove('collapsed');
  }

  function hide() {
    panel?.classList.add('collapsed');
  }

  function toggle() {
    panel?.classList.toggle('collapsed');
  }

  function isVisible() {
    return panel && !panel.classList.contains('collapsed');
  }

  // ===== PYTHON EXECUTION via Pyodide =====
  async function loadPyodide() {
    if (pyodideReady || pyodideLoading) return;
    pyodideLoading = true;
    showOutput('Loading Python environment...');

    try {
      // Dynamically load Pyodide
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
      document.head.appendChild(script);

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });

      pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/' });
      pyodideReady = true;
      pyodideLoading = false;
      showOutput('Python ready! Running your code...');
    } catch (err) {
      pyodideLoading = false;
      showOutput(`Failed to load Python: ${err.message}\n\nTip: You need internet the first time to download the Python runtime (~10MB). After that it's cached.`);
    }
  }

  async function run() {
    const code = getCode().trim();
    if (!code) {
      showOutput('No code to run! Write some Python code first.');
      return;
    }

    show(); // Make sure panel is visible

    if (!pyodideReady) {
      await loadPyodide();
      if (!pyodideReady) return;
    }

    showOutput('Running...');

    try {
      // Capture stdout
      pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
      `);

      // Run user code
      await pyodide.runPythonAsync(code);

      // Get output
      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      const stderr = pyodide.runPython('sys.stderr.getvalue()');

      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += (output ? '\n' : '') + '⚠️ ' + stderr;
      if (!output) output = '✓ Code ran successfully (no output)';

      showOutput(output);
    } catch (err) {
      // Format Python errors nicely
      let errMsg = err.message || String(err);
      // Strip Pyodide internals
      const pyErr = errMsg.match(/(?:File "<exec>",.*\n)?.*Error:.*/s);
      if (pyErr) errMsg = pyErr[0];
      showOutput('❌ Error:\n' + errMsg);
    }
  }

  function showOutput(text) {
    if (!outputEl || !outputTextEl) return;
    outputEl.classList.remove('hidden');
    outputTextEl.textContent = text;
  }

  function hideOutput() {
    outputEl?.classList.add('hidden');
    if (outputTextEl) outputTextEl.textContent = '';
  }

  return {
    init,
    setCode,
    getCode,
    clear,
    show,
    hide,
    toggle,
    isVisible,
    run,
  };
})();
