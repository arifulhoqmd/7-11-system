import {
  NUMBER_READING_CATEGORIES,
  NUMBER_TRAINING_MODES,
  getNumberTrainingMode,
} from "../number-training/number-training-config.js";
import { getCurrentNumberTask } from "../number-training/self-mark-session.js";

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
      ‹ ${label}
    </button>
  `;
}

function modeButton(mode) {
  return `
    <button
      class="number-mode-card"
      type="button"
      data-action="choose-number-mode"
      data-number-mode="${mode.id}"
    >
      <span>
        <strong>${escapeHtml(mode.title)}</strong>
        ${
          mode.highestPriority
            ? '<span class="priority-badge">Highest priority</span>'
            : ""
        }
      </span>
      <small>${escapeHtml(mode.description)}</small>
      <span class="mode-arrow" aria-hidden="true">›</span>
    </button>
  `;
}

export function renderNumberTrainingHome(state) {
  const listeningModes = NUMBER_TRAINING_MODES.filter(
    (mode) => mode.section === "listening",
  );
  const readingMode = getNumberTrainingMode("number-reading");

  return `
    <main class="screen number-training-home" id="main-content" tabindex="-1">
      ${backButton("practice", "Practice")}
      <header class="screen-heading">
        <p class="eyebrow">Dedicated module</p>
        <h1>Number Training</h1>
        <p class="lede">
          Focus on hearing numbers first, then practice saying them aloud.
        </p>
      </header>

      <section class="number-section" aria-labelledby="listening-section">
        <div class="section-title-row">
          <span class="section-number" aria-hidden="true">A</span>
          <div>
            <h2 id="listening-section">Listening</h2>
            <p>Play Japanese audio and identify the number.</p>
          </div>
        </div>
        <div class="number-mode-list">
          ${listeningModes.map(modeButton).join("")}
        </div>
      </section>

      <section class="number-section" aria-labelledby="reading-section">
        <div class="section-title-row">
          <span class="section-number orange" aria-hidden="true">B</span>
          <div>
            <h2 id="reading-section">Speaking / Reading</h2>
            <p>See digits, say the reading, then hear the answer.</p>
          </div>
        </div>
        <div class="number-mode-list">
          ${modeButton(readingMode)}
          ${NUMBER_READING_CATEGORIES.filter(
            (category) => !category.implemented,
          )
            .map(
              (category) => `
                <div class="future-category">
                  <strong>${escapeHtml(category.label)}</strong>
                  <span>Prepared for a later phase</span>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    </main>
  `;
}

export function renderNumberSetup(state) {
  const mode = getNumberTrainingMode(state.numberModeId);
  const rangeButtons = mode.ranges
    .map(
      (range) => `
        <button
          class="range-button"
          type="button"
          data-action="select-number-range"
          data-range-id="${range.id}"
          aria-pressed="${range.id === state.numberRangeId}"
        >
          ${escapeHtml(range.label)}
        </button>
      `,
    )
    .join("");

  return `
    <main class="screen" id="main-content" tabindex="-1">
      ${backButton("number-training", "Number Training")}
      <header class="screen-heading">
        <p class="eyebrow">${mode.section === "reading" ? "Speaking / Reading" : "Listening"}</p>
        <h1>${escapeHtml(mode.title)}</h1>
        <p class="lede">${escapeHtml(mode.description)}</p>
      </header>

      <section class="setting-group">
        <h2>Choose a range</h2>
        <p>Current session size: ${state.settings.sessionSize} tasks.</p>
        <div class="range-grid" role="group" aria-label="Number range">
          ${rangeButtons}
        </div>
      </section>

      <button
        class="primary-action-button"
        type="button"
        data-action="start-number-session"
        ${state.numberRangeId ? "" : "disabled"}
      >
        Start session
      </button>
      <p class="announcement" aria-live="polite">
        ${escapeHtml(state.announcement ?? "")}
      </p>
    </main>
  `;
}

export function renderNumberTask(state, { ttsSupported }) {
  const session = state.numberSession;
  const task = getCurrentNumberTask(session);
  const mode = getNumberTrainingMode(session.modeId);
  const revealed = session.phase === "revealed" || session.phase === "marked";
  const marked = session.phase === "marked";
  const position = session.currentIndex + 1;
  const total = session.tasks.length;
  const progressPercent = Math.round((position / total) * 100);

  const prompt =
    task.promptType === "speaking"
      ? `
        <p class="task-instruction">Say this number aloud.</p>
        <p class="speaking-number">${task.promptNumber}</p>
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
          ${ttsSupported ? "" : "disabled"}
        >
          <span aria-hidden="true">▶</span>
          Play
        </button>
        <button
          class="secondary-button show-answer-button"
          type="button"
          data-action="reveal-number-answer"
        >
          Show Answer
        </button>
        ${
          ttsSupported
            ? ""
            : '<p class="muted">Japanese speech synthesis is unavailable on this device.</p>'
        }
      `;

  const reveal = revealed
    ? `
      <section class="number-answer-card" aria-live="polite" tabindex="-1">
        <p class="numeric-answer">${escapeHtml(task.reveal.numericAnswer)}</p>
        <p class="answer-japanese" lang="ja">
          ${escapeHtml(task.reveal.japanese)}
        </p>
        ${
          state.settings.showKana
            ? `<p class="answer-kana" lang="ja">${escapeHtml(task.reveal.readingKana)}</p>`
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
          <strong>${session.currentResult.correct ? "Marked correct" : "Added to mistakes"}</strong>
          <button
            class="primary-action-button"
            type="button"
            data-action="next-number-task"
          >
            ${position === total ? "See results" : "Next task"}
          </button>
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
          class="text-button"
          type="button"
          data-action="exit-number-session"
        >
          Exit
        </button>
        <div class="quiz-position">
          <strong>Task ${position} of ${total}</strong>
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

export function renderNumberResults(state) {
  const session = state.numberSession;
  const total = session.tasks.length;
  const correct = session.correctCount;
  const percentage = Math.round((correct / total) * 100);

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
