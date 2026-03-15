# 🤖 CodeBot V3 — Voice-First AI Coding Tutor

A fully local, voice-driven AI coding tutor built for Ryan. Everything runs on your machine — no cloud APIs, no subscriptions, no data leaving your device.

## What It Does

- **Voice conversation** — Ryan talks to CodeBot using the microphone, CodeBot talks back using high-quality local TTS. Typing is only needed for actual code.
- **Smart assessment** — CodeBot chats with Ryan first to gauge his level before jumping into code. No overwhelming first session.
- **Hobby-themed curriculum** — Lessons themed around Maccabi Tel Aviv, Roblox, Fortnite, Plants vs Zombies, FC 26, and Brawl Stars.
- **The Everest Files integration** — Coding projects based on the book Ryan is reading at school.
- **Mobile-friendly code editor** — Runs Python code directly in the browser (via Pyodide). Works great on phones and tablets with big touch targets.
- **Gamified progression** — XP system, 10 badges, 6 quest worlds.

## Architecture

| Component | Technology | Runs |
|-----------|-----------|------|
| AI Brain | **Ollama** + Llama 3.1 8B | Locally on your Mac |
| Speech-to-Text | **Web Speech API** (browser native) | In the browser |
| Text-to-Speech | **Kokoro TTS** (Docker) with browser fallback | Locally on your Mac |
| Code Execution | **Pyodide** (Python in WebAssembly) | In the browser |
| Server | **Node.js + Express** | Locally on your Mac |
| Frontend | **Vanilla HTML/CSS/JS** | In the browser |

**Zero cloud dependencies once set up.** The only internet needed is the first time Pyodide loads (~10MB, then cached).

---

## Quick Setup (Mac)

### Prerequisites

1. **Node.js 18+** — Download from [nodejs.org](https://nodejs.org/) or:
   ```bash
   brew install node
   ```

2. **Ollama** — Install from [ollama.com](https://ollama.com/) or:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

3. **Pull the AI model** (one time, ~4.7GB download):
   ```bash
   ollama pull llama3.1:8b
   ```

4. **Docker** (for high-quality voice) — Install from [docker.com](https://www.docker.com/products/docker-desktop/) or:
   ```bash
   brew install --cask docker
   ```

### Install & Run

```bash
# Clone the repo
git clone https://github.com/IgorLipo/codebot-v2.git
cd codebot-v2

# Install dependencies
npm install

# Make sure Ollama is running
ollama serve

# Start Kokoro TTS (high-quality voice — run once, Docker keeps it)
docker run -d -p 8880:8880 --name kokoro-tts ghcr.io/remsky/kokoro-fastapi-cpu:latest

# Start CodeBot (in a new terminal tab)
npm start
```

Open **http://localhost:3000** in Chrome or Edge.

That's it. Talk to CodeBot.

---

## Voice Setup — Kokoro TTS

CodeBot V3 uses **Kokoro TTS** for high-quality, near-human voice. It runs locally via Docker and sounds dramatically better than the old browser voices.

### First Time Setup

```bash
# Pull and start Kokoro (one-time ~1GB download)
docker run -d -p 8880:8880 --name kokoro-tts ghcr.io/remsky/kokoro-fastapi-cpu:latest
```

### After That

Kokoro auto-starts with Docker. If you need to restart it manually:

```bash
# Check if it's running
docker ps | grep kokoro

# Start it if stopped
docker start kokoro-tts

# Or restart it
docker restart kokoro-tts
```

### Voice Details

- **Voice**: `bf_emma` — British female, warm and natural
- **Speed**: 1.05x (slightly faster for conversational feel)
- **Fallback**: If Kokoro isn't running, CodeBot automatically falls back to the browser's built-in SpeechSynthesis (still works, just lower quality)
- **No internet needed** after initial Docker image download

### Troubleshooting Voice

| Problem | Solution |
|---------|----------|
| Voice sounds robotic/old | Make sure Docker is running and Kokoro container is started |
| "Kokoro TTS not found" in console | Run `docker start kokoro-tts` |
| Docker not installed | Install from [docker.com](https://www.docker.com/products/docker-desktop/) |
| Container doesn't exist | Run the `docker run` command from First Time Setup above |

---

## Setup on Ryan's MacBook

1. Install **Node.js**: `brew install node` (or download from nodejs.org)
2. Install **Ollama**: Download from [ollama.com](https://ollama.com/)
3. Install **Docker Desktop**: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
4. Open Terminal and run:
   ```bash
   # Pull the AI model
   ollama pull llama3.1:8b

   # Start Kokoro TTS voice
   docker run -d -p 8880:8880 --name kokoro-tts ghcr.io/remsky/kokoro-fastapi-cpu:latest
   ```
5. Clone the repo:
   ```bash
   git clone https://github.com/IgorLipo/codebot-v2.git ~/codebot-v2
   cd ~/codebot-v2
   npm install
   ```
6. Start it:
   ```bash
   # Terminal tab 1:
   ollama serve

   # Terminal tab 2:
   cd ~/codebot-v2
   npm start
   ```
7. Open Chrome → `http://localhost:3000`

### Make It Even Easier — Desktop Shortcut (Optional)

Create a file `~/start-codebot.command`:
```bash
#!/bin/bash
cd ~/codebot-v2
ollama serve &
sleep 2
docker start kokoro-tts 2>/dev/null || docker run -d -p 8880:8880 --name kokoro-tts ghcr.io/remsky/kokoro-fastapi-cpu:latest
sleep 3
npm start &
sleep 2
open http://localhost:3000
wait
```
Then run `chmod +x ~/start-codebot.command`. Double-click it to launch CodeBot.

---

## Configuration

### Change the AI Model

For faster responses on older Macs, use a smaller model:

```bash
# Lighter option (~2GB):
ollama pull llama3.2:3b

# Then set the environment variable:
OLLAMA_MODEL=llama3.2:3b npm start
```

For smarter responses on powerful Macs (M2/M3 Pro with 16GB+ RAM):

```bash
ollama pull llama3.1:70b
OLLAMA_MODEL=llama3.1:70b npm start
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Web server port |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama API address |
| `OLLAMA_MODEL` | `llama3.1:8b` | Which model to use |

---

## Voice Notes

### Speech-to-Text (Listening)
- Uses the browser's built-in **Web Speech API**
- Works best in **Chrome** and **Edge**
- Chrome routes audio through Google's servers for recognition. For fully offline STT, see the Whisper section below.
- Safari has limited support; Firefox doesn't support it yet.

### Text-to-Speech (Speaking)
- **Primary**: Kokoro TTS via Docker — near-human quality, fully local
- **Fallback**: Browser SpeechSynthesis API (if Kokoro isn't running)
- On macOS the browser fallback uses "Daniel" or "Samantha" voices

### Fully Offline STT with Whisper (Advanced)

If you want 100% offline speech recognition, you can run Whisper locally. This is optional — the Web Speech API works great for most use cases.

```bash
# Install whisper.cpp (Mac)
brew install whisper-cpp

# Or use the Python whisper:
pip install openai-whisper
```

Then you'd need to add a local Whisper endpoint to the server. This is a more advanced setup — the Web Speech API is recommended for simplicity.

---

## What Changed in V3

- **Kokoro TTS** — Replaced old browser SpeechSynthesis with near-human quality local voice via Docker
- **7-Step Assessment** — CodeBot now chats casually with Ryan before any coding to gauge his level
- **Absolute Beginner Path** — Step-by-step lesson sequence (print → variables → numbers → input → boss challenge) with exact guidance
- **Fixed Code Editor** — `input()` now works via popup dialog, Run button pulses on first code, friendly error messages
- **Mobile Improvements** — Bigger mic button (52px), bigger send button (44px), larger code font (14px), connection banner at top
- **Voice-First Enforcement** — Strict 3-sentence limit, no markdown/bullets, always ends with a question
- **No More Terminal References** — CodeBot will never tell Ryan to open Terminal or install Python

---

## Project Structure

```
codebot-v2/
├── package.json          # Dependencies & scripts
├── README.md             # This file
├── SYSTEM_PROMPT.md      # CodeBot's prompt (standalone, portable)
├── server/
│   ├── index.js          # Express server — connects to Ollama
│   └── system-prompt.js  # CodeBot's personality & curriculum
├── public/
│   ├── index.html        # Main page
│   ├── css/
│   │   └── style.css     # All styles (dark/light theme, mobile-first)
│   └── js/
│       ├── app.js        # Main controller
│       ├── chat.js       # Chat messaging & streaming
│       ├── editor.js     # Code editor & Python execution
│       └── voice.js      # Speech recognition & Kokoro TTS
└── .gitignore
```

---

## Git Sync

```bash
cd codebot-v2

# Initial setup
git init
git add .
git commit -m "CodeBot V3 — voice-first AI tutor"
git remote add origin https://github.com/IgorLipo/codebot-v2.git
git push -u origin main
```

On Ryan's Mac:
```bash
git clone https://github.com/IgorLipo/codebot-v2.git ~/codebot-v2
cd ~/codebot-v2
npm install
```

To sync updates:
```bash
# On your machine (after changes):
git add . && git commit -m "update" && git push

# On Ryan's Mac:
cd ~/codebot-v2 && git pull && npm install
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Can't reach Ollama" | Run `ollama serve` in a terminal |
| "Model not found" | Run `ollama pull llama3.1:8b` |
| Voice sounds bad/robotic | Make sure Docker is running and `docker start kokoro-tts` |
| Voice doesn't work at all | Use Chrome or Edge. Check mic permissions. |
| Slow responses | Try a smaller model: `OLLAMA_MODEL=llama3.2:3b npm start` |
| Code editor not showing | Tap the `</>` button next to the text input |
| Python not running | First run needs internet to download Pyodide (~10MB, cached after) |
| input() not working | Should show a popup dialog. If not, check you're using Chrome. |
| Docker won't start | Open Docker Desktop app first, then try `docker start kokoro-tts` |

---

## Licence

Personal use for Ryan's education. Built with love. 🚀
