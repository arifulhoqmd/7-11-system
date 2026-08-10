import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMasterDataset } from "../src/data/normalize.js";
import {
  DICTATION_RANGES,
  QUANTITY_OPTIONS,
  READING_RANGES,
  SELECTED_SERVICE_AMOUNTS,
  TOBACCO_RANGES,
} from "../src/number-training/number-training-config.js";
import {
  composeTobaccoNumberTask,
  composeTobaccoQuantityTask,
  generateNumberTrainingTasks,
} from "../src/number-training/number-task-generator.js";
import { readRawDataset } from "./helpers.js";

test("dictation, tobacco, and reading generators honor every range", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const cases = [
    ["number-dictation", DICTATION_RANGES],
    ["tobacco-number", TOBACCO_RANGES],
    ["tobacco-quantity", TOBACCO_RANGES],
    ["number-reading", READING_RANGES],
  ];

  for (const [modeId, ranges] of cases) {
    for (const range of ranges) {
      const tasks = generateNumberTrainingTasks({
        dataset: data,
        modeId,
        rangeId: range.id,
        sessionSize: 5,
        rng: () => 0.35,
      });
      assert.equal(tasks.length, 5);
      for (const task of tasks) {
        const numericValue =
          task.promptNumber ??
          Number.parseInt(task.reveal.numericAnswer, 10);
        assert.ok(numericValue >= range.min);
        assert.ok(numericValue <= range.max);
      }
    }
  }
});

test("small ranges repeat safely to honor the existing session-size setting", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tasks = generateNumberTrainingTasks({
    dataset: data,
    modeId: "number-dictation",
    rangeId: "dictation-1-10",
    sessionSize: 20,
    rng: () => 0.25,
  });

  assert.equal(tasks.length, 20);
  assert.ok(
    tasks.every((task) => {
      const value = Number(task.reveal.numericAnswer);
      return value >= 1 && value <= 10;
    }),
  );
});

test("tobacco 番 composition uses runtime readings up to 300", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const task = composeTobaccoNumberTask({
    dataset: data,
    value: 236,
    rangeId: "tobacco-201-300",
  });

  assert.equal(task.reveal.numericAnswer, "236番");
  assert.equal(task.reveal.japanese, "二百三十六番");
  assert.equal(task.reveal.readingKana, "にひゃくさんじゅうろくばん");
  assert.equal(task.ttsText, "にひゃくさんじゅうろくばん");
  assert.deepEqual(task.sourceRefs, ["NUMGEN:236", "RULE_BAN"]);
});

test("quantity modes reuse all explicit つ and 個 records", async () => {
  const data = normalizeMasterDataset(await readRawDataset());

  for (const option of QUANTITY_OPTIONS) {
    const tasks = generateNumberTrainingTasks({
      dataset: data,
      modeId: "quantity-listening",
      rangeId: option.id,
      sessionSize: option.counter === "mixed" ? 20 : 10,
      rng: () => 0.6,
    });
    assert.ok(
      tasks.every((task) =>
        option.counter === "mixed"
          ? ["つ", "個"].some((counter) =>
              task.reveal.numericAnswer.endsWith(counter),
            )
          : task.reveal.numericAnswer.endsWith(option.counter),
      ),
    );
    assert.ok(
      tasks.every((task) =>
        data.indexes.numberDetailsById[task.sourceRefs[0]],
      ),
    );
  }
});

test("tobacco plus quantity composes both identifiers with Japanese TTS", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const quantity = data.indexes.numberDetailsById.QTY02;
  const task = composeTobaccoQuantityTask({
    dataset: data,
    value: 128,
    quantity,
    rangeId: "tobacco-101-200",
  });

  assert.equal(task.reveal.numericAnswer, "128番 × 2つ");
  assert.equal(task.reveal.japanese, "百二十八番を二つください");
  assert.equal(
    task.reveal.readingKana,
    "ひゃくにじゅうはちばんをふたつください",
  );
  assert.equal(task.ttsText, task.reveal.readingKana);
  assert.deepEqual(task.sourceRefs, [
    "NUM000128",
    "RULE_BAN",
    "QTY02",
  ]);
  assert.notEqual(task.ttsText, task.reveal.romaji);
});

test("selected service amounts remain a separate finite category", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tasks = generateNumberTrainingTasks({
    dataset: data,
    modeId: "service-amount",
    rangeId: "service-selected",
    sessionSize: SELECTED_SERVICE_AMOUNTS.length,
    rng: () => 0.4,
  });

  assert.deepEqual(
    [...tasks.map((task) => Number(task.reveal.numericAnswer.slice(1)))].sort(
      (left, right) => left - right,
    ),
    [...SELECTED_SERVICE_AMOUNTS],
  );
  assert.ok(tasks.every((task) => task.sourceRefs.includes("RULE_EN")));
});

test("mixed listening includes every requested number-task category", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tasks = generateNumberTrainingTasks({
    dataset: data,
    modeId: "mixed-number-listening",
    rangeId: "mixed-1-300",
    sessionSize: 5,
    rng: () => 0.2,
  });

  assert.deepEqual(
    new Set(tasks.map((task) => task.taskKind)),
    new Set([
      "plain-number",
      "tobacco-number",
      "quantity",
      "tobacco-quantity",
      "service-amount",
    ]),
  );
});
