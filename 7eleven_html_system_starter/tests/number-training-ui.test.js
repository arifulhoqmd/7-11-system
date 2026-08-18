import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMasterDataset } from "../src/data/normalize.js";
import { DEFAULT_SETTINGS } from "../src/progress/progress-store.js";
import {
  renderNumberSetup,
  renderNumberResults,
  renderNumberTask,
  renderNumberTrainingHome,
  renderContinuousPlaying,
  renderContinuousReading,
} from "../src/ui/number-training-screens.js";
import { readRawDataset } from "./helpers.js";

function baseState() {
  return {
    settings: DEFAULT_SETTINGS,
    dataset: { numberDetail: [] },
    announcement: null,
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
  };
}

const DICTATION_TASK = Object.freeze({
  taskId: "dictation-task",
  exerciseKey: "NT_DICTATION:dictation-101-200:128",
  patternId: "NT_DICTATION",
  sourceRefs: ["NUM000128"],
  taskKind: "plain-number",
  promptType: "listening",
  promptNumber: null,
  ttsText: "ひゃくにじゅうはち",
  reveal: {
    numericAnswer: "128",
    japanese: "百二十八",
    readingKana: "ひゃくにじゅうはち",
    romaji: "hyaku ni juu hachi",
  },
});

function numberSession(task, phase = "prompt", result = null) {
  return {
    modeId:
      task.promptType === "speaking" ? "number-reading" : "number-dictation",
    rangeId:
      task.promptType === "speaking"
        ? "reading-601-700"
        : "dictation-101-200",
    status: "active",
    phase,
    currentIndex: 0,
    currentResult: result,
    correctCount: result?.correct ? 1 : 0,
    tasks: [task],
    responses: result ? [result] : [],
  };
}

test("Number Training uses category and mode navigation beside main content", () => {
  const output = renderNumberTrainingHome(baseState());
  const navigationLabels = [
    "Listening",
    "Number Dictation",
    "Continuous Playing",
    "Continuous Playing 11–260",
    "Continuous English → Japanese",
    "Tobacco Number",
    "Quantity",
    "Tobacco + Quantity",
    "Service / Money Amount",
    "Mixed Listening",
    "Multiple Choice",
  ];

  assert.match(output, /Number Training/);
  assert.match(output, /Listening/);
  assert.match(output, /Number Dictation/);
  assert.match(output, /Highest priority/);
  assert.match(output, /Multiple Choice/);
  assert.match(output, /Tobacco \+ Quantity/);
  assert.ok(
    output.indexOf("Mixed Listening") <
    output.indexOf("Multiple Choice"),
  );
  assert.match(output, /<aside class="number-training-navigation"/);
  assert.match(output, /<nav class="number-desktop-navigation"/);
  assert.match(
    output,
    /<details class="number-navigation-drawer number-mobile-navigation">/,
  );
  assert.match(output, /☰ Number Training/);
  assert.match(
    output,
    /data-number-mode="number-dictation"[\s\S]*aria-current="page"/,
  );
  assert.match(output, /Listening[\s\S]*›[\s\S]*Number Dictation/);

  const desktopSidebar = output.match(
    /<nav class="number-desktop-navigation"[\s\S]*?<\/nav>/,
  )?.[0];
  const mobileDrawer = output.match(
    /<nav class="number-navigation-body"[\s\S]*?<\/nav>/,
  )?.[0];
  assert.ok(desktopSidebar);
  assert.ok(mobileDrawer);
  for (const label of navigationLabels) {
    assert.match(desktopSidebar, new RegExp(label.replace("+", "\\+")));
    assert.match(mobileDrawer, new RegExp(label.replace("+", "\\+")));
  }
  assert.doesNotMatch(
    desktopSidebar,
    /Speaking \/ Reading|General Numbers|Total Bill|Price|Change/,
  );
  assert.doesNotMatch(
    mobileDrawer,
    /Speaking \/ Reading|General Numbers|Total Bill|Price|Change/,
  );
  assert.doesNotMatch(
    desktopSidebar,
    /data-range-id|1–10|Mixed 1–300/,
  );
  assert.doesNotMatch(mobileDrawer, /data-range-id|1–10|Mixed 1–300/);
  assert.equal((output.match(/aria-current="page"/g) ?? []).length, 2);
  assert.match(output, /data-route="home"/);
});

test("Speaking/Reading mode selection is obvious and keeps ranges in main content", () => {
  const output = renderNumberTrainingHome({
    ...baseState(),
    numberModeId: "number-reading",
    numberRangeId: "reading-601-700",
  });

  assert.match(output, /Speaking \/ Reading[\s\S]*›[\s\S]*General Numbers/);
  assert.match(
    output,
    /data-number-mode="number-reading"[\s\S]*aria-current="page"/,
  );
  assert.match(
    output,
    /data-range-id="reading-601-700"[\s\S]*aria-pressed="true"/,
  );
  assert.match(output, /Mixed 1–1000/);
  assert.match(output, /1001–10000/);
  assert.match(output, /Focused 400–5999/);
  assert.match(output, /Mixed 1–10000/);
  const desktopSidebar = output.match(
    /<nav class="number-desktop-navigation"[\s\S]*?<\/nav>/,
  )?.[0];
  const mobileDrawer = output.match(
    /<nav class="number-navigation-body"[\s\S]*?<\/nav>/,
  )?.[0];
  assert.match(desktopSidebar, /Speaking \/ Reading/);
  assert.match(desktopSidebar, /Continuous Reading/);
  assert.match(mobileDrawer, /Speaking \/ Reading/);
  assert.match(mobileDrawer, /Continuous Reading/);
  assert.doesNotMatch(
    desktopSidebar,
    /Number Dictation|Tobacco Number|Mixed Listening|Multiple Choice/,
  );
  assert.doesNotMatch(
    mobileDrawer,
    /Number Dictation|Tobacco Number|Mixed Listening|Multiple Choice/,
  );
});

test("Continuous Reading is a separate Speaking/Reading-only mode", () => {
  const output = renderNumberTrainingHome({
    ...baseState(),
    numberModeId: "continuous-number-reading",
  });

  assert.match(output, /Speaking \/ Reading[\s\S]*Continuous Reading/);
  assert.match(output, /Random numbers 1–10000/);
  assert.match(output, /Five seconds to read each number aloud/);
  assert.match(output, /Right Arrow or Skip/);
  assert.match(output, /data-action="start-continuous-reading"/);
  assert.doesNotMatch(output, /data-action="start-number-session"/);
});

test("selecting Price updates only the right mode panel", () => {
  const output = renderNumberTrainingHome({
    ...baseState(),
    numberModeId: "price-reading",
  });

  assert.match(output, /Speaking \/ Reading[\s\S]*›[\s\S]*Price/);
  assert.match(output, /data-range-id="price-selected"/);
  assert.match(output, /Selected amounts/);
  const rightPanel = output.match(
    /<section class="number-mode-panel"[\s\S]*?<div class="range-action-buttons">/s,
  )?.[0];
  assert.ok(rightPanel);
  assert.match(rightPanel, /<h1 id="selected-mode-title">Price<\/h1>/);
  assert.doesNotMatch(rightPanel, /Tobacco Number|General Numbers|Total Bill/);
});

test("setup screen exposes selectable dictation ranges without typing", () => {
  const output = renderNumberSetup({
    ...baseState(),
    numberModeId: "number-dictation",
    numberRangeId: "dictation-101-200",
  });

  for (const label of [
    "1–10",
    "11–50",
    "51–100",
    "101–200",
    "201–300",
    "Mixed 1–300",
  ]) {
    assert.match(output, new RegExp(label));
  }
  assert.match(output, /data-action="select-number-range"/);
  assert.match(
    output,
    /data-range-id="dictation-101-200"[\s\S]*aria-pressed="true"/,
  );
  assert.doesNotMatch(output, /type="text"/);
});

test("Multiple Choice remains selected until its explicit Start button", () => {
  const output = renderNumberTrainingHome({
    ...baseState(),
    numberModeId: "number-multiple-choice",
  });

  assert.match(output, /Current pool/);
  assert.match(output, /Stage A/);
  assert.match(output, /data-action="start-number-multiple-choice"/);
  assert.doesNotMatch(output, /data-action="start-number-session"/);
});

test("Continuous Playing is a separate Listening-only hands-free mode", () => {
  const output = renderNumberTrainingHome({
    ...baseState(),
    numberModeId: "continuous-number-listening",
  });

  assert.match(output, /Listening[\s\S]*Continuous Playing/);
  assert.match(output, /300 numbers \+ 20 quantity forms/);
  assert.match(output, /Numbers 1.300, つ quantities 1.10, and 個 quantities 1.10/);
  assert.match(output, /All 320 items play once/);
  assert.match(output, /Five seconds to say the answer/);
  assert.match(output, /No scores, mistakes, or checklist changes/);
  assert.match(output, /Japanese prompt environment:[\s\S]*Medium noise/);
  assert.match(output, /uses Medium noise when the general setting is Clean/);
  assert.match(output, /data-action="start-continuous-playing"/);
  assert.doesNotMatch(output, /data-action="start-number-session"/);
  assert.doesNotMatch(output, /data-action="reset-number-range"/);
});

test("Continuous Playing 11–260 is an independent numbers-only mode", () => {
  const output = renderNumberTrainingHome({
    ...baseState(),
    numberModeId: "continuous-number-11-260",
  });

  assert.match(output, /Continuous Playing 11–260/);
  assert.match(output, /250 numbers/);
  assert.match(output, /Numbers 11–260 only, with no quantity forms/);
  assert.match(output, /All 250 numbers play once in a shuffled cycle/);
  assert.match(output, /Five seconds to say the answer/);
  assert.match(output, /Slow English answer, then a clear Japanese repeat/);
  assert.match(output, /data-action="start-continuous-playing-11-260"/);
  assert.doesNotMatch(output, /data-action="start-number-session"/);
});

test("11–260 continuous player keeps the standard Japanese-first format", () => {
  const output = renderContinuousPlaying(
    {
      ...baseState(),
      continuousSession: {
        continuousModeId: "continuous-number-11-260",
        direction: "japanese-to-english",
        status: "active",
        phase: "waiting",
        items: [128, 129],
        currentIndex: 0,
      },
      continuousRemainingMs: 5000,
    },
    { ttsSupported: true, englishTtsSupported: true },
  );

  assert.match(output, /Continuous Playing 11–260/);
  assert.match(output, /Item 1 \/ 2/);
  assert.match(output, /Say the answer now/);
  assert.doesNotMatch(output, />128</);
  assert.match(output, /data-action="pause-continuous-playing"/);
  assert.match(output, /data-action="repeat-continuous-number"/);
});

test("Continuous English to Japanese is a separate weighted Listening mode", () => {
  const output = renderNumberTrainingHome({
    ...baseState(),
    numberModeId: "continuous-english-listening",
  });

  assert.match(output, /Continuous English → Japanese/);
  assert.match(output, /Weighted random numbers 400–5999/);
  assert.match(output, /4000–5999 appear twice as often/);
  assert.match(output, /4400–4499 and 5500–5599 appear three times as often/);
  assert.match(output, /English prompt, then five seconds/);
  assert.match(output, /data-action="start-continuous-english-playing"/);
  assert.doesNotMatch(output, /data-action="start-number-session"/);
});

test("English-first continuous mode shows digits but hides Japanese until answer time", () => {
  const state = {
    ...baseState(),
    continuousSession: {
      direction: "english-to-japanese",
      status: "active",
      phase: "waiting",
      items: [5542],
      currentIndex: 0,
    },
    continuousRemainingMs: 5000,
  };
  const hidden = renderContinuousPlaying(state, {
    ttsSupported: true,
    englishTtsSupported: true,
  });
  assert.match(hidden, /Continuous English → Japanese/);
  assert.match(hidden, /Say the Japanese answer now/);
  assert.match(hidden, />5542</);
  assert.doesNotMatch(hidden, /The answer is five thousand five hundred forty-two\./);
  assert.doesNotMatch(hidden, /ごせんごひゃくよんじゅうに/);

  const answer = renderContinuousPlaying(
    {
      ...state,
      continuousSession: { ...state.continuousSession, phase: "japanese-answer" },
    },
    { ttsSupported: true, englishTtsSupported: true },
  );
  assert.match(answer, />5542</);
  assert.match(answer, /The answer is five thousand five hundred forty-two\./);
  assert.match(answer, /ごせんごひゃくよんじゅうに/);
  assert.match(answer, /Background noise always plays with the English prompt/);
});

test("Continuous Playing hides the answer during its five-second window", () => {
  const items = Object.freeze([
    289,
    ...Array.from({ length: 299 }, (_, index) =>
      index + 1 === 289 ? 300 : index + 1,
    ),
  ]);
  const state = {
    ...baseState(),
    continuousSession: {
      status: "active",
      phase: "waiting",
      items,
      currentIndex: 0,
    },
    continuousRemainingMs: 5000,
  };
  const hidden = renderContinuousPlaying(state, {
    ttsSupported: true,
    englishTtsSupported: true,
  });
  assert.match(hidden, /Item 1 \/ 300/);
  assert.match(hidden, /Say the answer now/);
  assert.match(hidden, /5\.0 sec/);
  assert.doesNotMatch(hidden, />289</);
  assert.match(hidden, /data-action="pause-continuous-playing"/);
  assert.match(hidden, /data-action="repeat-continuous-number"/);

  const answer = renderContinuousPlaying(
    {
      ...state,
      continuousSession: { ...state.continuousSession, phase: "english-answer" },
    },
    { ttsSupported: true, englishTtsSupported: true },
  );
  assert.match(answer, />289</);
  assert.match(answer, /The answer is two hundred eighty-nine\./);
  assert.match(
    answer,
    /\u306b\u3072\u3083\u304f\u306f\u3061\u3058\u3085\u3046\u304d\u3085\u3046/,
  );
  assert.match(answer, /Background noise always plays/);
  assert.match(answer, /does not change your progress or checklist/);
});

test("Continuous Playing renders stored つ and 個 quantity answers", async () => {
  const dataset = normalizeMasterDataset(await readRawDataset());
  for (const numberType of ["item_quantity_native", "piece_counter_ko"]) {
    const quantity = dataset.numberDetail.find(
      (detail) => detail.number_type === numberType,
    );
    const output = renderContinuousPlaying(
      {
        ...baseState(),
        dataset,
        continuousSession: {
          status: "active",
          phase: "english-answer",
          items: [quantity.number_id],
          currentIndex: 0,
        },
      },
      { ttsSupported: true, englishTtsSupported: true },
    );

    assert.ok(output.includes(`${quantity.number_value}${quantity.counter}`));
    assert.ok(output.includes(quantity.reading_kana));
    assert.match(output, /using the (tsu|ko) counter/);
  }
});

test("Continuous Reading hides the answer, then reveals Japanese after five seconds", () => {
  const state = {
    ...baseState(),
    continuousReadingSession: {
      status: "active",
      phase: "reading",
      currentValue: 1234,
      position: 1,
      cycle: 1,
      seenValues: [1234],
      pendingValue: null,
    },
    continuousReadingRemainingMs: 5000,
  };
  const reading = renderContinuousReading(state, { ttsSupported: true });
  assert.match(reading, />1234</);
  assert.match(reading, /5\.0 sec/);
  assert.match(reading, /data-action="skip-continuous-reading"/);
  assert.match(reading, /press Right Arrow to skip/);
  assert.doesNotMatch(reading, /せんにひゃくさんじゅうよん/);

  const answer = renderContinuousReading(
    {
      ...state,
      continuousReadingSession: {
        ...state.continuousReadingSession,
        phase: "answer",
      },
    },
    { ttsSupported: true },
  );
  assert.match(answer, /Listen to the Japanese answer/);
  assert.match(answer, /せんにひゃくさんじゅうよん/);
  assert.doesNotMatch(answer, /continuous-reading-countdown-value/);
});

test("dictation prompt hides all answer forms until Show Answer", () => {
  const hidden = renderNumberTask(
    {
      ...baseState(),
      numberSession: numberSession(DICTATION_TASK),
    },
    { ttsSupported: true },
  );

  assert.match(hidden, /Play/);
  assert.match(hidden, /class="text-button exit-session-button"/);
  assert.match(hidden, /navigation-button-icon[^>]*>×</);
  assert.match(hidden, /Show Answer/);
  assert.doesNotMatch(hidden, /128/);
  assert.doesNotMatch(hidden, /百二十八/);
  assert.doesNotMatch(hidden, /ひゃくにじゅうはち/);
  assert.doesNotMatch(hidden, /hyaku ni juu hachi/);

  const revealed = renderNumberTask(
    {
      ...baseState(),
      numberSession: numberSession(DICTATION_TASK, "revealed"),
    },
    { ttsSupported: true },
  );
  assert.match(revealed, /128/);
  assert.match(revealed, /ひゃくにじゅうはち/);
  assert.match(revealed, /hyaku ni juu hachi/);
  assert.match(revealed, /Correct/);
  assert.match(revealed, /Wrong/);
});

test("Number Training Home button uses the prominent navigation style", () => {
  const output = renderNumberTrainingHome(baseState());

  assert.match(output, /class="text-button back-button"/);
  assert.match(output, /navigation-button-icon[^>]*>←</);
  assert.match(output, /<span>Home<\/span>/);
});

test("listening prompt shows a compact timer and preserves replay status", () => {
  const waiting = renderNumberTask(
    {
      ...baseState(),
      numberSession: numberSession(DICTATION_TASK),
      listeningAttempt: {
        taskId: DICTATION_TASK.taskId,
        playbackCount: 1,
        replayCount: 0,
        isPlaying: true,
        responseStartedAt: null,
        responseStoppedAt: null,
        responseTimeMs: null,
      },
      listeningElapsedMs: null,
    },
    { ttsSupported: true },
  );
  assert.match(waiting, /Response time:[\s\S]*Starts after audio/);
  assert.match(waiting, /Replays:[\s\S]*0/);
  assert.match(waiting, /data-action="reveal-number-answer"[\s\S]*disabled/);

  const running = renderNumberTask(
    {
      ...baseState(),
      numberSession: numberSession(DICTATION_TASK),
      listeningAttempt: {
        taskId: DICTATION_TASK.taskId,
        playbackCount: 2,
        replayCount: 1,
        isPlaying: false,
        responseStartedAt: 1000,
        responseStoppedAt: null,
        responseTimeMs: null,
      },
      listeningElapsedMs: 2800,
    },
    { ttsSupported: true },
  );
  assert.match(running, /Question 1 \/ 1/);
  assert.match(running, /Replay/);
  assert.match(running, /2\.8 sec/);
  assert.match(running, /Replays:[\s\S]*1/);
});

test("Listening waits for audio while Speaking/Reading shows a running answer limit", () => {
  const listening = renderNumberTask(
    {
      ...baseState(),
      numberSession: numberSession(DICTATION_TASK),
      answerDeadline: {
        durationMs: 3000,
        startedAt: null,
        expiresAt: null,
        stoppedAt: null,
      },
    },
    { ttsSupported: true },
  );
  assert.match(listening, /Time left:[\s\S]*Starts after audio/);

  const readingTask = {
    ...DICTATION_TASK,
    promptType: "speaking",
    promptNumber: 128,
  };
  const reading = renderNumberTask(
    {
      ...baseState(),
      numberSession: numberSession(readingTask),
      answerDeadline: {
        durationMs: 5000,
        startedAt: Date.now(),
        expiresAt: Date.now() + 5000,
        stoppedAt: null,
      },
    },
    { ttsSupported: true },
  );
  assert.match(reading, /Time left:[\s\S]*[45]\.\d sec/);
});

test("timed-out self-mark questions keep every answer form hidden", () => {
  const timedOutResult = {
    correct: false,
    timedOut: true,
  };
  const output = renderNumberTask(
    {
      ...baseState(),
      numberSession: numberSession(
        DICTATION_TASK,
        "marked",
        timedOutResult,
      ),
      answerDeadline: {
        durationMs: 3000,
        startedAt: 1000,
        expiresAt: 4000,
        stoppedAt: 4000,
        timedOut: true,
      },
    },
    { ttsSupported: true },
  );
  assert.match(output, /Time is up — marked wrong/);
  assert.doesNotMatch(output, /class="numeric-answer"/);
  assert.doesNotMatch(output, /ひゃくにじゅうはち/);
  assert.doesNotMatch(output, /hyaku ni juu hachi/);
  assert.doesNotMatch(output, /data-action="mark-number-task"/);
  assert.match(output, /data-action="retry-number-task"/);
  assert.match(output, /Try this question again \(5 left\)/);
  assert.match(output, /Up to five retries are available/);
  assert.match(output, /Every timeout remains[\s\S]*recorded as wrong/);
  assert.match(output, /Skip and see results/);

  const fourRetriesLeft = renderNumberTask(
    {
      ...baseState(),
      numberSession: {
        ...numberSession(DICTATION_TASK, "marked", timedOutResult),
        currentRetryCount: 1,
      },
    },
    { ttsSupported: true },
  );
  assert.match(fourRetriesLeft, /Try this question again \(4 left\)/);

  const retryUsed = renderNumberTask(
    {
      ...baseState(),
      numberSession: {
        ...numberSession(DICTATION_TASK, "marked", timedOutResult),
        currentRetryCount: 5,
      },
      answerDeadline: {
        durationMs: 3000,
        startedAt: 1000,
        expiresAt: 4000,
        stoppedAt: 4000,
        timedOut: true,
      },
    },
    { ttsSupported: true },
  );
  assert.doesNotMatch(retryUsed, /data-action="retry-number-task"/);
  assert.match(retryUsed, /See results/);
});

test("timed-out Speaking and Reading keeps Hear Answer beside all retries", () => {
  const readingTask = {
    ...DICTATION_TASK,
    taskId: "timed-reading-task",
    exerciseKey: "NT_READING:reading-1-10:4",
    patternId: "NT_READING",
    taskKind: "number-reading",
    promptType: "speaking",
    promptNumber: 4,
    ttsText: "ã‚ˆã‚“",
    reveal: {
      numericAnswer: "4",
      readingKana: "ã‚ˆã‚“",
      romaji: "yon",
    },
  };
  const timedOutResult = { correct: false, timedOut: true };
  const firstTimeout = renderNumberTask(
    {
      ...baseState(),
      numberSession: numberSession(
        readingTask,
        "marked",
        timedOutResult,
      ),
    },
    { ttsSupported: true },
  );

  assert.match(
    firstTimeout,
    /data-action="play-number-task"[\s\S]*Hear Answer/,
  );
  assert.match(firstTimeout, /Try this question again \(5 left\)/);
  assert.doesNotMatch(firstTimeout, /class="numeric-answer"/);
  assert.doesNotMatch(firstTimeout, /class="answer-kana/);
  assert.doesNotMatch(firstTimeout, /class="answer-romaji/);

  const retriesExhausted = renderNumberTask(
    {
      ...baseState(),
      numberSession: {
        ...numberSession(readingTask, "marked", timedOutResult),
        currentRetryCount: 5,
      },
    },
    { ttsSupported: true },
  );
  assert.match(
    retriesExhausted,
    /data-action="play-number-task"[\s\S]*Hear Answer/,
  );
  assert.doesNotMatch(retriesExhausted, /retry-number-task/);
});

test("money reading shows only the dynamic 円 amount before Hear Answer", () => {
  const task = {
    ...DICTATION_TASK,
    taskId: "price-task",
    patternId: "NT_PRICE_READING",
    exerciseKey: "NT_PRICE_READING:price-selected:1480:RULE_EN",
    taskKind: "price-reading",
    promptType: "speaking",
    promptNumber: "1480円",
    ttsText: "せんよんひゃくはちじゅうえん",
    reveal: {
      numericAnswer: "1480円",
      readingKana: "せんよんひゃくはちじゅうえん",
      romaji: "sen yonhyaku hachijuu en",
    },
  };
  const hidden = renderNumberTask(
    {
      ...baseState(),
      numberSession: {
        ...numberSession(task),
        modeId: "price-reading",
        rangeId: "price-selected",
      },
    },
    { ttsSupported: true },
  );

  assert.match(hidden, /1480円/);
  assert.match(hidden, /Hear Answer/);
  assert.doesNotMatch(hidden, /せんよん/);
  assert.doesNotMatch(hidden, /yonhyaku/);
  assert.doesNotMatch(hidden, /English|explanation|picture/i);
});

test("range setup and results report saved range performance", () => {
  const state = {
    ...baseState(),
    numberModeId: "number-dictation",
    numberRangeId: "dictation-101-200",
    progress: {
      numberTraining: {
        skills: {},
        modes: {},
        ranges: {},
        taskKinds: {},
        modeRanges: {
          "number-dictation:dictation-101-200": {
            attempts: 10,
            correct: 7,
            incorrect: 3,
            lastSeenAt: "2026-08-11T00:00:00.000Z",
          },
        },
      },
    },
  };

  assert.match(renderNumberSetup(state), /70% · 10 attempts/);
  assert.match(
    renderNumberResults({
      ...state,
      numberSession: {
        ...numberSession(DICTATION_TASK, "completed"),
        status: "completed",
        correctCount: 1,
      },
    }),
    /This range: 70% across 10 attempts/,
  );
});

test("selected numeric range renders a persistent coverage checklist and history table", () => {
  const state = {
    ...baseState(),
    numberModeId: "number-dictation",
    numberRangeId: "dictation-1-10",
    progress: {
      numberTraining: {
        skills: {},
        modes: {},
        ranges: {},
        modeRanges: {},
        taskKinds: {},
        coverage: {
          "number-dictation:dictation-1-10": {
            cycle: 1,
            presentedKeys: ["2", "7"],
            completedKeys: ["2", "7"],
            entries: {
              "2": {
                timesPresented: 1,
                attempts: 1,
                correct: 1,
                incorrect: 0,
                timedAttempts: 1,
                totalResponseTimeMs: 2800,
              },
              "7": { timesPresented: 1 },
            },
          },
        },
      },
    },
  };
  const output = renderNumberSetup(state);
  assert.match(output, /Coverage checklist/);
  assert.match(output, /Cycle 1 · 2 \/ 10 asked/);
  assert.match(output, /Unasked numbers are selected first/);
  assert.match(output, /<th>Number<\/th>/);
  assert.match(output, /2\.8s/);
  assert.match(output, /Cycle 1: 2\/10 asked/);
  assert.match(output, /data-action="reset-number-range"/);
  assert.match(output, /data-number-mode="number-dictation"/);
  assert.match(output, /data-range-id="dictation-1-10"/);
  assert.match(output, /Reset this range/);
  assert.match(output, /Clears this range's score, attempts, and checklist history/);
});

test("Mixed 1–300 checklist includes its 20 quantity forms", async () => {
  const dataset = normalizeMasterDataset(await readRawDataset());
  const output = renderNumberSetup({
    ...baseState(),
    dataset,
    numberModeId: "number-dictation",
    numberRangeId: "dictation-mixed-1-300",
  });

  assert.match(output, /Cycle 1[^<]*0 \/ 320 asked/);
  assert.match(output, /Number \/ quantity/);
  assert.match(output, />1つ</);
  assert.match(output, />10つ</);
  assert.match(output, />1個</);
  assert.match(output, />10個</);
  assert.match(output, /after all 320 items have appeared/);
});

test("Speaking and Reading ranges also include the reset control", () => {
  const output = renderNumberSetup({
    ...baseState(),
    numberModeId: "number-reading",
    numberRangeId: "reading-1-10",
  });

  assert.match(output, /data-action="reset-number-range"/);
  assert.match(output, /data-number-mode="number-reading"/);
  assert.match(output, /data-range-id="reading-1-10"/);
});

test("Mixed 1–10000 renders its rule and a lightweight checklist", () => {
  const output = renderNumberSetup({
    ...baseState(),
    numberModeId: "number-reading",
    numberRangeId: "reading-mixed-1-10000",
  });

  assert.match(output, /Mixed 1–10000/);
  assert.match(output, /changes both its 1,000 band and the 100 band/);
  assert.match(output, /Cycle 1[^<]*0 \/ 10000 asked/);
  assert.match(output, /No completed numbers yet/);
  assert.match(output, /table shows practiced numbers only/);
  assert.match(output, /summary still tracks all 10,000 numbers/);
  assert.ok((output.match(/<tr/g) ?? []).length < 30);
});

test("1001–10000 renders as an independent lightweight reading range", () => {
  const output = renderNumberSetup({
    ...baseState(),
    numberModeId: "number-reading",
    numberRangeId: "reading-1001-10000",
  });

  assert.match(output, /1001–10000/);
  assert.match(output, /Cycle 1[^<]*0 \/ 9000 asked/);
  assert.match(output, /data-range-id="reading-1001-10000"/);
  assert.match(output, /data-action="reset-number-range"/);
  assert.match(output, /table shows practiced numbers only/);
  assert.doesNotMatch(output, /changes both its 1,000 band/);
});

test("Focused 400–5999 explains its weighting and keeps independent progress", () => {
  const output = renderNumberSetup({
    ...baseState(),
    settings: { ...DEFAULT_SETTINGS, sessionSize: 15 },
    numberModeId: "number-reading",
    numberRangeId: "reading-focused-400-5999",
  });

  assert.match(output, /Focused 400–5999/);
  assert.match(output, /10 of 15 tasks come from/);
  assert.match(output, /400–499, 500–599, 4000–4999, and 5000–5999/);
  assert.match(output, /Cycle 1[^<]*0 \/ 5600 asked/);
  assert.match(output, /data-range-id="reading-focused-400-5999"/);
  assert.match(output, /data-action="reset-number-range"/);
  assert.match(output, /table shows practiced numbers only/);
});

test("reading prompt shows only digits before Hear Answer", () => {
  const readingTask = {
    ...DICTATION_TASK,
    taskId: "reading-task",
    patternId: "NT_READING",
    exerciseKey: "NT_READING:reading-601-700:684",
    taskKind: "number-reading",
    promptType: "speaking",
    promptNumber: 684,
    ttsText: "ろっぴゃくはちじゅうよん",
    reveal: {
      numericAnswer: "684",
      japanese: "六百八十四",
      readingKana: "ろっぴゃくはちじゅうよん",
      romaji: "roppyaku hachi juu yon",
    },
  };
  const hidden = renderNumberTask(
    {
      ...baseState(),
      numberSession: numberSession(readingTask),
    },
    { ttsSupported: true },
  );

  assert.match(hidden, /684/);
  assert.match(hidden, /Hear Answer/);
  assert.doesNotMatch(hidden, /六百八十四/);
  assert.doesNotMatch(hidden, /ろっぴゃく/);
  assert.doesNotMatch(hidden, /roppyaku/);
});
