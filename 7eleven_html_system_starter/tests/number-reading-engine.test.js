import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMasterDataset } from "../src/data/normalize.js";
import {
  DICTATION_RANGES,
  READING_RANGES,
  TOBACCO_RANGES,
} from "../src/number-training/number-training-config.js";
import {
  createPureNumberRuntime,
  generateJapaneseNumber,
  resolveNumberReading,
} from "../src/number-training/number-reading-engine.js";
import { readRawDataset } from "./helpers.js";

test("number engine generates boundary and compound readings", () => {
  const expected = new Map([
    [0, ["零", "ゼロ", "zero"]],
    [1, ["一", "いち", "ichi"]],
    [10, ["十", "じゅう", "juu"]],
    [11, ["十一", "じゅういち", "juu ichi"]],
    [99, ["九十九", "きゅうじゅうきゅう", "kyuu juu kyuu"]],
    [100, ["百", "ひゃく", "hyaku"]],
    [101, ["百一", "ひゃくいち", "hyaku ichi"]],
    [236, ["二百三十六", "にひゃくさんじゅうろく", "ni hyaku san juu roku"]],
    [684, ["六百八十四", "ろっぴゃくはちじゅうよん", "roppyaku hachi juu yon"]],
    [1000, ["千", "せん", "sen"]],
    [10000, ["一万", "いちまん", "ichi man"]],
  ]);

  for (const [value, [japanese, kana, romaji]] of expected) {
    const result = generateJapaneseNumber(value);
    assert.equal(result.japanese, japanese);
    assert.equal(result.readingKana, kana);
    assert.equal(result.romaji, romaji);
    assert.equal(result.ttsText, kana);
  }
});

test("irregular hundreds and thousands remain explicit", () => {
  const expected = new Map([
    [300, ["さんびゃく", "sanbyaku"]],
    [600, ["ろっぴゃく", "roppyaku"]],
    [800, ["はっぴゃく", "happyaku"]],
    [3000, ["さんぜん", "sanzen"]],
    [8000, ["はっせん", "hassen"]],
  ]);

  for (const [value, [kana, romaji]] of expected) {
    const result = generateJapaneseNumber(value);
    assert.equal(result.readingKana, kana);
    assert.equal(result.romaji, romaji);
  }
});

test("stored readings are preferred while absent values use runtime rules", async () => {
  const data = normalizeMasterDataset(await readRawDataset());

  const stored = resolveNumberReading(data, 300);
  assert.equal(stored.readingSource, "master");
  assert.equal(stored.sourceRef, "NUM000300");
  assert.equal(stored.ttsText, data.indexes.numberDetailsById.NUM000300.tts_text);

  const generated = resolveNumberReading(data, 684);
  assert.equal(generated.readingSource, "rules");
  assert.equal(generated.sourceRef, "NUMGEN:684");
  assert.equal(generated.ttsText, "ろっぴゃくはちじゅうよん");
});

test("pure-number runtime objects contain only number-training essentials", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const number = createPureNumberRuntime(data, 234);

  assert.deepEqual(number, {
    value: 234,
    readingKana: "にひゃくさんじゅうよん",
    romaji: "nihyaku sanjuu yon",
    ttsText: "にひゃくさんじゅうよん",
  });
  for (const unnecessaryField of [
    "english",
    "explanation",
    "picture",
    "expectedAction",
    "listenKeywords",
    "notes",
    "product",
  ]) {
    assert.equal(Object.hasOwn(number, unnecessaryField), false);
  }
  assert.ok(Object.isFrozen(number));
});

test("generated rules agree with every stored cardinal through 10,000", async () => {
  const raw = await readRawDataset();
  const storedCardinals = raw.number_detail.filter(
    (detail) =>
      detail.number_type === "cardinal" && detail.number_value <= 10000,
  );

  assert.equal(storedCardinals.length, 563);
  for (const stored of storedCardinals) {
    const generated = generateJapaneseNumber(stored.number_value);
    assert.equal(generated.readingKana, stored.reading_kana);
    assert.equal(generated.romaji, stored.romaji);
    assert.equal(generated.ttsText, stored.tts_text);
  }
});

test("every selectable range has valid inclusive boundaries", () => {
  for (const range of [
    ...DICTATION_RANGES,
    ...TOBACCO_RANGES,
    ...READING_RANGES,
  ]) {
    assert.ok(range.min >= 1);
    assert.ok(range.max >= range.min);
    assert.doesNotThrow(() => generateJapaneseNumber(range.min));
    assert.doesNotThrow(() => generateJapaneseNumber(range.max));
  }

  assert.deepEqual(
    DICTATION_RANGES.map((range) => [range.min, range.max]),
    [
      [1, 10],
      [11, 50],
      [51, 100],
      [101, 200],
      [201, 300],
      [1, 300],
    ],
  );
  assert.deepEqual(
    READING_RANGES.map((range) => [range.min, range.max]),
    [
      [1, 10],
      [11, 100],
      [101, 200],
      [201, 300],
      [301, 400],
      [401, 500],
      [501, 600],
      [601, 700],
      [701, 800],
      [801, 900],
      [901, 1000],
      [1001, 10000],
      [400, 5999],
      [1, 1000],
      [1, 10000],
    ],
  );
});

test("range engine is prepared for later values beyond 1000", () => {
  assert.equal(
    generateJapaneseNumber(1500).readingKana,
    "せんごひゃく",
  );
  assert.equal(generateJapaneseNumber(3000).readingKana, "さんぜん");
  assert.equal(generateJapaneseNumber(10000).readingKana, "いちまん");
});
