# ARCHIVED — INITIAL PROJECT SETUP PROMPT

> This file is historical documentation only. It is not the current Codex instruction.
> Read `docs/CURRENT_CODEX_DIRECTION.md` for the active approved direction.

## Original initial setup prompt

Paste this into the Codex panel in VS Code after opening this project folder.

---

Read `AGENTS.md`, `docs/PROJECT_REQUIREMENTS.md`, and `docs/PROJECT_PLAN.md`.

Then inspect the real file:

`data/7eleven_staff_training_master_dataset_v2_2026-08-09.json`

Do not modify any project files yet.

First verify the actual dataset structure, counts, important fields, number/counter strategy, hot-food detail structure, and existing quiz patterns.

Then propose a concrete V1 architecture for this local mobile-first 7-Eleven training system.

The architecture must preserve these decisions:

1. The master JSON is the content source of truth.
2. Do not duplicate every number with 円; generate 円 dynamically.
3. V1 language scope is Japanese <-> English, with Romaji where useful. Do not add Bengali fields in V1.
4. Do not expose all 839 items at once; use a beginner/high-priority selection layer.
5. Quiz scores, mistakes, and progress must remain separate from the master dataset.
6. V1 must prioritize numbers, hot-food + quantity, customer phrase -> action, staff response, cigarette shelf numbers, and mistake review.
7. The interface must be mobile-first for Android.
8. Do not invent store-specific POS, machine, cleaning, temperature, or food-safety procedures.

Please return:

- proposed file/folder structure;
- data-loading design;
- beginner-pool selection design;
- Japanese/English/Romaji display and quiz-direction design;
- quiz engine design;
- Japanese TTS approach;
- localStorage progress schema;
- mobile UI structure;
- test plan;
- implementation phases;
- any risks or questions that truly block implementation.

Do not start coding until I approve the architecture.
