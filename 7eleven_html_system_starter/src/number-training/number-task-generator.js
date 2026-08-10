import {
  SELECTED_SERVICE_AMOUNTS,
  getNumberTrainingMode,
  getNumberTrainingRange,
} from "./number-training-config.js";
import { resolveNumberReading } from "./number-reading-engine.js";

const PATTERN_IDS = Object.freeze({
  "number-dictation": "NT_DICTATION",
  "tobacco-number": "NT_TOBACCO",
  "quantity-listening": "NT_QUANTITY",
  "tobacco-quantity": "NT_TOBACCO_QUANTITY",
  "service-amount": "NT_SERVICE_AMOUNT",
  "mixed-number-listening": "NT_MIXED",
  "number-reading": "NT_READING",
});

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

function sampleWithRounds(values, count, rng) {
  if (values.length === 0) {
    throw new RangeError("Cannot sample from an empty number-training pool.");
  }
  const result = [];
  while (result.length < count) {
    const round = shuffled(values, rng);
    if (
      result.length > 0 &&
      round.length > 1 &&
      round[0] === result[result.length - 1]
    ) {
      [round[0], round[1]] = [round[1], round[0]];
    }
    result.push(...round.slice(0, count - result.length));
  }
  return result;
}

function valuesInRange(range) {
  return Array.from(
    { length: range.max - range.min + 1 },
    (_, index) => range.min + index,
  );
}

function commonTask({
  modeId,
  patternId,
  rangeId,
  taskKind,
  exerciseKey,
  sourceRefs,
  ttsText,
  reveal,
  promptType = "listening",
  promptNumber = null,
}) {
  return {
    modeId,
    patternId,
    rangeId,
    taskKind,
    exerciseKey,
    sourceRefs,
    ttsText,
    promptType,
    promptNumber,
    reveal,
  };
}

function makePlainNumberTask({
  dataset,
  value,
  modeId = "number-dictation",
  patternId = PATTERN_IDS["number-dictation"],
  rangeId,
}) {
  const reading = resolveNumberReading(dataset, value);
  return commonTask({
    modeId,
    patternId,
    rangeId,
    taskKind: "plain-number",
    exerciseKey: `${patternId}:${rangeId}:${value}`,
    sourceRefs: [reading.sourceRef],
    ttsText: reading.ttsText,
    reveal: {
      numericAnswer: String(value),
      japanese: reading.japanese,
      readingKana: reading.readingKana,
      romaji: reading.romaji,
    },
  });
}

function makeReadingTask({ dataset, value, rangeId }) {
  const reading = resolveNumberReading(dataset, value);
  return commonTask({
    modeId: "number-reading",
    patternId: PATTERN_IDS["number-reading"],
    rangeId,
    taskKind: "number-reading",
    exerciseKey: `NT_READING:${rangeId}:${value}`,
    sourceRefs: [reading.sourceRef],
    ttsText: reading.ttsText,
    promptType: "speaking",
    promptNumber: value,
    reveal: {
      numericAnswer: String(value),
      japanese: reading.japanese,
      readingKana: reading.readingKana,
      romaji: reading.romaji,
    },
  });
}

function makeTobaccoTask({
  dataset,
  value,
  modeId = "tobacco-number",
  patternId = PATTERN_IDS["tobacco-number"],
  rangeId,
}) {
  const reading = resolveNumberReading(dataset, value);
  return commonTask({
    modeId,
    patternId,
    rangeId,
    taskKind: "tobacco-number",
    exerciseKey: `${patternId}:${rangeId}:${value}`,
    sourceRefs: [reading.sourceRef, "RULE_BAN"],
    ttsText: `${reading.ttsText}ばん`,
    reveal: {
      numericAnswer: `${value}番`,
      japanese: `${reading.japanese}番`,
      readingKana: `${reading.readingKana}ばん`,
      romaji: `${reading.romaji} ban`,
    },
  });
}

function getQuantityPool(dataset, counter = "mixed") {
  const allowedTypes =
    counter === "つ"
      ? ["item_quantity_native"]
      : counter === "個"
        ? ["piece_counter_ko"]
        : ["item_quantity_native", "piece_counter_ko"];
  return dataset.numberDetail.filter((detail) =>
    allowedTypes.includes(detail.number_type),
  );
}

function makeQuantityTask({
  quantity,
  modeId = "quantity-listening",
  patternId = PATTERN_IDS["quantity-listening"],
  rangeId,
}) {
  return commonTask({
    modeId,
    patternId,
    rangeId,
    taskKind: "quantity",
    exerciseKey: `${patternId}:${rangeId}:${quantity.number_id}`,
    sourceRefs: [quantity.number_id],
    ttsText: quantity.tts_text,
    reveal: {
      numericAnswer: `${quantity.number_value}${quantity.counter}`,
      japanese: quantity.japanese,
      readingKana: quantity.reading_kana,
      romaji: quantity.romaji,
    },
  });
}

function makeTobaccoQuantityTask({
  dataset,
  value,
  quantity,
  modeId = "tobacco-quantity",
  patternId = PATTERN_IDS["tobacco-quantity"],
  rangeId,
}) {
  const reading = resolveNumberReading(dataset, value);
  return commonTask({
    modeId,
    patternId,
    rangeId,
    taskKind: "tobacco-quantity",
    exerciseKey:
      `${patternId}:${rangeId}:${value}:${quantity.number_id}`,
    sourceRefs: [
      reading.sourceRef,
      "RULE_BAN",
      quantity.number_id,
    ],
    ttsText:
      `${reading.ttsText}ばんを${quantity.tts_text}ください`,
    reveal: {
      numericAnswer:
        `${value}番 × ${quantity.number_value}${quantity.counter}`,
      japanese:
        `${reading.japanese}番を${quantity.japanese}ください`,
      readingKana:
        `${reading.readingKana}ばんを${quantity.reading_kana}ください`,
      romaji:
        `${reading.romaji} ban o ${quantity.romaji} kudasai`,
    },
  });
}

function makeServiceAmountTask({
  dataset,
  value,
  modeId = "service-amount",
  patternId = PATTERN_IDS["service-amount"],
  rangeId = "service-selected",
}) {
  const reading = resolveNumberReading(dataset, value);
  return commonTask({
    modeId,
    patternId,
    rangeId,
    taskKind: "service-amount",
    exerciseKey: `${patternId}:${rangeId}:${value}`,
    sourceRefs: [reading.sourceRef, "RULE_EN"],
    ttsText: `${reading.ttsText}えん`,
    reveal: {
      numericAnswer: `¥${value}`,
      japanese: `${reading.japanese}円`,
      readingKana: `${reading.readingKana}えん`,
      romaji: `${reading.romaji} en`,
    },
  });
}

function generateMixedTasks({ dataset, sessionSize, rng, rangeId }) {
  const kinds = sampleWithRounds(
    [
      "plain-number",
      "tobacco-number",
      "quantity",
      "tobacco-quantity",
      "service-amount",
    ],
    sessionSize,
    rng,
  );
  const quantities = getQuantityPool(dataset, "mixed");

  return kinds.map((kind) => {
    if (kind === "quantity") {
      return makeQuantityTask({
        quantity: quantities[randomIndex(quantities.length, rng)],
        modeId: "mixed-number-listening",
        patternId: PATTERN_IDS["mixed-number-listening"],
        rangeId,
      });
    }
    if (kind === "service-amount") {
      return makeServiceAmountTask({
        dataset,
        value:
          SELECTED_SERVICE_AMOUNTS[
            randomIndex(SELECTED_SERVICE_AMOUNTS.length, rng)
          ],
        modeId: "mixed-number-listening",
        patternId: PATTERN_IDS["mixed-number-listening"],
        rangeId,
      });
    }

    const value = 1 + randomIndex(300, rng);
    if (kind === "tobacco-number") {
      return makeTobaccoTask({
        dataset,
        value,
        modeId: "mixed-number-listening",
        patternId: PATTERN_IDS["mixed-number-listening"],
        rangeId,
      });
    }
    if (kind === "tobacco-quantity") {
      return makeTobaccoQuantityTask({
        dataset,
        value,
        quantity: quantities[randomIndex(quantities.length, rng)],
        modeId: "mixed-number-listening",
        patternId: PATTERN_IDS["mixed-number-listening"],
        rangeId,
      });
    }
    return makePlainNumberTask({
      dataset,
      value,
      modeId: "mixed-number-listening",
      patternId: PATTERN_IDS["mixed-number-listening"],
      rangeId,
    });
  });
}

export function generateNumberTrainingTasks({
  dataset,
  modeId,
  rangeId,
  sessionSize,
  rng = Math.random,
}) {
  const mode = getNumberTrainingMode(modeId);
  const range = getNumberTrainingRange(modeId, rangeId);
  if (!mode || modeId === "number-multiple-choice") {
    throw new RangeError(`Unsupported self-marking mode "${modeId}".`);
  }
  if (!range) {
    throw new RangeError(`Unknown range "${rangeId}" for ${modeId}.`);
  }
  if (!Number.isInteger(sessionSize) || sessionSize <= 0) {
    throw new RangeError("Session size must be a positive integer.");
  }

  let tasks;
  if (modeId === "mixed-number-listening") {
    tasks = generateMixedTasks({ dataset, sessionSize, rng, rangeId });
  } else if (modeId === "quantity-listening") {
    const quantities = getQuantityPool(dataset, range.counter);
    tasks = sampleWithRounds(quantities, sessionSize, rng).map((quantity) =>
      makeQuantityTask({ quantity, rangeId }),
    );
  } else if (modeId === "service-amount") {
    tasks = sampleWithRounds(
      SELECTED_SERVICE_AMOUNTS,
      sessionSize,
      rng,
    ).map((value) => makeServiceAmountTask({ dataset, value, rangeId }));
  } else {
    const values = sampleWithRounds(
      valuesInRange(range),
      sessionSize,
      rng,
    );
    if (modeId === "number-dictation") {
      tasks = values.map((value) =>
        makePlainNumberTask({ dataset, value, rangeId }),
      );
    } else if (modeId === "number-reading") {
      tasks = values.map((value) =>
        makeReadingTask({ dataset, value, rangeId }),
      );
    } else if (modeId === "tobacco-number") {
      tasks = values.map((value) =>
        makeTobaccoTask({ dataset, value, rangeId }),
      );
    } else if (modeId === "tobacco-quantity") {
      const quantities = getQuantityPool(dataset, "mixed");
      tasks = values.map((value) =>
        makeTobaccoQuantityTask({
          dataset,
          value,
          quantity: quantities[randomIndex(quantities.length, rng)],
          rangeId,
        }),
      );
    }
  }

  return deepFreeze(
    tasks.map((task, index) => ({
      ...task,
      taskId: `${task.exerciseKey}:session-${index}`,
    })),
  );
}

export {
  makePlainNumberTask as composePlainNumberTask,
  makeQuantityTask as composeQuantityTask,
  makeReadingTask as composeReadingTask,
  makeServiceAmountTask as composeServiceAmountTask,
  makeTobaccoQuantityTask as composeTobaccoQuantityTask,
  makeTobaccoTask as composeTobaccoNumberTask,
};
