import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceNumberTask,
  createSelfMarkSession,
  getCurrentNumberTask,
  getNumberSessionSummary,
  MAX_TIMEOUT_RETRIES,
  markNumberTask,
  revealNumberTask,
  retryTimedOutNumberTask,
} from "../src/number-training/self-mark-session.js";

const TASKS = Object.freeze([
  Object.freeze({
    taskId: "task-1",
    exerciseKey: "NT_DICTATION:range:128",
    patternId: "NT_DICTATION",
    sourceRefs: ["NUM000128"],
    taskKind: "plain-number",
    promptType: "listening",
  }),
  Object.freeze({
    taskId: "task-2",
    exerciseKey: "NT_DICTATION:range:236",
    patternId: "NT_DICTATION",
    sourceRefs: ["NUMGEN:236"],
    taskKind: "plain-number",
    promptType: "listening",
  }),
]);

test("dictation flow requires reveal before self-marking", () => {
  let session = createSelfMarkSession({
    tasks: TASKS,
    modeId: "number-dictation",
    rangeId: "dictation-101-200",
    now: () => "2026-08-10T00:00:00.000Z",
    idFactory: () => "number-session",
  });

  assert.equal(session.phase, "prompt");
  assert.equal(getCurrentNumberTask(session), TASKS[0]);
  assert.throws(() => markNumberTask(session, true), /Reveal/);

  session = revealNumberTask(session);
  assert.equal(session.phase, "revealed");
  session = markNumberTask(session, false, {
    now: () => "2026-08-10T00:01:00.000Z",
    responseTimeMs: 3456.4,
    replayCount: 1,
  });
  assert.equal(session.phase, "marked");
  assert.equal(session.currentResult.correct, false);
  assert.equal(session.currentResult.responseTimeMs, 3456);
  assert.equal(session.currentResult.replayCount, 1);
  assert.deepEqual(session.currentResult.numberTraining, {
    skill: "listening",
    modeId: "number-dictation",
    rangeId: "dictation-101-200",
    taskKind: "plain-number",
  });
});

test("Correct/Wrong self-marks drive progress and final result", () => {
  let timeIndex = 0;
  const now = () => `2026-08-10T00:00:0${timeIndex++}.000Z`;
  let session = createSelfMarkSession({
    tasks: TASKS,
    modeId: "number-dictation",
    rangeId: "dictation-101-200",
    now,
    idFactory: () => "number-session",
  });

  session = markNumberTask(revealNumberTask(session), true, { now });
  session = advanceNumberTask(session, { now });
  session = markNumberTask(revealNumberTask(session), false, { now });
  session = advanceNumberTask(session, { now });

  assert.equal(session.status, "completed");
  assert.equal(session.correctCount, 1);
  assert.equal(getCurrentNumberTask(session), null);
  const summary = getNumberSessionSummary(session);
  assert.equal(summary.total, 2);
  assert.equal(summary.correct, 1);
  assert.equal(summary.rangeId, "dictation-101-200");
});

test("speaking and reading self-marks use a separate progress skill", () => {
  const readingTask = Object.freeze({
    taskId: "reading-task",
    exerciseKey: "NT_PRICE_READING:price-selected:1480:RULE_EN",
    patternId: "NT_PRICE_READING",
    sourceRefs: ["NUMGEN:1480", "RULE_EN"],
    taskKind: "price-reading",
    promptType: "speaking",
  });
  let session = createSelfMarkSession({
    tasks: [readingTask],
    modeId: "price-reading",
    rangeId: "price-selected",
    idFactory: () => "speaking-session",
  });

  session = markNumberTask(revealNumberTask(session), true);
  assert.equal(session.currentResult.responseTimeMs, null);
  assert.equal(session.currentResult.replayCount, 0);
  assert.deepEqual(session.currentResult.numberTraining, {
    skill: "speaking-reading",
    modeId: "price-reading",
    rangeId: "price-selected",
    taskKind: "price-reading",
  });
});

test("expired questions remain recorded as wrong when one retry succeeds", () => {
  let session = createSelfMarkSession({
    tasks: TASKS.slice(0, 1),
    modeId: "number-dictation",
    rangeId: "dictation-101-200",
    idFactory: () => "timeout-session",
  });
  session = markNumberTask(revealNumberTask(session), false, {
    responseTimeMs: 3000,
    timedOut: true,
  });
  assert.equal(session.currentResult.correct, false);
  assert.equal(session.currentResult.timedOut, true);
  assert.equal(session.currentResult.responseTimeMs, 3000);
  session = retryTimedOutNumberTask(session);
  assert.equal(session.phase, "prompt");
  assert.equal(session.currentRetryCount, 1);
  assert.equal(session.currentResult, null);
  assert.equal(session.responses.length, 1);

  session = markNumberTask(revealNumberTask(session), true);
  assert.equal(session.correctCount, 1);
  assert.equal(session.responses.length, 2);
  assert.equal(session.responses[0].timedOut, true);
  assert.equal(session.responses[0].correct, false);
  assert.equal(session.responses[1].correct, true);
});

test("five timeout retries are allowed for each task", () => {
  let session = createSelfMarkSession({
    tasks: TASKS.slice(0, 1),
    modeId: "number-dictation",
    rangeId: "dictation-101-200",
    idFactory: () => "one-retry-session",
  });
  for (let attempt = 0; attempt <= MAX_TIMEOUT_RETRIES; attempt += 1) {
    session = markNumberTask(revealNumberTask(session), false, {
      timedOut: true,
    });
    if (attempt < MAX_TIMEOUT_RETRIES) {
      session = retryTimedOutNumberTask(session);
      assert.equal(session.currentRetryCount, attempt + 1);
    }
  }

  assert.equal(session.responses.length, MAX_TIMEOUT_RETRIES + 1);
  assert.throws(
    () => retryTimedOutNumberTask(session),
    /All retries.*already been used/,
  );
});
