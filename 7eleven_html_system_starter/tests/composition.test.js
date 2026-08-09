import assert from "node:assert/strict";
import test from "node:test";

import {
  composeShelfNumber,
  composeYen,
} from "../src/data/composition.js";
import { normalizeMasterDataset } from "../src/data/normalize.js";
import { readRawDataset } from "./helpers.js";

test("yen is composed from the stored cardinal reading without duplicate rows", async () => {
  const raw = await readRawDataset();
  const data = normalizeMasterDataset(raw);
  const sixHundred = data.masterItems.find(
    (item) => item.entry_type === "number" && item.number_value === 600,
  );

  const amount = composeYen(sixHundred);
  assert.deepEqual(amount, {
    kind: "yen",
    numberId: sixHundred.entry_id,
    ruleId: "RULE_EN",
    sourceRefs: [sixHundred.entry_id, "RULE_EN"],
    numberValue: 600,
    counter: "円",
    japanese: "600円",
    readingKana: "ろっぴゃくえん",
    romaji: "roppyaku en",
    english: "¥600",
    ttsText: "ろっぴゃくえんです。",
  });
  assert.ok(Object.isFrozen(amount));
  assert.ok(Object.isFrozen(amount.sourceRefs));

  const yenRows = raw.master_items.filter((item) => item.counter === "円");
  assert.deepEqual(
    yenRows.map((item) => item.entry_id),
    ["RULE_EN"],
  );
});

test("shelf number is composed dynamically from a nonzero cardinal", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const thirtySeven = data.masterItems.find(
    (item) => item.entry_type === "number" && item.number_value === 37,
  );

  assert.deepEqual(composeShelfNumber(thirtySeven), {
    kind: "shelf_number",
    numberId: thirtySeven.entry_id,
    ruleId: "RULE_BAN",
    sourceRefs: [thirtySeven.entry_id, "RULE_BAN"],
    numberValue: 37,
    counter: "番",
    japanese: "37番",
    readingKana: "さんじゅうななばん",
    romaji: "san juu nana ban",
    english: "shelf #37",
    ttsText: "さんじゅうななばんください。",
  });
});

test("shelf composition rejects zero and both helpers reject counter records", async () => {
  const data = normalizeMasterDataset(await readRawDataset());

  assert.throws(
    () => composeShelfNumber(data.indexes.itemsById.NUM000000),
    RangeError,
  );
  assert.throws(
    () => composeYen(data.indexes.itemsById.RULE_EN),
    TypeError,
  );
});
