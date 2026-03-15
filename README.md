# 🤖 CodeBot V2 — Voice-First AI Coding Tutor

A fully local, voice-driven AI coding tutor built for Ryan. Everything runs on your machine — no cloud APIs, no subscriptions, no data leaving your device.

## What It Does

- **Voice conversation** — Ryan talks to CodeBot using the microphone, CodeBot talks back using text-to-speech. Typing is only needed for actual code.
- **Hobby-themed curriculum** — Lessons themed around Maccabi Tel Aviv, Roblox, Fortnite, Plants vs Zombies, FC 26, and Brawl Stars.
- **The Everest Files integration** — Coding projects based on the book Ryan is reading at school.
- **Mobile-friendly code editor** — Runs Python code directly in the browser (via Pyodide). Works great on phones and tablets.
- **Gamified progression** — XP system, 10 badges, 6 quest worlds.

## Architecture

| Component | Technology | Runs |
|-----------|-----------|------|
| AI Brain | **Ollama** + Llama 3.1 8B | Locally on your Mac |
| Speech-to-Text | **Web Speech API** (browser native) | In the browser |
| Text-to-Speech | **SpeechSynthesis API** (browser native) | In the browser, fully offline |
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

### Install & Run

```bash
# Clone the repo (or copy the folder)
git clone <your-repo-url> codebot-v2
cd codebot-v2

# Install dependencies
npm install

# Make sure Ollama is running
ollama serve

# Start CodeBot (in a new terminal tab)
npm start
```

Open **http://localhost:3000** in Chrome or Edge.

That's it. Talk to CodeBot.

---

## Setup on Ryan's MacBook

1. Install **Node.js**: `brew install node` (or download from nodejs.org)
2. Install **Ollama**: Download from [ollama.com](https://ollama.com/)
3. Open Terminal and run:
   ```bash
   ollama pull llama3.1:8b
   ```
4. Clone the repo:
   ```bash
   git clone <your-repo-url> ~/codebot-v2
   cd ~/codebot-v2
   npm install
   ```
5. Start it:
   ```bash
   # Terminal tab 1:
   ollama serve

   # Terminal tab 2:
   cd ~/codebot-v2
   npm start
   ```
6. Open Chrome → `http://localhost:3000`

### Make It Even Easier — Desktop Shortcut (Optional)

Create a file `~/start-codebot.command`:
```bash
#!/bin/bash
cd ~/codebot-v2
ollama serve &
sleep 2
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
- Uses the browser's built-in **SpeechSynthesis API**
- **Fully offline** — no internet needed
- Automatically picks the best available English voice on your system
- On macOS, "Daniel" or "Samantha" are used. You can install more voices in System Settings → Accessibility → Spoken Content → System Voice → Manage Voices.

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

## Project Structure

```
codebot-v2/
├── package.json          # Dependencies & scripts
├── README.md             # This file
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
│       └── voice.js      # Speech recognition & synthesis
└── .gitignore
```

---

## Git Sync

```bash
cd codebot-v2

# Initial setup
git init
git add .
git commit -m "CodeBot V2 — voice-first AI tutor"
git remote add origin <your-github-repo-url>
git push -u origin main
```

On Ryan's Mac:
```bash
git clone <your-github-repo-url> ~/codebot-v2
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
| Voice doesn't work | Use Chrome or Edge. Check mic permissions. |
| Slow responses | Try a smaller model: `OLLAMA_MODEL=llama3.2:3b npm start` |
| Code editor not showing | Tap the `</>` button next to the text input |
| Python not running | First run needs internet to download Pyodide (~10MB, cached after) |

---

## Licence

Personal use for Ryan's education. Built with love. 🚀
