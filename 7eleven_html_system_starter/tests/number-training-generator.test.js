import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMasterDataset } from "../src/data/normalize.js";
import {
  DICTATION_RANGES,
  MONEY_READING_AMOUNTS,
  QUANTITY_OPTIONS,
  READING_RANGES,
  SELECTED_SERVICE_AMOUNTS,
  TOBACCO_RANGES,
} from "../src/number-training/number-training-config.js";
import {
  composeTobaccoNumberTask,
  composeTobaccoQuantityTask,
  generateNumberTrainingTasks,
  getRemainderHundredsBand,
  getThousandsBand,
  isDifferentMixedTenThousandBand,
  isFocusedReadingValue,
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

test("coverage-aware generation selects unseen numbers before starting a new cycle", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tasks = generateNumberTrainingTasks({
    dataset: data,
    modeId: "number-dictation",
    rangeId: "dictation-1-10",
    sessionSize: 5,
    coverage: {
      cycle: 1,
      presentedKeys: ["1", "2", "3", "4", "5", "6", "7", "8"],
    },
    rng: () => 0.4,
  });

  assert.deepEqual(
    new Set(tasks.slice(0, 2).map((task) => task.coverageKey)),
    new Set(["9", "10"]),
  );
  assert.ok(tasks.slice(0, 2).every((task) => task.coverageCycle === 1));
  assert.ok(tasks.slice(2).every((task) => task.coverageCycle === 2));
});

test("11–50 uses all remaining unseen values without duplicates", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tasks = generateNumberTrainingTasks({
    dataset: data,
    modeId: "number-dictation",
    rangeId: "dictation-11-50",
    sessionSize: 10,
    coverage: {
      cycle: 1,
      presentedKeys: Array.from({ length: 30 }, (_, index) => String(11 + index)),
    },
    rng: () => 0.6,
  });
  assert.deepEqual(
    new Set(tasks.map((task) => task.coverageKey)),
    new Set(Array.from({ length: 10 }, (_, index) => String(41 + index))),
  );
  assert.ok(tasks.every((task) => task.coverageCycle === 1));
});

test("tobacco 番 composition uses runtime readings up to 300", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const task = composeTobaccoNumberTask({
    dataset: data,
    value: 236,
    rangeId: "tobacco-201-300",
  });

  assert.equal(task.reveal.numericAnswer, "236番");
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

test("Mixed 1–300 dictation includes all 300 numbers and 20 quantity forms", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tasks = generateNumberTrainingTasks({
    dataset: data,
    modeId: "number-dictation",
    rangeId: "dictation-mixed-1-300",
    sessionSize: 320,
    rng: () => 0.42,
  });
  const numberTasks = tasks.filter((task) => task.taskKind === "plain-number");
  const quantityTasks = tasks.filter((task) => task.taskKind === "quantity");

  assert.equal(tasks.length, 320);
  assert.equal(new Set(tasks.map((task) => task.coverageKey)).size, 320);
  assert.equal(numberTasks.length, 300);
  assert.equal(quantityTasks.length, 20);
  assert.equal(
    quantityTasks.filter((task) => task.reveal.numericAnswer.endsWith("つ")).length,
    10,
  );
  assert.equal(
    quantityTasks.filter((task) => task.reveal.numericAnswer.endsWith("個")).length,
    10,
  );
  assert.ok(quantityTasks.every((task) => task.ttsText !== task.reveal.romaji));
});

test("a normal Mixed 1–300 session includes both つ and 個 practice", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tasks = generateNumberTrainingTasks({
    dataset: data,
    modeId: "number-dictation",
    rangeId: "dictation-mixed-1-300",
    sessionSize: 15,
    rng: () => 0.42,
  });

  assert.ok(tasks.some((task) => task.reveal.numericAnswer.endsWith("つ")));
  assert.ok(tasks.some((task) => task.reveal.numericAnswer.endsWith("個")));
});

test("Mixed 1–10000 changes thousand and remainder-hundred bands", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tasks = generateNumberTrainingTasks({
    dataset: data,
    modeId: "number-reading",
    rangeId: "reading-mixed-1-10000",
    sessionSize: 100,
    coverage: {
      cycle: 1,
      presentedKeys: ["1234"],
    },
    rng: () => 0.37,
  });
  const values = tasks.map((task) => Number(task.promptNumber));

  assert.equal(tasks.length, 100);
  assert.equal(new Set(values).size, 100);
  assert.ok(values.every((value) => value >= 1 && value <= 10000));
  assert.ok(isDifferentMixedTenThousandBand(1234, values[0]));
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(
      isDifferentMixedTenThousandBand(values[index - 1], values[index]),
      `${values[index - 1]} should transition safely to ${values[index]}`,
    );
  }
});

test("Mixed 1–10000 band helpers match the confirmed example", () => {
  assert.equal(getThousandsBand(1234), 1);
  assert.equal(getRemainderHundredsBand(1234), 2);
  assert.equal(getThousandsBand(5674), 5);
  assert.equal(getRemainderHundredsBand(5674), 6);
  assert.equal(isDifferentMixedTenThousandBand(1234, 5674), true);
  assert.equal(isDifferentMixedTenThousandBand(1234, 1390), false);
  assert.equal(isDifferentMixedTenThousandBand(1234, 5234), false);
});

test("1001–10000 reading range stays within its own boundaries", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tasks = generateNumberTrainingTasks({
    dataset: data,
    modeId: "number-reading",
    rangeId: "reading-1001-10000",
    sessionSize: 100,
    rng: () => 0.48,
  });
  const values = tasks.map((task) => Number(task.promptNumber));

  assert.equal(tasks.length, 100);
  assert.equal(new Set(values).size, 100);
  assert.ok(values.every((value) => value >= 1001 && value <= 10000));
  assert.ok(tasks.every((task) => task.promptType === "speaking"));
  assert.ok(tasks.every((task) => task.ttsText !== task.reveal.romaji));
});

test("Focused 400–5999 weights ten of fifteen tasks across four priority bands", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const tasks = generateNumberTrainingTasks({
    dataset: data,
    modeId: "number-reading",
    rangeId: "reading-focused-400-5999",
    sessionSize: 15,
    rng: () => 0.48,
  });
  const values = tasks.map((task) => Number(task.promptNumber));
  const focusValues = values.filter(isFocusedReadingValue);
  const groups = [
    focusValues.filter((value) => value >= 400 && value <= 499),
    focusValues.filter((value) => value >= 500 && value <= 599),
    focusValues.filter((value) => value >= 4000 && value <= 4999),
    focusValues.filter((value) => value >= 5000 && value <= 5999),
  ];

  assert.equal(tasks.length, 15);
  assert.equal(new Set(values).size, 15);
  assert.ok(values.every((value) => value >= 400 && value <= 5999));
  assert.equal(focusValues.length, 10);
  assert.equal(values.length - focusValues.length, 5);
  assert.ok(groups.every((group) => group.length >= 2));
  assert.ok(tasks.every((task) => task.ttsText !== task.reveal.romaji));
});

test("Focused range classification includes exactly the requested problem bands", () => {
  for (const value of [400, 499, 500, 599, 4000, 4999, 5000, 5999]) {
    assert.equal(isFocusedReadingValue(value), true);
  }
  for (const value of [399, 600, 3999, 6000]) {
    assert.equal(isFocusedReadingValue(value), false);
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
    [...tasks.map((task) => Number.parseInt(task.reveal.numericAnswer, 10))].sort(
      (left, right) => left - right,
    ),
    [...SELECTED_SERVICE_AMOUNTS],
  );
  assert.ok(tasks.every((task) => task.sourceRefs.includes("RULE_EN")));
});

test("price, total, and change reading dynamically compose selected 円 amounts", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const modes = ["price-reading", "total-reading", "change-reading"];

  for (const modeId of modes) {
    const rangeId = `${modeId.split("-")[0]}-selected`;
    const tasks = generateNumberTrainingTasks({
      dataset: data,
      modeId,
      rangeId,
      sessionSize: MONEY_READING_AMOUNTS.length,
      rng: () => 0.3,
    });
    assert.equal(tasks.length, MONEY_READING_AMOUNTS.length);
    assert.deepEqual(
      [...tasks.map((task) => Number.parseInt(task.promptNumber, 10))].sort(
        (left, right) => left - right,
      ),
      [...MONEY_READING_AMOUNTS],
    );
    assert.ok(tasks.every((task) => task.promptType === "speaking"));
    assert.ok(tasks.every((task) => task.promptNumber.endsWith("円")));
    assert.ok(tasks.every((task) => task.ttsText.endsWith("えん")));
    assert.ok(tasks.every((task) => task.sourceRefs.includes("RULE_EN")));
    assert.ok(tasks.every((task) => task.ttsText !== task.reveal.romaji));
  }
});

test("generated pure-number tasks do not require vocabulary metadata", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const [task] = generateNumberTrainingTasks({
    dataset: data,
    modeId: "number-dictation",
    rangeId: "dictation-201-300",
    sessionSize: 1,
    rng: () => 0.777,
  });

  assert.deepEqual(Object.keys(task.pureNumber).sort(), [
    "readingKana",
    "romaji",
    "ttsText",
    "value",
  ]);
  assert.equal(Object.hasOwn(task.reveal, "japanese"), false);
  assert.equal(Object.hasOwn(task, "english"), false);
  assert.equal(Object.hasOwn(task, "explanation"), false);
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
  for (const task of tasks) {
    if (
      task.taskKind === "plain-number" ||
      task.taskKind === "tobacco-number" ||
      task.taskKind === "tobacco-quantity"
    ) {
      const value = Number.parseInt(task.reveal.numericAnswer, 10);
      assert.ok(value >= 1 && value <= 300);
    }
  }
});
