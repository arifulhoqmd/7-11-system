import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  PROGRESS_SCHEMA_VERSION,
  PROGRESS_STORAGE_KEY,
  createProgressStore,
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
