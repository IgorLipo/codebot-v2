/**
 * Voice module — Speech Recognition (STT) + Text-to-Speech (TTS)
 *
 * TTS priority:
 *   1. Kokoro TTS (local Docker at localhost:8880) — near-human quality
 *   2. Browser SpeechSynthesis API — fallback if Kokoro isn't running
 *
 * STT: Web Speech API (Chrome/Edge)
 */

const Voice = (() => {
  // ===== STATE =====
  let recognition = null;
  let synth = window.speechSynthesis;
  let isListening = false;
  let isSpeaking = false;
  let selectedVoice = null;
  let voicesLoaded = false;
  let onResultCallback = null;
  let onStatusCallback = null;
  let currentAudio = null;

  // Speech queue for streaming TTS
  const speechQueue = [];
  let isProcessingQueue = false;
  let onQueueDrained = null; // Called when queue is empty and last item finishes

  // Kokoro TTS config
  const KOKORO_BASE = 'http://localhost:8880';
  const KOKORO_VOICE = 'bf_emma'; // British female, warm and natural
  let kokoroAvailable = null; // null = untested, true/false after check

  // ===== INIT =====
  function init() {
    initRecognition();
    loadBrowserVoices();
    checkKokoro();
    if (synth) {
      synth.addEventListener('voiceschanged', loadBrowserVoices);
    }
  }

  // Check if Kokoro TTS is running
  async function checkKokoro() {
    try {
      const res = await fetch(`${KOKORO_BASE}/v1/models`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        kokoroAvailable = true;
        console.log('[Voice] Kokoro TTS available — using high-quality voice');
      } else {
        kokoroAvailable = false;
      }
    } catch (e) {
      kokoroAvailable = false;
      console.log('[Voice] Kokoro TTS not found — falling back to browser voice');
    }
  }

  function loadBrowserVoices() {
    if (!synth) return;
    const voices = synth.getVoices();
    if (voices.length === 0) return;
    voicesLoaded = true;

    const preferred = [
      'Google UK English Male', 'Google UK English Female',
      'Daniel', 'Samantha', 'Karen', 'Alex',
      'Microsoft Ryan', 'Microsoft Libby',
    ];

    for (const name of preferred) {
      const match = voices.find(v => v.name.includes(name));
      if (match) { selectedVoice = match; break; }
    }

    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    }
    console.log(`[Voice] Browser TTS voice: ${selectedVoice?.name}`);
  }

  // ===== SPEECH RECOGNITION (STT) =====
  function initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Voice] Speech Recognition not supported');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      if (finalText && onResultCallback) onResultCallback(finalText.trim(), true);
      else if (interimText && onResultCallback) onResultCallback(interimText.trim(), false);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setListening(false);
        return;
      }
      console.warn('[Voice] Recognition error:', event.error);
      setListening(false);
      if (onStatusCallback) onStatusCallback('error', event.error);
    };

    recognition.onend = () => setListening(false);
  }

  function startListening() {
    if (!recognition) {
      if (onStatusCallback) onStatusCallback('unsupported');
      return;
    }
    stopSpeaking(); // Stop TTS if playing
    try {
      recognition.start();
      setListening(true);
    } catch (e) {
      recognition.stop();
      setTimeout(() => {
        try { recognition.start(); setListening(true); } catch (_) {}
      }, 100);
    }
  }

  function stopListening() {
    if (recognition && isListening) {
      recognition.stop();
      setListening(false);
    }
  }

  function toggleListening() {
    isListening ? stopListening() : startListening();
  }

  function setListening(val) {
    isListening = val;
    if (onStatusCallback) onStatusCallback(val ? 'listening' : 'idle');
  }

  // ===== TEXT-TO-SPEECH =====
  function speak(text, onEnd) {
    if (!text) { onEnd?.(); return; }

    // Clean text for speech — strip code blocks and markdown
    const cleaned = text
      .replace(/```[\s\S]*?```/g, '... check the code editor ...')
      .replace(/`[^`]+`/g, (m) => m.replace(/`/g, ''))
      .replace(/[#*_~]/g, '')
      .trim();

    if (!cleaned) { onEnd?.(); return; }

    // Try Kokoro first, fall back to browser
    if (kokoroAvailable) {
      speakWithKokoro(cleaned, onEnd);
    } else {
      speakWithBrowser(cleaned, onEnd);
    }
  }

  // Queue a sentence for streaming speech — sentences play in order
  function queueSpeak(text) {
    if (!text || !text.trim()) return;
    const cleaned = text.replace(/[#*_~]/g, '').trim();
    if (!cleaned) return;

    speechQueue.push(cleaned);
    if (!isProcessingQueue) {
      processQueue();
    }
  }

  // Process the speech queue one item at a time
  async function processQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (speechQueue.length > 0) {
      const text = speechQueue.shift();
      await new Promise((resolve) => {
        if (kokoroAvailable) {
          speakWithKokoro(text, resolve);
        } else {
          speakWithBrowser(text, resolve);
        }
      });
    }

    isProcessingQueue = false;
    isSpeaking = false;
    onQueueDrained?.();
    onQueueDrained = null;
  }

  // Flush queue — called when streaming is done, fires callback after last sentence
  function onQueueEmpty(cb) {
    if (!isProcessingQueue && speechQueue.length === 0) {
      cb?.();
    } else {
      onQueueDrained = cb;
    }
  }

  function clearQueue() {
    speechQueue.length = 0;
    onQueueDrained = null;
  }

  // ===== KOKORO TTS =====
  async function speakWithKokoro(text, onEnd) {
    isSpeaking = true;

    try {
      const res = await fetch(`${KOKORO_BASE}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'kokoro',
          input: text,
          voice: KOKORO_VOICE,
          response_format: 'mp3',
          speed: 1.05,
        }),
      });

      if (!res.ok) throw new Error(`Kokoro error: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }

      currentAudio = new Audio(url);
      currentAudio.onended = () => {
        isSpeaking = false;
        URL.revokeObjectURL(url);
        currentAudio = null;
        onEnd?.();
      };
      currentAudio.onerror = () => {
        isSpeaking = false;
        URL.revokeObjectURL(url);
        currentAudio = null;
        // Fallback to browser on error
        speakWithBrowser(text, onEnd);
      };
      currentAudio.play();

    } catch (err) {
      console.warn('[Voice] Kokoro failed, falling back to browser TTS:', err.message);
      kokoroAvailable = false; // Don't retry Kokoro this session
      isSpeaking = false;
      speakWithBrowser(text, onEnd);
    }
  }

  // ===== BROWSER SPEECHSYNTHESIS (FALLBACK) =====
  function speakWithBrowser(text, onEnd) {
    if (!synth) { onEnd?.(); return; }
    synth.cancel();

    const chunks = splitIntoChunks(text, 180);
    let index = 0;
    isSpeaking = true;

    function speakNext() {
      if (index >= chunks.length || !isSpeaking) {
        isSpeaking = false;
        onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => { index++; speakNext(); };
      utterance.onerror = () => { isSpeaking = false; onEnd?.(); };

      synth.speak(utterance);
    }

    speakNext();
  }

  function stopSpeaking() {
    isSpeaking = false;
    clearQueue();
    isProcessingQueue = false;
    // Stop Kokoro audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.onended = null;
      currentAudio = null;
    }
    // Stop browser speech
    if (synth) synth.cancel();
  }

  function splitIntoChunks(text, maxLen) {
    const sentences = text.match(/[^.!?]+[.!?]?\s*/g) || [text];
    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
      if ((current + sentence).length > maxLen && current) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  // ===== PUBLIC API =====
  return {
    init,
    startListening,
    stopListening,
    toggleListening,
    speak,
    queueSpeak,
    onQueueEmpty,
    clearQueue,
    stopSpeaking,
    get isListening() { return isListening; },
    get isSpeaking() { return isSpeaking; },
    get isSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
    get ttsSupported() { return !!window.speechSynthesis; },
    get usingKokoro() { return kokoroAvailable === true; },
    onResult(cb) { onResultCallback = cb; },
    onStatus(cb) { onStatusCallback = cb; },
  };
})();
