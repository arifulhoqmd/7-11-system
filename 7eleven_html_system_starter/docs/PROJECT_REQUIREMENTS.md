# Project Requirements — 7-Eleven Work Support

## 1. Purpose

This project supports a beginner Japanese learner performing normal 7-Eleven work in Japan.

The success criterion is:

**hear -> understand -> act correctly -> respond simply**

The system is practical work support, not a general Japanese course.

The HTML training application is one tool inside the wider project.

## 2. Learner

The learner:

- reads Hiragana and Katakana;
- knows very few Kanji;
- has beginner-level listening and speaking;
- for V1, uses Japanese <-> English, with Romaji where useful;
- mainly uses Android;
- sometimes uses Windows.

Therefore the interface must emphasize listening, keywords, actions, short replies, and mobile usability.

## 3. Current biggest difficulties

### Current highest priority — numbers

Focus on:

- listening and dictation mastery from 1 through 300;
- speaking/reading mastery from 1 through 1000, then expansion toward 10,000+;
- amounts;
- prices;
- change;
- quantities;
- cigarette/tobacco shelf numbers.

Number Training remains the current development priority until the dedicated module is satisfactory.

### Paused — hot/fried food

Focus on:

- official/current product name;
- reading;
- Romaji;
- important sound/keyword;
- quantity;
- visual clue;
- similar/confusable product;
- expected staff action.

The hot-food dataset remains valid, but further hot-food feature development is paused.

### Paused — register/customer language

Focus on practical requests such as:

- bag;
- heating;
- chopsticks/spoon/fork;
- receipt;
- payment;
- cigarettes;
- coffee;
- quantities;
- product location;
- requests/questions.

Customer-interaction quiz development is paused. Hot-food and customer-interaction work may resume only after Number Training refinement and validation.

## 4. Current dataset baseline

File:

`data/7eleven_staff_training_master_dataset_v2_2026-08-09.json`

Verified file structure:

- `metadata`
- `master_items`
- `hot_food_detail`
- `number_detail`
- `quiz_patterns`
- `sources`

Verified counts:

| Area | Count |
|---|---:|
| P3_NUMBERS | 687 |
| P1_REJI | 64 |
| P2_HOT_FOOD | 26 |
| EXTRA | 62 |
| Total master_items | 839 |

Relevant category counts include:

- 653 base `Number` records;
- 34 `Number counter` records;
- 33 `Customer phrase` records;
- 26 `Hot food` records;
- 20 `Register vocabulary` records;
- 19 `Register phrase` records;
- 19 `Payment` records;
- 14 `Store service` records;
- 8 `Age-restricted sales` records;
- 8 `Seven Cafe` records.

The dataset already contains 10 quiz patterns, including:

- customer phrase -> action;
- situation -> staff response;
- hot-food name listening;
- hot-food + quantity;
- number listening;
- price listening;
- cigarette shelf number;
- mixed real checkout;
- fast request keywords;
- store service keyword.

## 5. Dataset design decisions that must be preserved

### Numbers

Pure numbers are simpler than vocabulary records. For a number such as `234`, the runtime training object only needs:

- numeric value: `234`;
- Japanese reading: `にひゃくさんじゅうよん`;
- Romaji: `nihyaku sanjuu yon`;
- Japanese TTS text: `にひゃくさんじゅうよん`.

The numeric value itself is the meaning. A generated pure number does not require English meaning, explanation, image, listening keyword, expected action, product information, or notes.

Do not create thousands of full vocabulary-style master records. Continue using the runtime Japanese number-reading engine. Existing stored number readings remain usable as validation/reference data.

Generated practice numbers are runtime-derived data and must never be written into the master JSON.

### Number contexts

Keep pure number generation separate from work-context composition. Contexts may add:

- `番`;
- `円`;
- `個`;
- `つ`;
- tobacco number + quantity;
- selected customer-service/money amount.

Counter pronunciation differences and irregular forms must remain explicit and tested. Do not generate repetitive per-value price or shelf-number records.

### Hot food

Keep the Tokai dataset as the current regional baseline.

Individual store availability is not automatically known.

Product data can change, so respect `source_checked_date`, `volatility`, and `store_active`.

### IDs

Use existing IDs as stable content keys.

Learner progress should reference IDs, not duplicate content.

## 6. Language scope for V1

V1 should use the existing language fields already present in the master dataset:

- Japanese
- Kana
- Romaji
- English

Primary practice directions:

- Japanese -> English
- English -> Japanese
- Japanese -> Romaji where useful

## 7. Beginner-content strategy

Do not expose all 839 records.

### Broad V1 eligible pool

Initial rule:

`learning_priority == 1 && difficulty == "beginner"`

Current result: 167 entries.

Breakdown:

| Area | Eligible |
|---|---:|
| P3_NUMBERS | 115 |
| P1_REJI | 31 |
| P2_HOT_FOOD | 14 |
| EXTRA | 7 |

This is an eligible pool, not a single quiz session.

### Starter Stage A

Use a smaller practical starting layer:

- numbers 0-20;
- priority-1 beginner つ quantity forms;
- core counter rules;
- priority-1 beginner hot-food items;
- priority-1 beginner register/customer items;
- essential priority-1 beginner extra items.

Each session should draw a manageable number of questions rather than loading every eligible item at once.

Suggested default session size: 10 questions, configurable later.

During the current development stage, dedicated Number Training takes priority over the earlier mixed-practice weighting. Hot-food and customer-interaction weighting will be revisited only when those modules resume.

## 8. Core training behavior

The learner should practice:

### Number listening — highest-priority number skill

Organize listening practice in this order:

1. Basic Number Dictation
   - master 1-300;
   - audio only initially;
   - learner writes the numeric answer on paper;
   - Show Answer;
   - Correct / Wrong self-marking.
2. Tobacco Number Listening
   - compose with `番`;
   - use a configurable training range, currently through 300;
   - do not claim 300 is a universal Seven-Eleven shelf maximum.
3. Quantity Listening
   - explicit `ひとつ / ふたつ / ...`;
   - explicit `一個 / 二個 / ...`.
4. Tobacco Number + Quantity
   - example: `128番を二つください`.
5. Selected Customer Service / Money Amount Listening
   - use selected realistic amounts;
   - do not train every number above 300 continuously.
6. Mixed Number Listening
   - mix plain numbers, tobacco numbers, quantities, tobacco + quantity, and selected amounts.

Keep the existing QZ005 four-choice number-listening mode as an additional listening exercise.

### Number speaking / reading

General Number Reading flow:

1. Show a numeric value.
2. Learner says it aloud.
3. Do not reveal the Japanese reading automatically.
4. Learner taps Hear Answer.
5. Japanese TTS speaks the correct reading.
6. Reveal Japanese/Kana and Romaji where useful.
7. Learner self-marks Correct or Wrong.

No speech-recognition scoring is required for the current phase.

Master 1-1000 first, then expand toward 10,000+.

Current selectable ranges:

- 1-10;
- 11-100;
- 101-200;
- 201-300;
- 301-400;
- 401-500;
- 501-600;
- 601-700;
- 701-800;
- 801-900;
- 901-1000.

Later ranges:

- 1001-1500;
- 1501-2000;
- 2001-3000;
- continuing toward 10,000.

Keep category structure ready for total bill/amount, price, and change / `おつり`.

### Price listening

Generate price tasks from base number data + 円.

Do not create duplicate price records.

### Hot-food order

Feature development is currently paused.

Example:

`ななチキ二つください`

Learner must identify:

- product;
- quantity;
- expected action.

### Customer phrase -> action

Feature development is currently paused.

Example:

`袋いりません`

Expected action:

Do not add a bag.

### Staff response

Given a real customer request, choose a short safe Japanese response.

### Cigarette number

Train shelf number first, then shelf number + quantity.

### Mistake review

Incorrect items should reappear more often.

Progress logic must remain outside content data.

## 9. Audio requirements

V1 should use the Web Speech API / `speechSynthesis` where supported.

Use `tts_text` as the Japanese speech source.

Expected behavior:

- select Japanese voice when available;
- replay button;
- speaking-rate option later if useful;
- no answer text revealed automatically in listening mode;
- visible fallback when TTS is unsupported.

The app should still function as a text quiz without audio.

## 10. Progress model

V1 may use `localStorage`.

Suggested conceptual structure:

```json
{
  "version": 1,
  "items": {
    "ENTRY_ID": {
      "attempts": 0,
      "correct": 0,
      "incorrect": 0,
      "last_seen": null,
      "last_result": null
    }
  },
  "sessions": []
}
```

This is separate from the master content JSON.

Do not store full duplicated vocabulary records inside progress data.

## 11. V1 screens

Minimum useful V1:

1. Home
2. Choose practice mode
3. Dedicated Number Training home
4. Number range/mode selection
5. Quiz or self-marking task screen
6. Answer feedback
7. Session result
8. Mistake review

Useful mode buttons:

- Numbers
- Prices
- Hot Food
- Customer Requests
- Cigarette Numbers
- Mixed Practice
- Mistake Review

## 12. UI requirements

Mobile-first:

- large buttons;
- high readability;
- touch-friendly;
- Japanese text large enough to read;
- Romaji clearly separated from Japanese;
- minimal scrolling during a single question;
- answer buttons reachable by thumb;
- audio replay prominent.

Avoid excessive animation.

## 13. Real-shift learning

After a shift, new real problems may be added:

- misunderstood word/sentence;
- approximate sound heard;
- product not identified;
- number misunderstood;
- register problem;
- machine/task issue;
- mistake/confusing situation;
- new product/task.

New information should be reviewed before becoming master training content.

## 14. Equipment and procedures

Future modules can include:

- microwave/oven;
- coffee machine;
- fryer;
- temperature measurement;
- cleaning;
- stocking;
- waste/disposal;
- food safety.

Do not implement exact procedures from guesses.

Use exact brand/model, button labels, official/store material, or confirmed store procedure when available.

## 15. Photography / recording

Do not depend on secret recording.

If photos/video are not permitted, collect:

- machine brand/model;
- button names;
- screen messages;
- product labels;
- written description of what happened.

## 16. Technical direction

For V1, prefer a simple local web application:

- HTML
- CSS
- JavaScript
- JSON data
- browser localStorage
- browser Japanese TTS

No backend is required for the first prototype.

The code should be data-driven and easy to run from VS Code using a simple local server.

A framework should only be introduced if it solves a concrete need.

## 17. Definition of V1 success

V1 is successful when the learner can use Android to:

- complete audio-only number dictation and self-mark without typing;
- hear a Japanese number and choose or write the correct value;
- read a displayed number aloud, hear the answer, and self-mark;
- practice number ranges and review range-level progress;
- practice prices without duplicated 円 records;
- understand tobacco number and quantity compositions;
- review mistakes;
- resume progress without modifying the master dataset.

Hot-food recognition and customer-interaction outcomes remain planned V1 work, but they are paused until Number Training is satisfactory.
