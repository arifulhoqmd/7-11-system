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
  return `number-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createSelfMarkSession({
  tasks,
  modeId,
  rangeId,
  now = () => new Date().toISOString(),
  idFactory = defaultIdFactory,
}) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new RangeError("A self-marking session requires tasks.");
  }
  return deepFreeze({
    sessionId: idFactory(),
    modeId,
    rangeId,
    status: "active",
    phase: "prompt",
    currentIndex: 0,
    currentResult: null,
    correctCount: 0,
    startedAt: now(),
    finishedAt: null,
    tasks: [...tasks],
    responses: [],
  });
}

export function getCurrentNumberTask(session) {
  return session.status === "completed"
    ? null
    : session.tasks[session.currentIndex] ?? null;
}

export function revealNumberTask(session) {
  if (session.status !== "active" || session.phase !== "prompt") {
    throw new Error("Only a hidden current task can be revealed.");
  }
  return deepFreeze({ ...session, phase: "revealed" });
}

export function markNumberTask(
  session,
  correct,
  { now = () => new Date().toISOString() } = {},
) {
  if (session.status !== "active" || session.phase !== "revealed") {
    throw new Error("Reveal the answer before self-marking.");
  }
  if (typeof correct !== "boolean") {
    throw new TypeError("Self-mark result must be Correct or Wrong.");
  }

  const task = getCurrentNumberTask(session);
  const response = {
    exerciseKey: task.exerciseKey,
    patternId: task.patternId,
    sourceRefs: [...task.sourceRefs],
    correct,
    answeredAt: now(),
    numberTraining: {
      skill:
        task.promptType === "speaking" ? "speaking-reading" : "listening",
      modeId: session.modeId,
      rangeId: session.rangeId,
      taskKind: task.taskKind,
    },
  };

  return deepFreeze({
    ...session,
    phase: "marked",
    currentResult: response,
    correctCount: session.correctCount + (correct ? 1 : 0),
    responses: [...session.responses, response],
  });
}

export function advanceNumberTask(
  session,
  { now = () => new Date().toISOString() } = {},
) {
  if (session.status !== "active" || session.phase !== "marked") {
    throw new Error("Self-mark the current task before continuing.");
  }
  if (session.currentIndex === session.tasks.length - 1) {
    return deepFreeze({
      ...session,
      status: "completed",
      phase: "completed",
      currentResult: null,
      finishedAt: now(),
    });
  }
  return deepFreeze({
    ...session,
    currentIndex: session.currentIndex + 1,
    phase: "prompt",
    currentResult: null,
  });
}

export function getNumberSessionSummary(session) {
  if (session.status !== "completed") {
    throw new Error("Number-session summary requires a completed session.");
  }
  return deepFreeze({
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    mode: session.modeId,
    patternId: session.tasks[0].patternId,
    stage: "number-training",
    rangeId: session.rangeId,
    total: session.tasks.length,
    correct: session.correctCount,
    exerciseKeys: session.responses.map((response) => response.exerciseKey),
  });
}
