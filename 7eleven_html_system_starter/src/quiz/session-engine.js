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

function defaultIdFactory() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createQuizSession({
  questions,
  modeId,
  patternId,
  stage,
  now = () => new Date().toISOString(),
  idFactory = defaultIdFactory,
}) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new RangeError("A quiz session requires at least one question.");
  }

  return deepFreeze({
    sessionId: idFactory(),
    modeId,
    patternId,
    stage: stage === "B" ? "B" : "A",
    status: "active",
    startedAt: now(),
    finishedAt: null,
    currentIndex: 0,
    currentResult: null,
    correctCount: 0,
    questions: [...questions],
    responses: [],
  });
}

export function getCurrentQuestion(session) {
  if (session.status === "completed") {
    return null;
  }
  return session.questions[session.currentIndex] ?? null;
}

export function submitAnswer(
  session,
  choiceKey,
  { now = () => new Date().toISOString() } = {},
) {
  if (session.status !== "active") {
    throw new Error("Cannot answer a completed quiz session.");
  }
  if (session.currentResult !== null) {
    throw new Error("The current question has already been answered.");
  }

  const question = getCurrentQuestion(session);
  const selectedChoice = question.choices.find(
    (choice) => choice.key === choiceKey,
  );
  if (!selectedChoice) {
    throw new RangeError("Selected choice does not belong to this question.");
  }

  const response = {
    exerciseKey: question.exerciseKey,
    patternId: question.patternId,
    sourceRefs: [...question.sourceRefs],
    choiceKey,
    correct: choiceKey === question.correctChoiceKey,
    answeredAt: now(),
  };

  return deepFreeze({
    ...session,
    currentResult: response,
    correctCount: session.correctCount + (response.correct ? 1 : 0),
    responses: [...session.responses, response],
  });
}

export function advanceSession(
  session,
  { now = () => new Date().toISOString() } = {},
) {
  if (session.status !== "active") {
    throw new Error("Cannot advance a completed quiz session.");
  }
  if (session.currentResult === null) {
    throw new Error("Answer the current question before continuing.");
  }

  const isLastQuestion =
    session.currentIndex === session.questions.length - 1;
  if (isLastQuestion) {
    return deepFreeze({
      ...session,
      status: "completed",
      finishedAt: now(),
      currentResult: null,
    });
  }

  return deepFreeze({
    ...session,
    currentIndex: session.currentIndex + 1,
    currentResult: null,
  });
}

export function getSessionSummary(session) {
  if (session.status !== "completed") {
    throw new Error("Session summary is available only after completion.");
  }

  return deepFreeze({
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    mode: session.modeId,
    patternId: session.patternId,
    stage: session.stage,
    total: session.questions.length,
    correct: session.correctCount,
    incorrect: session.questions.length - session.correctCount,
    exerciseKeys: session.responses.map((response) => response.exerciseKey),
  });
}
