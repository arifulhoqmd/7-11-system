export const PROGRESS_STORAGE_KEY = "sevenElevenTraining.progress.v1";
export const PROGRESS_SCHEMA_VERSION = 5;
export const SESSION_SIZE_OPTIONS = Object.freeze([5, 10, 15, 20]);
export const TTS_RATE_OPTIONS = Object.freeze([0.75, 0.9, 1]);
export const ANSWER_TIME_LIMIT_OPTIONS = Object.freeze([1, 2, 3, 5, 7]);
export const LISTENING_ENVIRONMENT_OPTIONS = Object.freeze([
  "clean",
  "light",
  "medium",
  "conversation",
]);
const LISTENING_ATTEMPT_LIMIT = 500;

export const DEFAULT_SETTINGS = Object.freeze({
  stage: "A",
  sessionSize: 10,
  showKana: true,
  showRomaji: true,
  ttsRate: 0.9,
  listeningEnvironment: "clean",
  answerTimeLimitSeconds: 5,
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
    listeningEnvironment: LISTENING_ENVIRONMENT_OPTIONS.includes(
      candidate.listeningEnvironment,
    )
      ? candidate.listeningEnvironment
      : DEFAULT_SETTINGS.listeningEnvironment,
    answerTimeLimitSeconds: ANSWER_TIME_LIMIT_OPTIONS.includes(
      candidate.answerTimeLimitSeconds,
    )
      ? candidate.answerTimeLimitSeconds
      : DEFAULT_SETTINGS.answerTimeLimitSeconds,
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
    ...(typeof exercise.modeId === "string" && exercise.modeId.length > 0
      ? { modeId: exercise.modeId }
      : {}),
    ...(typeof exercise.rangeId === "string" && exercise.rangeId.length > 0
      ? { rangeId: exercise.rangeId }
      : {}),
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
    timedAttempts: nonNegativeInteger(performance.timedAttempts),
    totalResponseTimeMs: nonNegativeInteger(
      performance.totalResponseTimeMs,
    ),
    replayedAttempts: nonNegativeInteger(performance.replayedAttempts),
    totalReplays: nonNegativeInteger(performance.totalReplays),
  };
}

function removeRecordKey(collection, key) {
  const next = { ...collection };
  delete next[key];
  return next;
}

function subtractPerformance(collection, key, removed) {
  const current = collection[key];
  if (!current || !removed) {
    return collection;
  }
  const attempts = Math.max(
    0,
    nonNegativeInteger(current.attempts) - nonNegativeInteger(removed.attempts),
  );
  if (attempts === 0) {
    return removeRecordKey(collection, key);
  }
  return {
    ...collection,
    [key]: {
      attempts,
      correct: Math.max(
        0,
        nonNegativeInteger(current.correct) - nonNegativeInteger(removed.correct),
      ),
      incorrect: Math.max(
        0,
        nonNegativeInteger(current.incorrect) -
          nonNegativeInteger(removed.incorrect),
      ),
      lastSeenAt:
        current.lastSeenAt === removed.lastSeenAt ? null : current.lastSeenAt,
      timedAttempts: Math.max(
        0,
        nonNegativeInteger(current.timedAttempts) -
          nonNegativeInteger(removed.timedAttempts),
      ),
      totalResponseTimeMs: Math.max(
        0,
        nonNegativeInteger(current.totalResponseTimeMs) -
          nonNegativeInteger(removed.totalResponseTimeMs),
      ),
      replayedAttempts: Math.max(
        0,
        nonNegativeInteger(current.replayedAttempts) -
          nonNegativeInteger(removed.replayedAttempts),
      ),
      totalReplays: Math.max(
        0,
        nonNegativeInteger(current.totalReplays) -
          nonNegativeInteger(removed.totalReplays),
      ),
    },
  };
}

function sanitizeListeningAttempt(value) {
  const attempt = isRecord(value) ? value : {};
  return {
    exerciseKey:
      typeof attempt.exerciseKey === "string" ? attempt.exerciseKey : "",
    patternId:
      typeof attempt.patternId === "string" ? attempt.patternId : "",
    correct: Boolean(attempt.correct),
    answeredAt: nullableString(attempt.answeredAt),
    modeId: typeof attempt.modeId === "string" ? attempt.modeId : "",
    rangeId: typeof attempt.rangeId === "string" ? attempt.rangeId : "",
    taskKind:
      typeof attempt.taskKind === "string" ? attempt.taskKind : "",
    responseTimeMs:
      Number.isFinite(attempt.responseTimeMs) && attempt.responseTimeMs >= 0
        ? Math.round(attempt.responseTimeMs)
        : null,
    replayCount: nonNegativeInteger(attempt.replayCount),
    timedOut: Boolean(attempt.timedOut),
  };
}

function sanitizeCoverageEntry(value) {
  const entry = isRecord(value) ? value : {};
  return {
    timesPresented: nonNegativeInteger(entry.timesPresented),
    lastPresentedAt: nullableString(entry.lastPresentedAt),
    attempts: nonNegativeInteger(entry.attempts),
    correct: nonNegativeInteger(entry.correct),
    incorrect: nonNegativeInteger(entry.incorrect),
    timedAttempts: nonNegativeInteger(entry.timedAttempts),
    totalResponseTimeMs: nonNegativeInteger(entry.totalResponseTimeMs),
    totalReplays: nonNegativeInteger(entry.totalReplays),
  };
}

function sanitizeCoverageRange(value) {
  const coverage = isRecord(value) ? value : {};
  const presentedKeys = Array.isArray(coverage.presentedKeys)
    ? [...new Set(coverage.presentedKeys.filter((key) => typeof key === "string"))]
    : [];
  return {
    cycle:
      Number.isInteger(coverage.cycle) && coverage.cycle > 0
        ? coverage.cycle
        : 1,
    presentedKeys,
    completedKeys: Array.isArray(coverage.completedKeys)
      ? [...new Set(coverage.completedKeys.filter((key) => typeof key === "string"))]
      : presentedKeys,
    entries: sanitizeRecordMap(coverage.entries, sanitizeCoverageEntry),
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
    modeRanges: sanitizeRecordMap(
      numberTraining.modeRanges,
      sanitizePerformance,
    ),
    taskKinds: sanitizeRecordMap(
      numberTraining.taskKinds,
      sanitizePerformance,
    ),
    listeningAttempts: Array.isArray(numberTraining.listeningAttempts)
      ? numberTraining.listeningAttempts
          .slice(-LISTENING_ATTEMPT_LIMIT)
          .map(sanitizeListeningAttempt)
      : [],
    coverage: sanitizeRecordMap(
      numberTraining.coverage,
      sanitizeCoverageRange,
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
    rangeId: typeof session.rangeId === "string" ? session.rangeId : "",
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
      modeRanges: {},
      taskKinds: {},
      listeningAttempts: [],
      coverage: {},
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

  function recordNumberPresented({
    modeId,
    rangeId,
    coverageKey,
    coverageCycle,
    presentedAt = new Date().toISOString(),
  }) {
    load();
    if (
      typeof modeId !== "string" ||
      typeof rangeId !== "string" ||
      typeof coverageKey !== "string" ||
      coverageKey.length === 0
    ) {
      throw new TypeError("Presented number requires mode, range, and coverage keys.");
    }
    const mapKey = `${modeId}:${rangeId}`;
    const previous = snapshot.numberTraining.coverage[mapKey] ?? {
      cycle: 1,
      presentedKeys: [],
      completedKeys: [],
      entries: {},
    };
    const requestedCycle =
      Number.isInteger(coverageCycle) && coverageCycle > 0
        ? coverageCycle
        : previous.cycle;
    const cycle = Math.max(previous.cycle, requestedCycle);
    const presentedKeys =
      cycle > previous.cycle ? [] : [...previous.presentedKeys];
    const completedKeys =
      cycle > previous.cycle ? [] : [...previous.completedKeys];
    if (!presentedKeys.includes(coverageKey)) {
      presentedKeys.push(coverageKey);
    }
    const coverage = {
      ...snapshot.numberTraining.coverage,
      [mapKey]: {
        cycle,
        presentedKeys,
        completedKeys,
        entries: previous.entries,
      },
    };
    return persist({
      ...snapshot,
      numberTraining: { ...snapshot.numberTraining, coverage },
    });
  }

  function recordNumberCompleted({
    modeId,
    rangeId,
    coverageKey,
    coverageCycle,
    completedAt = new Date().toISOString(),
  }) {
    load();
    const mapKey = `${modeId}:${rangeId}`;
    const previous = snapshot.numberTraining.coverage[mapKey];
    if (
      !previous ||
      typeof coverageKey !== "string" ||
      previous.cycle !== coverageCycle ||
      !previous.presentedKeys.includes(coverageKey)
    ) {
      return snapshot;
    }
    if (previous.completedKeys.includes(coverageKey)) {
      return snapshot;
    }
    const previousEntry = previous.entries[coverageKey] ?? {};
    return persist({
      ...snapshot,
      numberTraining: {
        ...snapshot.numberTraining,
        coverage: {
          ...snapshot.numberTraining.coverage,
          [mapKey]: {
            ...previous,
            completedKeys: [...previous.completedKeys, coverageKey],
            entries: {
              ...previous.entries,
              [coverageKey]: {
                ...previousEntry,
                timesPresented:
                  nonNegativeInteger(previousEntry.timesPresented) + 1,
                lastPresentedAt: completedAt,
              },
            },
          },
        },
      },
    });
  }

  function recordAnswer({
    exerciseKey,
    patternId,
    sourceRefs,
    correct,
    answeredAt = new Date().toISOString(),
    numberTraining = null,
    responseTimeMs = null,
    replayCount = 0,
    timedOut = false,
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
        modeId:
          isRecord(numberTraining) && typeof numberTraining.modeId === "string"
            ? numberTraining.modeId
            : "",
        rangeId:
          isRecord(numberTraining) && typeof numberTraining.rangeId === "string"
            ? numberTraining.rangeId
            : "",
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
      const normalizedResponseTimeMs =
        Number.isFinite(responseTimeMs) && responseTimeMs >= 0
          ? Math.round(responseTimeMs)
          : null;
      const normalizedReplayCount = nonNegativeInteger(replayCount);
      const isListening = numberTraining.skill === "listening";
      let coverage = snapshot.numberTraining.coverage;
      if (
        !timedOut &&
        typeof numberTraining.coverageKey === "string" &&
        numberTraining.coverageKey.length > 0
      ) {
        const coverageMapKey = `${numberTraining.modeId}:${numberTraining.rangeId}`;
        const previousCoverage = coverage[coverageMapKey] ?? {
          cycle: 1,
          presentedKeys: [],
          completedKeys: [],
          entries: {},
        };
        const previousEntry =
          previousCoverage.entries[numberTraining.coverageKey] ?? {};
        coverage = {
          ...coverage,
          [coverageMapKey]: {
            ...previousCoverage,
            entries: {
              ...previousCoverage.entries,
              [numberTraining.coverageKey]: {
                ...previousEntry,
                attempts: nonNegativeInteger(previousEntry.attempts) + 1,
                correct:
                  nonNegativeInteger(previousEntry.correct) + (correct ? 1 : 0),
                incorrect:
                  nonNegativeInteger(previousEntry.incorrect) + (correct ? 0 : 1),
                timedAttempts:
                  nonNegativeInteger(previousEntry.timedAttempts) +
                  (isListening && normalizedResponseTimeMs !== null ? 1 : 0),
                totalResponseTimeMs:
                  nonNegativeInteger(previousEntry.totalResponseTimeMs) +
                  (isListening ? normalizedResponseTimeMs ?? 0 : 0),
                totalReplays:
                  nonNegativeInteger(previousEntry.totalReplays) +
                  (isListening ? normalizedReplayCount : 0),
              },
            },
          },
        };
      }
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
            timedAttempts:
              nonNegativeInteger(previous.timedAttempts) +
              (isListening && normalizedResponseTimeMs !== null ? 1 : 0),
            totalResponseTimeMs:
              nonNegativeInteger(previous.totalResponseTimeMs) +
              (isListening ? normalizedResponseTimeMs ?? 0 : 0),
            replayedAttempts:
              nonNegativeInteger(previous.replayedAttempts) +
              (isListening && normalizedReplayCount > 0 ? 1 : 0),
            totalReplays:
              nonNegativeInteger(previous.totalReplays) +
              (isListening ? normalizedReplayCount : 0),
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
        modeRanges: increment(
          snapshot.numberTraining.modeRanges,
          `${numberTraining.modeId}:${numberTraining.rangeId}`,
        ),
        taskKinds: increment(
          snapshot.numberTraining.taskKinds,
          numberTraining.taskKind,
        ),
        listeningAttempts: isListening
          ? [
              ...snapshot.numberTraining.listeningAttempts,
              {
                exerciseKey,
                patternId,
                correct,
                answeredAt,
                modeId: numberTraining.modeId,
                rangeId: numberTraining.rangeId,
                taskKind: numberTraining.taskKind,
                responseTimeMs: normalizedResponseTimeMs,
                replayCount: normalizedReplayCount,
                timedOut: Boolean(timedOut),
              },
            ].slice(-LISTENING_ATTEMPT_LIMIT)
          : snapshot.numberTraining.listeningAttempts,
        coverage,
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

  function resetNumberTrainingRange({ modeId, rangeId, skill, patternId }) {
    load();
    if (
      typeof modeId !== "string" ||
      modeId.length === 0 ||
      typeof rangeId !== "string" ||
      rangeId.length === 0 ||
      typeof skill !== "string" ||
      skill.length === 0 ||
      typeof patternId !== "string" ||
      patternId.length === 0
    ) {
      throw new TypeError(
        "Range reset requires mode, range, skill, and pattern IDs.",
      );
    }

    const mapKey = `${modeId}:${rangeId}`;
    const removedPerformance =
      snapshot.numberTraining.modeRanges[mapKey] ?? null;
    const belongsToSelection = (exerciseKey, exercise) => {
      if (typeof exerciseKey !== "string") {
        return false;
      }
      if (exercise?.modeId || exercise?.rangeId) {
        return exercise.modeId === modeId && exercise.rangeId === rangeId;
      }
      return (
        exercise?.patternId === patternId &&
        exerciseKey.split(":")[1] === rangeId
      );
    };
    const removedExercises = Object.fromEntries(
      Object.entries(snapshot.exercises).filter(([exerciseKey, exercise]) =>
        belongsToSelection(exerciseKey, exercise),
      ),
    );
    const removedExerciseKeys = new Set(Object.keys(removedExercises));
    const exercises = Object.fromEntries(
      Object.entries(snapshot.exercises).filter(
        ([exerciseKey]) => !removedExerciseKeys.has(exerciseKey),
      ),
    );
    const mistakes = Object.fromEntries(
      Object.entries(snapshot.mistakes).filter(
        ([exerciseKey]) => !removedExerciseKeys.has(exerciseKey),
      ),
    );
    const items = { ...snapshot.items };
    for (const exercise of Object.values(removedExercises)) {
      for (const sourceRef of exercise.sourceRefs ?? []) {
        const current = items[sourceRef];
        if (!current) {
          continue;
        }
        const attempts = Math.max(0, current.attempts - exercise.attempts);
        if (attempts === 0) {
          delete items[sourceRef];
        } else {
          items[sourceRef] = {
            ...current,
            attempts,
            correct: Math.max(0, current.correct - exercise.correct),
            incorrect: Math.max(0, current.incorrect - exercise.incorrect),
            streak: 0,
            lastResult: null,
          };
        }
      }
    }

    const removedListeningAttempts =
      snapshot.numberTraining.listeningAttempts.filter(
        (attempt) =>
          attempt.modeId === modeId && attempt.rangeId === rangeId,
      );
    const taskKindRemovals = {};
    for (const attempt of removedListeningAttempts) {
      const stats = taskKindRemovals[attempt.taskKind] ?? {
        attempts: 0,
        correct: 0,
        incorrect: 0,
        timedAttempts: 0,
        totalResponseTimeMs: 0,
        replayedAttempts: 0,
        totalReplays: 0,
        lastSeenAt: null,
      };
      stats.attempts += 1;
      stats.correct += attempt.correct ? 1 : 0;
      stats.incorrect += attempt.correct ? 0 : 1;
      stats.timedAttempts += attempt.responseTimeMs === null ? 0 : 1;
      stats.totalResponseTimeMs += attempt.responseTimeMs ?? 0;
      stats.replayedAttempts += attempt.replayCount > 0 ? 1 : 0;
      stats.totalReplays += attempt.replayCount;
      stats.lastSeenAt = attempt.answeredAt;
      taskKindRemovals[attempt.taskKind] = stats;
    }
    if (
      removedListeningAttempts.length === 0 &&
      removedPerformance !== null
    ) {
      taskKindRemovals[modeId] = removedPerformance;
    }
    let taskKinds = snapshot.numberTraining.taskKinds;
    for (const [taskKind, removed] of Object.entries(taskKindRemovals)) {
      taskKinds = subtractPerformance(taskKinds, taskKind, removed);
    }

    const numberTraining = {
      ...snapshot.numberTraining,
      skills: subtractPerformance(
        snapshot.numberTraining.skills,
        skill,
        removedPerformance,
      ),
      modes: subtractPerformance(
        snapshot.numberTraining.modes,
        modeId,
        removedPerformance,
      ),
      ranges: subtractPerformance(
        snapshot.numberTraining.ranges,
        rangeId,
        removedPerformance,
      ),
      modeRanges: removeRecordKey(
        snapshot.numberTraining.modeRanges,
        mapKey,
      ),
      taskKinds,
      listeningAttempts:
        snapshot.numberTraining.listeningAttempts.filter(
          (attempt) =>
            attempt.modeId !== modeId || attempt.rangeId !== rangeId,
        ),
      coverage: removeRecordKey(snapshot.numberTraining.coverage, mapKey),
    };
    const sessions = snapshot.sessions.filter(
      (session) =>
        !(
          (session.mode === modeId && session.rangeId === rangeId) ||
          session.exerciseKeys.some((exerciseKey) =>
            removedExerciseKeys.has(exerciseKey),
          )
        ),
    );

    return persist({
      ...snapshot,
      items,
      exercises,
      mistakes,
      numberTraining,
      sessions,
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
    recordNumberPresented,
    recordNumberCompleted,
    recordAnswer,
    recordSessionSummary,
    resetNumberTrainingRange,
    reset,
    exportJson,
    importJson,
    getLastError,
  });
}

export function getNumberTrainingRangePerformance(
  progress,
  modeId,
  rangeId,
) {
  const stats =
    progress?.numberTraining?.modeRanges?.[`${modeId}:${rangeId}`] ?? {};
  const attempts = nonNegativeInteger(stats.attempts);
  const correct = Math.min(nonNegativeInteger(stats.correct), attempts);
  const timedAttempts = nonNegativeInteger(stats.timedAttempts);
  const totalResponseTimeMs = nonNegativeInteger(stats.totalResponseTimeMs);
  const replayedAttempts = nonNegativeInteger(stats.replayedAttempts);
  return Object.freeze({
    attempts,
    correct,
    incorrect: Math.max(0, attempts - correct),
    percentage: attempts === 0 ? null : Math.round((correct / attempts) * 100),
    lastSeenAt: nullableString(stats.lastSeenAt),
    timedAttempts,
    averageResponseTimeMs:
      timedAttempts === 0 ? null : Math.round(totalResponseTimeMs / timedAttempts),
    replayedAttempts,
    replayRate:
      attempts === 0 ? null : Math.round((replayedAttempts / attempts) * 100),
    totalReplays: nonNegativeInteger(stats.totalReplays),
  });
}

export function getNumberTrainingCoverage(progress, modeId, rangeId) {
  const coverage =
    progress?.numberTraining?.coverage?.[`${modeId}:${rangeId}`];
  return coverage ?? Object.freeze({
    cycle: 1,
    presentedKeys: Object.freeze([]),
    completedKeys: Object.freeze([]),
    entries: Object.freeze({}),
  });
}
