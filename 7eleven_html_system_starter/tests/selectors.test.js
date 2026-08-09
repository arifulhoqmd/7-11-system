import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMasterDataset } from "../src/data/normalize.js";
import {
  selectBroadBeginner,
  selectCardinalNumbers,
  selectShelfNumberCardinals,
  selectStageA,
  selectStageB,
  selectStageBAdditions,
} from "../src/data/selectors.js";
import { readRawDataset } from "./helpers.js";

function countByProblemArea(items) {
  return items.reduce((counts, item) => {
    counts[item.problem_area] = (counts[item.problem_area] ?? 0) + 1;
    return counts;
  }, {});
}

test("broad beginner and cumulative Stage B contain the verified 167 records", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const broad = selectBroadBeginner(data);
  const stageB = selectStageB(data);

  assert.equal(broad.length, 167);
  assert.deepEqual(
    stageB.map((item) => item.entry_id),
    broad.map((item) => item.entry_id),
  );

  const areaCounts = countByProblemArea(stageB);
  assert.equal(areaCounts.P3_NUMBERS, 115);
  assert.equal(areaCounts.P1_REJI, 31);
  assert.equal(areaCounts.P2_HOT_FOOD, 14);
  assert.equal(areaCounts.EXTRA, 7);
});

test("Stage A contains the verified 87 practical starter records", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const stageA = selectStageA(data);

  assert.equal(stageA.length, 87);
  assert.ok(
    stageA.every(
      (item) =>
        item.learning_priority === 1 && item.difficulty === "beginner",
    ),
  );

  const areaCounts = countByProblemArea(stageA);
  assert.equal(areaCounts.P3_NUMBERS, 35);
  assert.equal(areaCounts.P1_REJI, 31);
  assert.equal(areaCounts.P2_HOT_FOOD, 14);
  assert.equal(areaCounts.EXTRA, 7);

  const cardinalValues = selectCardinalNumbers(data, { stage: "A" }).map(
    (item) => item.number_value,
  );
  assert.deepEqual(cardinalValues, Array.from({ length: 21 }, (_, i) => i));

  const counterForms = stageA.filter(
    (item) => item.entry_type === "counter_form",
  );
  const counterRules = stageA.filter(
    (item) => item.entry_type === "counter_rule",
  );
  assert.equal(counterForms.length, 10);
  assert.equal(counterRules.length, 4);
});

test("Stage B adds cardinals 21 through 100 without exposing other content", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const additions = selectStageBAdditions(data);

  assert.equal(additions.length, 80);
  assert.ok(
    additions.every(
      (item) =>
        item.problem_area === "P3_NUMBERS" &&
        item.entry_type === "number",
    ),
  );
  assert.deepEqual(
    additions.map((item) => item.number_value),
    Array.from({ length: 80 }, (_, i) => i + 21),
  );
  assert.equal(selectCardinalNumbers(data, { stage: "B" }).length, 101);
});

test("shelf-number selector excludes zero in both stages", async () => {
  const data = normalizeMasterDataset(await readRawDataset());

  const stageA = selectShelfNumberCardinals(data, { stage: "A" });
  const stageB = selectShelfNumberCardinals(data, { stage: "B" });

  assert.equal(stageA.length, 20);
  assert.equal(stageB.length, 100);
  assert.ok(stageA.every((item) => item.number_value > 0));
  assert.ok(stageB.every((item) => item.number_value > 0));
});
