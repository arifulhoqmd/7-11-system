import assert from "node:assert/strict";
import test from "node:test";

import {
  beginListeningPlayback,
  completeListeningPlayback,
  createListeningAttempt,
  getListeningResponseTime,
  stopListeningResponseTimer,
} from "../src/number-training/listening-attempt.js";

test("response timer starts only when the first TTS playback completes", () => {
  let attempt = createListeningAttempt("task-1");
  attempt = beginListeningPlayback(attempt);
  assert.equal(attempt.responseStartedAt, null);
  assert.equal(getListeningResponseTime(attempt, 1500), null);

  attempt = completeListeningPlayback(attempt, 2000);
  assert.equal(attempt.responseStartedAt, 2000);
  assert.equal(getListeningResponseTime(attempt, 4800), 2800);
});

test("Show Answer freezes the response time", () => {
  let attempt = completeListeningPlayback(
    beginListeningPlayback(createListeningAttempt("task-1")),
    1000,
  );
  attempt = stopListeningResponseTimer(attempt, 4400);
  assert.equal(attempt.responseTimeMs, 3400);
  assert.equal(getListeningResponseTime(attempt, 9000), 3400);
});

test("replay is counted and never resets the first response clock", () => {
  let attempt = completeListeningPlayback(
    beginListeningPlayback(createListeningAttempt("task-1")),
    1000,
  );
  attempt = beginListeningPlayback(attempt);
  assert.equal(attempt.replayCount, 1);
  assert.equal(attempt.responseStartedAt, 1000);

  attempt = completeListeningPlayback(attempt, 3500);
  attempt = stopListeningResponseTimer(attempt, 5000);
  assert.equal(attempt.responseStartedAt, 1000);
  assert.equal(attempt.responseTimeMs, 4000);
  assert.equal(attempt.replayCount, 1);
});
