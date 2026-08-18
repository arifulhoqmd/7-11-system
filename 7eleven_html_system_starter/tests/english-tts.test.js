import assert from "node:assert/strict";
import test from "node:test";

import { createEnglishTts, selectEnglishVoice } from "../src/audio/english-tts.js";

class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

test("slow English answer uses an English voice and completion callback", () => {
  const voices = [
    { name: "Japanese", lang: "ja-JP" },
    { name: "English US", lang: "en-US" },
  ];
  const spoken = [];
  const synthesis = {
    getVoices: () => voices,
    cancel() {},
    speak: (utterance) => spoken.push(utterance),
  };
  const tts = createEnglishTts({
    speechSynthesis: synthesis,
    Utterance: FakeUtterance,
  });
  let ended = 0;
  const result = tts.speakText("The answer is two hundred eighty-nine.", {
    rate: 0.75,
    onEnd: () => { ended += 1; },
  });

  assert.equal(selectEnglishVoice(voices).name, "English US");
  assert.equal(result.ok, true);
  assert.equal(spoken[0].lang, "en-US");
  assert.equal(spoken[0].rate, 0.75);
  assert.equal(spoken[0].voice.name, "English US");
  spoken[0].onend();
  assert.equal(ended, 1);
});
