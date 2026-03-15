const express = require('express');
const path = require('path');
const { Ollama } = require('ollama');
const { SYSTEM_PROMPT } = require('./system-prompt');

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

const ollama = new Ollama({ host: OLLAMA_HOST });

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// In-memory session store (resets on server restart)
const sessions = {};

function getSession(id) {
  if (!sessions[id]) {
    sessions[id] = {
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      xp: 0,
      level: 1,
      world: 1,
      mission: 1,
      badges: [],
      createdAt: Date.now()
    };
  }
  return sessions[id];
}

// Chat endpoint — streaming
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const session = getSession(sessionId || 'default');
  session.messages.push({ role: 'user', content: message });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await ollama.chat({
      model: MODEL,
      messages: session.messages,
      stream: true,
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const token = chunk.message?.content || '';
      fullResponse += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }

    session.messages.push({ role: 'assistant', content: fullResponse });

    // Parse XP awards from the response
    const xpMatch = fullResponse.match(/(\d+)\s*XP/gi);
    if (xpMatch) {
      for (const match of xpMatch) {
        const num = parseInt(match);
        if (num > 0 && num <= 500) {
          session.xp += num;
          if (session.xp >= session.level * 1000) {
            session.level++;
          }
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, xp: session.xp, level: session.level })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Ollama error:', err.message);
    res.write(`data: ${JSON.stringify({ error: `Could not reach Ollama. Make sure it's running at ${OLLAMA_HOST} with model "${MODEL}". Error: ${err.message}` })}\n\n`);
    res.end();
  }
});

// Session state
app.get('/api/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  res.json({
    xp: session.xp,
    level: session.level,
    world: session.world,
    mission: session.mission,
    badges: session.badges,
    messageCount: session.messages.length - 1 // exclude system prompt
  });
});

// Reset session
app.post('/api/session/:id/reset', (req, res) => {
  delete sessions[req.params.id];
  res.json({ ok: true });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const models = await ollama.list();
    const available = models.models?.map(m => m.name) || [];
    res.json({
      status: 'ok',
      ollamaHost: OLLAMA_HOST,
      model: MODEL,
      availableModels: available,
      modelReady: available.some(m => m.startsWith(MODEL.split(':')[0]))
    });
  } catch (err) {
    res.json({
      status: 'error',
      ollamaHost: OLLAMA_HOST,
      model: MODEL,
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🤖 CodeBot V2 running at http://localhost:${PORT}`);
  console.log(`   Ollama: ${OLLAMA_HOST}`);
  console.log(`   Model:  ${MODEL}\n`);
});
