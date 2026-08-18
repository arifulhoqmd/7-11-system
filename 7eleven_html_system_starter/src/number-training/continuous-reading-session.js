import { isDifferentMixedTenThousandBand } from "./number-task-generator.js";

export const CONTINUOUS_READING_MIN = 1;
export const CONTINUOUS_READING_MAX = 10000;
export const CONTINUOUS_READING_WAIT_MS = 5000;
export const CONTINUOUS_READING_NEXT_DELAY_MS = 1000;

export function isContinuousReadingSkipKey(event) {
  return Boolean(
    event?.key === "ArrowRight" &&
    !event.repeat &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey,
  );
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function randomValue(rng) {
  const sample = Number(rng());
  const normalized = Number.isFinite(sample)
    ? Math.min(0.999999999, Math.max(0, sample))
    : 0;
  return CONTINUOUS_READING_MIN +
    Math.floor(normalized * CONTINUOUS_READING_MAX);
}

function findUnseenCandidate(previous, seen, rng) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = randomValue(rng);
    if (
      !seen.has(candidate) &&
      isDifferentMixedTenThousandBand(previous, candidate)
    ) {
      return candidate;
    }
  }
  for (
    let candidate = CONTINUOUS_READING_MIN;
    candidate <= CONTINUOUS_READING_MAX;
    candidate += 1
  ) {
    if (
      !seen.has(candidate) &&
      isDifferentMixedTenThousandBand(previous, candidate)
    ) {
      return candidate;
    }
  }
  return null;
}

function findBridge(previous, unseenTarget) {
  for (
    let candidate = CONTINUOUS_READING_MIN;
    candidate <= CONTINUOUS_READING_MAX;
    candidate += 1
  ) {
    if (
      isDifferentMixedTenThousandBand(previous, candidate) &&
      isDifferentMixedTenThousandBand(candidate, unseenTarget)
    ) {
      return candidate;
    }
  }
  throw new Error("Could not satisfy the Continuous Reading transition rule.");
}

export function createContinuousReadingSession({ rng = Math.random } = {}) {
  const currentValue = randomValue(rng);
  return deepFreeze({
    status: "active",
    phase: "reading",
    currentValue,
    position: 1,
    cycle: 1,
    seenValues: [currentValue],
    pendingValue: null,
  });
}

export function setContinuousReadingPhase(session, phase) {
  if (session.status !== "active") {
    throw new Error("Only an active Continuous Reading session can change phase.");
  }
  return deepFreeze({ ...session, phase });
}

export function pauseContinuousReadingSession(session) {
  if (session.status !== "active") {
    throw new Error("Only an active Continuous Reading session can be paused.");
  }
  return deepFreeze({ ...session, status: "paused", phase: "paused" });
}

export function resumeContinuousReadingSession(session) {
  if (session.status !== "paused") {
    throw new Error("Only a paused Continuous Reading session can be resumed.");
  }
  return deepFreeze({ ...session, status: "active", phase: "reading" });
}

export function advanceContinuousReadingSession(
  session,
  { rng = Math.random } = {},
) {
  if (session.status !== "active") {
    throw new Error("Only an active Continuous Reading session can advance.");
  }
  const seen = new Set(session.seenValues);
  if (session.pendingValue !== null) {
    const next = session.pendingValue;
    seen.add(next);
    return deepFreeze({
      ...session,
      phase: "reading",
      currentValue: next,
      position: session.position + 1,
      seenValues: [...seen],
      pendingValue: null,
    });
  }
  let next = findUnseenCandidate(session.currentValue, seen, rng);
  let cycle = session.cycle;
  let pendingValue = null;
  if (next === null && seen.size < CONTINUOUS_READING_MAX) {
    const unseenTarget = Array.from(
      { length: CONTINUOUS_READING_MAX },
      (_, index) => index + 1,
    ).find((value) => !seen.has(value));
    next = findBridge(session.currentValue, unseenTarget);
    pendingValue = unseenTarget;
  } else if (next === null) {
    cycle += 1;
    seen.clear();
    seen.add(session.currentValue);
    next = findUnseenCandidate(session.currentValue, seen, rng);
  }
  seen.add(next);
  return deepFreeze({
    ...session,
    phase: "reading",
    currentValue: next,
    position: session.position + 1,
    cycle,
    seenValues: [...seen],
    pendingValue,
  });
}
