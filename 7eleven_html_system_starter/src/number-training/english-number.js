const ONES = Object.freeze([
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
]);

const TEENS = Object.freeze([
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
]);

const TENS = Object.freeze([
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
]);

function underOneHundred(value) {
  if (value < 10) {
    return ONES[value];
  }
  if (value < 20) {
    return TEENS[value - 10];
  }
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return ones === 0 ? TENS[tens] : `${TENS[tens]}-${ONES[ones]}`;
}

export function toEnglishNumberWords(value) {
  if (!Number.isInteger(value) || value < 0 || value > 9999) {
    throw new RangeError("English number words support integers from 0 to 9999.");
  }
  if (value >= 1000) {
    const thousands = Math.floor(value / 1000);
    const remainder = value % 1000;
    return remainder === 0
      ? `${ONES[thousands]} thousand`
      : `${ONES[thousands]} thousand ${toEnglishNumberWords(remainder)}`;
  }
  if (value < 100) {
    return underOneHundred(value);
  }
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  return remainder === 0
    ? `${ONES[hundreds]} hundred`
    : `${ONES[hundreds]} hundred ${underOneHundred(remainder)}`;
}

export function createEnglishAnswerText(value) {
  return `The answer is ${toEnglishNumberWords(value)}.`;
}
