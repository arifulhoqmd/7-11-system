function getMasterItems(datasetOrItems) {
  if (Array.isArray(datasetOrItems)) {
    return datasetOrItems;
  }

  if (Array.isArray(datasetOrItems?.masterItems)) {
    return datasetOrItems.masterItems;
  }

  throw new TypeError("Expected a normalized dataset or master-item array.");
}

export function isBroadBeginnerItem(item) {
  return item.learning_priority === 1 && item.difficulty === "beginner";
}

export function isStageAItem(item) {
  if (!isBroadBeginnerItem(item)) {
    return false;
  }

  if (item.problem_area !== "P3_NUMBERS") {
    return true;
  }

  if (item.entry_type === "number") {
    return (
      Number.isInteger(item.number_value) &&
      item.number_value >= 0 &&
      item.number_value <= 20
    );
  }

  return (
    item.entry_type === "counter_form" ||
    item.entry_type === "counter_rule"
  );
}

export function selectBroadBeginner(datasetOrItems) {
  return Object.freeze(
    getMasterItems(datasetOrItems).filter(isBroadBeginnerItem),
  );
}

// Stage B is cumulative: it is the complete priority-1 beginner pool.
export function selectStageB(datasetOrItems) {
  return selectBroadBeginner(datasetOrItems);
}

export function selectStageA(datasetOrItems) {
  return Object.freeze(getMasterItems(datasetOrItems).filter(isStageAItem));
}

export function selectStageBAdditions(datasetOrItems) {
  const stageAIds = new Set(
    selectStageA(datasetOrItems).map((item) => item.entry_id),
  );
  return Object.freeze(
    selectStageB(datasetOrItems).filter(
      (item) => !stageAIds.has(item.entry_id),
    ),
  );
}

export function selectCardinalNumbers(datasetOrItems, { stage = "B" } = {}) {
  const pool =
    stage === "A"
      ? selectStageA(datasetOrItems)
      : stage === "B"
        ? selectStageB(datasetOrItems)
        : null;

  if (pool === null) {
    throw new RangeError('Stage must be either "A" or "B".');
  }

  return Object.freeze(
    pool.filter(
      (item) =>
        item.problem_area === "P3_NUMBERS" && item.entry_type === "number",
    ),
  );
}

export function selectShelfNumberCardinals(
  datasetOrItems,
  { stage = "B" } = {},
) {
  return Object.freeze(
    selectCardinalNumbers(datasetOrItems, { stage }).filter(
      (item) => item.number_value > 0,
    ),
  );
}
