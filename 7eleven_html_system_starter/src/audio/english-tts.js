function normalizeLanguageTag(language) {
  return String(language ?? "").replace("_", "-").toLowerCase();
}

export function selectEnglishVoice(voices) {
  const englishVoices = [...(voices ?? [])].filter((voice) =>
    normalizeLanguageTag(voice.lang).startsWith("en"),
  );
  return (
    englishVoices.find(
      (voice) => normalizeLanguageTag(voice.lang) === "en-us",
    ) ?? englishVoices[0] ?? null
  );
}

export function createEnglishTts({
  speechSynthesis = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
} = {}) {
  const isSupported =
    speechSynthesis !== undefined &&
    speechSynthesis !== null &&
    typeof speechSynthesis.speak === "function" &&
    typeof speechSynthesis.cancel === "function" &&
    typeof Utterance === "function";
  let cachedVoices =
    isSupported && typeof speechSynthesis.getVoices === "function"
      ? speechSynthesis.getVoices()
      : [];

  function speakText(text, { rate = 0.75, onEnd, onError } = {}) {
    if (!isSupported) {
      return Object.freeze({ ok: false, reason: "unsupported" });
    }
    if (typeof text !== "string" || text.trim() === "") {
      throw new TypeError("English TTS requires non-empty text.");
    }
    if (cachedVoices.length === 0 && typeof speechSynthesis.getVoices === "function") {
      cachedVoices = speechSynthesis.getVoices();
    }
    const utterance = new Utterance(text);
    utterance.lang = "en-US";
    utterance.rate = Math.min(1.5, Math.max(0.5, Number(rate) || 0.75));
    utterance.pitch = 1;
    utterance.volume = 1;
    const voice = selectEnglishVoice(cachedVoices);
    if (voice !== null) {
      utterance.voice = voice;
    }
    utterance.onend = typeof onEnd === "function" ? onEnd : null;
    utterance.onerror = typeof onError === "function" ? onError : null;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    return Object.freeze({
      ok: true,
      voiceName: voice?.name ?? null,
      language: utterance.lang,
      rate: utterance.rate,
    });
  }

  function stop() {
    if (isSupported) {
      speechSynthesis.cancel();
    }
  }

  return Object.freeze({ isSupported, speakText, stop });
}
