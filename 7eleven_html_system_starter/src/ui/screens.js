import { getCurrentQuestion } from "../quiz/session-engine.js";

export const PRACTICE_MODES = Object.freeze([
  {
    id: "numbers",
    patternId: "QZ005",
    icon: "123",
    title: "Numbers",
    description: "Hear and recognize work numbers",
  },
  {
    id: "prices",
    patternId: "QZ006",
    icon: "¥",
    title: "Prices",
    description: "Practice dynamically composed yen amounts",
  },
  {
    id: "hot-food",
    patternId: null,
    icon: "食",
    title: "Hot Food",
    description: "Product names and quantities",
  },
  {
    id: "customer-requests",
    patternId: null,
    icon: "客",
    title: "Customer Requests",
    description: "Listen and choose the required action",
  },
  {
    id: "staff-responses",
    patternId: null,
    icon: "返",
    title: "Staff Responses",
    description: "Choose a short safe reply",
  },
  {
    id: "cigarette-numbers",
    patternId: null,
    icon: "#",
    title: "Cigarette Numbers",
    description: "Shelf numbers and quantities",
  },
  {
    id: "mixed",
    patternId: null,
    icon: "組",
    title: "Mixed Practice",
    description: "Short realistic checkout combinations",
  },
  {
    id: "mistakes",
    patternId: null,
    icon: "復",
    title: "Mistake Review",
    description: "Revisit questions answered incorrectly",
  },
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLoading() {
  return `
    <main class="status-screen" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <h1>Loading training data…</h1>
      <p>Checking the local master dataset.</p>
    </main>
  `;
}

function renderError(error) {
  return `
    <main class="status-screen" aria-labelledby="error-title">
      <div class="error-mark" aria-hidden="true">!</div>
      <h1 id="error-title">Training data could not load</h1>
      <p>
        Run this folder through VS Code Live Server or another local HTTP
        server, then try again.
      </p>
      <p class="muted">${escapeHtml(error?.message ?? "Unknown data error.")}</p>
      <button class="secondary-button" type="button" data-action="retry-load">
        Try again
      </button>
    </main>
  `;
}

function renderHome(state, stageCount) {
  const { settings, dataset } = state;
  return `
    <main class="screen" id="main-content" tabindex="-1">
      <header class="screen-heading">
        <p class="eyebrow">7-Eleven work support</p>
        <h1>Ready for a short practice?</h1>
        <p class="lede">Hear → understand → act correctly → respond simply.</p>
      </header>

      <section class="card hero-card" aria-labelledby="today-plan">
        <h2 id="today-plan">Current learning plan</h2>
        <p class="muted">Your choices are saved only in this browser.</p>
        <div class="plan-stats">
          <div class="stat">
            <strong>Stage ${escapeHtml(settings.stage)}</strong>
            <span>${stageCount} available records</span>
          </div>
          <div class="stat">
            <strong>${settings.sessionSize}</strong>
            <span>questions per session</span>
          </div>
        </div>
        <button
          class="primary-button"
          type="button"
          data-action="navigate"
          data-route="practice"
        >
          Choose practice mode
        </button>
      </section>

      <section class="card tip-card" aria-label="Dataset status">
        <div class="tip-icon" aria-hidden="true">✓</div>
        <div>
          <h2>Training data is ready</h2>
          <p class="muted">
            ${dataset.masterItems.length} source records loaded. Only your
            selected beginner stage is shown for practice.
          </p>
        </div>
      </section>
    </main>
  `;
}

function renderPractice(state) {
  const selectedMode = PRACTICE_MODES.find(
    (mode) => mode.id === state.selectedMode,
  );
  const modeButtons = PRACTICE_MODES.map(
    (mode) => `
      <button
        class="mode-card"
        type="button"
        data-action="select-mode"
        data-mode="${mode.id}"
        aria-pressed="${mode.id === state.selectedMode}"
      >
        <span class="mode-icon" aria-hidden="true">${mode.icon}</span>
        <span class="mode-copy">
          <strong>${escapeHtml(mode.title)}</strong>
          <small>${escapeHtml(mode.description)}</small>
          <span class="mode-status">
            ${mode.patternId ? "Ready" : "Later phase"}
          </span>
        </span>
        <span class="mode-arrow" aria-hidden="true">›</span>
      </button>
    `,
  ).join("");

  const selection = selectedMode
    ? selectedMode.patternId
      ? `
      <section class="selection-summary" aria-live="polite">
        <h2>${escapeHtml(selectedMode.title)} selected</h2>
        <p>${escapeHtml(selectedMode.description)}.</p>
        <button
          class="secondary-button"
          type="button"
          data-action="start-quiz"
        >
          Start ${state.settings.sessionSize}-question session
        </button>
      </section>
    `
      : `
        <section class="selection-summary" aria-live="polite">
          <h2>${escapeHtml(selectedMode.title)}</h2>
          <div class="phase-note">
            This mode is intentionally not implemented in Phase 3A.
          </div>
        </section>
      `
    : "";

  return `
    <main class="screen" id="main-content" tabindex="-1">
      <header class="screen-heading">
        <p class="eyebrow">Practice</p>
        <h1>Choose a focus</h1>
        <p class="lede">
          Stage ${escapeHtml(state.settings.stage)} ·
          ${state.settings.sessionSize} questions
        </p>
      </header>
      <div class="mode-grid" aria-label="Practice modes">
        ${modeButtons}
      </div>
      ${selection}
    </main>
  `;
}

function renderChoiceButtons({
  values,
  currentValue,
  setting,
  formatter = String,
  extraClass = "",
}) {
  return values
    .map(
      (value) => `
        <button
          class="choice-button"
          type="button"
          data-action="update-setting"
          data-setting="${setting}"
          data-value="${value}"
          aria-pressed="${value === currentValue}"
        >
          ${escapeHtml(formatter(value))}
        </button>
      `,
    )
    .join("");
}

function renderSettings(state, { ttsSupported, sampleRecord }) {
  const settings = state.settings;
  const stageButtons = renderChoiceButtons({
    values: ["A", "B"],
    currentValue: settings.stage,
    setting: "stage",
    formatter: (stage) => `Stage ${stage}`,
  });
  const sessionButtons = renderChoiceButtons({
    values: [5, 10, 15, 20],
    currentValue: settings.sessionSize,
    setting: "sessionSize",
  });
  const rateButtons = renderChoiceButtons({
    values: [0.75, 0.9, 1],
    currentValue: settings.ttsRate,
    setting: "ttsRate",
    formatter: (rate) =>
      rate === 0.75 ? "Slow" : rate === 0.9 ? "Learning" : "Normal",
  });

  return `
    <main class="screen" id="main-content" tabindex="-1">
      <header class="screen-heading">
        <p class="eyebrow">Settings</p>
        <h1>Make practice comfortable</h1>
        <p class="lede">Changes are saved automatically in this browser.</p>
      </header>

      <div class="settings-list">
        <section class="setting-group" aria-labelledby="stage-setting">
          <h2 id="stage-setting">Learning stage</h2>
          <p>Stage A starts small. Stage B includes the full beginner pool.</p>
          <div class="choice-grid" role="group" aria-label="Learning stage">
            ${stageButtons}
          </div>
        </section>

        <section class="setting-group" aria-labelledby="size-setting">
          <h2 id="size-setting">Session size</h2>
          <p>Choose how many questions a future session will contain.</p>
          <div class="choice-grid four" role="group" aria-label="Session size">
            ${sessionButtons}
          </div>
        </section>

        <section class="setting-group" aria-labelledby="reading-setting">
          <h2 id="reading-setting">Reading help</h2>
          <p>These helpers appear after answers in listening practice.</p>
          <label class="toggle-row">
            <span class="toggle-label">
              <strong>Show Kana</strong>
              <small>Display the Japanese reading</small>
            </span>
            <span class="switch">
              <input
                type="checkbox"
                data-action="toggle-setting"
                data-setting="showKana"
                ${settings.showKana ? "checked" : ""}
              >
              <span class="switch-track" aria-hidden="true"></span>
            </span>
          </label>
          <label class="toggle-row">
            <span class="toggle-label">
              <strong>Show Romaji</strong>
              <small>Display supporting Latin-script reading</small>
            </span>
            <span class="switch">
              <input
                type="checkbox"
                data-action="toggle-setting"
                data-setting="showRomaji"
                ${settings.showRomaji ? "checked" : ""}
              >
              <span class="switch-track" aria-hidden="true"></span>
            </span>
          </label>
        </section>

        <section class="setting-group" aria-labelledby="audio-setting">
          <h2 id="audio-setting">Japanese audio speed</h2>
          <p>Speech uses the dataset’s Japanese TTS text, never Romaji.</p>
          <div class="choice-grid" role="group" aria-label="TTS rate">
            ${rateButtons}
          </div>
          <div class="language-preview">
            <p class="preview-japanese" lang="ja">
              ${escapeHtml(sampleRecord.japanese)}
            </p>
            ${
              settings.showKana
                ? `<p lang="ja">${escapeHtml(sampleRecord.reading_kana)}</p>`
                : ""
            }
            ${
              settings.showRomaji
                ? `<p>${escapeHtml(sampleRecord.romaji)}</p>`
                : ""
            }
            <p>${escapeHtml(sampleRecord.english)}</p>
          </div>
          <div class="audio-row">
            <button
              class="secondary-button"
              type="button"
              data-action="test-tts"
              ${ttsSupported ? "" : "disabled"}
            >
              Play Japanese sample
            </button>
            <span class="muted">
              ${ttsSupported ? "Uses an available ja-JP voice." : "Speech synthesis is unavailable."}
            </span>
          </div>
          <p class="announcement" aria-live="polite">
            ${escapeHtml(state.announcement ?? "")}
          </p>
        </section>
      </div>
    </main>
  `;
}

function renderQuiz(state, { ttsSupported }) {
  const session = state.quizSession;
  const question = getCurrentQuestion(session);
  const result = session.currentResult;
  const answered = result !== null;
  const position = session.currentIndex + 1;
  const total = session.questions.length;
  const progressPercent = Math.round((position / total) * 100);

  const choices = question.choices
    .map((choice) => {
      let answerClass = "";
      if (answered && choice.key === question.correctChoiceKey) {
        answerClass = " correct";
      } else if (
        answered &&
        choice.key === result.choiceKey &&
        !result.correct
      ) {
        answerClass = " incorrect";
      }

      return `
        <button
          class="answer-choice${answerClass}"
          type="button"
          data-action="answer-question"
          data-choice-key="${escapeHtml(choice.key)}"
          ${answered ? "disabled" : ""}
        >
          ${escapeHtml(choice.label)}
        </button>
      `;
    })
    .join("");

  const feedback = answered
    ? `
      <section
        class="feedback-card ${result.correct ? "is-correct" : "is-incorrect"}"
        aria-live="polite"
        tabindex="-1"
      >
        <p class="feedback-label">
          ${result.correct ? "Correct" : "Not quite"}
        </p>
        <p class="answer-japanese" lang="ja">
          ${escapeHtml(question.reveal.japanese)}
        </p>
        ${
          state.settings.showKana
            ? `<p class="answer-kana" lang="ja">${escapeHtml(question.reveal.readingKana)}</p>`
            : ""
        }
        ${
          state.settings.showRomaji
            ? `<p class="answer-romaji">${escapeHtml(question.reveal.romaji)}</p>`
            : ""
        }
        <p class="answer-english">${escapeHtml(question.reveal.english)}</p>
        <button
          class="primary-action-button"
          type="button"
          data-action="next-question"
        >
          ${position === total ? "See results" : "Next question"}
        </button>
      </section>
    `
    : "";

  return `
    <main class="quiz-screen" id="main-content" tabindex="-1">
      <header class="quiz-header">
        <button
          class="text-button"
          type="button"
          data-action="exit-quiz"
          aria-label="Exit this quiz session"
        >
          Exit
        </button>
        <div class="quiz-position">
          <strong>Question ${position} of ${total}</strong>
          <span>${escapeHtml(question.patternName)}</span>
        </div>
      </header>

      <div
        class="progress-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="${total}"
        aria-valuenow="${position}"
        aria-label="Session progress"
      >
        <span style="width: ${progressPercent}%"></span>
      </div>

      <section class="question-card" aria-labelledby="question-instruction">
        <p class="listening-label">
          ${ttsSupported ? "Listening" : "Reading fallback"}
        </p>
        <h1 id="question-instruction">${escapeHtml(question.instruction)}</h1>
        ${
          ttsSupported
            ? `
              <p class="listening-privacy">
                Japanese text stays hidden until you answer.
              </p>
              <button
                class="audio-button"
                type="button"
                data-action="play-question-audio"
              >
                <span aria-hidden="true">▶</span>
                ${answered ? "Replay audio" : "Play audio"}
              </button>
            `
            : `
              <p class="listening-privacy">
                Japanese audio is unavailable, so this question uses text.
              </p>
              <p class="fallback-reading" lang="ja">
                ${escapeHtml(question.reveal.readingKana)}
              </p>
            `
        }
        <p class="announcement" aria-live="polite">
          ${escapeHtml(state.announcement ?? "")}
        </p>
      </section>

      <section class="answer-grid" aria-label="Answer choices">
        ${choices}
      </section>
      ${feedback}
    </main>
  `;
}

function renderResults(state) {
  const session = state.quizSession;
  const total = session.questions.length;
  const correct = session.correctCount;
  const percentage = Math.round((correct / total) * 100);

  return `
    <main class="result-screen" id="main-content" tabindex="-1">
      <p class="eyebrow">Session complete</p>
      <h1>Good work</h1>
      <div class="score-circle" aria-label="${correct} correct out of ${total}">
        <strong>${correct}/${total}</strong>
        <span>${percentage}%</span>
      </div>
      <div class="result-stats">
        <div>
          <strong>${correct}</strong>
          <span>Correct</span>
        </div>
        <div>
          <strong>${total - correct}</strong>
          <span>Review</span>
        </div>
      </div>
      <button
        class="primary-action-button"
        type="button"
        data-action="restart-quiz"
      >
        Practice this mode again
      </button>
      <button
        class="secondary-button"
        type="button"
        data-action="finish-results"
      >
        Choose another mode
      </button>
    </main>
  `;
}

function renderBottomNavigation(route) {
  const items = [
    ["home", "⌂", "Home"],
    ["practice", "▶", "Practice"],
    ["settings", "⚙", "Settings"],
  ];

  return `
    <nav class="bottom-nav" aria-label="Main navigation">
      ${items
        .map(
          ([itemRoute, symbol, label]) => `
            <button
              class="nav-button"
              type="button"
              data-action="navigate"
              data-route="${itemRoute}"
              ${route === itemRoute ? 'aria-current="page"' : ""}
            >
              <span class="nav-symbol" aria-hidden="true">${symbol}</span>
              ${label}
            </button>
          `,
        )
        .join("")}
    </nav>
  `;
}

export function renderApp(
  state,
  { stageCount = 0, ttsSupported = false, sampleRecord = {} } = {},
) {
  if (state.status === "loading") {
    return renderLoading();
  }
  if (state.status === "error") {
    return renderError(state.error);
  }

  let screen;
  if (state.route === "quiz") {
    screen = renderQuiz(state, { ttsSupported });
  } else if (state.route === "results") {
    screen = renderResults(state);
  } else if (state.route === "practice") {
    screen = renderPractice(state);
  } else if (state.route === "settings") {
    screen = renderSettings(state, { ttsSupported, sampleRecord });
  } else {
    screen = renderHome(state, stageCount);
  }

  return `
    <div class="app-frame">
      ${screen}
      ${
        ["home", "practice", "settings"].includes(state.route)
          ? renderBottomNavigation(state.route)
          : ""
      }
    </div>
  `;
}
