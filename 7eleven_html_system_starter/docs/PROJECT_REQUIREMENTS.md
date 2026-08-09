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
- Bengali is deferred to a later phase;
- mainly uses Android;
- sometimes uses Windows.

Therefore the interface must emphasize listening, keywords, actions, short replies, and mobile usability.

## 3. Current biggest difficulties

### Priority A — numbers

Focus on:

- amounts;
- prices;
- change;
- quantities;
- cigarette/tobacco shelf numbers.

### Priority B — hot/fried food

Focus on:

- official/current product name;
- reading;
- Romaji;
- important sound/keyword;
- quantity;
- visual clue;
- similar/confusable product;
- expected staff action.

### Priority C — register/customer language

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

Store each base number once.

Do not create repetitive rows for every value + 円.

Generate price/円 forms in the application.

Keep explicit counter forms where pronunciation or real work use differs.

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
- Japanese -> Romaji
- listening -> meaning/action

Do not add Bengali fields during V1.

Bengali support is future work and can be added later without changing the core quiz architecture.

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

Suggested weighting for mixed beginner practice:

- 40% numbers/prices/shelf numbers;
- 25% hot food + quantity;
- 25% customer phrase/action/reply;
- 10% essential rescue/payment/other.

These weights are application behavior, not changes to the master data.

## 8. Core training behavior

The learner should practice:

### Number listening

Hear Japanese number -> choose numeric value.

Later contexts can dynamically add:

- 円;
- 番;
- quantity counters.

### Price listening

Generate price tasks from base number data + 円.

Do not create duplicate price records.

### Hot-food order

Example:

`ななチキ二つください`

Learner must identify:

- product;
- quantity;
- expected action.

### Customer phrase -> action

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
3. Quiz screen
4. Answer feedback
5. Session result
6. Mistake review

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

- hear a Japanese number and choose the correct value;
- practice prices without duplicated 円 records;
- recognize important hot-food names;
- understand product + quantity;
- recognize common customer requests and choose the correct action;
- practice simple staff responses;
- review mistakes;
- resume progress without modifying the master dataset.
