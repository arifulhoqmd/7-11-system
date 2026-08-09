import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMasterDataset } from "../src/data/normalize.js";
import {
  NUMBER_LISTENING_PATTERN_ID,
  generateListeningQuestions,
} from "../src/quiz/number-question-generator.js";
import {
  advanceSession,
  createQuizSession,
  getCurrentQuestion,
  getSessionSummary,
  submitAnswer,
} from "../src/quiz/session-engine.js";
import { readRawDataset } from "./helpers.js";

test("quiz session tracks progress and produces a final result", async () => {
  const data = normalizeMasterDataset(await readRawDataset());
  const questions = generateListeningQuestions({
    dataset: data,
    patternId: NUMBER_LISTENING_PATTERN_ID,
    stage: "A",
    sessionSize: 2,
    rng: () => 0.5,
  });
  let timeIndex = 0;
  const now = () => `2026-08-10T00:00:0${timeIndex++}.000Z`;
  let session = createQuizSession({
    questions,
    modeId: "numbers",
    patternId: NUMBER_LISTENING_PATTERN_ID,
    stage: "A",
    now,
    idFactory: () => "session-test",
  });

  const first = getCurrentQuestion(session);
  const wrongChoice = first.choices.find(
    (choice) => choice.key !== first.correctChoiceKey,
  );
  session = submitAnswer(session, wrongChoice.key, { now });
  assert.equal(session.currentResult.correct, false);
  assert.equal(session.correctCount, 0);
  assert.throws(
    () => submitAnswer(session, first.correctChoiceKey),
    /already been answered/,
  );

  session = advanceSession(session, { now });
  const second = getCurrentQuestion(session);
  session = submitAnswer(session, second.correctChoiceKey, { now });
  assert.equal(session.correctCount, 1);
  session = advanceSession(session, { now });

  assert.equal(session.status, "completed");
  assert.equal(getCurrentQuestion(session), null);
  assert.deepEqual(getSessionSummary(session), {
    sessionId: "session-test",
    startedAt: "2026-08-10T00:00:00.000Z",
    finishedAt: "2026-08-10T00:00:03.000Z",
    mode: "numbers",
    patternId: "QZ005",
    stage: "A",
    total: 2,
    correct: 1,
    incorrect: 1,
    exerciseKeys: questions.map((question) => question.exerciseKey),
  });
});
