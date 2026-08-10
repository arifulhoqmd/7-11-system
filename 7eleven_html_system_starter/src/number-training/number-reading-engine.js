const DIGITS = Object.freeze({
  0: { kanji: "零", kana: "ゼロ", romaji: "zero" },
  1: { kanji: "一", kana: "いち", romaji: "ichi" },
  2: { kanji: "二", kana: "に", romaji: "ni" },
  3: { kanji: "三", kana: "さん", romaji: "san" },
  4: { kanji: "四", kana: "よん", romaji: "yon" },
  5: { kanji: "五", kana: "ご", romaji: "go" },
  6: { kanji: "六", kana: "ろく", romaji: "roku" },
  7: { kanji: "七", kana: "なな", romaji: "nana" },
  8: { kanji: "八", kana: "はち", romaji: "hachi" },
  9: { kanji: "九", kana: "きゅう", romaji: "kyuu" },
});

const HUNDREDS = Object.freeze({
  1: { kana: "ひゃく", romaji: "hyaku" },
  2: { kana: "にひゃく", romaji: "ni hyaku" },
  3: { kana: "さんびゃく", romaji: "sanbyaku" },
  4: { kana: "よんひゃく", romaji: "yon hyaku" },
  5: { kana: "ごひゃく", romaji: "go hyaku" },
  6: { kana: "ろっぴゃく", romaji: "roppyaku" },
  7: { kana: "ななひゃく", romaji: "nana hyaku" },
  8: { kana: "はっぴゃく", romaji: "happyaku" },
  9: { kana: "きゅうひゃく", romaji: "kyuu hyaku" },
});

const THOUSANDS = Object.freeze({
  1: { kana: "せん", romaji: "sen" },
  2: { kana: "にせん", romaji: "ni sen" },
  3: { kana: "さんぜん", romaji: "sanzen" },
  4: { kana: "よんせん", romaji: "yon sen" },
  5: { kana: "ごせん", romaji: "go sen" },
  6: { kana: "ろくせん", romaji: "roku sen" },
  7: { kana: "ななせん", romaji: "nana sen" },
  8: { kana: "はっせん", romaji: "hassen" },
  9: { kana: "きゅうせん", romaji: "kyuu sen" },
});

function readUnderTenThousand(value) {
  const kana = [];
  const romaji = [];
  let kanji = "";
  let remainder = value;

  const thousands = Math.floor(remainder / 1000);
  remainder %= 1000;
  if (thousands > 0) {
    kanji += `${thousands === 1 ? "" : DIGITS[thousands].kanji}千`;
    kana.push(THOUSANDS[thousands].kana);
    romaji.push(THOUSANDS[thousands].romaji);
  }

  const hundreds = Math.floor(remainder / 100);
  remainder %= 100;
  if (hundreds > 0) {
    kanji += `${hundreds === 1 ? "" : DIGITS[hundreds].kanji}百`;
    kana.push(HUNDREDS[hundreds].kana);
    romaji.push(HUNDREDS[hundreds].romaji);
  }

  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;
  if (tens > 0) {
    kanji += `${tens === 1 ? "" : DIGITS[tens].kanji}十`;
    kana.push(tens === 1 ? "じゅう" : `${DIGITS[tens].kana}じゅう`);
    romaji.push(tens === 1 ? "juu" : `${DIGITS[tens].romaji} juu`);
  }
  if (ones > 0) {
    kanji += DIGITS[ones].kanji;
    kana.push(DIGITS[ones].kana);
    romaji.push(DIGITS[ones].romaji);
  }

  return {
    japanese: kanji,
    readingKana: kana.join(""),
    romaji: romaji.join(" "),
  };
}

export function generateJapaneseNumber(value) {
  if (!Number.isInteger(value) || value < 0 || value > 99_999_999) {
    throw new RangeError(
      "Japanese number generation supports integers from 0 to 99,999,999.",
    );
  }

  if (value === 0) {
    return Object.freeze({
      numberValue: 0,
      japanese: DIGITS[0].kanji,
      readingKana: DIGITS[0].kana,
      romaji: DIGITS[0].romaji,
      ttsText: DIGITS[0].kana,
      readingSource: "rules",
      sourceRef: "NUMGEN:0",
    });
  }

  const tenThousands = Math.floor(value / 10_000);
  const remainder = value % 10_000;
  const parts = [];

  if (tenThousands > 0) {
    const group = readUnderTenThousand(tenThousands);
    parts.push({
      japanese: `${group.japanese}万`,
      readingKana: `${group.readingKana}まん`,
      romaji: `${group.romaji} man`,
    });
  }
  if (remainder > 0) {
    parts.push(readUnderTenThousand(remainder));
  }

  const result = {
    numberValue: value,
    japanese: parts.map((part) => part.japanese).join(""),
    readingKana: parts.map((part) => part.readingKana).join(""),
    romaji: parts.map((part) => part.romaji).join(" "),
    readingSource: "rules",
    sourceRef: `NUMGEN:${value}`,
  };
  return Object.freeze({ ...result, ttsText: result.readingKana });
}

export function resolveNumberReading(dataset, value) {
  const generated = generateJapaneseNumber(value);
  const stored = dataset?.numberDetail?.find(
    (detail) =>
      detail.number_type === "cardinal" && detail.number_value === value,
  );

  if (!stored) {
    return generated;
  }

  return Object.freeze({
    ...generated,
    readingKana: stored.reading_kana,
    romaji: stored.romaji,
    ttsText: stored.tts_text,
    readingSource: "master",
    sourceRef: stored.number_id,
  });
}
