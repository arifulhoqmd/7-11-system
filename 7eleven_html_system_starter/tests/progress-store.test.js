import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  PROGRESS_SCHEMA_VERSION,
  PROGRESS_STORAGE_KEY,
  createProgressStore,
  getNumberTrainingCoverage,
  getNumberTrainingRangePerformance,
} from "../src/progress/progress-store.js";

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const DATASET_METADATA = Object.freeze({
  filename: "master-v2.json",
  updated: "2026-08-09",
  masterItemCount: 839,
});

test("progress defaults are versioned and separate from content", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });
  const progress = store.load();

  assert.equal(progress.schemaVersion, PROGRESS_SCHEMA_VERSION);
  assert.deepEqual(progress.dataset, DATASET_METADATA);
  assert.deepEqual(progress.settings, DEFAULT_SETTINGS);
  assert.deepEqual(progress.items, {});
  assert.deepEqual(progress.exercises, {});
  assert.deepEqual(progress.mistakes, {});
  assert.deepEqual(progress.numberTraining, {
    skills: {},
    modes: {},
    ranges: {},
    modeRanges: {},
    taskKinds: {},
    listeningAttempts: [],
    coverage: {},
  });
  assert.deepEqual(progress.sessions, []);
  assert.ok(Object.isFrozen(progress));
  assert.ok(Object.isFrozen(progress.settings));
});

test("settings persist across store instances", () => {
  const storage = createMemoryStorage();
  const firstStore = createProgressStore({
    storage,
    datasetMetadata: DATASET_METADATA,
  });

  firstStore.updateSettings({
    stage: "B",
    sessionSize: 15,
    showKana: false,
    showRomaji: false,
    ttsRate: 0.75,
    listeningEnvironment: "conversation",
    answerTimeLimitSeconds: 7,
  });

  const secondStore = createProgressStore({
    storage,
    datasetMetadata: DATASET_METADATA,
  });
  assert.deepEqual(secondStore.load().settings, {
    stage: "B",
    sessionSize: 15,
    showKana: false,
    showRomaji: false,
    ttsRate: 0.75,
    listeningEnvironment: "conversation",
    answerTimeLimitSeconds: 7,
  });
});

test("corrupt localStorage safely falls back to defaults", () => {
  const storage = createMemoryStorage({
    [PROGRESS_STORAGE_KEY]: "{not valid json",
  });
  const store = createProgressStore({
    storage,
    datasetMetadata: DATASET_METADATA,
  });

  assert.deepEqual(store.load().settings, DEFAULT_SETTINGS);
  assert.ok(store.getLastError() instanceof Error);

  store.updateSettings({ sessionSize: 20 });
  assert.equal(store.getSnapshot().settings.sessionSize, 20);
  assert.equal(store.getLastError(), null);
});

test("imports strip vocabulary fields and normalize unsupported settings", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });

  const imported = store.importJson(
    JSON.stringify({
      schemaVersion: 99,
      settings: {
        stage: "C",
        sessionSize: 999,
        showKana: "yes",
        showRomaji: false,
        ttsRate: 5,
      },
      items: {
        R001: {
          attempts: 3,
          correct: 2,
          japanese: "いらっしゃいませ。",
          english: "Welcome.",
        },
      },
      sessions: [],
    }),
  );

  assert.deepEqual(imported.settings, {
    stage: "A",
    sessionSize: 10,
    showKana: true,
    showRomaji: false,
    ttsRate: 0.9,
    listeningEnvironment: "clean",
    answerTimeLimitSeconds: 5,
  });
  assert.deepEqual(imported.items.R001, {
    attempts: 3,
    correct: 2,
    incorrect: 0,
    streak: 0,
    lastSeenAt: null,
    lastResult: null,
  });
  assert.equal(Object.hasOwn(imported.items.R001, "japanese"), false);
  assert.equal(Object.hasOwn(imported.items.R001, "english"), false);
});

test("session history is capped at the most recent 50 summaries", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });
  const sessions = Array.from({ length: 55 }, (_, index) => ({
    sessionId: `session-${index}`,
    mode: "numbers",
    stage: "A",
    total: 10,
    correct: index,
  }));

  const imported = store.importJson(JSON.stringify({ sessions }));
  assert.equal(imported.sessions.length, 50);
  assert.equal(imported.sessions[0].sessionId, "session-5");
  assert.equal(imported.sessions[49].sessionId, "session-54");
});

test("answer results update item and exercise counts without content", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });
  const result = {
    exerciseKey: "QZ005:NUM000010",
    patternId: "QZ005",
    sourceRefs: ["NUM000010"],
    correct: false,
    answeredAt: "2026-08-10T01:00:00.000Z",
  };

  store.recordAnswer(result);
  const progress = store.getSnapshot();
  assert.deepEqual(progress.items.NUM000010, {
    attempts: 1,
    correct: 0,
    incorrect: 1,
    streak: 0,
    lastSeenAt: result.answeredAt,
    lastResult: false,
  });
  assert.deepEqual(progress.exercises[result.exerciseKey], {
    patternId: "QZ005",
    sourceRefs: ["NUM000010"],
    attempts: 1,
    correct: 0,
    incorrect: 1,
    lastSeenAt: result.answeredAt,
  });
  assert.equal(Object.hasOwn(progress.items.NUM000010, "japanese"), false);
});

test("incorrect answers activate mistakes and two later correct answers resolve them", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });
  const baseResult = {
    exerciseKey: "QZ005:NUM000010",
    patternId: "QZ005",
    sourceRefs: ["NUM000010"],
  };

  store.recordAnswer({
    ...baseResult,
    correct: false,
    answeredAt: "2026-08-10T01:00:00.000Z",
  });
  assert.deepEqual(store.getSnapshot().mistakes[baseResult.exerciseKey], {
    status: "active",
    wrongCount: 1,
    reviewCorrectStreak: 0,
    lastWrongAt: "2026-08-10T01:00:00.000Z",
    resolvedAt: null,
  });

  store.recordAnswer({
    ...baseResult,
    correct: true,
    answeredAt: "2026-08-10T01:05:00.000Z",
  });
  assert.equal(
    store.getSnapshot().mistakes[baseResult.exerciseKey].status,
    "active",
  );

  store.recordAnswer({
    ...baseResult,
    correct: true,
    answeredAt: "2026-08-10T01:10:00.000Z",
  });
  const progress = store.getSnapshot();
  assert.equal(progress.mistakes[baseResult.exerciseKey].status, "resolved");
  assert.equal(
    progress.mistakes[baseResult.exerciseKey].reviewCorrectStreak,
    2,
  );
  assert.equal(
    progress.mistakes[baseResult.exerciseKey].resolvedAt,
    "2026-08-10T01:10:00.000Z",
  );
  assert.equal(progress.items.NUM000010.attempts, 3);
  assert.equal(progress.items.NUM000010.correct, 2);
  assert.equal(progress.items.NUM000010.incorrect, 1);
});

test("price answers update the number and dynamic yen-rule references", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });

  store.recordAnswer({
    exerciseKey: "QZ006:NUM000037:RULE_EN",
    patternId: "QZ006",
    sourceRefs: ["NUM000037", "RULE_EN"],
    correct: true,
    answeredAt: "2026-08-10T02:00:00.000Z",
  });

  const progress = store.getSnapshot();
  assert.equal(progress.items.NUM000037.attempts, 1);
  assert.equal(progress.items.RULE_EN.attempts, 1);
  assert.deepEqual(
    progress.exercises["QZ006:NUM000037:RULE_EN"].sourceRefs,
    ["NUM000037", "RULE_EN"],
  );
});

test("completed session summaries are stored separately from questions", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });

  store.recordSessionSummary({
    sessionId: "session-qz005",
    startedAt: "2026-08-10T03:00:00.000Z",
    finishedAt: "2026-08-10T03:05:00.000Z",
    mode: "numbers",
    patternId: "QZ005",
    stage: "A",
    total: 10,
    correct: 8,
    exerciseKeys: ["QZ005:NUM000001"],
    questions: [{ japanese: "いち" }],
  });

  const summary = store.getSnapshot().sessions[0];
  assert.equal(summary.patternId, "QZ005");
  assert.equal(summary.correct, 8);
  assert.equal(Object.hasOwn(summary, "questions"), false);
});

test("number-training results update skill, mode, range, and task-kind stats", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });

  store.recordAnswer({
    exerciseKey: "NT_TOBACCO:tobacco-101-200:128",
    patternId: "NT_TOBACCO",
    sourceRefs: ["NUM000128", "RULE_BAN"],
    correct: false,
    answeredAt: "2026-08-10T04:00:00.000Z",
    numberTraining: {
      skill: "listening",
      modeId: "tobacco-number",
      rangeId: "tobacco-101-200",
      taskKind: "tobacco-number",
    },
  });

  const progress = store.getSnapshot();
  for (const stats of [
    progress.numberTraining.skills.listening,
    progress.numberTraining.modes["tobacco-number"],
    progress.numberTraining.ranges["tobacco-101-200"],
    progress.numberTraining.modeRanges[
      "tobacco-number:tobacco-101-200"
    ],
    progress.numberTraining.taskKinds["tobacco-number"],
  ]) {
    assert.deepEqual(stats, {
      attempts: 1,
      correct: 0,
      incorrect: 1,
      lastSeenAt: "2026-08-10T04:00:00.000Z",
      timedAttempts: 0,
      totalResponseTimeMs: 0,
      replayedAttempts: 0,
      totalReplays: 0,
    });
  }
  assert.equal(
    progress.mistakes["NT_TOBACCO:tobacco-101-200:128"].status,
    "active",
  );
});

test("number performance stays separate by mode and selected range", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });
  const base = {
    patternId: "NT_DICTATION",
    sourceRefs: ["NUMGEN:150"],
    numberTraining: {
      skill: "listening",
      modeId: "number-dictation",
      rangeId: "dictation-101-200",
      taskKind: "plain-number",
    },
  };

  store.recordAnswer({
    ...base,
    exerciseKey: "NT_DICTATION:dictation-101-200:150",
    correct: true,
  });
  store.recordAnswer({
    ...base,
    exerciseKey: "NT_DICTATION:dictation-101-200:151",
    sourceRefs: ["NUMGEN:151"],
    correct: false,
  });

  assert.deepEqual(
    getNumberTrainingRangePerformance(
      store.getSnapshot(),
      "number-dictation",
      "dictation-101-200",
    ),
    {
      attempts: 2,
      correct: 1,
      incorrect: 1,
      percentage: 50,
      lastSeenAt: store.getSnapshot().numberTraining.modeRanges[
        "number-dictation:dictation-101-200"
      ].lastSeenAt,
      timedAttempts: 0,
      averageResponseTimeMs: null,
      replayedAttempts: 0,
      replayRate: 0,
      totalReplays: 0,
    },
  );
  assert.equal(
    getNumberTrainingRangePerformance(
      store.getSnapshot(),
      "tobacco-number",
      "dictation-101-200",
    ).percentage,
    null,
  );
});

test("listening attempts store timing metadata and aggregate it by range and mode", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });
  const common = {
    patternId: "NT_DICTATION",
    sourceRefs: ["NUMGEN:150"],
    numberTraining: {
      skill: "listening",
      modeId: "number-dictation",
      rangeId: "dictation-101-200",
      taskKind: "plain-number",
    },
  };
  store.recordAnswer({
    ...common,
    exerciseKey: "NT_DICTATION:dictation-101-200:150",
    correct: true,
    answeredAt: "2026-08-11T01:00:00.000Z",
    responseTimeMs: 3000,
    replayCount: 0,
  });
  store.recordAnswer({
    ...common,
    exerciseKey: "NT_DICTATION:dictation-101-200:151",
    sourceRefs: ["NUMGEN:151"],
    correct: false,
    answeredAt: "2026-08-11T01:01:00.000Z",
    responseTimeMs: 5000,
    replayCount: 2,
    timedOut: false,
  });

  const progress = store.getSnapshot();
  const performance = getNumberTrainingRangePerformance(
    progress,
    "number-dictation",
    "dictation-101-200",
  );
  assert.equal(performance.percentage, 50);
  assert.equal(performance.averageResponseTimeMs, 4000);
  assert.equal(performance.replayRate, 50);
  assert.equal(performance.totalReplays, 2);
  assert.equal(progress.numberTraining.modes["number-dictation"].timedAttempts, 2);
  assert.deepEqual(progress.numberTraining.listeningAttempts[1], {
    exerciseKey: "NT_DICTATION:dictation-101-200:151",
    patternId: "NT_DICTATION",
    correct: false,
    answeredAt: "2026-08-11T01:01:00.000Z",
    modeId: "number-dictation",
    rangeId: "dictation-101-200",
    taskKind: "plain-number",
    responseTimeMs: 5000,
    replayCount: 2,
    timedOut: false,
  });
  assert.equal(
    Object.hasOwn(progress.numberTraining.listeningAttempts[1], "japanese"),
    false,
  );
});

test("presented-number coverage persists cycles and answer history without content", () => {
  const storage = createMemoryStorage();
  const store = createProgressStore({ storage, datasetMetadata: DATASET_METADATA });
  const presented = {
    modeId: "number-dictation",
    rangeId: "dictation-1-10",
    coverageKey: "7",
    coverageCycle: 1,
    presentedAt: "2026-08-11T02:00:00.000Z",
  };
  store.recordNumberPresented(presented);
  store.recordNumberCompleted({
    modeId: presented.modeId,
    rangeId: presented.rangeId,
    coverageKey: presented.coverageKey,
    coverageCycle: presented.coverageCycle,
    completedAt: presented.presentedAt,
  });
  store.recordAnswer({
    exerciseKey: "NT_DICTATION:dictation-1-10:7",
    patternId: "NT_DICTATION",
    sourceRefs: ["NUM000007"],
    correct: true,
    answeredAt: "2026-08-11T02:00:04.000Z",
    responseTimeMs: 4000,
    replayCount: 1,
    numberTraining: {
      skill: "listening",
      modeId: presented.modeId,
      rangeId: presented.rangeId,
      taskKind: "plain-number",
      coverageKey: "7",
      coverageCycle: 1,
    },
  });

  let coverage = getNumberTrainingCoverage(
    store.getSnapshot(),
    presented.modeId,
    presented.rangeId,
  );
  assert.equal(coverage.cycle, 1);
  assert.deepEqual(coverage.presentedKeys, ["7"]);
  assert.deepEqual(coverage.completedKeys, ["7"]);
  assert.deepEqual(coverage.entries["7"], {
    timesPresented: 1,
    lastPresentedAt: presented.presentedAt,
    attempts: 1,
    correct: 1,
    incorrect: 0,
    timedAttempts: 1,
    totalResponseTimeMs: 4000,
    totalReplays: 1,
  });
  assert.equal(Object.hasOwn(coverage.entries["7"], "japanese"), false);

  store.recordNumberPresented({
    ...presented,
    coverageKey: "2",
    coverageCycle: 2,
  });
  coverage = getNumberTrainingCoverage(
    store.getSnapshot(),
    presented.modeId,
    presented.rangeId,
  );
  assert.equal(coverage.cycle, 2);
  assert.deepEqual(coverage.presentedKeys, ["2"]);
  assert.deepEqual(coverage.completedKeys, []);

  const reloaded = createProgressStore({ storage, datasetMetadata: DATASET_METADATA });
  assert.equal(
    getNumberTrainingCoverage(
      reloaded.load(),
      presented.modeId,
      presented.rangeId,
    ).entries["7"].timesPresented,
    1,
  );
});

test("timed-out numbers remain outside checklist history", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });
  const numberTraining = {
    skill: "listening",
    modeId: "number-dictation",
    rangeId: "dictation-1-10",
    taskKind: "plain-number",
    coverageKey: "4",
    coverageCycle: 1,
  };
  store.recordNumberPresented({
    modeId: numberTraining.modeId,
    rangeId: numberTraining.rangeId,
    coverageKey: numberTraining.coverageKey,
    coverageCycle: numberTraining.coverageCycle,
  });
  store.recordAnswer({
    exerciseKey: "NT_DICTATION:dictation-1-10:4",
    patternId: "NT_DICTATION",
    sourceRefs: ["NUM000004"],
    correct: false,
    timedOut: true,
    numberTraining,
  });
  const coverage = getNumberTrainingCoverage(
    store.getSnapshot(),
    numberTraining.modeId,
    numberTraining.rangeId,
  );
  assert.deepEqual(coverage.completedKeys, []);
  assert.equal(coverage.entries["4"], undefined);
  assert.equal(store.getSnapshot().mistakes["NT_DICTATION:dictation-1-10:4"].status, "active");
});

test("range reset clears listening score, attempts, mistakes, and checklist only for that range", () => {
  const storage = createMemoryStorage();
  const store = createProgressStore({ storage, datasetMetadata: DATASET_METADATA });
  const record = ({ rangeId, value, correct }) => {
    const coverageKey = String(value);
    store.recordNumberPresented({
      modeId: "number-dictation",
      rangeId,
      coverageKey,
      coverageCycle: 1,
    });
    store.recordNumberCompleted({
      modeId: "number-dictation",
      rangeId,
      coverageKey,
      coverageCycle: 1,
    });
    store.recordAnswer({
      exerciseKey: `NT_DICTATION:${rangeId}:${value}`,
      patternId: "NT_DICTATION",
      sourceRefs: [`NUMGEN:${value}`],
      correct,
      responseTimeMs: 2400,
      replayCount: 1,
      numberTraining: {
        skill: "listening",
        modeId: "number-dictation",
        rangeId,
        taskKind: "plain-number",
        coverageKey,
        coverageCycle: 1,
      },
    });
  };
  record({ rangeId: "dictation-1-10", value: 7, correct: false });
  record({ rangeId: "dictation-11-50", value: 27, correct: true });
  store.recordSessionSummary({
    sessionId: "reset-me",
    mode: "number-dictation",
    patternId: "NT_DICTATION",
    stage: "number-training",
    rangeId: "dictation-1-10",
    total: 1,
    correct: 0,
    exerciseKeys: ["NT_DICTATION:dictation-1-10:7"],
  });

  const progress = store.resetNumberTrainingRange({
    modeId: "number-dictation",
    rangeId: "dictation-1-10",
    skill: "listening",
    patternId: "NT_DICTATION",
  });

  assert.equal(progress.numberTraining.modeRanges["number-dictation:dictation-1-10"], undefined);
  assert.equal(progress.numberTraining.coverage["number-dictation:dictation-1-10"], undefined);
  assert.equal(progress.numberTraining.ranges["dictation-1-10"], undefined);
  assert.equal(progress.numberTraining.listeningAttempts.length, 1);
  assert.equal(progress.exercises["NT_DICTATION:dictation-1-10:7"], undefined);
  assert.equal(progress.mistakes["NT_DICTATION:dictation-1-10:7"], undefined);
  assert.equal(progress.items["NUMGEN:7"], undefined);
  assert.equal(progress.sessions.length, 0);
  assert.equal(progress.numberTraining.modes["number-dictation"].attempts, 1);
  assert.equal(progress.numberTraining.skills.listening.attempts, 1);
  assert.equal(progress.numberTraining.taskKinds["plain-number"].attempts, 1);
  assert.equal(
    progress.numberTraining.modeRanges["number-dictation:dictation-11-50"].attempts,
    1,
  );
  assert.deepEqual(
    getNumberTrainingCoverage(progress, "number-dictation", "dictation-1-10"),
    { cycle: 1, presentedKeys: [], completedKeys: [], entries: {} },
  );
  assert.equal(
    createProgressStore({ storage, datasetMetadata: DATASET_METADATA }).load()
      .numberTraining.modeRanges["number-dictation:dictation-1-10"],
    undefined,
  );
});

test("range reset also clears Speaking and Reading progress", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });
  store.recordAnswer({
    exerciseKey: "NT_READING:reading-1-10:7",
    patternId: "NT_READING",
    sourceRefs: ["NUMGEN:7"],
    correct: true,
    numberTraining: {
      skill: "speaking-reading",
      modeId: "number-reading",
      rangeId: "reading-1-10",
      taskKind: "number-reading",
    },
  });

  const progress = store.resetNumberTrainingRange({
    modeId: "number-reading",
    rangeId: "reading-1-10",
    skill: "speaking-reading",
    patternId: "NT_READING",
  });

  assert.equal(progress.numberTraining.modes["number-reading"], undefined);
  assert.equal(progress.numberTraining.skills["speaking-reading"], undefined);
  assert.equal(progress.numberTraining.ranges["reading-1-10"], undefined);
  assert.equal(progress.numberTraining.taskKinds["number-reading"], undefined);
  assert.equal(progress.exercises["NT_READING:reading-1-10:7"], undefined);
});

test("reset isolates modes that share the same range ID", () => {
  const store = createProgressStore({
    storage: createMemoryStorage(),
    datasetMetadata: DATASET_METADATA,
  });
  const sharedRangeId = "tobacco-1-100";
  const record = ({ modeId, patternId, taskKind, value }) => {
    store.recordNumberPresented({
      modeId,
      rangeId: sharedRangeId,
      coverageKey: String(value),
      coverageCycle: 1,
    });
    store.recordNumberCompleted({
      modeId,
      rangeId: sharedRangeId,
      coverageKey: String(value),
      coverageCycle: 1,
    });
    store.recordAnswer({
      exerciseKey: `${patternId}:${sharedRangeId}:${value}`,
      patternId,
      sourceRefs: [`NUMGEN:${value}`],
      correct: false,
      numberTraining: {
        skill: "listening",
        modeId,
        rangeId: sharedRangeId,
        taskKind,
        coverageKey: String(value),
        coverageCycle: 1,
      },
    });
  };
  record({
    modeId: "tobacco-number",
    patternId: "NT_TOBACCO",
    taskKind: "tobacco-number",
    value: 24,
  });
  record({
    modeId: "tobacco-quantity",
    patternId: "NT_TOBACCO_QUANTITY",
    taskKind: "tobacco-quantity",
    value: 24,
  });

  const progress = store.resetNumberTrainingRange({
    modeId: "tobacco-number",
    rangeId: sharedRangeId,
    skill: "listening",
    patternId: "NT_TOBACCO",
  });

  assert.equal(progress.exercises["NT_TOBACCO:tobacco-1-100:24"], undefined);
  assert.equal(progress.mistakes["NT_TOBACCO:tobacco-1-100:24"], undefined);
  assert.equal(
    progress.numberTraining.coverage["tobacco-number:tobacco-1-100"],
    undefined,
  );
  assert.ok(
    progress.exercises["NT_TOBACCO_QUANTITY:tobacco-1-100:24"],
  );
  assert.ok(
    progress.mistakes["NT_TOBACCO_QUANTITY:tobacco-1-100:24"],
  );
  assert.ok(
    progress.numberTraining.coverage[
      "tobacco-quantity:tobacco-1-100"
    ],
  );
  assert.equal(
    progress.numberTraining.modeRanges[
      "tobacco-quantity:tobacco-1-100"
    ].attempts,
    1,
  );
  assert.equal(progress.numberTraining.ranges[sharedRangeId].attempts, 1);
  assert.equal(progress.numberTraining.skills.listening.attempts, 1);
  assert.equal(progress.numberTraining.listeningAttempts.length, 1);
  assert.equal(
    progress.numberTraining.listeningAttempts[0].modeId,
    "tobacco-quantity",
  );
});
