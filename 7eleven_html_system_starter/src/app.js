import { createJapaneseTts } from "./audio/japanese-tts.js";
import { loadMasterDataset } from "./data/load-master.js";
import { selectStageA, selectStageB } from "./data/selectors.js";
import { createProgressStore } from "./progress/progress-store.js";
import { generateListeningQuestions } from "./quiz/number-question-generator.js";
import {
  advanceSession,
  createQuizSession,
  getCurrentQuestion,
  getSessionSummary,
  submitAnswer,
} from "./quiz/session-engine.js";
import { createAppState } from "./state/app-state.js";
import { PRACTICE_MODES, renderApp } from "./ui/screens.js";

const DATASET_FILENAME =
  "7eleven_staff_training_master_dataset_v2_2026-08-09.json";

const root = document.querySelector("#app");
const appState = createAppState({ announcement: null });
const japaneseTts = createJapaneseTts();

let progressStore = null;
let previousRoute = null;
let previousQuestionId = null;
let previousQuestionAnswered = false;

function currentStageCount(state) {
  if (state.status !== "ready") {
    return 0;
  }
  return state.settings.stage === "B"
    ? selectStageB(state.dataset).length
    : selectStageA(state.dataset).length;
}

function getSampleRecord(state) {
  return (
    state.dataset?.indexes.itemsById.R001 ??
    state.dataset?.masterItems.find((item) => item.tts_text) ??
    {}
  );
}

function render(state) {
  const currentQuestion =
    state.status === "ready" && state.route === "quiz"
      ? getCurrentQuestion(state.quizSession)
      : null;
  const questionChanged =
    currentQuestion !== null &&
    currentQuestion.questionId !== previousQuestionId;
  const answerJustRevealed =
    state.route === "quiz" &&
    state.quizSession?.currentResult !== null &&
    !previousQuestionAnswered;

  root.innerHTML = renderApp(state, {
    stageCount: currentStageCount(state),
    ttsSupported: japaneseTts.isSupported,
    sampleRecord: getSampleRecord(state),
  });

  if (state.status === "ready" && state.route !== previousRoute) {
    root.querySelector("#main-content")?.focus({ preventScroll: true });
  } else if (questionChanged) {
    root.querySelector("#main-content")?.focus({ preventScroll: true });
  } else if (answerJustRevealed) {
    root.querySelector(".feedback-card")?.focus({ preventScroll: true });
  }
  previousRoute = state.route;
  previousQuestionId = currentQuestion?.questionId ?? null;
  previousQuestionAnswered =
    state.route === "quiz" && state.quizSession?.currentResult !== null;
}

appState.subscribe(render);
render(appState.getState());

async function initialize() {
  japaneseTts.stop();
  appState.setState({
    status: "loading",
    error: null,
    announcement: null,
  });

  try {
    const dataset = await loadMasterDataset();
    progressStore = createProgressStore({
      datasetMetadata: {
        filename: DATASET_FILENAME,
        updated: dataset.metadata.updated,
        masterItemCount: dataset.masterItems.length,
      },
    });
    const progress = progressStore.load();

    appState.setState({
      status: "ready",
      dataset,
      settings: progress.settings,
      error: null,
    });
  } catch (error) {
    appState.setState({
      status: "error",
      dataset: null,
      settings: null,
      error,
    });
  }
}

function saveSetting(setting, value) {
  if (progressStore === null) {
    return;
  }
  const progress = progressStore.updateSettings({ [setting]: value });
  appState.setState({
    settings: progress.settings,
    announcement:
      progressStore.getLastError() === null
        ? "Setting saved."
        : "Setting is active, but browser storage is unavailable.",
  });
}

function selectedPracticeMode() {
  return PRACTICE_MODES.find(
    (mode) => mode.id === appState.getState().selectedMode,
  );
}

function startSelectedQuiz() {
  const state = appState.getState();
  const mode = selectedPracticeMode();
  if (!mode?.patternId) {
    appState.setState({
      announcement: "This practice mode is not available in Phase 3A.",
    });
    return;
  }

  try {
    const questions = generateListeningQuestions({
      dataset: state.dataset,
      patternId: mode.patternId,
      stage: state.settings.stage,
      sessionSize: state.settings.sessionSize,
    });
    const quizSession = createQuizSession({
      questions,
      modeId: mode.id,
      patternId: mode.patternId,
      stage: state.settings.stage,
    });
    japaneseTts.stop();
    appState.setState({
      route: "quiz",
      quizSession,
      announcement: null,
    });
  } catch (error) {
    appState.setState({
      route: "practice",
      announcement: `Could not start this session: ${error.message}`,
    });
  }
}

root.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action]");
  if (!(control instanceof HTMLElement)) {
    return;
  }

  const action = control.dataset.action;
  if (action === "retry-load") {
    initialize();
    return;
  }

  if (appState.getState().status !== "ready") {
    return;
  }

  if (action === "navigate") {
    japaneseTts.stop();
    appState.setState({ announcement: null });
    appState.navigate(control.dataset.route);
    return;
  }

  if (action === "select-mode") {
    const mode = PRACTICE_MODES.find(
      (candidate) => candidate.id === control.dataset.mode,
    );
    if (mode) {
      appState.setState({ selectedMode: mode.id });
    }
    return;
  }

  if (action === "start-quiz" || action === "restart-quiz") {
    startSelectedQuiz();
    return;
  }

  if (action === "exit-quiz" || action === "finish-results") {
    japaneseTts.stop();
    appState.setState({
      route: "practice",
      quizSession: null,
      announcement: null,
    });
    return;
  }

  if (action === "play-question-audio") {
    const state = appState.getState();
    const question = getCurrentQuestion(state.quizSession);
    const result = japaneseTts.speakRecord(
      { tts_text: question.ttsText },
      { rate: state.settings.ttsRate },
    );
    appState.setState({
      announcement: result.ok
        ? "Playing Japanese audio."
        : "Japanese speech synthesis is unavailable.",
    });
    return;
  }

  if (action === "answer-question") {
    const state = appState.getState();
    if (state.quizSession.currentResult !== null) {
      return;
    }
    const quizSession = submitAnswer(
      state.quizSession,
      control.dataset.choiceKey,
    );
    progressStore.recordAnswer(quizSession.currentResult);
    japaneseTts.stop();
    appState.setState({
      quizSession,
      announcement:
        progressStore.getLastError() === null
          ? null
          : "Result recorded in memory; browser storage is unavailable.",
    });
    return;
  }

  if (action === "next-question") {
    const state = appState.getState();
    const quizSession = advanceSession(state.quizSession);
    japaneseTts.stop();
    if (quizSession.status === "completed") {
      progressStore.recordSessionSummary(getSessionSummary(quizSession));
      appState.setState({
        route: "results",
        quizSession,
        announcement: null,
      });
    } else {
      appState.setState({
        quizSession,
        announcement: null,
      });
    }
    return;
  }

  if (action === "update-setting") {
    const setting = control.dataset.setting;
    let value = control.dataset.value;
    if (setting === "sessionSize") {
      value = Number(value);
    } else if (setting === "ttsRate") {
      value = Number(value);
      japaneseTts.stop();
    }
    saveSetting(setting, value);
    return;
  }

  if (action === "test-tts") {
    const state = appState.getState();
    const result = japaneseTts.speakRecord(getSampleRecord(state), {
      rate: state.settings.ttsRate,
    });
    appState.setState({
      announcement: result.ok
        ? "Playing the Japanese sample."
        : "Japanese speech synthesis is unavailable.",
    });
  }
});

root.addEventListener("change", (event) => {
  const control = event.target;
  if (
    !(control instanceof HTMLInputElement) ||
    control.dataset.action !== "toggle-setting"
  ) {
    return;
  }
  saveSetting(control.dataset.setting, control.checked);
});

window.addEventListener("beforeunload", () => japaneseTts.dispose());

initialize();
