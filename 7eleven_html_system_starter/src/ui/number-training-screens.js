import {
  NUMBER_TRAINING_MODES,
  getNumberTrainingMode,
} from "../number-training/number-training-config.js";
import {
  MAX_TIMEOUT_RETRIES,
  getCurrentNumberTask,
} from "../number-training/self-mark-session.js";
import { getAnswerTimeRemaining } from "../number-training/answer-deadline.js";
import {
  getCurrentContinuousItem,
  resolveContinuousItem,
  resolveContinuousListeningEnvironment,
} from "../number-training/continuous-number-session.js";
import { resolveNumberReading } from "../number-training/number-reading-engine.js";
import { getNumberTrainingCoverageItems } from "../number-training/number-task-generator.js";
import {
  getNumberTrainingCoverage,
  getNumberTrainingRangePerformance,
} from "../progress/progress-store.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function backButton(target, label = "Back") {
  return `
    <button
      class="text-button back-button"
      type="button"
      data-action="navigate"
      data-route="${target}"
    >
      <span class="navigation-button-icon" aria-hidden="true">←</span>
      <span>${label}</span>
    </button>
  `;
}

function percentageText(stats) {
  if (!stats || stats.attempts === 0) {
    return "Not practiced yet";
  }
  return `${Math.round((stats.correct / stats.attempts) * 100)}% · ${stats.attempts} attempts`;
}

const MODE_NAV_LABELS = Object.freeze({
  "number-dictation": "Number Dictation",
  "continuous-number-listening": "Continuous Playing",
  "continuous-number-11-260": "Continuous Playing 11–260",
  "continuous-english-listening": "Continuous English → Japanese",
  "tobacco-number": "Tobacco Number",
  "quantity-listening": "Quantity",
  "tobacco-quantity": "Tobacco + Quantity",
  "service-amount": "Service / Money Amount",
  "mixed-number-listening": "Mixed Listening",
  "number-multiple-choice": "Multiple Choice",
  "continuous-number-reading": "Continuous Reading",
  "number-reading": "General Numbers",
  "total-reading": "Total Bill",
  "price-reading": "Price",
  "change-reading": "Change / おつり",
});

const SPECIAL_NUMBER_ROWS = Object.freeze([
  Object.freeze({
    number: 100,
    expectedWrong: "いちひゃく",
    correctJapanese: "ひゃく",
    romaji: "hyaku",
    examples: Object.freeze(["100 → ひゃく", "180 → ひゃくはちじゅう"]),
  }),
  Object.freeze({
    number: 300,
    expectedWrong: "さんひゃく",
    correctJapanese: "さんびゃく",
    romaji: "sanbyaku",
    examples: Object.freeze(["300 → さんびゃく", "345 → さんびゃくよんじゅうご"]),
  }),
  Object.freeze({
    number: 600,
    expectedWrong: "ろくひゃく",
    correctJapanese: "ろっぴゃく",
    romaji: "roppyaku",
    examples: Object.freeze(["600 → ろっぴゃく", "620 → ろっぴゃくにじゅう"]),
  }),
  Object.freeze({
    number: 800,
    expectedWrong: "はちひゃく",
    correctJapanese: "はっぴゃく",
    romaji: "happyaku",
    examples: Object.freeze(["800 → はっぴゃく", "840 → はっぴゃくよんじゅう"]),
  }),
  Object.freeze({
    number: 1000,
    expectedWrong: "いちせん",
    correctJapanese: "せん",
    romaji: "sen",
    examples: Object.freeze(["1000 → せん", "1400 → せんよんひゃく"]),
  }),
  Object.freeze({
    number: 3000,
    expectedWrong: "さんせん",
    correctJapanese: "さんぜん",
    romaji: "sanzen",
    examples: Object.freeze(["3000 → さんぜん", "3400 → さんぜんよんひゃく"]),
  }),
  Object.freeze({
    number: 8000,
    expectedWrong: "はちせん",
    correctJapanese: "はっせん",
    romaji: "hassen",
    examples: Object.freeze(["8000 → はっせん", "8200 → はっせんにひゃく"]),
  }),
]);

function modeLabel(mode) {
  return MODE_NAV_LABELS[mode.id] ?? mode.title;
}

function modeNavigationButton(mode, state) {
  const stats = state.progress?.numberTraining?.modes?.[mode.id];
  const selected = mode.id === (state.numberModeId ?? "number-dictation");
  const progressLabel =
    [
      "continuous-number-listening",
      "continuous-number-11-260",
      "continuous-english-listening",
    ].includes(mode.id)
      ? "Hands-free · no score"
      : percentageText(stats);
  return `
    <button
      class="number-nav-mode ${selected ? "is-selected" : ""}"
      type="button"
      data-action="choose-number-mode"
      data-number-mode="${mode.id}"
      ${selected ? 'aria-current="page"' : ""}
    >
      <span>${escapeHtml(modeLabel(mode))}</span>
      <small>${escapeHtml(progressLabel)}</small>
    </button>
  `;
}

function renderModeGroup(section, title, modes, state) {
  const selectedMode =
    getNumberTrainingMode(state.numberModeId) ??
    getNumberTrainingMode("number-dictation");
  const selected = selectedMode?.section === section;
  return `
    <section class="number-nav-group ${section}-group ${selected ? "is-selected" : ""}">
      <h2>${escapeHtml(title)}</h2>
      <div class="number-nav-mode-list">
        ${modes.map((mode) => modeNavigationButton(mode, state)).join("")}
      </div>
    </section>
  `;
}

function renderNavigationTree(listeningModes, readingModes, state) {
  const selectedMode =
    getNumberTrainingMode(state.numberModeId) ??
    getNumberTrainingMode("number-dictation");
  return selectedMode.section === "reading"
    ? renderModeGroup(
        "reading",
        "Speaking / Reading",
        readingModes,
        state,
      )
    : renderModeGroup("listening", "Listening", listeningModes, state);
}

function getCoverageSummary(state, modeId, range) {
  if (!Number.isInteger(range?.min) || !Number.isInteger(range?.max)) {
    return null;
  }
  const coverage = getNumberTrainingCoverage(
    state.progress,
    modeId,
    range.id,
  );
  const items = getNumberTrainingCoverageItems(
    state.dataset,
    modeId,
    range,
  );
  const total = items.length;
  const presented = new Set(coverage.completedKeys ?? []);
  const includesQuantities = items.some((item) => item.kind === "quantity");
  const covered = items.filter((item) => presented.has(item.key)).length;
  return { coverage, total, covered, items, includesQuantities };
}

function renderCoverageHistory(state, mode, range) {
  const summary = getCoverageSummary(state, mode.id, range);
  if (summary === null) {
    return "";
  }
  const { coverage, total, covered, items, includesQuantities } = summary;
  const presented = new Set(coverage.completedKeys ?? []);
  const compactLargeRange = total > 2000;
  const displayedItems = compactLargeRange
    ? items.filter(
        (item) =>
          presented.has(item.key) ||
          (coverage.entries[item.key]?.timesPresented ?? 0) > 0,
      )
    : items;
  const rows = displayedItems.map((item) => {
    const key = item.key;
    const entry = coverage.entries[key] ?? {};
    const timedAttempts = entry.timedAttempts ?? 0;
    const averageTime =
      timedAttempts === 0
        ? "—"
        : `${((entry.totalResponseTimeMs ?? 0) / timedAttempts / 1000).toFixed(1)}s`;
    return `
      <tr class="${presented.has(key) ? "is-covered" : ""}">
        <th scope="row">${escapeHtml(item.label)}</th>
        <td aria-label="Asked this cycle">${presented.has(key) ? "✓" : "—"}</td>
        <td>${entry.timesPresented ?? 0}</td>
        <td>${entry.correct ?? 0}</td>
        <td>${entry.incorrect ?? 0}</td>
        <td>${averageTime}</td>
      </tr>
    `;
  }).join("") || `
    <tr>
      <td colspan="6">No completed numbers yet.</td>
    </tr>
  `;
  const percent = Math.round((covered / total) * 100);

  return `
    <details class="coverage-history">
      <summary>
        <span>
          <strong>Coverage checklist</strong>
          <small>Cycle ${coverage.cycle} · ${covered} / ${total} asked</small>
        </span>
        <span class="coverage-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div
        class="coverage-progress"
        role="progressbar"
        aria-label="Range coverage"
        aria-valuemin="0"
        aria-valuemax="${total}"
        aria-valuenow="${covered}"
      >
        <span style="width: ${percent}%"></span>
      </div>
      <p class="coverage-help">
        ${
          includesQuantities
            ? "Unasked numbers and quantity forms are selected first. A new cycle begins after all 320 items have appeared."
            : "Unasked numbers are selected first. A new cycle begins after every number in this range has appeared."
        }
      </p>
      ${
        compactLargeRange
          ? '<p class="coverage-help">For Android performance, this table shows practiced numbers only. The summary still tracks all 10,000 numbers.</p>'
          : ""
      }
      <div class="coverage-table-wrap">
        <table class="coverage-table">
          <thead>
            <tr>
              <th>${includesQuantities ? "Number / quantity" : "Number"}</th>
              <th>This cycle</th>
              <th>Asked</th>
              <th>Correct</th>
              <th>Wrong</th>
              <th>Avg. time</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </details>
  `;
}

function renderModePanel(state) {
  const mode =
    getNumberTrainingMode(state.numberModeId) ??
    getNumberTrainingMode("number-dictation");
  const category =
    mode.section === "reading" ? "Speaking / Reading" : "Listening";

  if (["continuous-number-listening", "continuous-number-11-260"].includes(mode.id)) {
    const limitedRange = mode.id === "continuous-number-11-260";
    const title = limitedRange ? "Continuous Playing 11–260" : "Continuous Playing";
    const environmentLabels = {
      clean: "Clean",
      light: "Light noise",
      medium: "Medium noise",
      conversation: "Background conversation",
    };
    const continuousEnvironment = resolveContinuousListeningEnvironment(
      state.settings.listeningEnvironment,
    );
    return `
      <section class="number-mode-panel" aria-labelledby="selected-mode-title">
        <p class="number-breadcrumb">${category} <span aria-hidden="true">›</span> ${title}</p>
        <header class="number-mode-heading">
          <div>
            <h1 id="selected-mode-title">${title}</h1>
            <p>Hands-free Number Dictation while cooking or doing other work.</p>
          </div>
        </header>
        <section class="continuous-setup-card" aria-label="Continuous Playing details">
          <strong>${limitedRange ? "250 numbers" : "300 numbers + 20 quantity forms"}</strong>
          <ul>
            ${
              limitedRange
                ? "<li>Numbers 11–260 only, with no quantity forms.</li><li>All 250 numbers play once in a shuffled cycle.</li>"
                : "<li>Numbers 1–300, つ quantities 1–10, and 個 quantities 1–10.</li><li>All 320 items play once in a shuffled cycle.</li>"
            }
            <li>Five seconds to say the answer.</li>
            <li>Slow English answer, then a clear Japanese repeat.</li>
            <li>No scores, mistakes, or checklist changes.</li>
          </ul>
          <p>
            Japanese prompt environment:
            <strong>${escapeHtml(environmentLabels[continuousEnvironment])}</strong>
          </p>
          ${
            state.settings.listeningEnvironment === "clean"
              ? "<p>Continuous Playing uses Medium noise when the general setting is Clean.</p>"
              : ""
          }
        </section>
        <button
          class="primary-action-button"
          type="button"
          data-action="${limitedRange ? "start-continuous-playing-11-260" : "start-continuous-playing"}"
        >
          Start ${title}
        </button>
        <p class="announcement" aria-live="polite">
          ${escapeHtml(state.announcement ?? "")}
        </p>
      </section>
    `;
  }

  if (mode.id === "continuous-english-listening") {
    const environmentLabels = {
      clean: "Clean",
      light: "Light noise",
      medium: "Medium noise",
      conversation: "Background conversation",
    };
    const continuousEnvironment = resolveContinuousListeningEnvironment(
      state.settings.listeningEnvironment,
    );
    return `
      <section class="number-mode-panel" aria-labelledby="selected-mode-title">
        <p class="number-breadcrumb">${category} <span aria-hidden="true">›</span> Continuous English → Japanese</p>
        <header class="number-mode-heading">
          <div>
            <h1 id="selected-mode-title">Continuous English → Japanese</h1>
            <p>Hear an English number, recall it in Japanese, then listen to the answer.</p>
          </div>
        </header>
        <section class="continuous-setup-card" aria-label="Continuous English to Japanese details">
          <strong>Weighted random numbers 400–5999</strong>
          <ul>
            <li>English prompt, then five seconds to say the Japanese answer.</li>
            <li>The digits stay visible from the beginning while the English voice plays.</li>
            <li>The English wording and Japanese reading are shown at answer time.</li>
            <li>The correct Japanese pronunciation plays before the next number.</li>
            <li>4000–5999 appear twice as often as other numbers.</li>
            <li>4400–4499 and 5500–5599 appear three times as often.</li>
            <li>No scores, mistakes, or checklist changes.</li>
          </ul>
          <p>
            English prompt environment:
            <strong>${escapeHtml(environmentLabels[continuousEnvironment])}</strong>
          </p>
          ${
            state.settings.listeningEnvironment === "clean"
              ? "<p>This hands-free mode uses Medium noise when the general setting is Clean.</p>"
              : ""
          }
        </section>
        <button
          class="primary-action-button"
          type="button"
          data-action="start-continuous-english-playing"
        >
          Start English → Japanese
        </button>
        <p class="announcement" aria-live="polite">
          ${escapeHtml(state.announcement ?? "")}
        </p>
      </section>
    `;
  }

  if (mode.id === "continuous-number-reading") {
    return `
      <section class="number-mode-panel" aria-labelledby="selected-mode-title">
        <p class="number-breadcrumb">${category} <span aria-hidden="true">›</span> Continuous Reading</p>
        <header class="number-mode-heading">
          <div>
            <h1 id="selected-mode-title">Continuous Reading</h1>
            <p>Read each number aloud before the Japanese answer plays.</p>
          </div>
        </header>
        <section class="continuous-setup-card" aria-label="Continuous Reading details">
          <strong>Random numbers 1–10000</strong>
          <ul>
            <li>Five seconds to read each number aloud.</li>
            <li>The Japanese answer then plays automatically.</li>
            <li>Each next number changes its 1,000 and remainder-100 bands.</li>
            <li>Right Arrow or Skip immediately shows another number.</li>
            <li>No scores, mistakes, or checklist changes.</li>
          </ul>
        </section>
        <button
          class="primary-action-button"
          type="button"
          data-action="start-continuous-reading"
        >
          Start Continuous Reading
        </button>
        <p class="announcement" aria-live="polite">
          ${escapeHtml(state.announcement ?? "")}
        </p>
      </section>
    `;
  }

  if (mode.id === "number-multiple-choice") {
    return `
      <section class="number-mode-panel" aria-labelledby="selected-mode-title">
        <p class="number-breadcrumb">${category} <span aria-hidden="true">›</span> ${escapeHtml(modeLabel(mode))}</p>
        <header class="number-mode-heading">
          <div>
            <h1 id="selected-mode-title">${escapeHtml(modeLabel(mode))}</h1>
            <p>${escapeHtml(mode.description)}</p>
          </div>
        </header>
        <section class="current-pool-card" aria-label="Current question pool">
          <span>Current pool</span>
          <strong>Stage ${escapeHtml(state.settings.stage)}</strong>
          <small>Change the stage from Settings.</small>
        </section>
        <button
          class="primary-action-button"
          type="button"
          data-action="start-number-multiple-choice"
        >
          Start ${state.settings.sessionSize}-question session
        </button>
        <p class="announcement" aria-live="polite">
          ${escapeHtml(state.announcement ?? "")}
        </p>
      </section>
    `;
  }

  const rangeButtons = mode.ranges
    .map((range) => {
      const performance = getNumberTrainingRangePerformance(
        state.progress,
        mode.id,
        range.id,
      );
      const coverageSummary = getCoverageSummary(state, mode.id, range);
      return `
        <button
          class="range-button"
          type="button"
          data-action="select-number-range"
          data-number-mode="${mode.id}"
          data-range-id="${range.id}"
          aria-pressed="${range.id === state.numberRangeId}"
        >
          <strong>${escapeHtml(range.label)}</strong>
          <small>${escapeHtml(percentageText(performance))}</small>
          ${
            coverageSummary === null
              ? ""
              : `<small class="range-coverage">Cycle ${coverageSummary.coverage.cycle}: ${coverageSummary.covered}/${coverageSummary.total} asked</small>`
          }
        </button>
      `;
    })
    .join("");

  return `
    <section class="number-mode-panel" aria-labelledby="selected-mode-title">
      <p class="number-breadcrumb">${category} <span aria-hidden="true">›</span> ${escapeHtml(modeLabel(mode))}</p>
      <header class="number-mode-heading">
        <div>
          <h1 id="selected-mode-title">${escapeHtml(modeLabel(mode))}</h1>
          <p>${escapeHtml(mode.description)}</p>
        </div>
        ${
          mode.highestPriority
            ? '<span class="priority-badge">Highest priority</span>'
            : ""
        }
      </header>
      <section class="number-range-section" aria-labelledby="range-heading">
        <div class="range-heading-row">
          <div>
            <p class="step-label">Next step</p>
            <h2 id="range-heading">Choose a range</h2>
          </div>
          <span>${state.settings.sessionSize} tasks</span>
        </div>
        <div class="range-grid" role="group" aria-label="Number range">
          ${rangeButtons}
        </div>
      </section>
      ${
        state.numberRangeId === "reading-mixed-1-10000"
          ? '<p class="mixed-range-rule">Each next number changes both its 1,000 band and the 100 band inside its last three digits.</p>'
          : state.numberRangeId === "reading-focused-400-5999"
            ? `<p class="mixed-range-rule">Focused practice: ${Math.round((state.settings.sessionSize * 2) / 3)} of ${state.settings.sessionSize} tasks come from 400–499, 500–599, 4000–4999, and 5000–5999.</p>`
            : ""
      }
      ${
        state.numberRangeId
          ? renderCoverageHistory(
              state,
              mode,
              mode.ranges.find((range) => range.id === state.numberRangeId),
            )
          : ""
      }
      <div class="range-action-buttons">
        <button
          class="primary-action-button"
          type="button"
          data-action="start-number-session"
          ${state.numberRangeId ? "" : "disabled"}
        >
          Start session
        </button>
        ${
          state.numberRangeId
            ? `
              <button
                class="reset-range-button"
                type="button"
                data-action="reset-number-range"
                data-number-mode="${mode.id}"
                data-range-id="${state.numberRangeId}"
              >
                <span aria-hidden="true">↻</span>
                Reset this range
              </button>
              <p class="reset-range-help">
                Clears this range's score, attempts, and checklist history.
              </p>
            `
            : ""
        }
      </div>
      <p class="announcement" aria-live="polite">
        ${escapeHtml(state.announcement ?? "")}
      </p>
    </section>
  `;
}

export function renderNumberTrainingHome(state) {
  const listeningModes = NUMBER_TRAINING_MODES.filter(
    (mode) => mode.section === "listening",
  );
  const readingModes = NUMBER_TRAINING_MODES.filter(
    (mode) => mode.section === "reading",
  );
  const selectedMode =
    getNumberTrainingMode(state.numberModeId) ??
    getNumberTrainingMode("number-dictation");
  const selectedCategory =
    selectedMode.section === "reading" ? "Speaking / Reading" : "Listening";

  return `
    <main class="screen number-training-screen" id="main-content" tabindex="-1">
      ${backButton("home", "Home")}
      <div class="number-training-layout">
        <aside class="number-training-navigation" aria-label="Number Training modes">
          <nav class="number-desktop-navigation" aria-label="Desktop Number Training hierarchy">
            <div class="number-navigation-title">
              <strong>Number Training</strong>
            </div>
            <div class="number-navigation-tree">
              ${renderNavigationTree(listeningModes, readingModes, state)}
            </div>
          </nav>
          <details class="number-navigation-drawer number-mobile-navigation">
            <summary>
              <span>
                <strong>☰ Number Training</strong>
                <small>${escapeHtml(selectedCategory)} · ${escapeHtml(modeLabel(selectedMode))}</small>
              </span>
              <span class="drawer-chevron" aria-hidden="true">⌄</span>
            </summary>
            <nav class="number-navigation-body" aria-label="Number Training hierarchy">
              ${renderNavigationTree(listeningModes, readingModes, state)}
            </nav>
          </details>
        </aside>
        ${renderModePanel(state)}
      </div>
    </main>
  `;
}

export function renderNumberSetup(state) {
  return renderNumberTrainingHome(state);
}

export function renderNumberTask(state, { ttsSupported }) {
  const session = state.numberSession;
  const task = getCurrentNumberTask(session);
  const mode = getNumberTrainingMode(session.modeId);
  const revealed = session.phase === "revealed" || session.phase === "marked";
  const marked = session.phase === "marked";
  const timedOut = Boolean(session.currentResult?.timedOut);
  const timeoutRetriesRemaining = Math.max(
    0,
    MAX_TIMEOUT_RETRIES - (session.currentRetryCount ?? 0),
  );
  const canRetryTimedOutTask =
    timedOut && timeoutRetriesRemaining > 0;
  const position = session.currentIndex + 1;
  const total = session.tasks.length;
  const progressPercent = Math.round((position / total) * 100);
  const answerTimeRemaining =
    state.answerDeadline?.startedAt === null || !state.answerDeadline
      ? null
      : getAnswerTimeRemaining(state.answerDeadline, Date.now());
  const answerTimeText =
    answerTimeRemaining === null
      ? "Starts after audio"
      : `${(answerTimeRemaining / 1000).toFixed(1)} sec`;
  const deadlineMetric = `
    <div class="answer-deadline" aria-live="polite">
      Time left: <strong class="answer-time-left">${answerTimeText}</strong>
    </div>
  `;
  const listeningAttempt = state.listeningAttempt;
  const elapsedMs =
    listeningAttempt?.responseTimeMs ?? state.listeningElapsedMs;
  const responseTimeText =
    elapsedMs === null || elapsedMs === undefined
      ? listeningAttempt?.isPlaying
        ? "Starts after audio"
        : "—"
      : `${(elapsedMs / 1000).toFixed(1)} sec`;
  const playLabel =
    (listeningAttempt?.playbackCount ?? 0) > 0 ? "Replay" : "Play";
  const showAnswerDisabled =
    ttsSupported &&
    ((listeningAttempt?.playbackCount ?? 0) === 0 ||
      listeningAttempt?.isPlaying);

  const prompt =
    task.promptType === "speaking"
      ? `
        <p class="task-instruction">Say this number aloud.</p>
        <p class="speaking-number">${task.promptNumber}</p>
        ${deadlineMetric}
        <button
          class="audio-button"
          type="button"
          data-action="reveal-number-answer"
        >
          <span aria-hidden="true">▶</span>
          Hear Answer
        </button>
      `
      : `
        <p class="task-instruction">
          Listen and write the answer on paper.
        </p>
        <div class="hidden-answer-mark" aria-hidden="true">?</div>
        <button
          class="audio-button"
          type="button"
          data-action="play-number-task"
          ${ttsSupported && !listeningAttempt?.isPlaying ? "" : "disabled"}
        >
          <span aria-hidden="true">▶</span>
          ${playLabel}
        </button>
        <div class="listening-attempt-metrics" aria-live="polite">
          <span>Response time: <strong class="response-time-value">${responseTimeText}</strong></span>
          <span>Replays: <strong>${listeningAttempt?.replayCount ?? 0}</strong></span>
        </div>
        ${deadlineMetric}
        <button
          class="secondary-button show-answer-button"
          type="button"
          data-action="reveal-number-answer"
          ${showAnswerDisabled ? "disabled" : ""}
        >
          Show Answer
        </button>
        ${
          ttsSupported
            ? ""
            : '<p class="muted">Japanese speech synthesis is unavailable on this device.</p>'
        }
      `;

  const reveal = revealed && !timedOut
    ? `
      <section class="number-answer-card" aria-live="polite" tabindex="-1">
        <p class="numeric-answer">${escapeHtml(task.reveal.numericAnswer)}</p>
        ${
          state.settings.showKana
            ? `<p class="answer-kana primary-reading" lang="ja">${escapeHtml(task.reveal.readingKana)}</p>`
            : ""
        }
        ${
          state.settings.showRomaji
            ? `<p class="answer-romaji">${escapeHtml(task.reveal.romaji)}</p>`
            : ""
        }
        ${
          task.promptType === "speaking"
            ? `
              <button
                class="secondary-button"
                type="button"
                data-action="play-number-task"
                ${ttsSupported ? "" : "disabled"}
              >
                Replay answer
              </button>
            `
            : ""
        }
      </section>
    `
    : "";

  const marking = revealed
    ? marked
      ? `
        <section
          class="self-mark-feedback ${session.currentResult.correct ? "correct" : "wrong"}"
          aria-live="polite"
        >
          <strong>${
            session.currentResult.timedOut
              ? "Time is up — marked wrong"
              : session.currentResult.correct
                ? "Marked correct"
                : "Added to mistakes"
          }</strong>
          ${
            canRetryTimedOutTask
              ? `
                <div class="timed-out-actions">
                  ${
                    task.promptType === "speaking"
                      ? `
                        <button
                          class="secondary-button timed-out-hear-answer"
                          type="button"
                          data-action="play-number-task"
                          ${ttsSupported ? "" : "disabled"}
                        >
                          <span aria-hidden="true">▶</span>
                          Hear Answer
                        </button>
                      `
                      : ""
                  }
                  <button
                    class="primary-action-button"
                    type="button"
                    data-action="retry-number-task"
                  >
                    Try this question again (${timeoutRetriesRemaining} left)
                  </button>
                  <button
                    class="secondary-button"
                    type="button"
                    data-action="next-number-task"
                  >
                    ${position === total ? "Skip and see results" : "Skip to next task"}
                  </button>
                  <p>
                    Up to five retries are available. Every timeout remains
                    recorded as wrong.
                  </p>
                </div>
              `
              : `
                ${
                  timedOut && task.promptType === "speaking"
                    ? `
                      <button
                        class="secondary-button timed-out-hear-answer"
                        type="button"
                        data-action="play-number-task"
                        ${ttsSupported ? "" : "disabled"}
                      >
                        <span aria-hidden="true">▶</span>
                        Hear Answer
                      </button>
                    `
                    : ""
                }
                <button
                  class="primary-action-button"
                  type="button"
                  data-action="next-number-task"
                >
                  ${position === total ? "See results" : "Next task"}
                </button>
              `
          }
        </section>
      `
      : `
        <section class="self-mark-panel" aria-labelledby="self-mark-title">
          <h2 id="self-mark-title">How did you do?</h2>
          <div class="self-mark-grid">
            <button
              class="self-mark-button correct"
              type="button"
              data-action="mark-number-task"
              data-correct="true"
            >
              Correct
            </button>
            <button
              class="self-mark-button wrong"
              type="button"
              data-action="mark-number-task"
              data-correct="false"
            >
              Wrong
            </button>
          </div>
        </section>
      `
    : "";

  return `
    <main class="quiz-screen number-task-screen" id="main-content" tabindex="-1">
      <header class="quiz-header">
        <button
          class="text-button exit-session-button"
          type="button"
          data-action="exit-number-session"
        >
          <span class="navigation-button-icon" aria-hidden="true">×</span>
          <span>Exit</span>
        </button>
        <div class="quiz-position">
          <strong>Question ${position} / ${total}</strong>
          <span>${escapeHtml(mode.title)}</span>
        </div>
      </header>
      <div
        class="progress-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="${total}"
        aria-valuenow="${position}"
      >
        <span style="width: ${progressPercent}%"></span>
      </div>

      <section class="number-task-card">
        ${revealed ? "" : prompt}
        ${reveal}
        <p class="announcement" aria-live="polite">
          ${escapeHtml(state.announcement ?? "")}
        </p>
      </section>
      ${marking}
    </main>
  `;
}

export function renderContinuousPlaying(
  state,
  { ttsSupported, englishTtsSupported },
) {
  const session = state.continuousSession;
  const englishFirst = session?.direction === "english-to-japanese";
  const limitedRange = session?.continuousModeId === "continuous-number-11-260";
  const modeTitle = englishFirst
    ? "Continuous English → Japanese"
    : limitedRange
      ? "Continuous Playing 11–260"
      : "Continuous Playing";
  const completed = session?.status === "completed";
  const paused = session?.status === "paused";
  const currentItem = completed
    ? session.items[session.currentIndex]
    : getCurrentContinuousItem(session);
  const prompt = resolveContinuousItem(state.dataset, currentItem);
  const position = session.currentIndex + 1;
  const total = session.items.length;
  const phase = session.phase;
  const answerVisible = [
    "english-answer",
    "japanese-answer",
    "between",
    "completed",
  ].includes(phase);
  const phaseText = completed
    ? englishFirst
      ? "The weighted 400–5999 cycle is complete."
      : limitedRange
        ? "All 250 numbers from 11–260 completed."
        : "All 300 numbers and 20 quantity forms completed."
    : paused
      ? "Paused. Resume will restart the current number."
      : phase === "prompt"
        ? englishFirst
          ? "Listen to the English number."
          : "Listen to the Japanese number."
        : phase === "waiting"
          ? englishFirst
            ? "Say the Japanese answer now."
            : "Say the answer now."
          : phase === "english-answer"
            ? "Listen to the slow English answer."
            : phase === "japanese-answer"
              ? englishFirst
                ? "Listen to the correct Japanese answer."
                : "Listen to the clear Japanese repeat."
              : "The next number is coming.";

  return `
    <main class="quiz-screen continuous-playing-screen" id="main-content" tabindex="-1">
      <header class="quiz-header">
        <button
          class="text-button exit-session-button"
          type="button"
          data-action="stop-continuous-playing"
        >
          <span class="navigation-button-icon" aria-hidden="true">×</span>
          <span>Stop</span>
        </button>
        <div class="quiz-position">
          <strong>Item ${position} / ${total}</strong>
          <span>${escapeHtml(modeTitle)}</span>
        </div>
      </header>
      <div
        class="progress-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="${total}"
        aria-valuenow="${position}"
      >
        <span style="width: ${Math.round((position / total) * 100)}%"></span>
      </div>

      <section class="continuous-player-card" aria-live="polite">
        <p class="continuous-phase-label">${escapeHtml(phaseText)}</p>
        ${
          phase === "waiting"
            ? `<p class="continuous-countdown">Answer time: <strong class="continuous-countdown-value">${((state.continuousRemainingMs ?? 5000) / 1000).toFixed(1)} sec</strong></p>`
            : ""
        }
        ${
          answerVisible
            ? `
              <p class="continuous-answer-number">${escapeHtml(prompt.displayAnswer)}</p>
              <p class="continuous-english-answer">${escapeHtml(prompt.englishAnswerText)}</p>
              <p class="continuous-japanese-answer" lang="ja">${escapeHtml(prompt.readingKana)}</p>
            `
            : englishFirst
              ? `<p class="continuous-answer-number">${escapeHtml(prompt.displayAnswer)}</p>`
              : '<div class="hidden-answer-mark" aria-hidden="true">?</div>'
        }
        ${
          completed
            ? `
              <button class="primary-action-button" type="button" data-action="${englishFirst ? "start-continuous-english-playing" : limitedRange ? "start-continuous-playing-11-260" : "start-continuous-playing"}">
                Start a new shuffled cycle
              </button>
            `
            : `
              <div class="continuous-controls">
                <button
                  class="primary-action-button"
                  type="button"
                  data-action="${paused ? "resume-continuous-playing" : "pause-continuous-playing"}"
                >
                  ${paused ? "Resume" : "Pause"}
                </button>
                <button
                  class="secondary-button"
                  type="button"
                  data-action="repeat-continuous-number"
                  ${paused ? "disabled" : ""}
                >
                  Repeat current number
                </button>
              </div>
            `
        }
        <p class="continuous-note">
          Background noise always plays with the ${englishFirst ? "English" : "first Japanese"} prompt.
          This mode does not change your progress or checklist.
        </p>
        <p class="announcement" aria-live="polite">${escapeHtml(state.announcement ?? "")}</p>
        ${
          ttsSupported && englishTtsSupported
            ? ""
            : '<p class="error-text">Japanese and English speech synthesis are required for this mode.</p>'
        }
      </section>
    </main>
  `;
}

export function renderContinuousReading(state, { ttsSupported }) {
  const session = state.continuousReadingSession;
  const paused = session.status === "paused";
  const answerVisible = session.phase === "answer";
  const reading = resolveNumberReading(state.dataset, session.currentValue);
  const remaining = state.continuousReadingRemainingMs ?? 5000;

  return `
    <main class="quiz-screen continuous-reading-screen" id="main-content" tabindex="-1">
      <header class="quiz-header">
        <button
          class="text-button exit-session-button"
          type="button"
          data-action="stop-continuous-reading"
        >
          <span class="navigation-button-icon" aria-hidden="true">×</span>
          <span>Stop</span>
        </button>
        <div class="quiz-position">
          <strong>Number ${session.position}</strong>
          <span>Continuous Reading · Cycle ${session.cycle}</span>
        </div>
      </header>

      <section class="continuous-player-card" aria-live="polite">
        <p class="continuous-phase-label">
          ${
            paused
              ? "Paused. Resume restarts the five-second window."
              : answerVisible
                ? "Listen to the Japanese answer."
                : "Read this number aloud."
          }
        </p>
        <p class="continuous-answer-number">${session.currentValue}</p>
        ${
          !paused && !answerVisible
            ? `<p class="continuous-countdown">Time left: <strong class="continuous-reading-countdown-value">${(remaining / 1000).toFixed(1)} sec</strong></p>`
            : ""
        }
        ${
          answerVisible
            ? `
              ${state.settings.showKana ? `<p class="continuous-japanese-answer" lang="ja">${escapeHtml(reading.readingKana)}</p>` : ""}
              ${state.settings.showRomaji ? `<p class="answer-romaji">${escapeHtml(reading.romaji)}</p>` : ""}
            `
            : ""
        }
        <div class="continuous-controls">
          <button
            class="primary-action-button"
            type="button"
            data-action="${paused ? "resume-continuous-reading" : "pause-continuous-reading"}"
          >
            ${paused ? "Resume" : "Pause"}
          </button>
          <button
            class="secondary-button"
            type="button"
            data-action="skip-continuous-reading"
            ${paused ? "disabled" : ""}
          >
            Skip →
          </button>
        </div>
        <p class="continuous-note">
          Keyboard: press Right Arrow to skip. Skipped numbers receive no answer and are not recorded.
        </p>
        <p class="announcement" aria-live="polite">${escapeHtml(state.announcement ?? "")}</p>
        ${
          ttsSupported
            ? ""
            : '<p class="error-text">Japanese speech synthesis is required for Continuous Reading.</p>'
        }
      </section>
    </main>
  `;
}

export function renderSpecialNumberPage(state, { ttsSupported }) {
  const rows = SPECIAL_NUMBER_ROWS.map(
    (row) => `
      <tr>
        <th scope="row" data-label="Number">
          <span class="special-number-value">${row.number}</span>
          <button
            class="special-number-play"
            type="button"
            data-action="play-special-number"
            data-number-value="${row.number}"
            aria-label="Play the correct Japanese pronunciation for ${row.number}"
            ${ttsSupported ? "" : "disabled"}
          >
            <span aria-hidden="true">▶</span>
            Play
          </button>
        </th>
        <td data-label="Expected but wrong">
          <span class="special-number-wrong" lang="ja">${row.expectedWrong}</span>
        </td>
        <td data-label="Correct Japanese">
          <strong class="special-number-correct" lang="ja">${row.correctJapanese}</strong>
        </td>
        <td data-label="Romaji">
          <span class="special-number-romaji">${row.romaji}</span>
        </td>
        <td data-label="2 Examples">
          <ul class="special-number-examples">
            ${row.examples.map((example) => `<li lang="ja">${example}</li>`).join("")}
          </ul>
        </td>
      </tr>
    `,
  ).join("");

  return `
    <main class="screen special-number-screen" id="main-content" tabindex="-1">
      ${backButton("home", "Home")}
      <header class="special-number-heading">
        <p class="eyebrow">Number Training</p>
        <h1>Special Number</h1>
        <p>These are important special Japanese number pronunciations to memorize.</p>
      </header>
      <div class="special-number-table-wrap">
        <table class="special-number-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Expected but wrong</th>
              <th>Correct Japanese</th>
              <th>Romaji</th>
              <th>2 Examples</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="announcement" aria-live="polite">
        ${escapeHtml(state.announcement ?? "")}
      </p>
    </main>
  `;
}

export function renderNumberResults(state) {
  const session = state.numberSession;
  const total = session.tasks.length;
  const correct = session.correctCount;
  const percentage = Math.round((correct / total) * 100);
  const rangePerformance = getNumberTrainingRangePerformance(
    state.progress,
    session.modeId,
    session.rangeId,
  );

  return `
    <main class="result-screen" id="main-content" tabindex="-1">
      <p class="eyebrow">Number session complete</p>
      <h1>Good practice</h1>
      <div class="score-circle">
        <strong>${correct}/${total}</strong>
        <span>${percentage}%</span>
      </div>
      <div class="result-stats">
        <div><strong>${correct}</strong><span>Correct</span></div>
        <div><strong>${total - correct}</strong><span>Mistakes</span></div>
      </div>
      <p class="range-performance">
        This range: ${
          rangePerformance.percentage === null
            ? "No saved attempts"
            : `${rangePerformance.percentage}% across ${rangePerformance.attempts} attempts`
        }
      </p>
      <button
        class="primary-action-button"
        type="button"
        data-action="restart-number-session"
      >
        Practice this range again
      </button>
      <button
        class="secondary-button"
        type="button"
        data-action="finish-number-results"
      >
        Number Training home
      </button>
    </main>
  `;
}
