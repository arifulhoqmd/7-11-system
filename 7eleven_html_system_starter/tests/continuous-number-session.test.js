import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTINUOUS_ANSWER_WAIT_MS,
  advanceContinuousSession,
  createContinuousEnglishNumberSession,
  createContinuousNumberSession,
  createShuffledContinuousSequence,
  createShuffledNumberSequence,
  createWeightedEnglishNumberSequence,
  getContinuousEnglishNumberWeight,
  getCurrentContinuousItem,
  pauseContinuousSession,
  resolveContinuousItem,
  resolveContinuousListeningEnvironment,
  resumeContinuousSession,
} from "../src/number-training/continuous-number-session.js";
import { normalizeMasterDataset } from "../src/data/normalize.js";
import {
  createEnglishAnswerText,
  toEnglishNumberWords,
} from "../src/number-training/english-number.js";
import { readRawDataset } from "./helpers.js";

test("continuous sequence contains every number 1-300 once in shuffled order", () => {
  const sequence = createShuffledNumberSequence({ rng: () => 0 });
  assert.equal(sequence.length, 300);
  assert.equal(new Set(sequence).size, 300);
  assert.deepEqual([...sequence].sort((a, b) => a - b),
    Array.from({ length: 300 }, (_, index) => index + 1));
  assert.notDeepEqual(sequence, Array.from({ length: 300 }, (_, index) => index + 1));
  assert.equal(CONTINUOUS_ANSWER_WAIT_MS, 5000);
});

test("continuous session pauses, resumes the same number, and advances", () => {
  let session = createContinuousNumberSession({
    rng: () => 0.5,
    quantityIds: ["QTY01", "KO01"],
  });
  const first = getCurrentContinuousItem(session);
  session = pauseContinuousSession(session);
  assert.equal(session.status, "paused");
  session = resumeContinuousSession(session);
  assert.equal(getCurrentContinuousItem(session), first);
  session = advanceContinuousSession(session);
  assert.equal(session.currentIndex, 1);
  assert.notEqual(getCurrentContinuousItem(session), first);
});

test("11–260 continuous session contains each of its 250 numbers once", () => {
  const session = createContinuousNumberSession({
    min: 11,
    max: 260,
    continuousModeId: "continuous-number-11-260",
    rng: () => 0.4,
  });

  assert.equal(session.continuousModeId, "continuous-number-11-260");
  assert.equal(session.direction, "japanese-to-english");
  assert.equal(session.items.length, 250);
  assert.equal(new Set(session.items).size, 250);
  assert.equal(Math.min(...session.items), 11);
  assert.equal(Math.max(...session.items), 260);
  assert.ok(session.items.every(Number.isInteger));
});

test("continuous cycle adds every つ and 個 form to numbers 1-300", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const quantityIds = data.numberDetail
    .filter((detail) =>
      ["item_quantity_native", "piece_counter_ko"].includes(
        detail.number_type,
      ),
    )
    .map((detail) => detail.number_id);
  const sequence = createShuffledContinuousSequence({
    quantityIds,
    rng: () => 0.4,
  });

  assert.equal(quantityIds.length, 20);
  assert.equal(sequence.length, 320);
  assert.equal(new Set(sequence).size, 320);
  assert.equal(sequence.filter(Number.isInteger).length, 300);
  assert.deepEqual(
    new Set(sequence.filter((item) => typeof item === "string")),
    new Set(quantityIds),
  );
});

test("continuous quantity prompts use stored Japanese TTS and clear answers", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tsu = data.numberDetail.find(
    (detail) => detail.number_type === "item_quantity_native",
  );
  const ko = data.numberDetail.find(
    (detail) => detail.number_type === "piece_counter_ko",
  );
  const tsuPrompt = resolveContinuousItem(data, tsu.number_id);
  const koPrompt = resolveContinuousItem(data, ko.number_id);

  assert.equal(tsuPrompt.ttsText, tsu.tts_text);
  assert.equal(tsuPrompt.readingKana, tsu.reading_kana);
  assert.equal(tsuPrompt.displayAnswer, `${tsu.number_value}つ`);
  assert.match(tsuPrompt.englishAnswerText, /using the tsu counter/);
  assert.notEqual(tsuPrompt.ttsText, tsu.romaji);
  assert.equal(koPrompt.ttsText, ko.tts_text);
  assert.equal(koPrompt.displayAnswer, `${ko.number_value}個`);
  assert.match(koPrompt.englishAnswerText, /using the ko counter/);
  assert.notEqual(koPrompt.ttsText, ko.romaji);
});

test("English answer wording is explicit and suitable for slow TTS", () => {
  assert.equal(toEnglishNumberWords(289), "two hundred eighty-nine");
  assert.equal(
    createEnglishAnswerText(289),
    "The answer is two hundred eighty-nine.",
  );
});

test("English number wording supports the complete new continuous range", () => {
  assert.equal(
    toEnglishNumberWords(5542),
    "five thousand five hundred forty-two",
  );
  assert.equal(toEnglishNumberWords(4000), "four thousand");
  assert.equal(toEnglishNumberWords(5999), "five thousand nine hundred ninety-nine");
});

test("English to Japanese continuous cycle weights the requested bands", () => {
  const sequence = createWeightedEnglishNumberSequence({ rng: () => 0.5 });
  const occurrences = (value) => sequence.filter((item) => item === value).length;

  assert.equal(sequence.length, 7800);
  assert.equal(Math.min(...sequence), 400);
  assert.equal(Math.max(...sequence), 5999);
  assert.equal(occurrences(1200), 1);
  assert.equal(occurrences(4200), 2);
  assert.equal(occurrences(4400), 3);
  assert.equal(occurrences(5500), 3);
  assert.equal(getContinuousEnglishNumberWeight(399), 1);
  assert.equal(getContinuousEnglishNumberWeight(6000), 1);

  const session = createContinuousEnglishNumberSession({ rng: () => 0.5 });
  assert.equal(session.direction, "english-to-japanese");
  assert.equal(session.phase, "prompt");
  assert.equal(session.items.length, 7800);
});

test("Continuous Playing always resolves to an audible noise environment", () => {
  assert.equal(resolveContinuousListeningEnvironment("clean"), "medium");
  assert.equal(resolveContinuousListeningEnvironment("light"), "light");
  assert.equal(resolveContinuousListeningEnvironment("medium"), "medium");
  assert.equal(
    resolveContinuousListeningEnvironment("conversation"),
    "conversation",
  );
});
