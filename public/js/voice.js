/**
 * Voice module — Speech Recognition (STT) + Speech Synthesis (TTS)
 * Uses browser-native APIs — zero dependencies, fully offline TTS.
 * STT uses Web Speech API (Chrome/Edge send to Google; Safari has partial support).
 * For fully offline STT, users can install Whisper locally — see README.
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
  let autoRestartAfterSpeech = false;

  // ===== INIT =====
  function init() {
    initRecognition();
    loadVoices();
    // Voices load asynchronously in some browsers
    if (synth) {
      synth.addEventListener('voiceschanged', loadVoices);
    }
  }

  function loadVoices() {
    if (!synth) return;
    const voices = synth.getVoices();
    if (voices.length === 0) return;
    voicesLoaded = true;

    // Prefer a good English voice — prioritise natural-sounding ones
    const preferred = [
      'Google UK English Male',
      'Google UK English Female',
      'Daniel',              // macOS
      'Samantha',            // macOS
      'Alex',                // macOS
      'Karen',               // macOS AU
      'Microsoft Ryan',      // Windows
      'Microsoft Libby',     // Windows UK
    ];

    for (const name of preferred) {
      const match = voices.find(v => v.name.includes(name));
      if (match) { selectedVoice = match; break; }
    }

    // Fallback: any English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    }

    console.log(`[Voice] Selected TTS voice: ${selectedVoice?.name} (${selectedVoice?.lang})`);
  }

  // ===== SPEECH RECOGNITION (STT) =====
  function initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Voice] Speech Recognition not supported in this browser');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;      // Stop after one phrase
    recognition.interimResults = true;   // Show partial results
    recognition.lang = 'en-GB';          // British English for Ryan
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

      if (finalText && onResultCallback) {
        onResultCallback(finalText.trim(), true);
      } else if (interimText && onResultCallback) {
        onResultCallback(interimText.trim(), false);
      }
    };

    recognition.onerror = (event) => {
      console.warn('[Voice] Recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // Not a real error — just no input detected
        setListening(false);
        return;
      }
      setListening(false);
      if (onStatusCallback) onStatusCallback('error', event.error);
    };

    recognition.onend = () => {
      setListening(false);
    };
  }

  function startListening() {
    if (!recognition) {
      if (onStatusCallback) onStatusCallback('unsupported');
      return;
    }
    // Stop TTS if speaking
    if (isSpeaking) {
      synth.cancel();
      isSpeaking = false;
    }
    try {
      recognition.start();
      setListening(true);
    } catch (e) {
      // Already started — restart
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
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function setListening(val) {
    isListening = val;
    if (onStatusCallback) onStatusCallback(val ? 'listening' : 'idle');
  }

  // ===== SPEECH SYNTHESIS (TTS) =====
  function speak(text, onEnd) {
    if (!synth || !text) { onEnd?.(); return; }

    // Cancel any ongoing speech
    synth.cancel();

    // Strip code blocks — don't read code aloud
    const cleaned = text
      .replace(/```[\s\S]*?```/g, '... check the code editor ...')
      .replace(/`[^`]+`/g, (m) => m.replace(/`/g, ''))
      .replace(/[#*_~]/g, '')
      .trim();

    if (!cleaned) { onEnd?.(); return; }

    // Split into chunks (some browsers have a ~200 char limit per utterance)
    const chunks = splitIntoChunks(cleaned, 180);
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
      utterance.rate = 1.05;   // Slightly faster for a young audience
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        index++;
        speakNext();
      };
      utterance.onerror = (e) => {
        console.warn('[Voice] TTS error:', e.error);
        isSpeaking = false;
        onEnd?.();
      };

      synth.speak(utterance);
    }

    speakNext();
  }

  function stopSpeaking() {
    if (synth) synth.cancel();
    isSpeaking = false;
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
    stopSpeaking,
    get isListening() { return isListening; },
    get isSpeaking() { return isSpeaking; },
    get isSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
    get ttsSupported() { return !!window.speechSynthesis; },
    onResult(cb) { onResultCallback = cb; },
    onStatus(cb) { onStatusCallback = cb; },
  };
})();
