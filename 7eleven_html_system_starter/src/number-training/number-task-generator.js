import {
  MONEY_READING_AMOUNTS,
  SELECTED_SERVICE_AMOUNTS,
  getNumberTrainingMode,
  getNumberTrainingRange,
} from "./number-training-config.js";
import {
  createPureNumberRuntime,
  resolveNumberReading,
} from "./number-reading-engine.js";

const PATTERN_IDS = Object.freeze({
  "number-dictation": "NT_DICTATION",
  "tobacco-number": "NT_TOBACCO",
  "quantity-listening": "NT_QUANTITY",
  "tobacco-quantity": "NT_TOBACCO_QUANTITY",
  "service-amount": "NT_SERVICE_AMOUNT",
  "mixed-number-listening": "NT_MIXED",
  "number-reading": "NT_READING",
  "price-reading": "NT_PRICE_READING",
  "total-reading": "NT_TOTAL_READING",
  "change-reading": "NT_CHANGE_READING",
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

function sampleWithCoverageRounds(
  values,
  count,
  rng,
  coverage = {},
  keyOf = String,
  arrangeRound = (available) => shuffled(available, rng),
) {
  if (values.length === 0) {
    throw new RangeError("Cannot sample from an empty number-training pool.");
  }
  let cycle =
    Number.isInteger(coverage?.cycle) && coverage.cycle > 0
      ? coverage.cycle
      : 1;
  let presentedKeys = new Set(
    Array.isArray(coverage?.presentedKeys)
      ? coverage.presentedKeys.filter((key) => typeof key === "string")
      : [],
  );
  const result = [];

  while (result.length < count) {
    let available = values.filter(
      (value) => !presentedKeys.has(keyOf(value)),
    );
    if (available.length === 0) {
      cycle += 1;
      presentedKeys = new Set();
      available = values;
    }
    const previousKey =
      result.at(-1)?.coverageKey ??
      coverage?.presentedKeys?.at(-1) ??
      null;
    const round = arrangeRound(
      available,
      count - result.length,
      previousKey,
    );
    if (
      result.length > 0 &&
      round.length > 1 &&
      keyOf(round[0]) === result[result.length - 1].coverageKey
    ) {
      [round[0], round[1]] = [round[1], round[0]];
    }
    for (const value of round.slice(0, count - result.length)) {
      const coverageKey = keyOf(value);
      result.push({ value, coverageKey, coverageCycle: cycle });
      presentedKeys.add(coverageKey);
    }
  }
  return result;
}

export function getThousandsBand(value) {
  return Math.floor(value / 1000);
}

export function getRemainderHundredsBand(value) {
  return Math.floor((value % 1000) / 100);
}

export function isDifferentMixedTenThousandBand(previous, next) {
  return (
    Number.isInteger(previous) &&
    Number.isInteger(next) &&
    getThousandsBand(previous) !== getThousandsBand(next) &&
    getRemainderHundredsBand(previous) !== getRemainderHundredsBand(next)
  );
}

function arrangeMixedTenThousandRound(
  available,
  allItems,
  rng,
  needed,
  previousKey,
) {
  const candidates = shuffled(available, rng);
  const arranged = [];
  let previous = Number(previousKey);
  while (candidates.length > 0 && arranged.length < needed) {
    const candidateIndex = Number.isInteger(previous)
      ? candidates.findIndex((item) =>
          isDifferentMixedTenThousandBand(previous, item.value),
        )
      : 0;
    if (candidateIndex < 0) {
      const bridge = shuffled(allItems, rng).find(
        (item) =>
          !arranged.some((selected) => selected.key === item.key) &&
          isDifferentMixedTenThousandBand(previous, item.value) &&
          candidates.some((candidate) =>
            isDifferentMixedTenThousandBand(item.value, candidate.value),
          ),
      );
      if (!bridge) {
        throw new Error("Could not satisfy the Mixed 1–10000 transition rule.");
      }
      arranged.push(bridge);
      previous = bridge.value;
      continue;
    }
    const [candidate] = candidates.splice(candidateIndex, 1);
    arranged.push(candidate);
    previous = candidate.value;
  }
  return arranged;
}

function arrangeMixedDictationRound(available, rng) {
  const numbers = shuffled(
    available.filter((item) => item.kind === "number"),
    rng,
  );
  const tsu = shuffled(
    available.filter(
      (item) => item.kind === "quantity" && item.quantity.counter === "つ",
    ),
    rng,
  );
  const ko = shuffled(
    available.filter(
      (item) => item.kind === "quantity" && item.quantity.counter === "個",
    ),
    rng,
  );
  const quantities = [];
  while (tsu.length > 0 || ko.length > 0) {
    if (tsu.length > 0) quantities.push(tsu.shift());
    if (ko.length > 0) quantities.push(ko.shift());
  }
  const arranged = [];
  while (numbers.length > 0 || quantities.length > 0) {
    arranged.push(...numbers.splice(0, 6));
    if (quantities.length > 0) arranged.push(quantities.shift());
  }
  return arranged;
}

const FOCUSED_READING_GROUPS = Object.freeze([
  Object.freeze([400, 499]),
  Object.freeze([500, 599]),
  Object.freeze([4000, 4999]),
  Object.freeze([5000, 5999]),
]);

export function isFocusedReadingValue(value) {
  return FOCUSED_READING_GROUPS.some(
    ([min, max]) => value >= min && value <= max,
  );
}

function sampleFocusedReadingRange(values, count, rng, coverage = {}) {
  let cycle =
    Number.isInteger(coverage?.cycle) && coverage.cycle > 0
      ? coverage.cycle
      : 1;
  let presentedKeys = new Set(
    Array.isArray(coverage?.presentedKeys)
      ? coverage.presentedKeys.filter((key) => typeof key === "string")
      : [],
  );
  if (values.every((item) => presentedKeys.has(item.key))) {
    cycle += 1;
    presentedKeys = new Set();
  }

  const selectedKeys = new Set();
  const result = [];
  const chooseOne = (pool) => {
    const unseen = shuffled(
      pool.filter(
        (item) =>
          !presentedKeys.has(item.key) && !selectedKeys.has(item.key),
      ),
      rng,
    );
    const fallback = unseen.length > 0
      ? unseen
      : shuffled(
          pool.filter((item) => !selectedKeys.has(item.key)),
          rng,
        );
    const item = fallback[0];
    if (!item) return false;
    result.push({ value: item, coverageKey: item.key, coverageCycle: cycle });
    selectedKeys.add(item.key);
    presentedKeys.add(item.key);
    return true;
  };

  const focusCount = Math.round((count * 2) / 3);
  const groupPools = FOCUSED_READING_GROUPS.map(([min, max]) =>
    values.filter((item) => item.value >= min && item.value <= max),
  );
  const groupOffset = (coverage?.presentedKeys?.length ?? 0) % groupPools.length;
  for (let index = 0; index < focusCount; index += 1) {
    chooseOne(groupPools[(groupOffset + index) % groupPools.length]);
  }

  const otherPool = values.filter((item) => !isFocusedReadingValue(item.value));
  while (result.length < count && chooseOne(otherPool)) {
    // Fill the remaining one-third with other numbers in the range.
  }
  while (result.length < count && chooseOne(values)) {
    // Defensive fallback for unusually large future session sizes.
  }
  return shuffled(result, rng);
}

function addCoverage(task, selection) {
  return {
    ...task,
    coverageKey: selection.coverageKey,
    coverageCycle: selection.coverageCycle,
  };
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
  pureNumber = null,
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
    ...(pureNumber === null ? {} : { pureNumber }),
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
  const pureNumber = createPureNumberRuntime(dataset, value);
  return commonTask({
    modeId,
    patternId,
    rangeId,
    taskKind: "plain-number",
    exerciseKey: `${patternId}:${rangeId}:${value}`,
    sourceRefs: [reading.sourceRef],
    ttsText: pureNumber.ttsText,
    reveal: {
      numericAnswer: String(value),
      readingKana: pureNumber.readingKana,
      romaji: pureNumber.romaji,
    },
    pureNumber,
  });
}

function makeReadingTask({ dataset, value, rangeId }) {
  const reading = resolveNumberReading(dataset, value);
  const pureNumber = createPureNumberRuntime(dataset, value);
  return commonTask({
    modeId: "number-reading",
    patternId: PATTERN_IDS["number-reading"],
    rangeId,
    taskKind: "number-reading",
    exerciseKey: `NT_READING:${rangeId}:${value}`,
    sourceRefs: [reading.sourceRef],
    ttsText: pureNumber.ttsText,
    promptType: "speaking",
    promptNumber: value,
    reveal: {
      numericAnswer: String(value),
      readingKana: pureNumber.readingKana,
      romaji: pureNumber.romaji,
    },
    pureNumber,
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
  const pureNumber = createPureNumberRuntime(dataset, value);
  return commonTask({
    modeId,
    patternId,
    rangeId,
    taskKind: "tobacco-number",
    exerciseKey: `${patternId}:${rangeId}:${value}`,
    sourceRefs: [reading.sourceRef, "RULE_BAN"],
    ttsText: `${pureNumber.ttsText}ばん`,
    reveal: {
      numericAnswer: `${value}番`,
      readingKana: `${pureNumber.readingKana}ばん`,
      romaji: `${pureNumber.romaji} ban`,
    },
  });
}

export function getQuantityTrainingPool(dataset, counter = "mixed") {
  const allowedTypes =
    counter === "つ"
      ? ["item_quantity_native"]
      : counter === "個"
        ? ["piece_counter_ko"]
        : ["item_quantity_native", "piece_counter_ko"];
  return (dataset.numberDetail ?? []).filter((detail) =>
    allowedTypes.includes(detail.number_type),
  );
}

export function getNumberTrainingCoverageItems(dataset, modeId, range) {
  if (!Number.isInteger(range?.min) || !Number.isInteger(range?.max)) {
    return [];
  }
  const numberItems = valuesInRange(range).map((value) => ({
    key: String(value),
    label: String(value),
    kind: "number",
    value,
  }));
  if (
    modeId !== "number-dictation" ||
    range.id !== "dictation-mixed-1-300"
  ) {
    return numberItems;
  }
  return [
    ...numberItems,
    ...getQuantityTrainingPool(dataset, "mixed").map((quantity) => ({
      key: quantity.number_id,
      label: `${quantity.number_value}${quantity.counter}`,
      kind: "quantity",
      quantity,
    })),
  ];
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
  const pureNumber = createPureNumberRuntime(dataset, value);
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
      `${pureNumber.ttsText}ばんを${quantity.tts_text}ください`,
    reveal: {
      numericAnswer:
        `${value}番 × ${quantity.number_value}${quantity.counter}`,
      readingKana:
        `${pureNumber.readingKana}ばんを${quantity.reading_kana}ください`,
      romaji:
        `${pureNumber.romaji} ban o ${quantity.romaji} kudasai`,
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
  const pureNumber = createPureNumberRuntime(dataset, value);
  return commonTask({
    modeId,
    patternId,
    rangeId,
    taskKind: "service-amount",
    exerciseKey: `${patternId}:${rangeId}:${value}`,
    sourceRefs: [reading.sourceRef, "RULE_EN"],
    ttsText: `${pureNumber.ttsText}えん`,
    reveal: {
      numericAnswer: `${value}円`,
      readingKana: `${pureNumber.readingKana}えん`,
      romaji: `${pureNumber.romaji} en`,
    },
  });
}

function makeMoneyReadingTask({ dataset, value, modeId, rangeId }) {
  const reading = resolveNumberReading(dataset, value);
  const pureNumber = createPureNumberRuntime(dataset, value);
  const patternId = PATTERN_IDS[modeId];
  const taskKind = modeId;
  return commonTask({
    modeId,
    patternId,
    rangeId,
    taskKind,
    exerciseKey: `${patternId}:${rangeId}:${value}:RULE_EN`,
    sourceRefs: [reading.sourceRef, "RULE_EN"],
    ttsText: `${pureNumber.ttsText}えん`,
    promptType: "speaking",
    promptNumber: `${value}円`,
    reveal: {
      numericAnswer: `${value}円`,
      readingKana: `${pureNumber.readingKana}えん`,
      romaji: `${pureNumber.romaji} en`,
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
  const quantities = getQuantityTrainingPool(dataset, "mixed");

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
  coverage = null,
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
    const quantities = getQuantityTrainingPool(dataset, range.counter);
    tasks = sampleWithCoverageRounds(
      quantities,
      sessionSize,
      rng,
      coverage,
      (quantity) => quantity.number_id,
    ).map((selection) =>
      addCoverage(
        makeQuantityTask({ quantity: selection.value, rangeId }),
        selection,
      ),
    );
  } else if (modeId === "service-amount") {
    tasks = sampleWithCoverageRounds(
      SELECTED_SERVICE_AMOUNTS,
      sessionSize,
      rng,
      coverage,
    ).map((selection) =>
      addCoverage(
        makeServiceAmountTask({
          dataset,
          value: selection.value,
          rangeId,
        }),
        selection,
      ),
    );
  } else if (
    modeId === "price-reading" ||
    modeId === "total-reading" ||
    modeId === "change-reading"
  ) {
    tasks = sampleWithCoverageRounds(
      MONEY_READING_AMOUNTS,
      sessionSize,
      rng,
      coverage,
    ).map((selection) =>
      addCoverage(
        makeMoneyReadingTask({
          dataset,
          value: selection.value,
          modeId,
          rangeId,
        }),
        selection,
      ),
    );
  } else {
    const coverageItems = getNumberTrainingCoverageItems(
      dataset,
      modeId,
      range,
    );
    const selections = range.id === "reading-focused-400-5999"
      ? sampleFocusedReadingRange(
          coverageItems,
          sessionSize,
          rng,
          coverage,
        )
      : sampleWithCoverageRounds(
          coverageItems,
          sessionSize,
          rng,
          coverage,
          (item) => item.key,
          range.id === "dictation-mixed-1-300"
            ? (available) => arrangeMixedDictationRound(available, rng)
            : range.id === "reading-mixed-1-10000"
              ? (available, needed, previousKey) =>
                  arrangeMixedTenThousandRound(
                    available,
                    coverageItems,
                    rng,
                    needed,
                    previousKey,
                  )
              : undefined,
        );
    if (modeId === "number-dictation") {
      tasks = selections.map((selection) =>
        addCoverage(
          selection.value.kind === "quantity"
            ? makeQuantityTask({
                quantity: selection.value.quantity,
                modeId,
                patternId: PATTERN_IDS[modeId],
                rangeId,
              })
            : makePlainNumberTask({
                dataset,
                value: selection.value.value,
                rangeId,
              }),
          selection,
        ),
      );
    } else if (modeId === "number-reading") {
      tasks = selections.map((selection) =>
        addCoverage(
          makeReadingTask({
            dataset,
            value: selection.value.value,
            rangeId,
          }),
          selection,
        ),
      );
    } else if (modeId === "tobacco-number") {
      tasks = selections.map((selection) =>
        addCoverage(
          makeTobaccoTask({
            dataset,
            value: selection.value.value,
            rangeId,
          }),
          selection,
        ),
      );
    } else if (modeId === "tobacco-quantity") {
      const quantities = getQuantityTrainingPool(dataset, "mixed");
      tasks = selections.map((selection) =>
        addCoverage(
          makeTobaccoQuantityTask({
            dataset,
            value: selection.value.value,
            quantity: quantities[randomIndex(quantities.length, rng)],
            rangeId,
          }),
          selection,
        ),
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
  makeMoneyReadingTask as composeMoneyReadingTask,
  makeServiceAmountTask as composeServiceAmountTask,
  makeTobaccoQuantityTask as composeTobaccoQuantityTask,
  makeTobaccoTask as composeTobaccoNumberTask,
};
