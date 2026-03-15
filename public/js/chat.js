/**
 * Chat module — handles messaging with the Ollama backend via SSE streaming.
 */

const Chat = (() => {
  const SESSION_ID = 'ryan-' + Date.now().toString(36);
  let messagesContainer = null;
  let isStreaming = false;
  let onCodeDetected = null;
  let onXPUpdate = null;
  let onResponseComplete = null;

  function init(container) {
    messagesContainer = container;
  }

  // Send a message and stream the response
  async function send(text) {
    if (!text.trim() || isStreaming) return;
    isStreaming = true;

    // Add user bubble
    addMessage('user', text);

    // Add bot placeholder with typing indicator
    const botEl = addMessage('bot', '', true);
    const contentEl = botEl.querySelector('.message-content');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: SESSION_ID, message: text }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.error) {
              contentEl.textContent = data.error;
              isStreaming = false;
              return;
            }

            if (data.token) {
              fullResponse += data.token;
              renderBotContent(contentEl, fullResponse);
              scrollToBottom();
            }

            if (data.done) {
              if (data.xp !== undefined && onXPUpdate) {
                onXPUpdate(data.xp, data.level);
              }
            }
          } catch (e) { /* skip malformed JSON */ }
        }
      }

      // Extract code blocks and send to editor
      extractAndSendCode(fullResponse);

      // Signal response complete (for voice to read aloud)
      if (onResponseComplete) onResponseComplete(fullResponse);

    } catch (err) {
      contentEl.textContent = `Connection error: ${err.message}. Make sure the server and Ollama are running.`;
    }

    isStreaming = false;
  }

  function addMessage(role, text, isStreaming = false) {
    const el = document.createElement('div');
    el.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'bot' ? '🤖' : 'R';

    const content = document.createElement('div');
    content.className = 'message-content';

    if (isStreaming) {
      content.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else {
      content.textContent = text;
    }

    el.appendChild(avatar);
    el.appendChild(content);
    messagesContainer.appendChild(el);
    scrollToBottom();
    return el;
  }

  function renderBotContent(el, text) {
    // Remove typing indicator if present
    const typing = el.querySelector('.typing-indicator');
    if (typing) typing.remove();

    // Simple rendering: preserve line breaks, bold, inline code
    let html = escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');

    el.innerHTML = html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function extractAndSendCode(text) {
    // Match ```code ... ``` or ```python ... ``` or ``` ... ```
    const codeBlockRegex = /```(?:code|python|py)?\s*\n?([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const code = match[1].trim();
      if (code && onCodeDetected) {
        onCodeDetected(code);
      }
    }
  }

  function scrollToBottom() {
    if (!messagesContainer) return;
    const chatArea = messagesContainer.closest('.chat-area');
    if (chatArea) {
      requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
      });
    }
  }

  async function reset() {
    try {
      await fetch(`/api/session/${SESSION_ID}/reset`, { method: 'POST' });
    } catch (_) {}
    if (messagesContainer) messagesContainer.innerHTML = '';
  }

  // Public API
  return {
    init,
    send,
    reset,
    addMessage,
    get isStreaming() { return isStreaming; },
    get sessionId() { return SESSION_ID; },
    onCodeDetected(cb) { onCodeDetected = cb; },
    onXPUpdate(cb) { onXPUpdate = cb; },
    onResponseComplete(cb) { onResponseComplete = cb; },
  };
})();
