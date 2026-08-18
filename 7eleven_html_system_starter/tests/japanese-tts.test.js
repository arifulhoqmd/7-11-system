import assert from "node:assert/strict";
import test from "node:test";

import {
  createJapaneseTts,
  selectJapaneseVoice,
} from "../src/audio/japanese-tts.js";

class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

function createFakeSynthesis(voices = []) {
  return {
    cancelCount: 0,
    spoken: [],
    getVoices() {
      return voices;
    },
    cancel() {
      this.cancelCount += 1;
    },
    speak(utterance) {
      this.spoken.push(utterance);
    },
  };
}

test("Japanese voice selection prefers an exact ja-JP voice", () => {
  const voices = [
    { name: "English", lang: "en-US" },
    { name: "Japanese generic", lang: "ja" },
    { name: "Japanese Japan", lang: "ja-JP" },
  ];

  assert.equal(selectJapaneseVoice(voices), voices[2]);
  assert.equal(
    selectJapaneseVoice([{ name: "Japanese", lang: "ja_JP" }]).name,
    "Japanese",
  );
  assert.equal(selectJapaneseVoice([{ name: "English", lang: "en" }]), null);
});

test("TTS speaks dataset tts_text, never the Romaji field", () => {
  const synth = createFakeSynthesis([
    { name: "Japanese Japan", lang: "ja-JP" },
  ]);
  const tts = createJapaneseTts({
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });
  const record = {
    tts_text: "いらっしゃいませ。",
    romaji: "irasshaimase",
  };

  const result = tts.speakRecord(record, { rate: 0.75 });
  assert.equal(result.ok, true);
  assert.equal(result.voiceName, "Japanese Japan");
  assert.equal(synth.cancelCount, 1);
  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.spoken[0].text, record.tts_text);
  assert.notEqual(synth.spoken[0].text, record.romaji);
  assert.equal(synth.spoken[0].lang, "ja-JP");
  assert.equal(synth.spoken[0].rate, 0.75);
  assert.equal(synth.spoken[0].voice.name, "Japanese Japan");
});

test("TTS works with ja-JP language fallback when no voice is installed", () => {
  const synth = createFakeSynthesis([]);
  const tts = createJapaneseTts({
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });

  const result = tts.speakRecord({ tts_text: "ななチキ" });
  assert.equal(result.ok, true);
  assert.equal(result.voiceName, null);
  assert.equal(synth.spoken[0].lang, "ja-JP");
  assert.equal(synth.spoken[0].voice, undefined);
});

test("unsupported TTS reports a non-throwing fallback", () => {
  const tts = createJapaneseTts({
    speechSynthesis: null,
    Utterance: null,
  });

  assert.equal(tts.isSupported, false);
  assert.deepEqual(tts.speakRecord({ tts_text: "はい。" }), {
    ok: false,
    reason: "unsupported",
  });
  assert.doesNotThrow(() => tts.stop());
});

test("TTS rejects records without Japanese tts_text", () => {
  const tts = createJapaneseTts({
    speechSynthesis: createFakeSynthesis(),
    Utterance: FakeUtterance,
  });

  assert.throws(
    () => tts.speakRecord({ romaji: "hai" }),
    /record with tts_text/,
  );
});

test("TTS exposes completion and error callbacks for timer lifecycle", () => {
  const synth = createFakeSynthesis();
  const tts = createJapaneseTts({
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });
  let ended = 0;
  let failed = 0;
  tts.speakRecord({ tts_text: "さん" }, {
    onEnd: () => { ended += 1; },
    onError: () => { failed += 1; },
  });
  synth.spoken[0].onend();
  synth.spoken[0].onerror();
  assert.equal(ended, 1);
  assert.equal(failed, 1);
});
