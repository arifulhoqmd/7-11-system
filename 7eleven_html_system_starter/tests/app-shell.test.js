import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DEFAULT_SETTINGS } from "../src/progress/progress-store.js";
import { PRACTICE_MODES, renderApp } from "../src/ui/screens.js";

const SAMPLE_RECORD = Object.freeze({
  japanese: "いらっしゃいませ。",
  reading_kana: "いらっしゃいませ。",
  romaji: "irasshaimase.",
  english: "Welcome.",
});

function readyState(route) {
  return {
    status: "ready",
    route,
    dataset: { masterItems: Array.from({ length: 839 }) },
    settings: DEFAULT_SETTINGS,
    selectedMode: null,
    announcement: null,
  };
}

test("HTML shell is mobile-first and starts the ES-module application", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(
    new URL("../assets/app.css", import.meta.url),
    "utf8",
  );

  assert.match(html, /width=device-width/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /type="module" src="\.\/src\/app\.js"/);
  assert.match(css, /button\s*\{[^}]*min-height:\s*48px/s);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("home, practice, and settings screens render the Phase 3A entry points", () => {
  const options = {
    stageCount: 87,
    ttsSupported: true,
    sampleRecord: SAMPLE_RECORD,
  };
  const home = renderApp(readyState("home"), options);
  const practice = renderApp(readyState("practice"), options);
  const settings = renderApp(readyState("settings"), options);

  assert.match(home, /87 available records/);
  assert.match(home, /Choose practice mode/);
  for (const mode of PRACTICE_MODES) {
    assert.match(practice, new RegExp(mode.title));
  }
  assert.match(settings, /Stage A/);
  assert.match(settings, /Session size/);
  assert.match(settings, /Show Kana/);
  assert.match(settings, /Show Romaji/);
  assert.match(settings, /Japanese audio speed/);
  assert.doesNotMatch(practice, /Start quiz/);
});

test("number and price selections can start while later modes stay unavailable", () => {
  const state = {
    ...readyState("practice"),
    selectedMode: "numbers",
  };
  const output = renderApp(state, {
    stageCount: 87,
    ttsSupported: false,
    sampleRecord: SAMPLE_RECORD,
  });

  assert.match(output, /Numbers selected/);
  assert.match(output, /Start 10-question session/);

  const laterOutput = renderApp(
    { ...readyState("practice"), selectedMode: "hot-food" },
    {
      stageCount: 87,
      ttsSupported: false,
      sampleRecord: SAMPLE_RECORD,
    },
  );
  assert.match(laterOutput, /not implemented in Phase 3A/);
});

function quizState(currentResult = null) {
  return {
    ...readyState("quiz"),
    quizSession: {
      sessionId: "session-test",
      modeId: "numbers",
      patternId: "QZ005",
      stage: "A",
      status: "active",
      startedAt: "2026-08-10T00:00:00.000Z",
      finishedAt: null,
      currentIndex: 0,
      currentResult,
      correctCount: currentResult?.correct ? 1 : 0,
      responses: currentResult ? [currentResult] : [],
      questions: [
        {
          questionId: "QZ005:NUM000004",
          exerciseKey: "QZ005:NUM000004",
          patternId: "QZ005",
          patternName: "Number listening",
          sourceRefs: ["NUM000004"],
          instruction: "What number did you hear?",
          ttsText: "よん",
          correctChoiceKey: "number:4",
          choices: [
            { key: "number:2", label: "2" },
            { key: "number:3", label: "3" },
            { key: "number:4", label: "4" },
            { key: "number:5", label: "5" },
          ],
          reveal: {
            japanese: "よん",
            readingKana: "よん",
            romaji: "yon",
            english: "4",
          },
        },
      ],
    },
  };
}

test("listening screen hides Japanese, Kana, and Romaji until answered", () => {
  const options = {
    stageCount: 87,
    ttsSupported: true,
    sampleRecord: SAMPLE_RECORD,
  };
  const unanswered = renderApp(quizState(), options);
  assert.match(unanswered, /What number did you hear/);
  assert.match(unanswered, /Play audio/);
  assert.doesNotMatch(unanswered, /よん/);
  assert.doesNotMatch(unanswered, />yon</);

  const response = {
    exerciseKey: "QZ005:NUM000004",
    patternId: "QZ005",
    sourceRefs: ["NUM000004"],
    choiceKey: "number:4",
    correct: true,
    answeredAt: "2026-08-10T00:01:00.000Z",
  };
  const answered = renderApp(quizState(response), options);
  assert.match(answered, /Correct/);
  assert.match(answered, /よん/);
  assert.match(answered, />yon</);
  assert.match(answered, /See results/);
});

test("unsupported TTS changes the question to a visible reading fallback", () => {
  const output = renderApp(quizState(), {
    stageCount: 87,
    ttsSupported: false,
    sampleRecord: SAMPLE_RECORD,
  });

  assert.match(output, /Reading fallback/);
  assert.match(output, /Japanese audio is unavailable/);
  assert.match(output, /よん/);
  assert.doesNotMatch(output, /Play audio/);
});

test("completed session renders the final score and restart controls", () => {
  const state = quizState();
  state.route = "results";
  state.quizSession = {
    ...state.quizSession,
    status: "completed",
    correctCount: 1,
    finishedAt: "2026-08-10T00:02:00.000Z",
  };

  const output = renderApp(state, {
    stageCount: 87,
    ttsSupported: true,
    sampleRecord: SAMPLE_RECORD,
  });
  assert.match(output, /Session complete/);
  assert.match(output, /1\/1/);
  assert.match(output, /100%/);
  assert.match(output, /Practice this mode again/);
});

test("dataset failures render a friendly local-server recovery screen", () => {
  const output = renderApp({
    ...readyState("home"),
    status: "error",
    error: new Error("Request failed."),
  });

  assert.match(output, /Training data could not load/);
  assert.match(output, /VS Code Live Server/);
  assert.match(output, /Try again/);
});
