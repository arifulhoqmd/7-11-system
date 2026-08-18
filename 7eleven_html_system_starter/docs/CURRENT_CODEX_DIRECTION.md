# Current Codex Direction

This document is the active approved direction for continued development. It supersedes priorities or future-language suggestions in older prompts and planning notes.

## Current status and next phase

- Phase 3C Number Training Refinement and Validation is complete.
- No further development phase is currently approved.
- Hot-food and customer-interaction quiz work remains paused until Number Training is satisfactory and a later phase is explicitly approved.

## Language scope

The supported learning directions are:

- Japanese -> English
- English -> Japanese
- Japanese -> Romaji, where useful

Bengali is not required for the current product or its future roadmap.

## Data and progress boundaries

- Keep `data/7eleven_staff_training_master_dataset_v2_2026-08-09.json` unchanged and use it as the content source of truth.
- Use the existing stored number readings as reference and validation data.
- Generate additional pure-number practice objects at runtime; do not add thousands of full records to the master dataset.
- Keep generated practice objects read-only and keep scores, mistakes, settings, and progress in the separate progress store.
- Use stored Japanese or `tts_text` for dataset-backed speech. Runtime-generated numbers must use the validated Japanese number-reading engine, never Romaji, for TTS.

## Pure-number model

A generated pure number needs only:

- numeric value;
- Japanese reading;
- Romaji;
- Japanese TTS text.

The number itself is the meaning. Pure-number screens should not show vocabulary-style English meanings, explanations, images, listening keywords, expected actions, product information, or notes.

## Number contexts

Keep pure-number generation separate from composition for work contexts:

- shelf number with `番`;
- price or money amount with `円`;
- quantity with `個` or `つ`;
- tobacco number plus quantity;
- selected service or money amount.

Context helpers must account explicitly for irregular readings and must be covered by automated tests. Do not create repetitive master records for generated combinations.

## Listening order

Refine and validate listening practice in this order:

1. Number Dictation from 1–300 — the highest priority.
2. Tobacco shelf-number listening with a configurable range up to 300. This is a training range, not a universal shelf maximum.
3. Quantity listening.
4. Tobacco number plus quantity listening.
5. Selected service and money amounts.
6. Mixed number listening.

Listening questions must continue to hide Japanese, Kana, and Romaji until the learner answers or self-marks.

## Speaking and reading order

Start with general number reading, then prepare category practice for:

1. total bill;
2. product price;
3. change.

Master the 1–1,000 range before progressing toward 10,000. Preserve useful selectable ranges such as 1–10, 1–20, 1–50, 1–100, 101–200, 201–300, 301–500, 501–1,000, and custom ranges within the validated limit. Later progression may add 1,001–1,500 and subsequent ranges toward 10,000 after the earlier ranges are satisfactory.

## Completed Phase 3C work

Phase 3C:

- validate the Listening versus Speaking / Reading structure;
- simplify pure-number display;
- remove unnecessary vocabulary-style information from number screens;
- confirm range selection;
- improve number progress reporting;
- validate Android usability;
- validate TTS pronunciation;
- test realistic tobacco plus quantity exercises;
- prepare bill, price, and change speaking practice.

Continue to preserve Android-first responsive design, touch targets of at least 48px, no required typing, plain HTML/CSS/JavaScript, no backend, and no unverified store-specific procedures.

## Instruction for the next Codex session

Read `AGENTS.md`, this document, `docs/PROJECT_REQUIREMENTS.md`, and `docs/PROJECT_PLAN.md` before making changes. Inspect the existing implementation and tests. Work only inside the explicitly approved phase, do not modify the master JSON, and do not resume hot-food or customer-interaction development without approval.
