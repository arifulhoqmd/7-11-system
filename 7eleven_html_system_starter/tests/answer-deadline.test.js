import assert from "node:assert/strict";
import test from "node:test";

import {
  createAnswerDeadline,
  getAnswerTimeRemaining,
  hasAnswerDeadlineExpired,
  startAnswerDeadline,
  stopAnswerDeadline,
} from "../src/number-training/answer-deadline.js";

test("answer deadline supports only the configured 1, 2, 3, 5, and 7 second limits", () => {
  assert.equal(createAnswerDeadline(1).durationMs, 1000);
  assert.equal(createAnswerDeadline(2).durationMs, 2000);
  assert.equal(createAnswerDeadline(3).durationMs, 3000);
  assert.equal(createAnswerDeadline(5).durationMs, 5000);
  assert.equal(createAnswerDeadline(7).durationMs, 7000);
  assert.throws(() => createAnswerDeadline(4), /1, 2, 3, 5, or 7/);
});

test("a waiting deadline does not count down before it is started", () => {
  const deadline = createAnswerDeadline(3);
  assert.equal(getAnswerTimeRemaining(deadline, 5000), null);
  assert.equal(hasAnswerDeadlineExpired(deadline, 5000), false);
});

test("started deadline expires at the selected limit and cannot be reset", () => {
  const started = startAnswerDeadline(createAnswerDeadline(3), 1000);
  assert.equal(getAnswerTimeRemaining(started, 2500), 1500);
  assert.equal(hasAnswerDeadlineExpired(started, 3999), false);
  assert.equal(hasAnswerDeadlineExpired(started, 4000), true);
  assert.equal(startAnswerDeadline(started, 3000), started);
});

test("showing the answer stops a deadline before timeout", () => {
  const started = startAnswerDeadline(createAnswerDeadline(5), 1000);
  const stopped = stopAnswerDeadline(started, 3500);
  assert.equal(stopped.timedOut, false);
  assert.equal(getAnswerTimeRemaining(stopped, 9000), 2500);

  const expired = stopAnswerDeadline(started, 6000);
  assert.equal(expired.timedOut, true);
  assert.equal(getAnswerTimeRemaining(expired, 9000), 0);
});
