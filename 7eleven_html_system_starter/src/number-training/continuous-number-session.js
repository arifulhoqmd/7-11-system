import { createEnglishAnswerText, toEnglishNumberWords } from "./english-number.js";
import { resolveNumberReading } from "./number-reading-engine.js";

export const CONTINUOUS_NUMBER_MIN = 1;
export const CONTINUOUS_NUMBER_MAX = 300;
export const CONTINUOUS_ANSWER_WAIT_MS = 5000;
export const CONTINUOUS_NEXT_DELAY_MS = 1000;
export const CONTINUOUS_ENGLISH_NUMBER_MIN = 400;
export const CONTINUOUS_ENGLISH_NUMBER_MAX = 5999;

export function getContinuousEnglishNumberWeight(value) {
  if (!Number.isInteger(value)) {
    return 0;
  }
  if (
    (value >= 4400 && value <= 4499) ||
    (value >= 5500 && value <= 5599)
  ) {
    return 3;
  }
  return value >= 4000 && value <= 5999 ? 2 : 1;
}

export function resolveContinuousListeningEnvironment(environment) {
  return ["light", "medium", "conversation"].includes(environment)
    ? environment
    : "medium";
}

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

export function createShuffledNumberSequence({
  min = CONTINUOUS_NUMBER_MIN,
  max = CONTINUOUS_NUMBER_MAX,
  rng = Math.random,
} = {}) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new RangeError("Continuous number bounds must be valid integers.");
  }
  const numbers = Array.from(
    { length: max - min + 1 },
    (_, index) => min + index,
  );
  for (let index = numbers.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [numbers[index], numbers[swapIndex]] = [numbers[swapIndex], numbers[index]];
  }
  return Object.freeze(numbers);
}

export function createShuffledContinuousSequence({
  min = CONTINUOUS_NUMBER_MIN,
  max = CONTINUOUS_NUMBER_MAX,
  quantityIds = [],
  rng = Math.random,
} = {}) {
  if (
    !Array.isArray(quantityIds) ||
    quantityIds.some((id) => typeof id !== "string" || id.length === 0) ||
    new Set(quantityIds).size !== quantityIds.length
  ) {
    throw new TypeError("Continuous quantity IDs must be unique strings.");
  }
  const items = [
    ...createShuffledNumberSequence({ min, max, rng }),
    ...quantityIds,
  ];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return Object.freeze(items);
}

export function createWeightedEnglishNumberSequence({
  min = CONTINUOUS_ENGLISH_NUMBER_MIN,
  max = CONTINUOUS_ENGLISH_NUMBER_MAX,
  rng = Math.random,
} = {}) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new RangeError("Continuous English number bounds must be valid integers.");
  }
  const numbers = [];
  for (let value = min; value <= max; value += 1) {
    const weight = getContinuousEnglishNumberWeight(value);
    for (let copy = 0; copy < weight; copy += 1) {
      numbers.push(value);
    }
  }
  for (let index = numbers.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [numbers[index], numbers[swapIndex]] = [numbers[swapIndex], numbers[index]];
  }
  return Object.freeze(numbers);
}

export function createContinuousNumberSession({
  rng = Math.random,
  quantityIds = [],
  min = CONTINUOUS_NUMBER_MIN,
  max = CONTINUOUS_NUMBER_MAX,
  continuousModeId = "continuous-number-listening",
} = {}) {
  return deepFreeze({
    continuousModeId,
    direction: "japanese-to-english",
    status: "active",
    phase: "prompt",
    items: createShuffledContinuousSequence({ min, max, rng, quantityIds }),
    currentIndex: 0,
  });
}

export function createContinuousEnglishNumberSession({ rng = Math.random } = {}) {
  return deepFreeze({
    continuousModeId: "continuous-english-listening",
    direction: "english-to-japanese",
    status: "active",
    phase: "prompt",
    items: createWeightedEnglishNumberSequence({ rng }),
    currentIndex: 0,
  });
}

export function getCurrentContinuousItem(session) {
  return session.status === "completed"
    ? null
    : session.items[session.currentIndex] ?? null;
}

export function resolveContinuousItem(dataset, item) {
  if (Number.isInteger(item)) {
    const reading = resolveNumberReading(dataset, item);
    return Object.freeze({
      kind: "number",
      displayAnswer: String(item),
      englishNumberText: toEnglishNumberWords(item),
      englishAnswerText: createEnglishAnswerText(item),
      ttsText: reading.ttsText,
      readingKana: reading.readingKana,
    });
  }
  const quantity = dataset.indexes?.numberDetailsById?.[item];
  if (
    !quantity ||
    !["item_quantity_native", "piece_counter_ko"].includes(
      quantity.number_type,
    )
  ) {
    throw new RangeError(`Unknown continuous-listening item "${item}".`);
  }
  const counterName = quantity.counter === "つ" ? "tsu" : "ko";
  return Object.freeze({
    kind: "quantity",
    displayAnswer: `${quantity.number_value}${quantity.counter}`,
    englishAnswerText:
      `The answer is ${toEnglishNumberWords(quantity.number_value)} items, ` +
      `using the ${counterName} counter.`,
    ttsText: quantity.tts_text,
    readingKana: quantity.reading_kana,
  });
}

export function setContinuousPhase(session, phase) {
  if (session.status !== "active") {
    throw new Error("Only an active continuous session can change phase.");
  }
  return deepFreeze({ ...session, phase });
}

export function pauseContinuousSession(session) {
  if (session.status !== "active") {
    throw new Error("Only an active continuous session can be paused.");
  }
  return deepFreeze({ ...session, status: "paused", phase: "paused" });
}

export function resumeContinuousSession(session) {
  if (session.status !== "paused") {
    throw new Error("Only a paused continuous session can be resumed.");
  }
  return deepFreeze({ ...session, status: "active", phase: "prompt" });
}

export function advanceContinuousSession(session) {
  if (session.status !== "active") {
    throw new Error("Only an active continuous session can advance.");
  }
  if (session.currentIndex === session.items.length - 1) {
    return deepFreeze({ ...session, status: "completed", phase: "completed" });
  }
  return deepFreeze({
    ...session,
    currentIndex: session.currentIndex + 1,
    phase: "prompt",
  });
}
