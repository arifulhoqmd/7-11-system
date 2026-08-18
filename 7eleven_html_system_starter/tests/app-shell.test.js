import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DEFAULT_SETTINGS } from "../src/progress/progress-store.js";
import { renderApp } from "../src/ui/screens.js";

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
    numberModeId: null,
    numberRangeId: null,
    numberSession: null,
    progress: {
      numberTraining: {
        skills: {},
        modes: {},
        ranges: {},
        modeRanges: {},
        taskKinds: {},
      },
    },
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
  assert.match(html, /type="module" src="\.\/src\/app\.js\?v=\d+-\d+"/);
  assert.match(css, /button\s*\{[^}]*min-height:\s*48px/s);
  assert.match(
    css,
    /\.exit-session-button,[\s\S]*?\.back-button\s*\{[^}]*min-height:\s*54px[^}]*border:\s*2px solid var\(--green-700\)[^}]*font-size:\s*1\.05rem/s,
  );
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(min-width: 780px\)/);
  assert.match(
    css,
    /\.number-training-layout\s*\{[^}]*grid-template-columns:\s*300px minmax\(0, 1fr\)/s,
  );
  assert.match(css, /\.number-desktop-navigation\s*\{[^}]*display:\s*block/s);
  assert.match(css, /\.number-mobile-navigation\s*\{[^}]*display:\s*none/s);
});

test("Continuous Listening start reads the current dataset before building its quantity pool", async () => {
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const handler = source.match(
    /if \(action === "start-continuous-playing"\) \{[\s\S]*?if \(action === "start-continuous-reading"\)/,
  )?.[0];

  assert.ok(handler, "Continuous Listening start handler was not found");
  assert.match(
    handler,
    /const state = appState\.getState\(\);[\s\S]*getQuantityTrainingPool\(state\.dataset, "mixed"\)/,
  );
});

test("English-first Continuous Listening has an independent start handler", async () => {
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(source, /if \(action === "start-continuous-english-playing"\)/);
  assert.match(source, /createContinuousEnglishNumberSession\(\)/);
  assert.match(source, /numberModeId: "continuous-english-listening"/);
});

test("11–260 Continuous Playing starts an independent finite range", async () => {
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const handler = source.match(
    /if \(action === "start-continuous-playing-11-260"\) \{[\s\S]*?if \(action === "start-continuous-reading"\)/,
  )?.[0];

  assert.ok(handler, "11–260 Continuous Playing handler was not found");
  assert.match(handler, /min: 11/);
  assert.match(handler, /max: 260/);
  assert.match(handler, /numberModeId: "continuous-number-11-260"/);
});

test("home, focused Practice hub, and settings screens render", () => {
  const options = {
    stageCount: 87,
    ttsSupported: true,
    sampleRecord: SAMPLE_RECORD,
  };
  const home = renderApp(readyState("home"), options);
  const practice = renderApp(readyState("practice"), options);
  const settings = renderApp(readyState("settings"), options);

  assert.equal((home.match(/class="home-category-card/g) ?? []).length, 3);
  assert.match(home, /Listening/);
  assert.match(home, /Speaking \/ Reading/);
  assert.match(home, /Special Number/);
  assert.match(
    home,
    /data-action="choose-number-mode"[\s\S]*data-number-mode="number-dictation"/,
  );
  assert.match(
    home,
    /data-action="choose-number-mode"[\s\S]*data-number-mode="number-reading"/,
  );
  assert.match(
    home,
    /data-action="navigate"[\s\S]*data-route="special-number"/,
  );
  assert.doesNotMatch(home, /Choose practice mode/);
  assert.doesNotMatch(home, /Ready for a short practice/);
  assert.doesNotMatch(home, /Hear → understand/);
  assert.doesNotMatch(home, /Current learning plan/);
  assert.doesNotMatch(home, /Your choices are saved/);
  assert.doesNotMatch(home, /Training data is ready/);
  assert.doesNotMatch(home, /839 source records loaded/);
  assert.doesNotMatch(home, /available records|questions per session/);
  assert.doesNotMatch(home, /data-route="practice"/);
  assert.match(home, /data-route="home"/);
  assert.match(home, /data-route="settings"/);
  assert.match(practice, /Primary active module/);
  assert.match(practice, /Number Training/);
  assert.match(practice, /Listening · Speaking \/ Reading/);
  assert.match(practice, /data-action="open-number-training"/);
  assert.match(practice, /Later modules/);
  assert.match(practice, /Hot Food/);
  assert.match(practice, /Customer Interaction/);
  assert.doesNotMatch(practice, />Prices</);
  assert.doesNotMatch(practice, /Cigarette Numbers/);
  assert.match(settings, /Stage A/);
  assert.match(settings, /Session size/);
  assert.match(settings, /Show Kana/);
  assert.match(settings, /Show Romaji/);
  assert.match(settings, /Japanese audio speed/);
  assert.match(settings, /Listening environment/);
  assert.match(settings, /Clean/);
  assert.match(settings, /Light noise/);
  assert.match(settings, /Medium noise/);
  assert.match(settings, /Background conversation/);
  assert.match(settings, /synthetic, indistinct speech-like babble/);
  assert.match(settings, /Answer time limit/);
  assert.match(settings, /1 second/);
  assert.match(settings, /2 seconds/);
  assert.match(settings, /3 seconds/);
  assert.match(settings, /5 seconds/);
  assert.match(settings, /7 seconds/);
  assert.doesNotMatch(practice, /Numbers selected|Open Number Training/);
});

test("Special Number home category opens the complete reference page", () => {
  const special = renderApp(readyState("special-number"), {
    stageCount: 87,
    ttsSupported: true,
    sampleRecord: SAMPLE_RECORD,
  });
  const requiredRows = [
    ["100", "いちひゃく", "ひゃく", "hyaku"],
    ["300", "さんひゃく", "さんびゃく", "sanbyaku"],
    ["600", "ろくひゃく", "ろっぴゃく", "roppyaku"],
    ["800", "はちひゃく", "はっぴゃく", "happyaku"],
    ["1000", "いちせん", "せん", "sen"],
    ["3000", "さんせん", "さんぜん", "sanzen"],
    ["8000", "はちせん", "はっせん", "hassen"],
  ];
  const requiredExamples = [
    "180 → ひゃくはちじゅう",
    "345 → さんびゃくよんじゅうご",
    "620 → ろっぴゃくにじゅう",
    "840 → はっぴゃくよんじゅう",
    "1400 → せんよんひゃく",
    "3400 → さんぜんよんひゃく",
    "8200 → はっせんにひゃく",
  ];

  assert.match(special, /<h1>Special Number<\/h1>/);
  assert.match(special, /Expected but wrong/);
  assert.match(special, /Correct Japanese/);
  assert.match(special, /2 Examples/);
  for (const row of requiredRows) {
    for (const value of row) {
      assert.ok(special.includes(value), `Missing Special Number value: ${value}`);
    }
  }
  for (const example of requiredExamples) {
    assert.ok(special.includes(example), `Missing example: ${example}`);
  }
  assert.equal(
    (special.match(/data-action="play-special-number"/g) ?? []).length,
    7,
  );
  assert.match(special, /data-route="home"/);
});

test("Practice links directly to Number Training and paused modules are disabled", () => {
  const practice = renderApp(readyState("practice"), {
    stageCount: 87,
    ttsSupported: false,
    sampleRecord: SAMPLE_RECORD,
  });

  assert.match(
    practice,
    /class="active-training-card"[\s\S]*data-action="open-number-training"/,
  );
  assert.equal((practice.match(/class="later-module-card"/g) ?? []).length, 4);
  assert.equal((practice.match(/type="button" disabled/g) ?? []).length, 4);
  assert.doesNotMatch(practice, /data-action="select-mode"/);

  const numberTraining = renderApp(
    {
      ...readyState("number-training"),
      numberModeId: "number-dictation",
    },
    { ttsSupported: false },
  );
  assert.match(numberTraining, /number-training-frame/);
  assert.match(numberTraining, /Listening[\s\S]*Number Dictation/);
  assert.doesNotMatch(numberTraining, /Numbers selected|Open Number Training/);
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

test("multiple-choice timeout reveals neither answer text nor correct choice", () => {
  const response = {
    exerciseKey: "QZ005:NUM000004",
    patternId: "QZ005",
    sourceRefs: ["NUM000004"],
    choiceKey: null,
    correct: false,
    timedOut: true,
    answeredAt: "2026-08-10T00:01:00.000Z",
  };
  const output = renderApp(quizState(response), {
    stageCount: 87,
    ttsSupported: true,
    sampleRecord: SAMPLE_RECORD,
  });
  assert.match(output, /Time is up — marked wrong/);
  assert.match(output, /answer stays hidden/);
  assert.doesNotMatch(output, /よん/);
  assert.doesNotMatch(output, />yon</);
  assert.doesNotMatch(output, /answer-choice correct/);
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
