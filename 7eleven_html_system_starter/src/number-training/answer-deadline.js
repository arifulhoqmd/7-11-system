function freeze(value) {
  return Object.freeze(value);
}

function validTimestamp(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative timestamp.`);
  }
  return value;
}

export function createAnswerDeadline(durationSeconds) {
  if (![1, 2, 3, 5, 7].includes(durationSeconds)) {
    throw new RangeError("Answer deadline must be 1, 2, 3, 5, or 7 seconds.");
  }
  return freeze({
    durationMs: durationSeconds * 1000,
    startedAt: null,
    expiresAt: null,
    stoppedAt: null,
    timedOut: false,
  });
}

export function startAnswerDeadline(deadline, startedAt) {
  const timestamp = validTimestamp(startedAt, "Deadline start time");
  if (deadline.startedAt !== null || deadline.stoppedAt !== null) {
    return deadline;
  }
  return freeze({
    ...deadline,
    startedAt: timestamp,
    expiresAt: timestamp + deadline.durationMs,
  });
}

export function stopAnswerDeadline(deadline, stoppedAt) {
  const timestamp = validTimestamp(stoppedAt, "Deadline stop time");
  if (deadline.startedAt === null || deadline.stoppedAt !== null) {
    return deadline;
  }
  return freeze({
    ...deadline,
    stoppedAt: Math.min(timestamp, deadline.expiresAt),
    timedOut: timestamp >= deadline.expiresAt,
  });
}

export function getAnswerTimeRemaining(deadline, currentTime) {
  if (deadline?.startedAt === null || deadline === null) {
    return null;
  }
  if (deadline.stoppedAt !== null) {
    return Math.max(0, deadline.expiresAt - deadline.stoppedAt);
  }
  const timestamp = validTimestamp(currentTime, "Current time");
  return Math.max(0, deadline.expiresAt - timestamp);
}

export function hasAnswerDeadlineExpired(deadline, currentTime) {
  return (
    deadline?.startedAt !== null &&
    deadline?.stoppedAt === null &&
    getAnswerTimeRemaining(deadline, currentTime) === 0
  );
}
