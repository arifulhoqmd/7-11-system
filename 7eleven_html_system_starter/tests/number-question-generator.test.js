import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMasterDataset } from "../src/data/normalize.js";
import {
  NUMBER_LISTENING_PATTERN_ID,
  PRICE_LISTENING_PATTERN_ID,
  createListeningQuestion,
  generateListeningQuestions,
  getListeningNumberPool,
} from "../src/quiz/number-question-generator.js";
import { readRawDataset } from "./helpers.js";

test("QZ005 and QZ006 use the correct Stage A and Stage B cardinal pools", async () => {
  const data = normalizeMasterDataset(await readRawDataset());

  const numberA = getListeningNumberPool(data, {
    patternId: NUMBER_LISTENING_PATTERN_ID,
    stage: "A",
  });
  const numberB = getListeningNumberPool(data, {
    patternId: NUMBER_LISTENING_PATTERN_ID,
    stage: "B",
  });
  const priceA = getListeningNumberPool(data, {
    patternId: PRICE_LISTENING_PATTERN_ID,
    stage: "A",
  });
  const priceB = getListeningNumberPool(data, {
    patternId: PRICE_LISTENING_PATTERN_ID,
    stage: "B",
  });

  assert.deepEqual(
    numberA.map((record) => record.number_value),
    Array.from({ length: 21 }, (_, index) => index),
  );
  assert.deepEqual(
    numberB.map((record) => record.number_value),
    Array.from({ length: 101 }, (_, index) => index),
  );
  assert.deepEqual(
    priceA.map((record) => record.number_value),
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    priceB.map((record) => record.number_value),
    Array.from({ length: 100 }, (_, index) => index + 1),
  );
});

test("QZ005 has four unique choices and exactly one correct answer", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const pool = getListeningNumberPool(data, {
    patternId: NUMBER_LISTENING_PATTERN_ID,
    stage: "A",
  });
  const correctRecord = pool.find((record) => record.number_value === 10);
  const question = createListeningQuestion({
    dataset: data,
    patternId: NUMBER_LISTENING_PATTERN_ID,
    correctRecord,
    candidateRecords: pool,
    rng: () => 0.4,
  });

  assert.equal(question.patternId, "QZ005");
  assert.equal(question.choices.length, 4);
  assert.equal(new Set(question.choices.map((choice) => choice.key)).size, 4);
  assert.equal(
    question.choices.filter(
      (choice) => choice.key === question.correctChoiceKey,
    ).length,
    1,
  );
  assert.equal(question.ttsText, correctRecord.tts_text);
  assert.deepEqual(question.sourceRefs, [correctRecord.entry_id]);
  assert.ok(Object.isFrozen(question));
});

test("number distractors are nearby values that exist in the selected pool", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const pool = getListeningNumberPool(data, {
    patternId: NUMBER_LISTENING_PATTERN_ID,
    stage: "A",
  });
  const correctRecord = pool.find((record) => record.number_value === 10);
  const question = createListeningQuestion({
    dataset: data,
    patternId: NUMBER_LISTENING_PATTERN_ID,
    correctRecord,
    candidateRecords: pool,
    rng: () => 0,
  });

  const validValues = new Set(pool.map((record) => record.number_value));
  const distractorValues = question.choices
    .map((choice) => choice.numberValue)
    .filter((value) => value !== 10);

  assert.ok(distractorValues.every((value) => validValues.has(value)));
  assert.ok(distractorValues.every((value) => Math.abs(value - 10) <= 2));
});

test("QZ006 dynamically composes yen from the stored number reading", async () => {
  const raw = await readRawDataset();
  const data = normalizeMasterDataset(raw);
  const pool = getListeningNumberPool(data, {
    patternId: PRICE_LISTENING_PATTERN_ID,
    stage: "B",
  });
  const correctRecord = pool.find((record) => record.number_value === 37);
  const question = createListeningQuestion({
    dataset: data,
    patternId: PRICE_LISTENING_PATTERN_ID,
    correctRecord,
    candidateRecords: pool,
    rng: () => 0.7,
  });

  assert.equal(question.patternId, "QZ006");
  assert.equal(question.ttsText, `${correctRecord.tts_text}えんです。`);
  assert.equal(question.reveal.japanese, "37円");
  assert.equal(question.reveal.readingKana, "さんじゅうななえん");
  assert.equal(question.reveal.romaji, "san juu nana en");
  assert.deepEqual(question.sourceRefs, [correctRecord.entry_id, "RULE_EN"]);
  assert.ok(question.choices.every((choice) => choice.label.startsWith("¥")));
  assert.equal(
    raw.master_items.filter((item) => item.counter === "円").length,
    1,
  );
});

test("session generation honors session size and does not repeat correct records", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const questions = generateListeningQuestions({
    dataset: data,
    patternId: NUMBER_LISTENING_PATTERN_ID,
    stage: "A",
    sessionSize: 20,
    rng: () => 0.25,
  });

  assert.equal(questions.length, 20);
  assert.equal(new Set(questions.map((question) => question.answerValue)).size, 20);
  assert.ok(questions.every((question) => question.answerValue <= 20));
});
