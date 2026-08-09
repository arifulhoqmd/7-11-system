# 7-Eleven HTML Training System — Starter Repository

This starter pack contains **project instructions and the verified master dataset only**. It intentionally does not contain the HTML quiz implementation yet.

## Included

- `AGENTS.md` — permanent instructions for Codex/agents
- `docs/PROJECT_REQUIREMENTS.md` — project requirements
- `docs/PROJECT_PLAN.md` — staged implementation plan
- `docs/START_CODEX_PROMPT.md` — first prompt to paste into Codex
- `data/7eleven_staff_training_master_dataset_v2_2026-08-09.json` — unchanged uploaded baseline
- `.gitignore`

## V1 language scope

V1 uses **Japanese <-> English**, with **Romaji where useful**. Bengali support is intentionally deferred to a later phase.

## Dataset integrity

Baseline SHA-256:

`dff14cb46511a6c577edb25599ba9d4f677dabddc0625a11c2f341dc65f657d0`

The dataset copy in this starter pack was copied byte-for-byte from the uploaded JSON.

## Recommended VS Code steps

1. Extract/copy this folder to your Windows project location.
2. Open the folder in VS Code.
3. Use the **Codex** panel, not the GitHub Copilot sign-in, for OpenAI Codex work.
4. Initialize Git:
   - `git init`
   - `git add .`
   - `git commit -m "Initial 7-Eleven training baseline"`
5. Open `docs/START_CODEX_PROMPT.md`.
6. Paste that prompt into Codex.
7. Review Codex's architecture proposal before allowing it to write the application.

## Important

Do not let an agent overwrite the v2 master JSON during the first architecture/design pass.
