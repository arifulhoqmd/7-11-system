# 7-Eleven HTML Training System

This repository contains the verified data layer, the mobile-first application shell, and the Phase 3A number/price listening quizzes. Hot-food and customer-interaction quizzes are not implemented yet.

## Included

- `AGENTS.md` — permanent instructions for Codex/agents
- `docs/PROJECT_REQUIREMENTS.md` — project requirements
- `docs/PROJECT_PLAN.md` — staged implementation plan
- `docs/START_CODEX_PROMPT.md` — first prompt to paste into Codex
- `data/7eleven_staff_training_master_dataset_v2_2026-08-09.json` — unchanged uploaded baseline
- `index.html` and `assets/app.css` — mobile-first application shell
- `src/data/` — validation, normalization, joins, selectors, and counter composition
- `src/audio/` — browser-native Japanese TTS
- `src/quiz/` — QZ005/QZ006 question generation and session state
- `src/progress/` — versioned localStorage progress/settings
- `src/state/` and `src/ui/` — navigation, state, and Phase 2 screens
- `tests/` — automated data and application-shell tests
- `.gitignore`

## V1 language scope

V1 uses **Japanese <-> English**, with **Romaji where useful**. Bengali support is intentionally deferred to a later phase.

## Dataset integrity

Baseline SHA-256:

`dff14cb46511a6c577edb25599ba9d4f677dabddc0625a11c2f341dc65f657d0`

The dataset copy in this starter pack was copied byte-for-byte from the uploaded JSON.

## Run locally in VS Code

The JSON dataset is loaded with `fetch`, so do not open `index.html` directly with a `file://` URL.

### VS Code Live Server

1. Open this repository folder in VS Code.
2. Install the **Live Server** extension if needed.
3. Right-click `index.html` and choose **Open with Live Server**.

### Python local server

From the repository folder:

```powershell
python -m http.server 8000
```

Then open:

`http://localhost:8000/`

An Android phone on the same local network can use the computer's local IP address and port 8000. This is a static file server, not an application backend.

## Run tests

```powershell
npm test
```

## Implemented quiz modes

- QZ005 — number listening from the selected Stage A or Stage B cardinal pool;
- QZ006 — price listening composed at runtime from the same cardinal records plus the 円 rule.

Both modes use four numeric choices, save results to localStorage, and reveal Japanese/Kana/Romaji only after answering when audio is available.

## Important

Do not overwrite the v2 master JSON. Learner settings and future quiz progress stay in browser localStorage.
