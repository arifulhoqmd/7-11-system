function normalizeLanguageTag(language) {
  return String(language ?? "").replace("_", "-").toLowerCase();
}

export function selectJapaneseVoice(voices) {
  const japaneseVoices = [...(voices ?? [])].filter((voice) =>
    normalizeLanguageTag(voice.lang).startsWith("ja"),
  );

  return (
    japaneseVoices.find(
      (voice) => normalizeLanguageTag(voice.lang) === "ja-jp",
    ) ??
    japaneseVoices[0] ??
    null
  );
}

function normalizeRate(rate) {
  const numericRate = Number(rate);
  if (!Number.isFinite(numericRate)) {
    return 0.9;
  }
  return Math.min(1.5, Math.max(0.5, numericRate));
}

export function createJapaneseTts({
  speechSynthesis = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
} = {}) {
  const isSupported =
    speechSynthesis !== undefined &&
    speechSynthesis !== null &&
    typeof speechSynthesis.speak === "function" &&
    typeof speechSynthesis.cancel === "function" &&
    typeof Utterance === "function";

  let cachedVoices = [];

  function refreshVoices() {
    cachedVoices =
      isSupported && typeof speechSynthesis.getVoices === "function"
        ? speechSynthesis.getVoices()
        : [];
    return cachedVoices;
  }

  const handleVoicesChanged = () => refreshVoices();
  if (
    isSupported &&
    typeof speechSynthesis.addEventListener === "function"
  ) {
    speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
  }
  refreshVoices();

  function getJapaneseVoice() {
    if (!isSupported) {
      return null;
    }
    if (cachedVoices.length === 0) {
      refreshVoices();
    }
    return selectJapaneseVoice(cachedVoices);
  }

  function speakRecord(record, { rate = 0.9, onEnd, onError } = {}) {
    if (!isSupported) {
      return Object.freeze({ ok: false, reason: "unsupported" });
    }

    if (
      record === null ||
      typeof record !== "object" ||
      typeof record.tts_text !== "string" ||
      record.tts_text.trim() === ""
    ) {
      throw new TypeError("Japanese TTS requires a record with tts_text.");
    }

    const utterance = new Utterance(record.tts_text);
    utterance.lang = "ja-JP";
    utterance.rate = normalizeRate(rate);
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = getJapaneseVoice();
    if (voice !== null) {
      utterance.voice = voice;
    }
    if (typeof onEnd === "function") {
      utterance.onend = onEnd;
    }
    if (typeof onError === "function") {
      utterance.onerror = onError;
    }

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

  function dispose() {
    stop();
    if (
      isSupported &&
      typeof speechSynthesis.removeEventListener === "function"
    ) {
      speechSynthesis.removeEventListener(
        "voiceschanged",
        handleVoicesChanged,
      );
    }
  }

  return Object.freeze({
    isSupported,
    getJapaneseVoice,
    refreshVoices,
    speakRecord,
    stop,
    dispose,
  });
}
