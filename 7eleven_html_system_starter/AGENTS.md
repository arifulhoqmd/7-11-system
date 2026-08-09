# AGENTS.md — 7-Eleven Work Support Training System

## Mission

Build a practical training application for a beginner Japanese learner who works at 7-Eleven in Japan.

The goal is not JLPT study and not perfect Japanese.

The target learning loop is:

**hear -> understand -> act correctly -> respond simply**

The application must prioritize real work performance.

## Learner profile

The learner:

- can read Hiragana and Katakana;
- knows very few Kanji;
- has very beginner-level spoken/listening Japanese;
- for V1, studies Japanese <-> English, with Romaji where useful;
- Bengali support is deferred to a later phase;
- mainly uses Android;
- sometimes uses a Windows laptop.

Design for this learner. Avoid unnecessary grammar explanations, difficult Kanji, or academic language-learning patterns.

## Highest priorities

1. Numbers used at work:
   - prices / amounts;
   - change;
   - quantities;
   - cigarette/tobacco shelf numbers.
2. Hot/fried-food names and quantities.
3. Register/customer interaction.

## Teaching model

Prefer this sequence:

customer speech -> important listening keyword -> English/Romaji meaning -> required action -> simple staff response

Example:

ななチキ二つください

- product: ななチキ
- quantity: 二つ = 2
- request cue: ください
- action: Nanachiki x 2

Do not require perfect grammar when correct understanding/action is the real work objective.

## Source of truth

The current baseline content database is:

`data/7eleven_staff_training_master_dataset_v2_2026-08-09.json`

Treat it as the current master content dataset.

Verified baseline:

- 839 `master_items`
- 687 `P3_NUMBERS`
- 64 `P1_REJI`
- 26 `P2_HOT_FOOD`
- 62 `EXTRA`
- top-level sections: `metadata`, `master_items`, `hot_food_detail`, `number_detail`, `quiz_patterns`, `sources`
- 10 existing quiz patterns

Do not replace the master dataset with hard-coded HTML questions.

Do not silently change stable IDs.

Do not overwrite this v2 baseline file during exploratory work. If an approved content/schema upgrade is needed, create a new versioned master file and preserve v2.

## Existing `master_items` schema

The current records already contain:

- entry_id
- problem_area
- category
- subcategory
- entry_type
- speaker
- japanese
- reading_kana
- romaji
- english
- listen_keywords
- expected_action
- recommended_reply_japanese
- recommended_reply_romaji
- recommended_reply_english
- learning_priority
- difficulty
- quiz_modes
- tts_text
- number_value
- counter
- aliases
- store_active
- availability_scope
- volatility
- source_type
- source_url
- source_checked_date
- notes

Use the existing schema instead of inventing duplicate concepts.

## Language fields for V1

V1 should use the existing fields:

- `japanese`
- `reading_kana`
- `romaji`
- `english`

Primary learning directions for V1:

- Japanese -> English
- English -> Japanese
- Japanese -> Romaji
- listening -> meaning/action

Do not add Bengali fields in V1.

Bengali support is future work and should be added later through a reviewed schema/content upgrade if requested.

## Beginner pool

Never present all 839 items at once.

Use dataset-driven selection, not a second duplicate vocabulary database.

The broad V1 beginner/high-priority eligibility rule is:

`learning_priority == 1 && difficulty == "beginner"`

This currently selects 167 records:

- 115 P3_NUMBERS
- 31 P1_REJI
- 14 P2_HOT_FOOD
- 7 EXTRA

For the earliest starter stage, favor:

- cardinal numbers 0-20;
- priority-1 beginner `つ` quantity forms and counter rules;
- priority-1 beginner hot food;
- priority-1 beginner register/customer phrases;
- priority-1 beginner extra items such as essential payment/tobacco-number recognition.

Do not permanently exclude the remaining dataset. Unlock content progressively.

## Number rules

The dataset intentionally stores base numbers once.

Do NOT create a separate row for every number + 円.

Compose 円 dynamically in the quiz/application layer.

Preserve useful counter forms and rules, including:

- 一つ / hitotsu
- 二つ / futatsu
- 一個 / ikko
- 二個 / niko
- 一番 / ichiban
- 二番 / niban

The data already includes number/counter material. Reuse it.

## Quiz priorities for V1

Use the existing `quiz_patterns` as the starting specification.

Highest-priority V1 modes:

1. Number listening / recognition
2. Price listening using dynamic 円 composition
3. Hot-food name listening
4. Hot-food + quantity
5. Customer phrase -> correct action
6. Situation -> simple staff response
7. Cigarette shelf number + quantity
8. Mixed realistic checkout
9. Mistake review

For listening questions, do not reveal the answer before the learner responds.

## Audio

Prefer browser-native Japanese speech synthesis for V1 when available.

Use the dataset's `tts_text`.

Requirements:

- choose a Japanese voice (`ja-JP`) when available;
- allow replay;
- do not depend on a network-only audio service for the first local prototype;
- gracefully fall back to visible Japanese/Kana if speech synthesis is unavailable.

Do not use Romaji as Japanese TTS input.

## Progress and learner state

Progress is not content.

Never write these into the master vocabulary dataset:

- score
- attempts
- correct/incorrect counts
- mistake history
- last reviewed time
- mastery level
- streaks

For V1, store progress separately in browser `localStorage`.

Use `entry_id`/quiz pattern IDs as references so content and progress remain decoupled.

Design progress storage so it can later be migrated to a JSON file or backend/database.

## UI / device requirements

Mobile-first, especially Android.

Requirements:

- large touch targets;
- readable Japanese, English, and Romaji;
- minimal typing;
- responsive layout;
- fast quiz flow;
- clear audio replay control;
- no hover-only interactions;
- works on Windows browser too.

Do not build a desktop-only UI.

## Accuracy and safety

Never invent exact store procedures for:

- POS/register button sequences;
- microwave/oven operation;
- fryer operation;
- coffee machine maintenance;
- temperature limits;
- food-safety thresholds;
- cleaning procedures.

Distinguish:

1. general convenience-store knowledge;
2. official Seven-Eleven information;
3. Tokai/Aichi product information;
4. the learner's individual store procedure.

Confirmed store procedure takes priority.

If information is unverified for the actual store, label it as unverified rather than guessing.

Do not encourage secret photos/recordings of customers, employees, POS screens, internal manuals, or restricted areas.

## Hot-food data

The current `hot_food_detail` section has 26 Tokai items and contains useful fields such as:

- visual_clue
- confusable_with
- example_customer_order
- heard_keywords
- practice_aliases
- store_active

Reuse these fields for later visual/product-identification training.

`store_active` is currently not a reliable indication of the learner's actual store inventory unless confirmed.

## Development rules

- Keep content, application logic, and learner progress separate.
- Prefer plain HTML/CSS/JavaScript for the first local prototype unless a framework has a clear justified benefit.
- Do not hard-code hundreds of questions.
- Generate questions from the master data and quiz patterns.
- Preserve Unicode correctly for Japanese and future Bengali support.
- Keep functions/modules small and understandable.
- Test changes after implementation.
- Avoid unnecessary dependencies.
- Keep the app usable without a build pipeline if practical for V1.
- Use Git checkpoints before and after substantial work.
- Before a major architecture or dataset change, explain the reason and obtain approval.

## Documentation rules

Before major implementation work:

1. read this file;
2. read `docs/PROJECT_REQUIREMENTS.md`;
3. read `docs/PROJECT_PLAN.md`;
4. inspect the real master JSON instead of assuming its structure.

Update `docs/PROJECT_PLAN.md` when the implementation phase changes.

## Agent autonomy boundary

The agent may create/edit application files inside this project after the user approves the implementation plan.

The agent must stop and ask before:

- overwriting/removing the v2 master dataset;
- performing a bulk data migration;
- changing stable IDs;
- changing the agreed learning priorities;
- adding a backend/cloud dependency;
- adding an external paid service;
- implementing an unverified store-specific operating procedure.
