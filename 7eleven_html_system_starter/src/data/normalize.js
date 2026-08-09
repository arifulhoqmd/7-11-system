import { validateMasterDataset } from "./validation.js";

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneValue(child)]),
    );
  }

  return value;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (
    value === null ||
    typeof value !== "object" ||
    seen.has(value)
  ) {
    return value;
  }

  seen.add(value);
  for (const child of Object.values(value)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}

export function parsePipeDelimited(value) {
  if (value === null || value === undefined || value === "") {
    return Object.freeze([]);
  }

  const parts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split("|")
      : null;

  if (parts === null) {
    throw new TypeError("Pipe-delimited value must be a string, array, or null.");
  }

  return Object.freeze(
    parts
      .map((part) => String(part).trim())
      .filter((part) => part.length > 0),
  );
}

function normalizeMasterItem(item) {
  return {
    ...cloneValue(item),
    quizModeList: parsePipeDelimited(item.quiz_modes),
    listenKeywordList: parsePipeDelimited(item.listen_keywords),
    aliasList: parsePipeDelimited(item.aliases),
  };
}

function normalizeNumberDetail(detail) {
  return {
    ...cloneValue(detail),
    quizModeList: parsePipeDelimited(detail.quiz_modes),
  };
}

function normalizeHotFoodDetail(detail) {
  return {
    ...cloneValue(detail),
    practiceAliasList: parsePipeDelimited(detail.practice_aliases),
    heardKeywordList: parsePipeDelimited(detail.heard_keywords),
    confusableWithList: parsePipeDelimited(detail.confusable_with),
  };
}

function indexBy(records, idField) {
  const index = Object.create(null);
  for (const record of records) {
    index[record[idField]] = record;
  }
  return index;
}

export function normalizeMasterDataset(rawDataset) {
  validateMasterDataset(rawDataset);

  const masterItems = rawDataset.master_items.map(normalizeMasterItem);
  const numberDetail = rawDataset.number_detail.map(normalizeNumberDetail);
  const hotFoodDetail =
    rawDataset.hot_food_detail.map(normalizeHotFoodDetail);
  const quizPatterns = rawDataset.quiz_patterns.map(cloneValue);
  const sources = rawDataset.sources.map(cloneValue);

  const itemsById = indexBy(masterItems, "entry_id");
  const numberDetailsById = indexBy(numberDetail, "number_id");
  const hotFoodDetailsById = indexBy(hotFoodDetail, "item_id");
  const patternsById = indexBy(quizPatterns, "pattern_id");
  const sourcesById = indexBy(sources, "source_id");

  const joinedItemsById = Object.create(null);
  for (const item of masterItems) {
    joinedItemsById[item.entry_id] = {
      item,
      numberDetail: numberDetailsById[item.entry_id] ?? null,
      hotFoodDetail: hotFoodDetailsById[item.entry_id] ?? null,
    };
  }

  return deepFreeze({
    metadata: cloneValue(rawDataset.metadata),
    masterItems,
    numberDetail,
    hotFoodDetail,
    quizPatterns,
    sources,
    indexes: {
      itemsById,
      numberDetailsById,
      hotFoodDetailsById,
      patternsById,
      sourcesById,
    },
    joinedItemsById,
  });
}
