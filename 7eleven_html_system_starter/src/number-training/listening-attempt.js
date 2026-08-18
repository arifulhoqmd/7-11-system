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

function validTime(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative timestamp.`);
  }
  return value;
}

export function createListeningAttempt(taskId) {
  if (typeof taskId !== "string" || taskId.length === 0) {
    throw new TypeError("A listening attempt requires a task ID.");
  }
  return deepFreeze({
    taskId,
    playbackCount: 0,
    replayCount: 0,
    isPlaying: false,
    responseStartedAt: null,
    responseStoppedAt: null,
    responseTimeMs: null,
  });
}

export function beginListeningPlayback(attempt) {
  if (attempt.isPlaying || attempt.responseStoppedAt !== null) {
    return attempt;
  }
  const playbackCount = attempt.playbackCount + 1;
  return deepFreeze({
    ...attempt,
    playbackCount,
    replayCount: Math.max(0, playbackCount - 1),
    isPlaying: true,
  });
}

export function completeListeningPlayback(attempt, completedAt) {
  const timestamp = validTime(completedAt, "TTS completion time");
  if (!attempt.isPlaying || attempt.responseStoppedAt !== null) {
    return attempt;
  }
  return deepFreeze({
    ...attempt,
    isPlaying: false,
    responseStartedAt: attempt.responseStartedAt ?? timestamp,
  });
}

export function failListeningPlayback(attempt) {
  return attempt.isPlaying
    ? deepFreeze({ ...attempt, isPlaying: false })
    : attempt;
}

export function stopListeningResponseTimer(attempt, stoppedAt) {
  const timestamp = validTime(stoppedAt, "Response stop time");
  if (
    attempt.responseStartedAt === null ||
    attempt.responseStoppedAt !== null
  ) {
    return attempt;
  }
  const responseStoppedAt = Math.max(timestamp, attempt.responseStartedAt);
  return deepFreeze({
    ...attempt,
    isPlaying: false,
    responseStoppedAt,
    responseTimeMs: responseStoppedAt - attempt.responseStartedAt,
  });
}

export function getListeningResponseTime(attempt, currentTime) {
  if (attempt === null || attempt?.responseStartedAt === null) {
    return null;
  }
  if (attempt.responseTimeMs !== null) {
    return attempt.responseTimeMs;
  }
  const timestamp = validTime(currentTime, "Current time");
  return Math.max(0, timestamp - attempt.responseStartedAt);
}
