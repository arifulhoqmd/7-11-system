# Project Plan — Active V1 Direction

Status: **Phase 3B Dedicated Number Training is complete.**

Next stage: **Phase 3C — Number Training Refinement and Validation. This is not hot-food development.**

## Phase 0 — Repository and data safety

- [x] Place this repository under Git.
- [x] Keep the v2 master JSON unchanged as the baseline.
- [x] Confirm Codex reads `AGENTS.md`.
- [x] Confirm the project opens/runs locally from VS Code.
- [x] Create a Git checkpoint before implementation.

Exit condition: baseline files are protected and Codex understands the project rules.

## Phase 1 — Beginner-pool preparation

### 1A. V1 language scope

- [x] Use existing Japanese, Kana, Romaji, and English fields.
- [ ] Support Japanese -> English.
- [ ] Support English -> Japanese.
- [ ] Support Japanese -> Romaji.
- [ ] Support listening -> meaning/action.
- [x] Keep the current language scope to Japanese <-> English, with Romaji where useful.

### 1B. Beginner pool

- [x] Implement selection logic, not a duplicate dataset.
- [x] Broad eligible rule: priority 1 + beginner.
- [x] Starter Stage A: numbers 0-20 + key counters + priority-1 beginner register/hot-food/extra.
- [x] Define per-session sample size and weighting.
- [x] Ensure later content remains unlockable.

Exit condition: data layer is ready for the first quiz UI.

## Phase 2 — Application shell

- [x] Create mobile-first HTML/CSS/JS structure.
- [x] Load the master JSON.
- [x] Validate dataset load and show a friendly error if unavailable.
- [x] Add simple navigation/home screen.
- [x] Add practice-mode selection.
- [x] Add Japanese TTS helper using `speechSynthesis`.
- [x] Add localStorage progress module.

Exit condition: app loads on desktop and Android browser and can read data.

## Phase 3 — Highest-priority quiz modes

Implement in this order:

1. [x] Number listening
2. [x] Dynamic price/円 listening
3. [ ] Hot-food name listening
4. [ ] Hot-food + quantity
5. [ ] Customer phrase -> action
6. [ ] Situation -> staff response
7. [ ] Cigarette shelf number
8. [ ] Mistake review

Items 3–8 are paused while Phase 3C refines and validates Number Training. Hot-food and customer-interaction work must not resume until the number module is satisfactory and a later phase is approved.

Exit condition: all priority V1 modes work and persist learner results.

### Phase 3B — Dedicated Number Training

- [x] Number Training home with Listening and Speaking / Reading sections
- [x] Number Dictation with paper/self-mark flow
- [x] Configurable listening ranges through 300
- [x] Existing QZ005 multiple-choice access
- [x] Tobacco number + 番 listening
- [x] Explicit つ / 個 quantity listening
- [x] Tobacco number + quantity composition
- [x] Selected service/money amounts
- [x] Mixed number listening
- [x] Number Reading ranges through 1000
- [x] Reusable runtime Japanese number-reading engine
- [x] Explicit irregular hundreds/thousands
- [x] Number skill/mode/range progress and mistake tracking

The tobacco practice ranges are configurable training ranges, not a claim that 300 is a universal shelf maximum.

### Phase 3C — Number Training Refinement and Validation

- [ ] Validate the Listening versus Speaking / Reading structure.
- [ ] Simplify pure-number display.
- [ ] Remove unnecessary vocabulary-style information from number screens.
- [ ] Confirm range selection.
- [ ] Improve number progress reporting.
- [ ] Validate Android usability.
- [ ] Validate TTS pronunciation.
- [ ] Test realistic tobacco + quantity exercises.
- [ ] Prepare bill, price, and change speaking practice.

Exit condition: the dedicated number module is satisfactory, validated on Android, and ready for explicit approval of the next development phase.

## Phase 4 — Mixed practice

- [ ] Mixed realistic checkout mode
- [ ] Weighted topic selection
- [ ] Repetition bias for mistakes
- [ ] Session summary
- [ ] Basic progress view

Exit condition: learner can complete a short realistic mixed session.

## Phase 5 — Validation and Android usability

- [ ] Test Japanese characters.
- [ ] Test Unicode handling throughout the application.
- [ ] Test Romaji.
- [ ] Test touch targets on Android.
- [ ] Test portrait layout.
- [ ] Test TTS replay.
- [ ] Test TTS fallback.
- [ ] Test localStorage reset/export behavior.
- [ ] Test with no network if possible.
- [ ] Verify no quiz modifies the master dataset.

Exit condition: stable V1 prototype.

## Later, not blockers for V1

- product image references / visual hot-food quizzes;
- actual-store `store_active` values;
- verified microwave/oven modules;
- verified coffee-machine module;
- verified temperature/food-safety workflows;
- cleaning/stocking/waste modules;
- real-shift problem log;
- richer spaced-repetition logic;
- optional backend/cloud sync.

## Decision gates for Codex

Codex may proceed autonomously inside an approved phase, but must ask before:

- changing the master schema;
- replacing the baseline dataset;
- adding a framework/backend;
- adding cloud services;
- adding store-specific operational procedures that are not verified.
