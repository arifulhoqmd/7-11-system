import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_SETTINGS } from "../src/progress/progress-store.js";
import {
  renderNumberSetup,
  renderNumberTask,
  renderNumberTrainingHome,
} from "../src/ui/number-training-screens.js";

function baseState() {
  return {
    settings: DEFAULT_SETTINGS,
    announcement: null,
    numberModeId: null,
    numberRangeId: null,
    numberSession: null,
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

test("Number Training home contains Listening and Speaking/Reading sections", () => {
  const output = renderNumberTrainingHome(baseState());

  assert.match(output, /Number Training/);
  assert.match(output, /Listening/);
  assert.match(output, /Speaking \/ Reading/);
  assert.match(output, /Number Dictation/);
  assert.match(output, /Highest priority/);
  assert.match(output, /4-Choice Number Listening/);
  assert.match(output, /Tobacco \+ Quantity/);
  assert.match(output, /Number Reading/);
  assert.match(output, /Total bill/);
  assert.match(output, /Change \/ おつり/);
});

test("setup screen exposes selectable dictation ranges without typing", () => {
  const output = renderNumberSetup({
    ...baseState(),
    numberModeId: "number-dictation",
    numberRangeId: "dictation-101-200",
  });

  for (const label of ["1–10", "11–50", "51–100", "101–200", "201–300"]) {
    assert.match(output, new RegExp(label));
  }
  assert.match(output, /data-action="select-number-range"/);
  assert.doesNotMatch(output, /type="text"/);
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
  assert.match(revealed, /百二十八/);
  assert.match(revealed, /ひゃくにじゅうはち/);
  assert.match(revealed, /hyaku ni juu hachi/);
  assert.match(revealed, /Correct/);
  assert.match(revealed, /Wrong/);
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
