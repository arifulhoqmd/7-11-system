export const PROGRESS_STORAGE_KEY = "sevenElevenTraining.progress.v1";
export const PROGRESS_SCHEMA_VERSION = 1;
export const SESSION_SIZE_OPTIONS = Object.freeze([5, 10, 15, 20]);
export const TTS_RATE_OPTIONS = Object.freeze([0.75, 0.9, 1]);

export const DEFAULT_SETTINGS = Object.freeze({
  stage: "A",
  sessionSize: 10,
  showKana: true,
  showRomaji: true,
  ttsRate: 0.9,
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonNegativeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function nullableString(value) {
  return typeof value === "string" ? value : null;
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

export function normalizeSettings(settings = {}) {
  const candidate = isRecord(settings) ? settings : {};
  return Object.freeze({
    stage: candidate.stage === "B" ? "B" : "A",
    sessionSize: SESSION_SIZE_OPTIONS.includes(candidate.sessionSize)
      ? candidate.sessionSize
      : DEFAULT_SETTINGS.sessionSize,
    showKana:
      typeof candidate.showKana === "boolean"
        ? candidate.showKana
        : DEFAULT_SETTINGS.showKana,
    showRomaji:
      typeof candidate.showRomaji === "boolean"
        ? candidate.showRomaji
        : DEFAULT_SETTINGS.showRomaji,
    ttsRate: TTS_RATE_OPTIONS.includes(candidate.ttsRate)
      ? candidate.ttsRate
      : DEFAULT_SETTINGS.ttsRate,
  });
}

function normalizeDatasetMetadata(metadata = {}) {
  return {
    filename:
      typeof metadata.filename === "string" ? metadata.filename : "",
    updated: typeof metadata.updated === "string" ? metadata.updated : "",
    masterItemCount: nonNegativeInteger(metadata.masterItemCount),
  };
}

function sanitizeItemProgress(value) {
  const item = isRecord(value) ? value : {};
  return {
    attempts: nonNegativeInteger(item.attempts),
    correct: nonNegativeInteger(item.correct),
    incorrect: nonNegativeInteger(item.incorrect),
    streak: nonNegativeInteger(item.streak),
    lastSeenAt: nullableString(item.lastSeenAt),
    lastResult:
      typeof item.lastResult === "boolean" ? item.lastResult : null,
  };
}

function sanitizeExerciseProgress(value) {
  const exercise = isRecord(value) ? value : {};
  return {
    patternId:
      typeof exercise.patternId === "string" ? exercise.patternId : "",
    sourceRefs: Array.isArray(exercise.sourceRefs)
      ? exercise.sourceRefs.filter((ref) => typeof ref === "string")
      : [],
    attempts: nonNegativeInteger(exercise.attempts),
    correct: nonNegativeInteger(exercise.correct),
    incorrect: nonNegativeInteger(exercise.incorrect),
    lastSeenAt: nullableString(exercise.lastSeenAt),
  };
}

function sanitizeMistakeProgress(value) {
  const mistake = isRecord(value) ? value : {};
  return {
    status: mistake.status === "resolved" ? "resolved" : "active",
    wrongCount: nonNegativeInteger(mistake.wrongCount),
    reviewCorrectStreak: nonNegativeInteger(mistake.reviewCorrectStreak),
    lastWrongAt: nullableString(mistake.lastWrongAt),
    resolvedAt: nullableString(mistake.resolvedAt),
  };
}

function sanitizePerformance(value) {
  const performance = isRecord(value) ? value : {};
  return {
    attempts: nonNegativeInteger(performance.attempts),
    correct: nonNegativeInteger(performance.correct),
    incorrect: nonNegativeInteger(performance.incorrect),
    lastSeenAt: nullableString(performance.lastSeenAt),
  };
}

function sanitizeRecordMap(value, sanitizer) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.length > 0)
      .map(([key, record]) => [key, sanitizer(record)]),
  );
}

function sanitizeNumberTraining(value) {
  const numberTraining = isRecord(value) ? value : {};
  return {
    skills: sanitizeRecordMap(numberTraining.skills, sanitizePerformance),
    modes: sanitizeRecordMap(numberTraining.modes, sanitizePerformance),
    ranges: sanitizeRecordMap(numberTraining.ranges, sanitizePerformance),
    taskKinds: sanitizeRecordMap(
      numberTraining.taskKinds,
      sanitizePerformance,
    ),
  };
}

function sanitizeSession(value) {
  const session = isRecord(value) ? value : {};
  return {
    sessionId:
      typeof session.sessionId === "string" ? session.sessionId : "",
    startedAt: nullableString(session.startedAt),
    finishedAt: nullableString(session.finishedAt),
    mode: typeof session.mode === "string" ? session.mode : "",
    patternId:
      typeof session.patternId === "string" ? session.patternId : "",
    stage:
      session.stage === "B"
        ? "B"
        : session.stage === "number-training"
          ? "number-training"
          : "A",
    total: nonNegativeInteger(session.total),
    correct: nonNegativeInteger(session.correct),
    exerciseKeys: Array.isArray(session.exerciseKeys)
      ? session.exerciseKeys.filter((key) => typeof key === "string")
      : [],
  };
}

export function createDefaultProgress(datasetMetadata = {}) {
  return deepFreeze({
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    dataset: normalizeDatasetMetadata(datasetMetadata),
    settings: { ...DEFAULT_SETTINGS },
    items: {},
    exercises: {},
    mistakes: {},
    numberTraining: {
      skills: {},
      modes: {},
      ranges: {},
      taskKinds: {},
    },
    sessions: [],
  });
}

export function sanitizeProgress(value, datasetMetadata = {}) {
  const progress = isRecord(value) ? value : {};
  return deepFreeze({
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    dataset: normalizeDatasetMetadata(datasetMetadata),
    settings: normalizeSettings(progress.settings),
    items: sanitizeRecordMap(progress.items, sanitizeItemProgress),
    exercises: sanitizeRecordMap(
      progress.exercises,
      sanitizeExerciseProgress,
    ),
    mistakes: sanitizeRecordMap(progress.mistakes, sanitizeMistakeProgress),
    numberTraining: sanitizeNumberTraining(progress.numberTraining),
    sessions: Array.isArray(progress.sessions)
      ? progress.sessions.slice(-50).map(sanitizeSession)
      : [],
  });
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createProgressStore({
  storage = getDefaultStorage(),
  storageKey = PROGRESS_STORAGE_KEY,
  datasetMetadata = {},
} = {}) {
  let snapshot = createDefaultProgress(datasetMetadata);
  let loaded = false;
  let lastError = null;

  function persist(nextSnapshot) {
    snapshot = sanitizeProgress(nextSnapshot, datasetMetadata);
    if (storage !== undefined && storage !== null) {
      try {
        storage.setItem(storageKey, JSON.stringify(snapshot));
        lastError = null;
      } catch (error) {
        lastError = error;
      }
    }
    return snapshot;
  }

  function load() {
    if (loaded) {
      return snapshot;
    }
    loaded = true;

    if (storage === undefined || storage === null) {
      return snapshot;
    }

    try {
      const stored = storage.getItem(storageKey);
      if (stored !== null) {
        snapshot = sanitizeProgress(JSON.parse(stored), datasetMetadata);
      }
      lastError = null;
    } catch (error) {
      snapshot = createDefaultProgress(datasetMetadata);
      lastError = error;
    }
    return snapshot;
  }

  function getSnapshot() {
    return snapshot;
  }

  function updateSettings(settingsPatch) {
    load();
    return persist({
      ...snapshot,
      settings: normalizeSettings({
        ...snapshot.settings,
        ...settingsPatch,
      }),
    });
  }

  function recordAnswer({
    exerciseKey,
    patternId,
    sourceRefs,
    correct,
    answeredAt = new Date().toISOString(),
    numberTraining = null,
  }) {
    load();
    if (typeof exerciseKey !== "string" || exerciseKey.length === 0) {
      throw new TypeError("Answer result requires an exerciseKey.");
    }
    if (typeof patternId !== "string" || patternId.length === 0) {
      throw new TypeError("Answer result requires a patternId.");
    }
    if (!Array.isArray(sourceRefs) || sourceRefs.length === 0) {
      throw new TypeError("Answer result requires sourceRefs.");
    }
    if (typeof correct !== "boolean") {
      throw new TypeError("Answer result requires a boolean correct value.");
    }

    const uniqueSourceRefs = [
      ...new Set(sourceRefs.filter((ref) => typeof ref === "string" && ref)),
    ];
    const items = { ...snapshot.items };
    for (const sourceRef of uniqueSourceRefs) {
      const previous = items[sourceRef] ?? {};
      items[sourceRef] = {
        attempts: nonNegativeInteger(previous.attempts) + 1,
        correct:
          nonNegativeInteger(previous.correct) + (correct ? 1 : 0),
        incorrect:
          nonNegativeInteger(previous.incorrect) + (correct ? 0 : 1),
        streak: correct ? nonNegativeInteger(previous.streak) + 1 : 0,
        lastSeenAt: answeredAt,
        lastResult: correct,
      };
    }

    const previousExercise = snapshot.exercises[exerciseKey] ?? {};
    const exercises = {
      ...snapshot.exercises,
      [exerciseKey]: {
        patternId,
        sourceRefs: uniqueSourceRefs,
        attempts: nonNegativeInteger(previousExercise.attempts) + 1,
        correct:
          nonNegativeInteger(previousExercise.correct) + (correct ? 1 : 0),
        incorrect:
          nonNegativeInteger(previousExercise.incorrect) +
          (correct ? 0 : 1),
        lastSeenAt: answeredAt,
      },
    };

    const mistakes = { ...snapshot.mistakes };
    const previousMistake = mistakes[exerciseKey];
    if (!correct) {
      mistakes[exerciseKey] = {
        status: "active",
        wrongCount: nonNegativeInteger(previousMistake?.wrongCount) + 1,
        reviewCorrectStreak: 0,
        lastWrongAt: answeredAt,
        resolvedAt: null,
      };
    } else if (previousMistake) {
      const reviewCorrectStreak =
        previousMistake.status === "active"
          ? nonNegativeInteger(previousMistake.reviewCorrectStreak) + 1
          : nonNegativeInteger(previousMistake.reviewCorrectStreak);
      const resolved =
        previousMistake.status === "resolved" || reviewCorrectStreak >= 2;
      mistakes[exerciseKey] = {
        ...previousMistake,
        status: resolved ? "resolved" : "active",
        reviewCorrectStreak,
        resolvedAt: resolved
          ? previousMistake.resolvedAt ?? answeredAt
          : null,
      };
    }

    let numberTrainingProgress = snapshot.numberTraining;
    if (isRecord(numberTraining)) {
      const increment = (collection, key) => {
        if (typeof key !== "string" || key.length === 0) {
          return collection;
        }
        const previous = collection[key] ?? {};
        return {
          ...collection,
          [key]: {
            attempts: nonNegativeInteger(previous.attempts) + 1,
            correct:
              nonNegativeInteger(previous.correct) + (correct ? 1 : 0),
            incorrect:
              nonNegativeInteger(previous.incorrect) + (correct ? 0 : 1),
            lastSeenAt: answeredAt,
          },
        };
      };

      numberTrainingProgress = {
        skills: increment(
          snapshot.numberTraining.skills,
          numberTraining.skill,
        ),
        modes: increment(
          snapshot.numberTraining.modes,
          numberTraining.modeId,
        ),
        ranges: increment(
          snapshot.numberTraining.ranges,
          numberTraining.rangeId,
        ),
        taskKinds: increment(
          snapshot.numberTraining.taskKinds,
          numberTraining.taskKind,
        ),
      };
    }

    return persist({
      ...snapshot,
      items,
      exercises,
      mistakes,
      numberTraining: numberTrainingProgress,
    });
  }

  function recordSessionSummary(summary) {
    load();
    if (!isRecord(summary) || typeof summary.sessionId !== "string") {
      throw new TypeError("A valid session summary is required.");
    }
    return persist({
      ...snapshot,
      sessions: [...snapshot.sessions, summary].slice(-50),
    });
  }

  function reset() {
    loaded = true;
    return persist(createDefaultProgress(datasetMetadata));
  }

  function exportJson() {
    load();
    return JSON.stringify(snapshot, null, 2);
  }

  function importJson(jsonText) {
    const parsed = JSON.parse(jsonText);
    loaded = true;
    return persist(parsed);
  }

  function getLastError() {
    return lastError;
  }

  return Object.freeze({
    load,
    getSnapshot,
    updateSettings,
    recordAnswer,
    recordSessionSummary,
    reset,
    exportJson,
    importJson,
    getLastError,
  });
}
