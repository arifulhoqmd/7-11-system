import { composeYen } from "../data/composition.js";
import { selectCardinalNumbers } from "../data/selectors.js";

export const NUMBER_LISTENING_PATTERN_ID = "QZ005";
export const PRICE_LISTENING_PATTERN_ID = "QZ006";
export const PHASE_3A_PATTERN_IDS = Object.freeze([
  NUMBER_LISTENING_PATTERN_ID,
  PRICE_LISTENING_PATTERN_ID,
]);

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}

function assertPatternId(patternId) {
  if (!PHASE_3A_PATTERN_IDS.includes(patternId)) {
    throw new RangeError(`Unsupported Phase 3A pattern "${patternId}".`);
  }
}

function randomIndex(length, rng) {
  const value = Number(rng());
  const normalized = Number.isFinite(value)
    ? Math.min(0.999999999, Math.max(0, value))
    : 0;
  return Math.floor(normalized * length);
}

function shuffled(values, rng) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, rng);
    [result[index], result[swapIndex]] = [
      result[swapIndex],
      result[index],
    ];
  }
  return result;
}

export function getListeningNumberPool(dataset, { patternId, stage }) {
  assertPatternId(patternId);
  const cardinals = selectCardinalNumbers(dataset, { stage });

  // Zero is useful for number recognition but is not a practical price.
  return Object.freeze(
    patternId === PRICE_LISTENING_PATTERN_ID
      ? cardinals.filter((record) => record.number_value > 0)
      : [...cardinals],
  );
}

export function selectNearbyNumberRecords({
  correctRecord,
  candidateRecords,
  count = 3,
}) {
  if (!Number.isInteger(correctRecord?.number_value)) {
    throw new TypeError("A valid correct cardinal record is required.");
  }

  const uniqueByValue = new Map();
  for (const record of candidateRecords) {
    if (
      Number.isInteger(record.number_value) &&
      record.number_value !== correctRecord.number_value
    ) {
      uniqueByValue.set(record.number_value, record);
    }
  }

  const nearby = [...uniqueByValue.values()]
    .sort((left, right) => {
      const distanceDifference =
        Math.abs(left.number_value - correctRecord.number_value) -
        Math.abs(right.number_value - correctRecord.number_value);
      return distanceDifference || left.number_value - right.number_value;
    })
    .slice(0, count);

  if (nearby.length < count) {
    throw new RangeError("Not enough unique nearby values for four choices.");
  }
  return Object.freeze(nearby);
}

function makeChoice(record, patternId) {
  const value = record.number_value;
  const isPrice = patternId === PRICE_LISTENING_PATTERN_ID;
  return {
    key: `${isPrice ? "price" : "number"}:${value}`,
    label: isPrice ? `¥${value}` : String(value),
    numberValue: value,
  };
}

export function createListeningQuestion({
  dataset,
  patternId,
  correctRecord,
  candidateRecords,
  rng = Math.random,
}) {
  assertPatternId(patternId);
  const pattern = dataset.indexes.patternsById[patternId];
  if (!pattern) {
    throw new Error(`Dataset does not contain quiz pattern ${patternId}.`);
  }
  if (
    !candidateRecords.some(
      (record) => record.entry_id === correctRecord?.entry_id,
    )
  ) {
    throw new RangeError("Correct record must belong to the selected stage pool.");
  }

  const distractors = selectNearbyNumberRecords({
    correctRecord,
    candidateRecords,
    count: 3,
  });
  const choices = shuffled(
    [correctRecord, ...distractors].map((record) =>
      makeChoice(record, patternId),
    ),
    rng,
  );

  const isPrice = patternId === PRICE_LISTENING_PATTERN_ID;
  const composition = isPrice ? composeYen(correctRecord) : null;
  const sourceRefs = isPrice
    ? composition.sourceRefs
    : [correctRecord.entry_id];
  const exerciseKey = `${patternId}:${sourceRefs.join(":")}`;

  return deepFreeze({
    questionId: exerciseKey,
    exerciseKey,
    patternId,
    patternName: pattern.name,
    modeId: isPrice ? "prices" : "numbers",
    sourceRefs: [...sourceRefs],
    instruction: pattern.display_template,
    ttsText: isPrice ? composition.ttsText : correctRecord.tts_text,
    answerValue: correctRecord.number_value,
    correctChoiceKey: makeChoice(correctRecord, patternId).key,
    choices,
    reveal: isPrice
      ? {
          japanese: composition.japanese,
          readingKana: composition.readingKana,
          romaji: composition.romaji,
          english: composition.english,
        }
      : {
          japanese: correctRecord.japanese,
          readingKana: correctRecord.reading_kana,
          romaji: correctRecord.romaji,
          english: correctRecord.english,
        },
  });
}

export function generateListeningQuestions({
  dataset,
  patternId,
  stage,
  sessionSize,
  rng = Math.random,
}) {
  assertPatternId(patternId);
  if (!Number.isInteger(sessionSize) || sessionSize <= 0) {
    throw new RangeError("Session size must be a positive integer.");
  }

  const pool = getListeningNumberPool(dataset, { patternId, stage });
  if (sessionSize > pool.length) {
    throw new RangeError(
      `Session size ${sessionSize} exceeds the ${pool.length}-item pool.`,
    );
  }

  const correctRecords = shuffled(pool, rng).slice(0, sessionSize);
  return Object.freeze(
    correctRecords.map((correctRecord) =>
      createListeningQuestion({
        dataset,
        patternId,
        correctRecord,
        candidateRecords: pool,
        rng,
      }),
    ),
  );
}
