import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceNumberTask,
  createSelfMarkSession,
  getCurrentNumberTask,
  getNumberSessionSummary,
  markNumberTask,
  revealNumberTask,
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
  });
  assert.equal(session.phase, "marked");
  assert.equal(session.currentResult.correct, false);
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
