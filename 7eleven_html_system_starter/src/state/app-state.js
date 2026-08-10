export const APP_ROUTES = Object.freeze([
  "home",
  "practice",
  "settings",
  "quiz",
  "results",
  "number-training",
  "number-setup",
  "number-task",
  "number-results",
]);
export const APP_STATUSES = Object.freeze(["loading", "ready", "error"]);

export function createAppState(initialState = {}) {
  let state = Object.freeze({
    status: "loading",
    route: "home",
    dataset: null,
    settings: null,
    selectedMode: null,
    quizSession: null,
    numberModeId: null,
    numberRangeId: null,
    numberSession: null,
    error: null,
    ...initialState,
  });
  const listeners = new Set();

  function assertState(nextState) {
    if (!APP_STATUSES.includes(nextState.status)) {
      throw new RangeError(`Unknown application status "${nextState.status}".`);
    }
    if (!APP_ROUTES.includes(nextState.route)) {
      throw new RangeError(`Unknown application route "${nextState.route}".`);
    }
  }

  assertState(state);

  function getState() {
    return state;
  }

  function setState(patch) {
    const changes =
      typeof patch === "function" ? patch(state) : patch;
    const nextState = Object.freeze({ ...state, ...changes });
    assertState(nextState);
    state = nextState;
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  function navigate(route) {
    if (!APP_ROUTES.includes(route)) {
      throw new RangeError(`Unknown application route "${route}".`);
    }
    return setState({ route });
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("State subscriber must be a function.");
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return Object.freeze({
    getState,
    setState,
    navigate,
    subscribe,
  });
}
