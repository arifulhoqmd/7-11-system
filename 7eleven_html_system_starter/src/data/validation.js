const REQUIRED_TOP_LEVEL_SECTIONS = Object.freeze([
  "metadata",
  "master_items",
  "hot_food_detail",
  "number_detail",
  "quiz_patterns",
  "sources",
]);

const REQUIRED_MASTER_ITEM_FIELDS = Object.freeze([
  "entry_id",
  "problem_area",
  "category",
  "subcategory",
  "entry_type",
  "speaker",
  "japanese",
  "reading_kana",
  "romaji",
  "english",
  "listen_keywords",
  "expected_action",
  "recommended_reply_japanese",
  "recommended_reply_romaji",
  "recommended_reply_english",
  "learning_priority",
  "difficulty",
  "quiz_modes",
  "tts_text",
  "number_value",
  "counter",
  "aliases",
  "store_active",
  "availability_scope",
  "volatility",
  "source_type",
  "source_url",
  "source_checked_date",
  "notes",
]);

const REQUIRED_NUMBER_DETAIL_FIELDS = Object.freeze([
  "number_id",
  "number_value",
  "number_type",
  "japanese",
  "reading_kana",
  "romaji",
  "counter",
  "priority",
  "irregular",
  "example_japanese",
  "example_romaji",
  "example_english",
  "tts_text",
  "quiz_modes",
  "notes",
]);

const REQUIRED_HOT_FOOD_DETAIL_FIELDS = Object.freeze([
  "item_id",
  "official_name",
  "reading_kana",
  "romaji",
  "english",
  "practice_aliases",
  "heard_keywords",
  "category",
  "variant",
  "learning_priority",
  "visual_clue",
  "confusable_with",
  "tts_text",
  "example_customer_order",
  "store_active",
  "region",
  "listed_on_check_date",
  "source_checked_date",
  "source_section",
  "source_url",
  "availability_note",
]);

const REQUIRED_QUIZ_PATTERN_FIELDS = Object.freeze([
  "pattern_id",
  "problem_area",
  "name",
  "tts_template",
  "display_template",
  "answer_type",
  "data_sources",
  "difficulty",
  "example",
]);

const REQUIRED_NONEMPTY_MASTER_FIELDS = Object.freeze([
  "entry_id",
  "problem_area",
  "category",
  "subcategory",
  "entry_type",
  "speaker",
  "japanese",
  "reading_kana",
  "romaji",
  "english",
  "listen_keywords",
  "expected_action",
  "difficulty",
  "quiz_modes",
  "tts_text",
  "availability_scope",
  "volatility",
  "source_type",
  "notes",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkFields(record, requiredFields, location, issues) {
  for (const field of requiredFields) {
    if (!Object.hasOwn(record, field)) {
      issues.push(`${location} is missing field "${field}".`);
    }
  }
}

function checkUniqueStringId(records, idField, location, issues) {
  const ids = new Set();

  for (const [index, record] of records.entries()) {
    if (!isRecord(record)) {
      issues.push(`${location}[${index}] must be an object.`);
      continue;
    }

    const id = record[idField];
    if (typeof id !== "string" || id.trim() === "") {
      issues.push(`${location}[${index}].${idField} must be a non-empty string.`);
      continue;
    }

    if (ids.has(id)) {
      issues.push(`${location} contains duplicate ${idField} "${id}".`);
    }
    ids.add(id);
  }

  return ids;
}

export class DatasetValidationError extends Error {
  constructor(issues) {
    const preview = issues.slice(0, 20).join("\n");
    const remainder =
      issues.length > 20 ? `\n...and ${issues.length - 20} more issue(s).` : "";
    super(`Master dataset validation failed:\n${preview}${remainder}`);
    this.name = "DatasetValidationError";
    this.issues = Object.freeze([...issues]);
  }
}

export function validateMasterDataset(dataset) {
  const issues = [];

  if (!isRecord(dataset)) {
    throw new DatasetValidationError(["Dataset root must be an object."]);
  }

  for (const section of REQUIRED_TOP_LEVEL_SECTIONS) {
    if (!Object.hasOwn(dataset, section)) {
      issues.push(`Dataset is missing top-level section "${section}".`);
    }
  }

  if (!isRecord(dataset.metadata)) {
    issues.push('Top-level section "metadata" must be an object.');
  }

  for (const section of [
    "master_items",
    "hot_food_detail",
    "number_detail",
    "quiz_patterns",
    "sources",
  ]) {
    if (!Array.isArray(dataset[section])) {
      issues.push(`Top-level section "${section}" must be an array.`);
    }
  }

  if (issues.length > 0) {
    throw new DatasetValidationError(issues);
  }

  const masterItems = dataset.master_items;
  const itemIds = checkUniqueStringId(
    masterItems,
    "entry_id",
    "master_items",
    issues,
  );

  for (const [index, item] of masterItems.entries()) {
    if (!isRecord(item)) {
      continue;
    }

    checkFields(item, REQUIRED_MASTER_ITEM_FIELDS, `master_items[${index}]`, issues);

    for (const field of REQUIRED_NONEMPTY_MASTER_FIELDS) {
      if (typeof item[field] !== "string" || item[field].trim() === "") {
        issues.push(
          `master_items[${index}].${field} must be a non-empty string.`,
        );
      }
    }

    if (!Number.isInteger(item.learning_priority)) {
      issues.push(
        `master_items[${index}].learning_priority must be an integer.`,
      );
    }

    for (const field of ["quiz_modes", "listen_keywords"]) {
      if (typeof item[field] !== "string") {
        issues.push(`master_items[${index}].${field} must be a string.`);
      }
    }

    if (item.aliases !== null && typeof item.aliases !== "string") {
      issues.push(`master_items[${index}].aliases must be a string or null.`);
    }
  }

  if (
    Number.isInteger(dataset.metadata.master_item_count) &&
    dataset.metadata.master_item_count !== masterItems.length
  ) {
    issues.push(
      `metadata.master_item_count is ${dataset.metadata.master_item_count}, but master_items contains ${masterItems.length} records.`,
    );
  }

  const numberIds = checkUniqueStringId(
    dataset.number_detail,
    "number_id",
    "number_detail",
    issues,
  );
  for (const [index, detail] of dataset.number_detail.entries()) {
    if (!isRecord(detail)) {
      continue;
    }
    checkFields(
      detail,
      REQUIRED_NUMBER_DETAIL_FIELDS,
      `number_detail[${index}]`,
      issues,
    );
    if (!itemIds.has(detail.number_id)) {
      issues.push(
        `number_detail[${index}].number_id "${detail.number_id}" has no master item.`,
      );
    } else {
      const masterItem = masterItems.find(
        (item) => item.entry_id === detail.number_id,
      );
      if (masterItem?.problem_area !== "P3_NUMBERS") {
        issues.push(
          `number_detail[${index}].number_id "${detail.number_id}" does not reference P3_NUMBERS.`,
        );
      }
    }
    if (typeof detail.quiz_modes !== "string") {
      issues.push(`number_detail[${index}].quiz_modes must be a string.`);
    }
  }

  const expectedNumberIds = masterItems
    .filter((item) => item.problem_area === "P3_NUMBERS")
    .map((item) => item.entry_id);
  for (const id of expectedNumberIds) {
    if (!numberIds.has(id)) {
      issues.push(`P3_NUMBERS master item "${id}" has no number_detail record.`);
    }
  }

  const hotFoodIds = checkUniqueStringId(
    dataset.hot_food_detail,
    "item_id",
    "hot_food_detail",
    issues,
  );
  for (const [index, detail] of dataset.hot_food_detail.entries()) {
    if (!isRecord(detail)) {
      continue;
    }
    checkFields(
      detail,
      REQUIRED_HOT_FOOD_DETAIL_FIELDS,
      `hot_food_detail[${index}]`,
      issues,
    );
    if (!itemIds.has(detail.item_id)) {
      issues.push(
        `hot_food_detail[${index}].item_id "${detail.item_id}" has no master item.`,
      );
    } else {
      const masterItem = masterItems.find(
        (item) => item.entry_id === detail.item_id,
      );
      if (masterItem?.problem_area !== "P2_HOT_FOOD") {
        issues.push(
          `hot_food_detail[${index}].item_id "${detail.item_id}" does not reference P2_HOT_FOOD.`,
        );
      }
    }

    for (const field of [
      "practice_aliases",
      "heard_keywords",
      "confusable_with",
    ]) {
      if (detail[field] !== null && typeof detail[field] !== "string") {
        issues.push(
          `hot_food_detail[${index}].${field} must be a string or null.`,
        );
      }
    }
  }

  const expectedHotFoodIds = masterItems
    .filter((item) => item.problem_area === "P2_HOT_FOOD")
    .map((item) => item.entry_id);
  for (const id of expectedHotFoodIds) {
    if (!hotFoodIds.has(id)) {
      issues.push(`P2_HOT_FOOD master item "${id}" has no hot_food_detail record.`);
    }
  }

  checkUniqueStringId(
    dataset.quiz_patterns,
    "pattern_id",
    "quiz_patterns",
    issues,
  );
  for (const [index, pattern] of dataset.quiz_patterns.entries()) {
    if (isRecord(pattern)) {
      checkFields(
        pattern,
        REQUIRED_QUIZ_PATTERN_FIELDS,
        `quiz_patterns[${index}]`,
        issues,
      );
    }
  }

  checkUniqueStringId(dataset.sources, "source_id", "sources", issues);

  if (issues.length > 0) {
    throw new DatasetValidationError(issues);
  }

  return true;
}
