function assertCardinalRecord(record) {
  if (record === null || typeof record !== "object") {
    throw new TypeError("A cardinal number record is required.");
  }

  const isMasterCardinal =
    record.entry_type === "number" && record.problem_area === "P3_NUMBERS";
  const isDetailCardinal = record.number_type === "cardinal";

  if (!isMasterCardinal && !isDetailCardinal) {
    throw new TypeError("Counter composition requires a cardinal record.");
  }

  if (!Number.isInteger(record.number_value) || record.number_value < 0) {
    throw new TypeError("Cardinal record must have a non-negative integer value.");
  }

  if (typeof record.tts_text !== "string" || record.tts_text.trim() === "") {
    throw new TypeError("Cardinal record must contain Japanese tts_text.");
  }

  if (typeof record.romaji !== "string" || record.romaji.trim() === "") {
    throw new TypeError("Cardinal record must contain Romaji.");
  }
}

function getNumberId(record) {
  return record.entry_id ?? record.number_id;
}

export function composeYen(cardinalRecord) {
  assertCardinalRecord(cardinalRecord);

  const value = cardinalRecord.number_value;
  const reading = cardinalRecord.tts_text.trim();

  return Object.freeze({
    kind: "yen",
    numberId: getNumberId(cardinalRecord),
    ruleId: "RULE_EN",
    sourceRefs: Object.freeze([getNumberId(cardinalRecord), "RULE_EN"]),
    numberValue: value,
    counter: "円",
    japanese: `${value}円`,
    readingKana: `${reading}えん`,
    romaji: `${cardinalRecord.romaji.trim()} en`,
    english: `¥${value}`,
    ttsText: `${reading}えんです。`,
  });
}

export function composeShelfNumber(cardinalRecord) {
  assertCardinalRecord(cardinalRecord);

  const value = cardinalRecord.number_value;
  if (value === 0) {
    throw new RangeError("Shelf-number composition requires a value above zero.");
  }

  const reading = cardinalRecord.tts_text.trim();

  return Object.freeze({
    kind: "shelf_number",
    numberId: getNumberId(cardinalRecord),
    ruleId: "RULE_BAN",
    sourceRefs: Object.freeze([getNumberId(cardinalRecord), "RULE_BAN"]),
    numberValue: value,
    counter: "番",
    japanese: `${value}番`,
    readingKana: `${reading}ばん`,
    romaji: `${cardinalRecord.romaji.trim()} ban`,
    english: `shelf #${value}`,
    ttsText: `${reading}ばんください。`,
  });
}
