import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTINUOUS_READING_NEXT_DELAY_MS,
  CONTINUOUS_READING_WAIT_MS,
  advanceContinuousReadingSession,
  createContinuousReadingSession,
  isContinuousReadingSkipKey,
  pauseContinuousReadingSession,
  resumeContinuousReadingSession,
  setContinuousReadingPhase,
} from "../src/number-training/continuous-reading-session.js";
import { isDifferentMixedTenThousandBand } from "../src/number-training/number-task-generator.js";

test("Continuous Reading uses a fixed five-second reading window", () => {
  assert.equal(CONTINUOUS_READING_WAIT_MS, 5000);
  assert.equal(CONTINUOUS_READING_NEXT_DELAY_MS, 1000);
});

test("Continuous Reading advances without repeating adjacent number bands", () => {
  let seed = 123456789;
  const rng = () => {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  let session = createContinuousReadingSession({ rng });
  const values = [session.currentValue];
  for (let index = 0; index < 250; index += 1) {
    session = advanceContinuousReadingSession(session, { rng });
    values.push(session.currentValue);
  }

  assert.equal(new Set(values).size, values.length);
  for (let index = 1; index < values.length; index += 1) {
    assert.equal(
      isDifferentMixedTenThousandBand(values[index - 1], values[index]),
      true,
    );
  }
});

test("Continuous Reading pause and resume preserve the current number", () => {
  let session = createContinuousReadingSession({ rng: () => 0.1234 });
  const current = session.currentValue;
  session = setContinuousReadingPhase(session, "answer");
  session = pauseContinuousReadingSession(session);
  assert.equal(session.status, "paused");
  assert.equal(session.currentValue, current);
  session = resumeContinuousReadingSession(session);
  assert.equal(session.status, "active");
  assert.equal(session.phase, "reading");
  assert.equal(session.currentValue, current);
});

test("only an unmodified, non-repeating Right Arrow triggers skip", () => {
  assert.equal(isContinuousReadingSkipKey({ key: "ArrowRight" }), true);
  assert.equal(
    isContinuousReadingSkipKey({ key: "ArrowRight", repeat: true }),
    false,
  );
  assert.equal(
    isContinuousReadingSkipKey({ key: "ArrowRight", ctrlKey: true }),
    false,
  );
  assert.equal(isContinuousReadingSkipKey({ key: "ArrowLeft" }), false);
});
