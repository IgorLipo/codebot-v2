/**
 * Code Editor module — Python execution via Pyodide with input() dialog support.
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
  let hasShownRunHint = false;

  function init() {
    textarea = document.getElementById('code-editor');
    outputEl = document.getElementById('code-output');
    outputTextEl = document.getElementById('code-output-text');
    panel = document.getElementById('code-panel');

    textarea.addEventListener('keydown', handleTab);
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
    if (window.innerWidth > 768) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 250) + 'px';
  }

  function setCode(code) {
    if (!textarea) return;
    textarea.value = code;
    show();

    // Pulse the Run button to draw attention on first code drop
    if (!hasShownRunHint) {
      hasShownRunHint = true;
      const runBtn = document.getElementById('run-code-btn');
      if (runBtn) {
        runBtn.classList.add('pulse-hint');
        setTimeout(() => runBtn.classList.remove('pulse-hint'), 3000);
      }
    }

    // Flash the panel border
    panel.style.transition = 'none';
    panel.style.boxShadow = '0 0 0 2px var(--accent)';
    setTimeout(() => {
      panel.style.transition = 'box-shadow 0.5s';
      panel.style.boxShadow = 'none';
    }, 100);
  }

  function getCode() { return textarea?.value || ''; }

  function clear() {
    if (textarea) textarea.value = '';
    hideOutput();
  }

  function show() { panel?.classList.remove('collapsed'); }
  function hide() { panel?.classList.add('collapsed'); }
  function toggle() { panel?.classList.toggle('collapsed'); }
  function isVisible() { return panel && !panel.classList.contains('collapsed'); }

  // ===== PYODIDE PYTHON EXECUTION =====
  async function loadPyodideEnv() {
    if (pyodideReady || pyodideLoading) return;
    pyodideLoading = true;
    showOutput('⏳ Loading Python environment (first time only)...');

    const PYODIDE_VERSION = '0.27.6';
    const CDN_URLS = [
      `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`,
      `https://cdnjs.cloudflare.com/ajax/libs/pyodide/${PYODIDE_VERSION}/pyodide.min.js`,
    ];

    try {
      // Try each CDN until one works
      let loaded = false;
      for (const url of CDN_URLS) {
        try {
          const script = document.createElement('script');
          script.src = url;
          document.head.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            setTimeout(reject, 15000); // 15s timeout per CDN
          });
          loaded = true;
          break;
        } catch (_) {
          // Try next CDN
        }
      }
      if (!loaded) throw new Error('All CDNs failed');

      pyodide = await loadPyodide({
        indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
      });

      // Patch input() to use browser prompt dialog
      pyodide.runPython(`
import builtins
from js import prompt as js_prompt

def _patched_input(text=""):
    result = js_prompt(str(text))
    if result is None:
        return ""
    return result

builtins.input = _patched_input
      `);

      pyodideReady = true;
      pyodideLoading = false;
      showOutput('✓ Python ready! Tap Run to execute your code.');
    } catch (err) {
      pyodideLoading = false;
      showOutput('Could not load Python. You need internet the first time (it downloads about 10MB and then gets cached for offline use).');
    }
  }

  async function run() {
    const code = getCode().trim();
    if (!code) {
      showOutput('Write some code first, then tap Run!');
      return;
    }

    show();

    if (!pyodideReady) {
      await loadPyodideEnv();
      if (!pyodideReady) return;
    }

    showOutput('Running...');

    try {
      // Capture stdout and stderr
      pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
      `);

      await pyodide.runPythonAsync(code);

      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      const stderr = pyodide.runPython('sys.stderr.getvalue()');

      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += (output ? '\n' : '') + stderr;
      if (!output) output = '✓ Code ran! No output to show (try adding a print statement).';

      showOutput(output);
    } catch (err) {
      const friendlyError = makeFriendlyError(err.message || String(err));
      showOutput(friendlyError);
    }
  }

  // Turn raw Python errors into kid-friendly messages
  function makeFriendlyError(errMsg) {
    // Extract the actual error line
    const lines = errMsg.split('\n');
    const errorLine = lines.find(l => l.match(/Error:/)) || lines[lines.length - 1];

    if (errMsg.includes('SyntaxError')) {
      if (errMsg.includes('EOL') || errMsg.includes('unterminated string')) {
        return '🔍 Hmm, looks like you forgot to close a quote mark. Check your text has matching " " around it.';
      }
      if (errMsg.includes('unexpected indent')) {
        return '🔍 There\'s an extra space at the start of a line. Make sure your lines start at the left edge.';
      }
      if (errMsg.includes('invalid syntax')) {
        return '🔍 Something doesn\'t look right to Python. Double check for typos, missing colons, or mismatched brackets.\n\nDetails: ' + errorLine;
      }
      return '🔍 Python found a spelling or grammar mistake in your code.\n\nDetails: ' + errorLine;
    }

    if (errMsg.includes('NameError')) {
      const varMatch = errMsg.match(/name '(\w+)' is not defined/);
      if (varMatch) {
        return `🔍 Python doesn't recognise "${varMatch[1]}". Check the spelling, or maybe you need to create it first with something like: ${varMatch[1]} = "something"`;
      }
      return '🔍 Python doesn\'t recognise a name you used. Check your spelling!\n\nDetails: ' + errorLine;
    }

    if (errMsg.includes('TypeError')) {
      if (errMsg.includes('can only concatenate str')) {
        return '🔍 You\'re trying to mix text and numbers. Try wrapping the number in str() like: str(your_number)';
      }
      return '🔍 You mixed up types — like trying to add text to a number.\n\nDetails: ' + errorLine;
    }

    if (errMsg.includes('IndentationError')) {
      return '🔍 Check your spacing! Python is fussy about spaces at the start of lines. Make sure related lines have the same spacing.';
    }

    if (errMsg.includes('ZeroDivisionError')) {
      return '🔍 You tried to divide by zero! Even computers can\'t do that one.';
    }

    // Generic fallback
    return '❌ Error:\n' + errorLine + '\n\nTell CodeBot what the error says and we\'ll fix it together!';
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
    init, setCode, getCode, clear, show, hide, toggle, isVisible, run,
  };
})();
