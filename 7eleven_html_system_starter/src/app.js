import { createJapaneseTts } from "./audio/japanese-tts.js";
import { createEnglishTts } from "./audio/english-tts.js";
import { createListeningEnvironment } from "./audio/listening-environment.js";
import { loadMasterDataset } from "./data/load-master.js";
import { selectStageA, selectStageB } from "./data/selectors.js";
import {
  createProgressStore,
  getNumberTrainingCoverage,
} from "./progress/progress-store.js";
import { getNumberTrainingMode } from "./number-training/number-training-config.js";
import { resolveNumberReading } from "./number-training/number-reading-engine.js";
import {
  CONTINUOUS_ANSWER_WAIT_MS,
  CONTINUOUS_NEXT_DELAY_MS,
  advanceContinuousSession,
  createContinuousEnglishNumberSession,
  createContinuousNumberSession,
  getCurrentContinuousItem,
  pauseContinuousSession,
  resolveContinuousItem,
  resolveContinuousListeningEnvironment,
  resumeContinuousSession,
  setContinuousPhase,
} from "./number-training/continuous-number-session.js";
import {
  CONTINUOUS_READING_NEXT_DELAY_MS,
  CONTINUOUS_READING_WAIT_MS,
  advanceContinuousReadingSession,
  createContinuousReadingSession,
  isContinuousReadingSkipKey,
  pauseContinuousReadingSession,
  resumeContinuousReadingSession,
  setContinuousReadingPhase,
} from "./number-training/continuous-reading-session.js";
import {
  generateNumberTrainingTasks,
  getQuantityTrainingPool,
} from "./number-training/number-task-generator.js";
import {
  advanceNumberTask,
  createSelfMarkSession,
  getCurrentNumberTask,
  getNumberSessionSummary,
  markNumberTask,
  revealNumberTask,
  retryTimedOutNumberTask,
} from "./number-training/self-mark-session.js";
import {
  beginListeningPlayback,
  completeListeningPlayback,
  createListeningAttempt,
  failListeningPlayback,
  getListeningResponseTime,
  stopListeningResponseTimer,
} from "./number-training/listening-attempt.js";
import {
  createAnswerDeadline,
  getAnswerTimeRemaining,
  hasAnswerDeadlineExpired,
  startAnswerDeadline,
  stopAnswerDeadline,
} from "./number-training/answer-deadline.js";
import { generateListeningQuestions } from "./quiz/number-question-generator.js";
import {
  advanceSession,
  createQuizSession,
  getCurrentQuestion,
  getSessionSummary,
  submitAnswer,
  submitTimeout,
} from "./quiz/session-engine.js";
import { createAppState } from "./state/app-state.js";
import { PRACTICE_MODES, renderApp } from "./ui/screens.js";

const DATASET_FILENAME =
  "7eleven_staff_training_master_dataset_v2_2026-08-09.json";

const root = document.querySelector("#app");
const appState = createAppState({ announcement: null });
const japaneseTts = createJapaneseTts();
const englishTts = createEnglishTts();
const listeningEnvironment = createListeningEnvironment();

let progressStore = null;
let previousRoute = null;
let previousQuestionId = null;
let previousQuestionAnswered = false;
let previousNumberTaskId = null;
let previousNumberPhase = null;
let responseTimerId = null;
let deadlineTimerId = null;
let continuousWaitTimerId = null;
let continuousCountdownTimerId = null;
let continuousNextTimerId = null;
let continuousFlowToken = 0;
let continuousReadingWaitTimerId = null;
let continuousReadingCountdownTimerId = null;
let continuousReadingNextTimerId = null;
let continuousReadingFlowToken = 0;

function clearContinuousTimers() {
  if (continuousWaitTimerId !== null) {
    clearTimeout(continuousWaitTimerId);
    continuousWaitTimerId = null;
  }
  if (continuousCountdownTimerId !== null) {
    clearInterval(continuousCountdownTimerId);
    continuousCountdownTimerId = null;
  }
  if (continuousNextTimerId !== null) {
    clearTimeout(continuousNextTimerId);
    continuousNextTimerId = null;
  }
}

function cancelContinuousFlow() {
  continuousFlowToken += 1;
  clearContinuousTimers();
  englishTts.stop();
}

function clearContinuousReadingTimers() {
  if (continuousReadingWaitTimerId !== null) {
    clearTimeout(continuousReadingWaitTimerId);
    continuousReadingWaitTimerId = null;
  }
  if (continuousReadingCountdownTimerId !== null) {
    clearInterval(continuousReadingCountdownTimerId);
    continuousReadingCountdownTimerId = null;
  }
  if (continuousReadingNextTimerId !== null) {
    clearTimeout(continuousReadingNextTimerId);
    continuousReadingNextTimerId = null;
  }
}

function cancelContinuousReadingFlow() {
  continuousReadingFlowToken += 1;
  clearContinuousReadingTimers();
}

function refreshResponseTimer() {
  const attempt = appState.getState().listeningAttempt;
  if (attempt?.responseStartedAt === null || attempt?.responseStoppedAt !== null) {
    return;
  }
  const elapsed = getListeningResponseTime(attempt, Date.now());
  const display = root.querySelector(".response-time-value");
  if (display !== null) {
    display.textContent = `${(elapsed / 1000).toFixed(1)} sec`;
  }
}

function stopResponseTicker() {
  if (responseTimerId !== null) {
    clearInterval(responseTimerId);
    responseTimerId = null;
  }
}

function startResponseTicker() {
  stopResponseTicker();
  refreshResponseTimer();
  responseTimerId = setInterval(refreshResponseTimer, 100);
}

function refreshDeadlineTimer() {
  const state = appState.getState();
  const deadline = state.answerDeadline;
  if (deadline?.startedAt === null || deadline?.stoppedAt !== null) {
    return;
  }
  const now = Date.now();
  const remaining = getAnswerTimeRemaining(deadline, now);
  const display = root.querySelector(".answer-time-left");
  if (display !== null) {
    display.textContent = `${(remaining / 1000).toFixed(1)} sec`;
  }
  if (hasAnswerDeadlineExpired(deadline, now)) {
    expireCurrentTimedQuestion(now);
  }
}

function stopDeadlineTicker() {
  if (deadlineTimerId !== null) {
    clearInterval(deadlineTimerId);
    deadlineTimerId = null;
  }
}

function startDeadlineTicker() {
  stopDeadlineTicker();
  refreshDeadlineTimer();
  deadlineTimerId = setInterval(refreshDeadlineTimer, 100);
}

function stopAllAudio() {
  cancelContinuousFlow();
  cancelContinuousReadingFlow();
  japaneseTts.stop();
  englishTts.stop();
  listeningEnvironment.stop();
  stopResponseTicker();
  stopDeadlineTicker();
}

function isCurrentContinuousFlow(token) {
  const state = appState.getState();
  return (
    token === continuousFlowToken &&
    state.route === "continuous-playing" &&
    state.continuousSession?.status === "active"
  );
}

function failContinuousPlayback(message) {
  const state = appState.getState();
  if (
    state.route !== "continuous-playing" ||
    state.continuousSession?.status !== "active"
  ) {
    return;
  }
  stopAllAudio();
  appState.setState({
    continuousSession: pauseContinuousSession(state.continuousSession),
    continuousRemainingMs: null,
    announcement: message,
  });
}

function beginContinuousPrompt(session) {
  japaneseTts.stop();
  englishTts.stop();
  listeningEnvironment.stop();
  clearContinuousTimers();
  const token = ++continuousFlowToken;
  const promptSession = setContinuousPhase(session, "prompt");
  const item = getCurrentContinuousItem(promptSession);
  const prompt = resolveContinuousItem(appState.getState().dataset, item);
  const englishFirst = promptSession.direction === "english-to-japanese";
  appState.setState({
    route: "continuous-playing",
    continuousSession: promptSession,
    continuousRemainingMs: CONTINUOUS_ANSWER_WAIT_MS,
    announcement: englishFirst
      ? "Playing the English number."
      : "Playing the Japanese number.",
  });
  listeningEnvironment.start(
    resolveContinuousListeningEnvironment(
      appState.getState().settings.listeningEnvironment,
    ),
  );
  const onPromptEnd = () => {
        listeningEnvironment.stop();
        if (!isCurrentContinuousFlow(token)) {
          return;
        }
        const waitingSession = setContinuousPhase(
          appState.getState().continuousSession,
          "waiting",
        );
        const deadline = Date.now() + CONTINUOUS_ANSWER_WAIT_MS;
        appState.setState({
          continuousSession: waitingSession,
          continuousRemainingMs: CONTINUOUS_ANSWER_WAIT_MS,
          announcement: englishFirst
            ? "Say the Japanese answer now."
            : "Say the answer now.",
        });
        continuousCountdownTimerId = setInterval(() => {
          const remaining = Math.max(0, deadline - Date.now());
          const display = root.querySelector(".continuous-countdown-value");
          if (display !== null) {
            display.textContent = `${(remaining / 1000).toFixed(1)} sec`;
          }
        }, 100);
        continuousWaitTimerId = setTimeout(() => {
          clearContinuousTimers();
          if (englishFirst) {
            speakContinuousJapaneseAnswer(token);
          } else {
            speakContinuousEnglishAnswer(token);
          }
        }, CONTINUOUS_ANSWER_WAIT_MS);
      };
  const onPromptError = () => {
        listeningEnvironment.stop();
        if (isCurrentContinuousFlow(token)) {
          failContinuousPlayback(
            `The ${englishFirst ? "English" : "Japanese"} number could not be played. Press Resume to try again.`,
          );
        }
      };
  const result = englishFirst
    ? englishTts.speakText(prompt.englishNumberText, {
        rate: 0.9,
        onEnd: onPromptEnd,
        onError: onPromptError,
      })
    : japaneseTts.speakRecord(
        { tts_text: prompt.ttsText },
        {
          rate: appState.getState().settings.ttsRate,
          onEnd: onPromptEnd,
          onError: onPromptError,
        },
      );
  if (!result.ok) {
    listeningEnvironment.stop();
    failContinuousPlayback(
      `${englishFirst ? "English" : "Japanese"} speech synthesis is unavailable. Continuous Playing was paused.`,
    );
  }
}

function speakContinuousEnglishAnswer(token) {
  if (!isCurrentContinuousFlow(token)) {
    return;
  }
  const state = appState.getState();
  const item = getCurrentContinuousItem(state.continuousSession);
  const prompt = resolveContinuousItem(state.dataset, item);
  appState.setState({
    continuousSession: setContinuousPhase(
      state.continuousSession,
      "english-answer",
    ),
    continuousRemainingMs: 0,
    announcement: "Playing the slow English answer.",
  });
  const result = englishTts.speakText(prompt.englishAnswerText, {
    rate: 0.75,
    onEnd: () => speakContinuousJapaneseAnswer(token),
    onError: () => {
      if (isCurrentContinuousFlow(token)) {
        failContinuousPlayback("The English answer could not be played. Press Resume to try again.");
      }
    },
  });
  if (!result.ok) {
    failContinuousPlayback("English speech synthesis is unavailable. Continuous Playing was paused.");
  }
}

function speakContinuousJapaneseAnswer(token) {
  if (!isCurrentContinuousFlow(token)) {
    return;
  }
  const state = appState.getState();
  const item = getCurrentContinuousItem(state.continuousSession);
  const prompt = resolveContinuousItem(state.dataset, item);
  const englishFirst = state.continuousSession.direction === "english-to-japanese";
  const limitedRange =
    state.continuousSession.continuousModeId === "continuous-number-11-260";
  appState.setState({
    continuousSession: setContinuousPhase(
      state.continuousSession,
      "japanese-answer",
    ),
    announcement: englishFirst
      ? "Playing the correct Japanese answer."
      : "Repeating the Japanese number clearly.",
  });
  const result = japaneseTts.speakRecord(
    { tts_text: prompt.ttsText },
    {
      rate: state.settings.ttsRate,
      onEnd: () => {
        if (!isCurrentContinuousFlow(token)) {
          return;
        }
        const current = appState.getState();
        appState.setState({
          continuousSession: setContinuousPhase(
            current.continuousSession,
            "between",
          ),
          announcement: "Next number coming up.",
        });
        continuousNextTimerId = setTimeout(() => {
          if (!isCurrentContinuousFlow(token)) {
            return;
          }
          const nextSession = advanceContinuousSession(
            appState.getState().continuousSession,
          );
          if (nextSession.status === "completed") {
            clearContinuousTimers();
            appState.setState({
              continuousSession: nextSession,
              continuousRemainingMs: null,
              announcement: englishFirst
                ? "The weighted 400–5999 cycle is complete."
                : limitedRange
                  ? "All 250 numbers from 11–260 are complete."
                  : "All 300 numbers and 20 quantity forms are complete.",
            });
          } else {
            beginContinuousPrompt(nextSession);
          }
        }, CONTINUOUS_NEXT_DELAY_MS);
      },
      onError: () => {
        if (isCurrentContinuousFlow(token)) {
          failContinuousPlayback("The Japanese repeat could not be played. Press Resume to try again.");
        }
      },
    },
  );
  if (!result.ok) {
    failContinuousPlayback("Japanese speech synthesis is unavailable. Continuous Playing was paused.");
  }
}

function isCurrentContinuousReadingFlow(token) {
  const state = appState.getState();
  return (
    token === continuousReadingFlowToken &&
    state.route === "continuous-reading" &&
    state.continuousReadingSession?.status === "active"
  );
}

function pauseContinuousReadingWithMessage(message) {
  const state = appState.getState();
  if (
    state.route !== "continuous-reading" ||
    state.continuousReadingSession?.status !== "active"
  ) {
    return;
  }
  stopAllAudio();
  appState.setState({
    continuousReadingSession: pauseContinuousReadingSession(
      state.continuousReadingSession,
    ),
    continuousReadingRemainingMs: null,
    announcement: message,
  });
}

function speakContinuousReadingAnswer(token) {
  if (!isCurrentContinuousReadingFlow(token)) return;
  clearContinuousReadingTimers();
  const state = appState.getState();
  const reading = resolveNumberReading(
    state.dataset,
    state.continuousReadingSession.currentValue,
  );
  appState.setState({
    continuousReadingSession: setContinuousReadingPhase(
      state.continuousReadingSession,
      "answer",
    ),
    continuousReadingRemainingMs: 0,
    announcement: "Playing the Japanese answer.",
  });
  const result = japaneseTts.speakRecord(
    { tts_text: reading.ttsText },
    {
      rate: state.settings.ttsRate,
      onEnd: () => {
        if (!isCurrentContinuousReadingFlow(token)) return;
        continuousReadingNextTimerId = setTimeout(() => {
          if (!isCurrentContinuousReadingFlow(token)) return;
          const nextSession = advanceContinuousReadingSession(
            appState.getState().continuousReadingSession,
          );
          beginContinuousReadingWindow(nextSession);
        }, CONTINUOUS_READING_NEXT_DELAY_MS);
      },
      onError: () => {
        if (isCurrentContinuousReadingFlow(token)) {
          pauseContinuousReadingWithMessage(
            "The Japanese answer could not be played. Press Resume to try again.",
          );
        }
      },
    },
  );
  if (!result.ok) {
    pauseContinuousReadingWithMessage(
      "Japanese speech synthesis is unavailable. Continuous Reading was paused.",
    );
  }
}

function beginContinuousReadingWindow(session) {
  japaneseTts.stop();
  clearContinuousReadingTimers();
  const token = ++continuousReadingFlowToken;
  const readingSession = setContinuousReadingPhase(session, "reading");
  const deadline = Date.now() + CONTINUOUS_READING_WAIT_MS;
  appState.setState({
    route: "continuous-reading",
    continuousReadingSession: readingSession,
    continuousReadingRemainingMs: CONTINUOUS_READING_WAIT_MS,
    announcement: "Read the number aloud.",
  });
  continuousReadingCountdownTimerId = setInterval(() => {
    if (!isCurrentContinuousReadingFlow(token)) return;
    const remaining = Math.max(0, deadline - Date.now());
    const display = root.querySelector(
      ".continuous-reading-countdown-value",
    );
    if (display !== null) {
      display.textContent = `${(remaining / 1000).toFixed(1)} sec`;
    }
  }, 100);
  continuousReadingWaitTimerId = setTimeout(
    () => speakContinuousReadingAnswer(token),
    CONTINUOUS_READING_WAIT_MS,
  );
}

function skipContinuousReading() {
  const state = appState.getState();
  if (
    state.route !== "continuous-reading" ||
    state.continuousReadingSession?.status !== "active"
  ) {
    return;
  }
  cancelContinuousReadingFlow();
  japaneseTts.stop();
  const nextSession = advanceContinuousReadingSession(
    state.continuousReadingSession,
  );
  beginContinuousReadingWindow(nextSession);
}

function attemptForTask(task) {
  return task?.promptType === "listening"
    ? createListeningAttempt(task.taskId)
    : null;
}

function deadlineForTask(task, settings, startNow = false) {
  if (task === null) {
    return null;
  }
  const deadline = createAnswerDeadline(settings.answerTimeLimitSeconds);
  return startNow ? startAnswerDeadline(deadline, Date.now()) : deadline;
}

function recordPresentedTask(task, session, fallbackProgress) {
  if (
    progressStore === null ||
    typeof task?.coverageKey !== "string" ||
    !Number.isInteger(task.coverageCycle)
  ) {
    return fallbackProgress;
  }
  return progressStore.recordNumberPresented({
    modeId: session.modeId,
    rangeId: session.rangeId,
    coverageKey: task.coverageKey,
    coverageCycle: task.coverageCycle,
  });
}

function recordCompletedTask(task, session, fallbackProgress) {
  if (
    progressStore === null ||
    typeof task?.coverageKey !== "string" ||
    !Number.isInteger(task.coverageCycle)
  ) {
    return fallbackProgress;
  }
  return progressStore.recordNumberCompleted({
    modeId: session.modeId,
    rangeId: session.rangeId,
    coverageKey: task.coverageKey,
    coverageCycle: task.coverageCycle,
  });
}

function quizProgressMetadata(session) {
  return {
    skill: "listening",
    modeId:
      session.patternId === "QZ005"
        ? "number-multiple-choice"
        : "price-listening",
    rangeId: `stage-${session.stage.toLowerCase()}`,
    taskKind:
      session.patternId === "QZ005" ? "plain-number" : "service-amount",
  };
}

function expireCurrentNumberTask(now = Date.now()) {
  const state = appState.getState();
  if (
    state.route !== "number-task" ||
    state.numberSession?.phase !== "prompt" ||
    !hasAnswerDeadlineExpired(state.answerDeadline, now)
  ) {
    return;
  }

  const task = getCurrentNumberTask(state.numberSession);
  const answerDeadline = stopAnswerDeadline(state.answerDeadline, now);
  const listeningAttempt =
    task.promptType === "listening"
      ? stopListeningResponseTimer(
          state.listeningAttempt,
          answerDeadline.expiresAt,
        )
      : state.listeningAttempt;
  stopAllAudio();
  const revealedSession = revealNumberTask(state.numberSession);
  const numberSession = markNumberTask(revealedSession, false, {
    responseTimeMs: listeningAttempt?.responseTimeMs ?? null,
    replayCount: listeningAttempt?.replayCount ?? 0,
    timedOut: true,
  });
  const progress = progressStore.recordAnswer(numberSession.currentResult);
  appState.setState({
    numberSession,
    progress,
    listeningAttempt,
    listeningElapsedMs: listeningAttempt?.responseTimeMs ?? null,
    answerDeadline,
    announcement: "Time is up. This question was marked wrong.",
  });
}

function expireCurrentQuizQuestion(now = Date.now()) {
  const state = appState.getState();
  if (
    state.route !== "quiz" ||
    state.quizSession?.currentResult !== null ||
    !hasAnswerDeadlineExpired(state.answerDeadline, now)
  ) {
    return;
  }
  const answerDeadline = stopAnswerDeadline(state.answerDeadline, now);
  stopAllAudio();
  const quizSession = submitTimeout(state.quizSession);
  const progress = progressStore.recordAnswer({
    ...quizSession.currentResult,
    timedOut: true,
    numberTraining: quizProgressMetadata(quizSession),
  });
  appState.setState({
    quizSession,
    progress,
    answerDeadline,
    announcement: "Time is up. This question was marked wrong.",
  });
}

function expireCurrentTimedQuestion(now = Date.now()) {
  if (appState.getState().route === "quiz") {
    expireCurrentQuizQuestion(now);
  } else {
    expireCurrentNumberTask(now);
  }
}

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
  const currentNumberTask =
    state.status === "ready" && state.route === "number-task"
      ? getCurrentNumberTask(state.numberSession)
      : null;
  const numberTaskChanged =
    currentNumberTask !== null &&
    currentNumberTask.taskId !== previousNumberTaskId;
  const numberAnswerJustRevealed =
    state.route === "number-task" &&
    state.numberSession?.phase === "revealed" &&
    previousNumberPhase === "prompt";

  root.innerHTML = renderApp(state, {
    stageCount: currentStageCount(state),
    ttsSupported: japaneseTts.isSupported,
    englishTtsSupported: englishTts.isSupported,
    sampleRecord: getSampleRecord(state),
  });
  refreshResponseTimer();
  refreshDeadlineTimer();

  if (state.status === "ready" && state.route !== previousRoute) {
    root.querySelector("#main-content")?.focus({ preventScroll: true });
  } else if (questionChanged) {
    root.querySelector("#main-content")?.focus({ preventScroll: true });
  } else if (answerJustRevealed) {
    root.querySelector(".feedback-card")?.focus({ preventScroll: true });
  } else if (numberTaskChanged) {
    root.querySelector("#main-content")?.focus({ preventScroll: true });
  } else if (numberAnswerJustRevealed) {
    root.querySelector(".number-answer-card")?.focus({ preventScroll: true });
  }
  previousRoute = state.route;
  previousQuestionId = currentQuestion?.questionId ?? null;
  previousQuestionAnswered =
    state.route === "quiz" && state.quizSession?.currentResult !== null;
  previousNumberTaskId = currentNumberTask?.taskId ?? null;
  previousNumberPhase =
    state.route === "number-task" ? state.numberSession?.phase : null;
}

appState.subscribe(render);
render(appState.getState());

async function initialize() {
  stopAllAudio();
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
      progress,
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
    progress,
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
    const answerDeadline = deadlineForTask(
      getCurrentQuestion(quizSession),
      state.settings,
      !japaneseTts.isSupported,
    );
    stopAllAudio();
    appState.setState({
      route: "quiz",
      quizSession,
      answerDeadline,
      announcement: null,
    });
    if (answerDeadline.startedAt !== null) {
      startDeadlineTicker();
    }
  } catch (error) {
    appState.setState({
      route: "practice",
      announcement: `Could not start this session: ${error.message}`,
    });
  }
}

function startNumberSession() {
  const state = appState.getState();
  const mode = getNumberTrainingMode(state.numberModeId);
  if (!mode || !state.numberRangeId) {
    appState.setState({
      announcement: "Choose a number range first.",
    });
    return;
  }

  try {
    const tasks = generateNumberTrainingTasks({
      dataset: state.dataset,
      modeId: mode.id,
      rangeId: state.numberRangeId,
      sessionSize: state.settings.sessionSize,
      coverage: getNumberTrainingCoverage(
        state.progress,
        mode.id,
        state.numberRangeId,
      ),
    });
    const numberSession = createSelfMarkSession({
      tasks,
      modeId: mode.id,
      rangeId: state.numberRangeId,
    });
    const task = getCurrentNumberTask(numberSession);
    const progress = recordPresentedTask(task, numberSession, state.progress);
    const answerDeadline = deadlineForTask(
      task,
      state.settings,
      task.promptType === "speaking",
    );
    stopAllAudio();
    appState.setState({
      route: "number-task",
      numberSession,
      progress,
      listeningAttempt: attemptForTask(task),
      listeningElapsedMs: null,
      answerDeadline,
      announcement: null,
    });
    if (answerDeadline.startedAt !== null) {
      startDeadlineTicker();
    }
  } catch (error) {
    appState.setState({
      route: "number-setup",
      announcement: `Could not start: ${error.message}`,
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
    stopAllAudio();
    appState.setState({ announcement: null });
    appState.navigate(control.dataset.route);
    return;
  }

  if (action === "select-mode") {
    const mode = PRACTICE_MODES.find(
      (candidate) => candidate.id === control.dataset.mode,
    );
    if (mode) {
      appState.setState({
        selectedMode: mode.id,
        numberModeId:
          mode.id === "numbers" ? appState.getState().numberModeId : null,
      });
    }
    return;
  }

  if (action === "open-number-training") {
    appState.setState({
      route: "number-training",
      numberModeId: "number-dictation",
      numberRangeId: null,
      numberSession: null,
      listeningAttempt: null,
      listeningElapsedMs: null,
      answerDeadline: null,
      announcement: null,
    });
    return;
  }

  if (action === "choose-number-mode") {
    const mode = getNumberTrainingMode(control.dataset.numberMode);
    if (!mode) {
      return;
    }
    stopAllAudio();
    appState.setState({
      route: "number-training",
      numberModeId: mode.id,
      numberRangeId: null,
      numberSession: null,
      listeningAttempt: null,
      listeningElapsedMs: null,
      answerDeadline: null,
      announcement: null,
    });
    return;
  }

  if (action === "select-number-range") {
    appState.setState({
      numberModeId:
        control.dataset.numberMode ?? appState.getState().numberModeId,
      numberRangeId: control.dataset.rangeId,
      announcement: null,
    });
    return;
  }

  if (action === "reset-number-range") {
    const state = appState.getState();
    const mode = getNumberTrainingMode(control.dataset.numberMode);
    const range = mode?.ranges?.find(
      (candidate) => candidate.id === control.dataset.rangeId,
    );
    if (!mode || !range || progressStore === null) {
      return;
    }
    const confirmed = globalThis.confirm(
      `Reset ${range.label}? This will permanently clear its score, attempts, and checklist history.`,
    );
    if (!confirmed) {
      return;
    }
    stopAllAudio();
    const progress = progressStore.resetNumberTrainingRange({
      modeId: mode.id,
      rangeId: range.id,
      skill: mode.section === "reading" ? "speaking-reading" : "listening",
      patternId: mode.patternId,
    });
    appState.setState({
      progress,
      numberSession: null,
      listeningAttempt: null,
      listeningElapsedMs: null,
      answerDeadline: null,
      announcement: `${range.label} was reset. Start a new session from the beginning.`,
    });
    return;
  }

  if (action === "start-number-multiple-choice") {
    appState.setState({
      selectedMode: "numbers",
      numberModeId: "number-multiple-choice",
    });
    startSelectedQuiz();
    return;
  }

  if (action === "start-continuous-playing") {
    const state = appState.getState();
    if (!japaneseTts.isSupported || !englishTts.isSupported) {
      appState.setState({
        announcement:
          "Japanese and English speech synthesis are required for Continuous Playing.",
      });
      return;
    }
    stopAllAudio();
    const quantityIds = getQuantityTrainingPool(state.dataset, "mixed").map(
      (quantity) => quantity.number_id,
    );
    const continuousSession = createContinuousNumberSession({ quantityIds });
    appState.setState({
      route: "continuous-playing",
      numberModeId: "continuous-number-listening",
      continuousSession,
      continuousRemainingMs: CONTINUOUS_ANSWER_WAIT_MS,
      numberSession: null,
      announcement: null,
    });
    beginContinuousPrompt(continuousSession);
    return;
  }

  if (action === "start-continuous-english-playing") {
    if (!japaneseTts.isSupported || !englishTts.isSupported) {
      appState.setState({
        announcement:
          "English and Japanese speech synthesis are required for this continuous mode.",
      });
      return;
    }
    stopAllAudio();
    const continuousSession = createContinuousEnglishNumberSession();
    appState.setState({
      route: "continuous-playing",
      numberModeId: "continuous-english-listening",
      continuousSession,
      continuousRemainingMs: CONTINUOUS_ANSWER_WAIT_MS,
      numberSession: null,
      announcement: null,
    });
    beginContinuousPrompt(continuousSession);
    return;
  }

  if (action === "start-continuous-playing-11-260") {
    if (!japaneseTts.isSupported || !englishTts.isSupported) {
      appState.setState({
        announcement:
          "Japanese and English speech synthesis are required for Continuous Playing 11–260.",
      });
      return;
    }
    stopAllAudio();
    const continuousSession = createContinuousNumberSession({
      min: 11,
      max: 260,
      continuousModeId: "continuous-number-11-260",
    });
    appState.setState({
      route: "continuous-playing",
      numberModeId: "continuous-number-11-260",
      continuousSession,
      continuousRemainingMs: CONTINUOUS_ANSWER_WAIT_MS,
      numberSession: null,
      announcement: null,
    });
    beginContinuousPrompt(continuousSession);
    return;
  }

  if (action === "start-continuous-reading") {
    const session = createContinuousReadingSession();
    beginContinuousReadingWindow(session);
    return;
  }

  if (action === "pause-continuous-reading") {
    const state = appState.getState();
    if (state.continuousReadingSession?.status !== "active") return;
    stopAllAudio();
    appState.setState({
      continuousReadingSession: pauseContinuousReadingSession(
        state.continuousReadingSession,
      ),
      continuousReadingRemainingMs: null,
      announcement: "Continuous Reading is paused.",
    });
    return;
  }

  if (action === "resume-continuous-reading") {
    const state = appState.getState();
    if (state.continuousReadingSession?.status !== "paused") return;
    beginContinuousReadingWindow(
      resumeContinuousReadingSession(state.continuousReadingSession),
    );
    return;
  }

  if (action === "skip-continuous-reading") {
    skipContinuousReading();
    return;
  }

  if (action === "stop-continuous-reading") {
    stopAllAudio();
    appState.setState({
      route: "number-training",
      numberModeId: "continuous-number-reading",
      numberRangeId: null,
      continuousReadingSession: null,
      continuousReadingRemainingMs: null,
      announcement: null,
    });
    return;
  }

  if (action === "pause-continuous-playing") {
    const state = appState.getState();
    if (state.continuousSession?.status !== "active") {
      return;
    }
    stopAllAudio();
    appState.setState({
      continuousSession: pauseContinuousSession(state.continuousSession),
      continuousRemainingMs: null,
      announcement: "Paused. Resume will restart this number.",
    });
    return;
  }

  if (action === "resume-continuous-playing") {
    const state = appState.getState();
    if (state.continuousSession?.status !== "paused") {
      return;
    }
    beginContinuousPrompt(resumeContinuousSession(state.continuousSession));
    return;
  }

  if (action === "repeat-continuous-number") {
    const state = appState.getState();
    if (state.continuousSession?.status !== "active") {
      return;
    }
    beginContinuousPrompt(state.continuousSession);
    return;
  }

  if (action === "stop-continuous-playing") {
    const currentSession = appState.getState().continuousSession;
    const modeId = currentSession?.continuousModeId ??
      (currentSession?.direction === "english-to-japanese"
        ? "continuous-english-listening"
        : "continuous-number-listening");
    stopAllAudio();
    appState.setState({
      route: "number-training",
      numberModeId: modeId,
      numberRangeId: null,
      continuousSession: null,
      continuousRemainingMs: null,
      announcement: null,
    });
    return;
  }

  if (action === "play-special-number") {
    const state = appState.getState();
    const value = Number(control.dataset.numberValue);
    if (!Number.isInteger(value)) {
      return;
    }
    const reading = resolveNumberReading(state.dataset, value);
    const result = japaneseTts.speakRecord(
      { tts_text: reading.ttsText },
      { rate: state.settings.ttsRate },
    );
    appState.setState({
      announcement: result.ok
        ? `Playing the correct Japanese pronunciation for ${value}.`
        : "Japanese speech synthesis is unavailable.",
    });
    return;
  }

  if (action === "start-number-session" || action === "restart-number-session") {
    startNumberSession();
    return;
  }

  if (action === "exit-number-session") {
    stopAllAudio();
    appState.setState({
      route: "number-training",
      numberSession: null,
      listeningAttempt: null,
      listeningElapsedMs: null,
      answerDeadline: null,
      announcement: null,
    });
    return;
  }

  if (action === "finish-number-results") {
    stopAllAudio();
    appState.setState({
      route: "number-training",
      numberSession: null,
      listeningAttempt: null,
      listeningElapsedMs: null,
      answerDeadline: null,
      announcement: null,
    });
    return;
  }

  if (action === "play-number-task") {
    const state = appState.getState();
    const task = getCurrentNumberTask(state.numberSession);
    if (task.promptType === "speaking") {
      const result = japaneseTts.speakRecord(
        { tts_text: task.ttsText },
        { rate: state.settings.ttsRate },
      );
      appState.setState({
        announcement: result.ok
          ? "Playing the correct Japanese reading."
          : "Japanese speech synthesis is unavailable.",
      });
      return;
    }

    const listeningAttempt = beginListeningPlayback(state.listeningAttempt);
    if (listeningAttempt === state.listeningAttempt) {
      return;
    }
    const playbackCount = listeningAttempt.playbackCount;
    appState.setState({
      listeningAttempt,
      listeningElapsedMs:
        state.listeningElapsedMs ?? listeningAttempt.responseTimeMs,
      announcement: "Playing Japanese audio.",
    });
    listeningEnvironment.start(state.settings.listeningEnvironment);
    const result = japaneseTts.speakRecord(
      { tts_text: task.ttsText },
      {
        rate: state.settings.ttsRate,
        onEnd: () => {
          listeningEnvironment.stop();
          const current = appState.getState();
          if (
            current.route !== "number-task" ||
            current.numberSession?.phase !== "prompt" ||
            current.listeningAttempt?.taskId !== task.taskId ||
            current.listeningAttempt.playbackCount !== playbackCount
          ) {
            return;
          }
          const completedAt = Date.now();
          const completed = completeListeningPlayback(
            current.listeningAttempt,
            completedAt,
          );
          const answerDeadline = startAnswerDeadline(
            current.answerDeadline,
            completedAt,
          );
          const elapsed = getListeningResponseTime(completed, completedAt);
          appState.setState({
            listeningAttempt: completed,
            listeningElapsedMs: elapsed,
            answerDeadline,
            announcement: "Audio finished. Answer timer started.",
          });
          startResponseTicker();
          startDeadlineTicker();
        },
        onError: () => {
          listeningEnvironment.stop();
          const current = appState.getState();
          if (
            current.route === "number-task" &&
            current.numberSession?.phase === "prompt" &&
            current.listeningAttempt?.taskId === task.taskId &&
            current.listeningAttempt.playbackCount === playbackCount
          ) {
            appState.setState({
              listeningAttempt: failListeningPlayback(
                current.listeningAttempt,
              ),
              announcement: "Japanese audio could not be played.",
            });
          }
        },
      },
    );
    if (!result.ok) {
      listeningEnvironment.stop();
      appState.setState({
        listeningAttempt: failListeningPlayback(listeningAttempt),
        announcement: "Japanese speech synthesis is unavailable.",
      });
    }
    return;
  }

  if (action === "reveal-number-answer") {
    const state = appState.getState();
    const now = Date.now();
    if (hasAnswerDeadlineExpired(state.answerDeadline, now)) {
      expireCurrentNumberTask(now);
      return;
    }
    const task = getCurrentNumberTask(state.numberSession);
    const answerDeadline = stopAnswerDeadline(
      state.answerDeadline,
      now,
    );
    stopDeadlineTicker();
    const listeningAttempt =
      task.promptType === "listening"
        ? stopListeningResponseTimer(state.listeningAttempt, now)
        : state.listeningAttempt;
    if (task.promptType === "listening") {
      stopAllAudio();
    }
    const numberSession = revealNumberTask(state.numberSession);
    const progress = recordCompletedTask(
      task,
      numberSession,
      state.progress,
    );
    let announcement = null;
    if (task.promptType === "speaking") {
      const result = japaneseTts.speakRecord(
        { tts_text: task.ttsText },
        { rate: state.settings.ttsRate },
      );
      announcement = result.ok
        ? "Playing the correct Japanese reading."
        : "Answer revealed; Japanese speech synthesis is unavailable.";
    }
    appState.setState({
      numberSession,
      progress,
      listeningAttempt,
      listeningElapsedMs: listeningAttempt?.responseTimeMs ?? null,
      answerDeadline,
      announcement,
    });
    return;
  }

  if (action === "mark-number-task") {
    const state = appState.getState();
    const numberSession = markNumberTask(
      state.numberSession,
      control.dataset.correct === "true",
      {
        responseTimeMs: state.listeningAttempt?.responseTimeMs ?? null,
        replayCount: state.listeningAttempt?.replayCount ?? 0,
      },
    );
    const progress = progressStore.recordAnswer(numberSession.currentResult);
    appState.setState({
      numberSession,
      progress,
      announcement:
        progressStore.getLastError() === null
          ? null
          : "Result recorded in memory; browser storage is unavailable.",
    });
    return;
  }

  if (action === "next-number-task") {
    const state = appState.getState();
    const numberSession = advanceNumberTask(state.numberSession);
    stopAllAudio();
    if (numberSession.status === "completed") {
      const progress = progressStore.recordSessionSummary(
        getNumberSessionSummary(numberSession),
      );
      appState.setState({
        route: "number-results",
        numberSession,
        progress,
        listeningAttempt: null,
        listeningElapsedMs: null,
        answerDeadline: null,
        announcement: null,
      });
    } else {
      const task = getCurrentNumberTask(numberSession);
      const progress = recordPresentedTask(
        task,
        numberSession,
        state.progress,
      );
      const answerDeadline = deadlineForTask(
        task,
        state.settings,
        task.promptType === "speaking",
      );
      appState.setState({
        numberSession,
        progress,
        listeningAttempt: attemptForTask(task),
        listeningElapsedMs: null,
        answerDeadline,
        announcement: null,
      });
      if (answerDeadline.startedAt !== null) {
        startDeadlineTicker();
      }
    }
    return;
  }

  if (action === "retry-number-task") {
    const state = appState.getState();
    const task = getCurrentNumberTask(state.numberSession);
    const numberSession = retryTimedOutNumberTask(state.numberSession);
    const answerDeadline = deadlineForTask(
      task,
      state.settings,
      task.promptType === "speaking",
    );
    stopAllAudio();
    appState.setState({
      numberSession,
      listeningAttempt: attemptForTask(task),
      listeningElapsedMs: null,
      answerDeadline,
      announcement:
        task.promptType === "listening"
          ? "One retry started. Press Play to hear the question again."
          : "One retry started with a fresh timer.",
    });
    if (answerDeadline.startedAt !== null) {
      startDeadlineTicker();
    }
    return;
  }

  if (action === "start-quiz" || action === "restart-quiz") {
    startSelectedQuiz();
    return;
  }

  if (action === "exit-quiz" || action === "finish-results") {
    stopAllAudio();
    const returnToNumberTraining =
      appState.getState().numberModeId === "number-multiple-choice";
    appState.setState({
      route: returnToNumberTraining ? "number-training" : "practice",
      quizSession: null,
      answerDeadline: null,
      announcement: null,
    });
    return;
  }

  if (action === "play-question-audio") {
    const state = appState.getState();
    const question = getCurrentQuestion(state.quizSession);
    const result = japaneseTts.speakRecord(
      { tts_text: question.ttsText },
      {
        rate: state.settings.ttsRate,
        onEnd: () => {
          const current = appState.getState();
          const currentQuestion = current.quizSession
            ? getCurrentQuestion(current.quizSession)
            : null;
          if (
            current.route !== "quiz" ||
            current.quizSession?.currentResult !== null ||
            currentQuestion?.questionId !== question.questionId
          ) {
            return;
          }
          const answerDeadline = startAnswerDeadline(
            current.answerDeadline,
            Date.now(),
          );
          appState.setState({
            answerDeadline,
            announcement: "Audio finished. Answer timer started.",
          });
          startDeadlineTicker();
        },
      },
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
    if (
      japaneseTts.isSupported &&
      !Number.isFinite(state.answerDeadline?.startedAt)
    ) {
      return;
    }
    const now = Date.now();
    if (hasAnswerDeadlineExpired(state.answerDeadline, now)) {
      expireCurrentQuizQuestion(now);
      return;
    }
    const answerDeadline = stopAnswerDeadline(state.answerDeadline, now);
    const quizSession = submitAnswer(
      state.quizSession,
      control.dataset.choiceKey,
    );
    const progress = progressStore.recordAnswer({
      ...quizSession.currentResult,
      numberTraining: quizProgressMetadata(quizSession),
    });
    stopAllAudio();
    appState.setState({
      quizSession,
      progress,
      answerDeadline,
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
    stopAllAudio();
    if (quizSession.status === "completed") {
      const progress = progressStore.recordSessionSummary(
        getSessionSummary(quizSession),
      );
      appState.setState({
        route: "results",
        quizSession,
        progress,
        answerDeadline: null,
        announcement: null,
      });
    } else {
      const answerDeadline = deadlineForTask(
        getCurrentQuestion(quizSession),
        state.settings,
        !japaneseTts.isSupported,
      );
      appState.setState({
        quizSession,
        answerDeadline,
        announcement: null,
      });
      if (answerDeadline.startedAt !== null) {
        startDeadlineTicker();
      }
    }
    return;
  }

  if (action === "update-setting") {
    const setting = control.dataset.setting;
    let value = control.dataset.value;
    if (setting === "sessionSize") {
      value = Number(value);
    } else if (setting === "answerTimeLimitSeconds") {
      value = Number(value);
    } else if (setting === "ttsRate") {
      value = Number(value);
      stopAllAudio();
    } else if (setting === "listeningEnvironment") {
      stopAllAudio();
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

document.addEventListener("keydown", (event) => {
  if (!isContinuousReadingSkipKey(event)) {
    return;
  }
  const state = appState.getState();
  if (
    state.route !== "continuous-reading" ||
    state.continuousReadingSession?.status !== "active"
  ) {
    return;
  }
  event.preventDefault();
  skipContinuousReading();
});

window.addEventListener("beforeunload", () => {
  stopAllAudio();
  japaneseTts.dispose();
  englishTts.stop();
  listeningEnvironment.dispose();
});

initialize();
