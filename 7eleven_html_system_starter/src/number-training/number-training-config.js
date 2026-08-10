export const DICTATION_RANGES = Object.freeze([
  { id: "dictation-1-10", label: "1–10", min: 1, max: 10 },
  { id: "dictation-11-50", label: "11–50", min: 11, max: 50 },
  { id: "dictation-51-100", label: "51–100", min: 51, max: 100 },
  { id: "dictation-101-200", label: "101–200", min: 101, max: 200 },
  { id: "dictation-201-300", label: "201–300", min: 201, max: 300 },
]);

export const TOBACCO_RANGES = Object.freeze([
  { id: "tobacco-1-100", label: "1–100", min: 1, max: 100 },
  { id: "tobacco-101-200", label: "101–200", min: 101, max: 200 },
  { id: "tobacco-201-300", label: "201–300", min: 201, max: 300 },
  { id: "tobacco-1-300", label: "Mixed 1–300", min: 1, max: 300 },
]);

export const READING_RANGES = Object.freeze([
  { id: "reading-1-10", label: "1–10", min: 1, max: 10 },
  { id: "reading-11-100", label: "11–100", min: 11, max: 100 },
  { id: "reading-101-200", label: "101–200", min: 101, max: 200 },
  { id: "reading-201-300", label: "201–300", min: 201, max: 300 },
  { id: "reading-301-400", label: "301–400", min: 301, max: 400 },
  { id: "reading-401-500", label: "401–500", min: 401, max: 500 },
  { id: "reading-501-600", label: "501–600", min: 501, max: 600 },
  { id: "reading-601-700", label: "601–700", min: 601, max: 700 },
  { id: "reading-701-800", label: "701–800", min: 701, max: 800 },
  { id: "reading-801-900", label: "801–900", min: 801, max: 900 },
  { id: "reading-901-1000", label: "901–1000", min: 901, max: 1000 },
]);

export const QUANTITY_OPTIONS = Object.freeze([
  { id: "quantity-mixed", label: "Mixed つ / 個", counter: "mixed" },
  { id: "quantity-tsu", label: "つ quantities", counter: "つ" },
  { id: "quantity-ko", label: "個 quantities", counter: "個" },
]);

export const SELECTED_SERVICE_AMOUNTS = Object.freeze([
  500, 1000, 1500, 2000, 3000, 5000, 10000,
]);

export const NUMBER_READING_CATEGORIES = Object.freeze([
  { id: "plain-number", label: "Number reading", implemented: true },
  { id: "total-bill", label: "Total bill", implemented: false },
  { id: "price", label: "Price", implemented: false },
  { id: "change", label: "Change / おつり", implemented: false },
]);

export const NUMBER_TRAINING_MODES = Object.freeze([
  {
    id: "number-dictation",
    section: "listening",
    title: "Number Dictation",
    description: "Listen, write the digits on paper, then self-check.",
    ranges: DICTATION_RANGES,
    highestPriority: true,
  },
  {
    id: "number-multiple-choice",
    section: "listening",
    title: "4-Choice Number Listening",
    description: "The existing QZ005 listening mode.",
    ranges: null,
  },
  {
    id: "tobacco-number",
    section: "listening",
    title: "Tobacco Number",
    description: "Listen for a shelf number followed by 番.",
    ranges: TOBACCO_RANGES,
  },
  {
    id: "quantity-listening",
    section: "listening",
    title: "Quantity",
    description: "Practice つ and 個 quantity forms.",
    ranges: QUANTITY_OPTIONS,
  },
  {
    id: "tobacco-quantity",
    section: "listening",
    title: "Tobacco + Quantity",
    description: "Identify both the tobacco number and quantity.",
    ranges: TOBACCO_RANGES,
  },
  {
    id: "service-amount",
    section: "listening",
    title: "Selected Money Amounts",
    description: "Practice a small set of realistic service amounts.",
    ranges: Object.freeze([
      { id: "service-selected", label: "Selected amounts" },
    ]),
  },
  {
    id: "mixed-number-listening",
    section: "listening",
    title: "Mixed Listening",
    description: "Mix plain numbers, tobacco, quantities, and money.",
    ranges: Object.freeze([
      { id: "mixed-1-300", label: "Mixed 1–300" },
    ]),
  },
  {
    id: "number-reading",
    section: "reading",
    title: "Number Reading",
    description: "See digits, say them aloud, then hear the answer.",
    ranges: READING_RANGES,
  },
]);

export function getNumberTrainingMode(modeId) {
  return NUMBER_TRAINING_MODES.find((mode) => mode.id === modeId) ?? null;
}

export function getNumberTrainingRange(modeId, rangeId) {
  return (
    getNumberTrainingMode(modeId)?.ranges?.find(
      (range) => range.id === rangeId,
    ) ?? null
  );
}
