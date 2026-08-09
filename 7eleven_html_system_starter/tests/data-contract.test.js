import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DatasetLoadError,
  loadMasterDataset,
} from "../src/data/load-master.js";
import {
  normalizeMasterDataset,
  parsePipeDelimited,
} from "../src/data/normalize.js";
import {
  DatasetValidationError,
  validateMasterDataset,
} from "../src/data/validation.js";
import { DATASET_URL, readRawDataset } from "./helpers.js";

const EXPECTED_SHA256 =
  "dff14cb46511a6c577edb25599ba9d4f677dabddc0625a11c2f341dc65f657d0";

test("master dataset matches the protected v2 baseline", async () => {
  const bytes = await readFile(DATASET_URL);
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest, EXPECTED_SHA256);

  const raw = JSON.parse(bytes.toString("utf8"));
  assert.equal(validateMasterDataset(raw), true);
  assert.equal(raw.master_items.length, 839);
  assert.equal(raw.number_detail.length, 687);
  assert.equal(raw.hot_food_detail.length, 26);
  assert.equal(raw.quiz_patterns.length, 10);
  assert.equal(raw.sources.length, 10);
});

test("normalization is read-only, preserves raw data, and builds complete joins", async () => {
  const raw = await readRawDataset();
  const before = JSON.stringify(raw);
  const data = normalizeMasterDataset(raw);

  assert.equal(JSON.stringify(raw), before);
  assert.ok(Object.isFrozen(data));
  assert.ok(Object.isFrozen(data.masterItems));
  assert.ok(Object.isFrozen(data.masterItems[0]));
  assert.ok(Object.isFrozen(data.masterItems[0].quizModeList));

  assert.equal(Object.keys(data.indexes.itemsById).length, 839);
  assert.equal(Object.keys(data.indexes.numberDetailsById).length, 687);
  assert.equal(Object.keys(data.indexes.hotFoodDetailsById).length, 26);
  assert.equal(Object.keys(data.indexes.patternsById).length, 10);

  for (const item of data.masterItems) {
    const join = data.joinedItemsById[item.entry_id];
    assert.equal(join.item, item);

    if (item.problem_area === "P3_NUMBERS") {
      assert.equal(join.numberDetail?.number_id, item.entry_id);
    } else {
      assert.equal(join.numberDetail, null);
    }

    if (item.problem_area === "P2_HOT_FOOD") {
      assert.equal(join.hotFoodDetail?.item_id, item.entry_id);
    } else {
      assert.equal(join.hotFoodDetail, null);
    }
  }

  assert.throws(() => data.masterItems.push({}), TypeError);
  assert.throws(
    () => {
      data.indexes.itemsById.HF004.english = "changed";
    },
    TypeError,
  );
});

test("only designated pipe-delimited fields become derived arrays", async () => {
  assert.deepEqual(parsePipeDelimited(" one | two || three "), [
    "one",
    "two",
    "three",
  ]);
  assert.deepEqual(parsePipeDelimited(null), []);

  const data = normalizeMasterDataset(await readRawDataset());
  assert.deepEqual(data.indexes.itemsById.NUM000000.quizModeList, [
    "listen_to_number",
    "number_to_reading",
    "compose_with_counter",
  ]);
  assert.deepEqual(data.indexes.hotFoodDetailsById.HF005.practiceAliasList, [
    "BIGフランク",
    "ポークフランク",
  ]);
  const noConfusableProduct = data.hotFoodDetail.filter(
    (detail) => detail.confusable_with === null,
  );
  assert.equal(noConfusableProduct.length, 2);
  assert.ok(
    noConfusableProduct.every(
      (detail) => detail.confusableWithList.length === 0,
    ),
  );
  assert.equal(
    data.indexes.hotFoodDetailsById.HF005.source_url,
    data.indexes.itemsById.HF005.source_url,
  );
});

test("validation rejects duplicate IDs and broken detail links", async () => {
  const duplicate = await readRawDataset();
  duplicate.master_items[1].entry_id = duplicate.master_items[0].entry_id;
  assert.throws(
    () => validateMasterDataset(duplicate),
    DatasetValidationError,
  );

  const brokenJoin = await readRawDataset();
  brokenJoin.hot_food_detail[0].item_id = "MISSING_ITEM";
  assert.throws(
    () => validateMasterDataset(brokenJoin),
    DatasetValidationError,
  );
});

test("loader fetches, validates, normalizes, and reports request failures", async () => {
  const raw = await readRawDataset();
  const data = await loadMasterDataset({
    url: "test://master-dataset",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => structuredClone(raw),
    }),
  });

  assert.equal(data.masterItems.length, 839);
  assert.ok(Object.isFrozen(data));

  await assert.rejects(
    loadMasterDataset({
      url: "test://missing",
      fetchImpl: async () => ({ ok: false, status: 404 }),
    }),
    DatasetLoadError,
  );
});
