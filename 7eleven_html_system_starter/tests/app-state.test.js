import assert from "node:assert/strict";
import test from "node:test";

import { createAppState } from "../src/state/app-state.js";

test("application state supports observable route and status transitions", () => {
  const state = createAppState();
  const observed = [];
  const unsubscribe = state.subscribe((nextState) => observed.push(nextState));

  state.setState({ status: "ready", settings: { stage: "A" } });
  state.navigate("practice");
  state.setState({ selectedMode: "numbers" });
  unsubscribe();
  state.navigate("settings");

  assert.equal(observed.length, 3);
  assert.equal(observed[0].status, "ready");
  assert.equal(observed[1].route, "practice");
  assert.equal(observed[2].selectedMode, "numbers");
  assert.equal(state.getState().route, "settings");
  assert.ok(Object.isFrozen(state.getState()));
});

test("application state rejects unknown routes and statuses", () => {
  const state = createAppState();
  assert.throws(
    () => state.navigate("unknown-screen"),
    /Unknown application route/,
  );
  assert.throws(
    () => state.setState({ status: "finished" }),
    /Unknown application status/,
  );
});

test("application state supports the Continuous Playing route", () => {
  const state = createAppState();
  assert.doesNotThrow(() => state.navigate("continuous-playing"));
  assert.equal(state.getState().route, "continuous-playing");
  assert.equal(state.getState().continuousSession, null);
});

test("application state supports the Special Number reference route", () => {
  const state = createAppState();
  assert.doesNotThrow(() => state.navigate("special-number"));
  assert.equal(state.getState().route, "special-number");
});

test("application state supports the Continuous Reading route", () => {
  const state = createAppState();
  assert.doesNotThrow(() => state.navigate("continuous-reading"));
  assert.equal(state.getState().route, "continuous-reading");
  assert.equal(state.getState().continuousReadingSession, null);
});
