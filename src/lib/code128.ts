// Code 128 (subset B) barcode encoder. Ports the checksum/symbol-table
// algorithm from JsBarcode (MIT licensed, github.com/lindell/JsBarcode) --
// verified against its published source rather than transcribed from a
// summarized reference table, since a single wrong bar pattern here would
// produce something that LOOKS like a barcode but silently fails to scan.
// Restricted to subset B (no code-set switching) because every character a
// seller would type into a SKU/barcode field -- letters, digits, punctuation,
// all of printable ASCII 32-126 -- is directly representable in B alone.
const START_B = 104;
const MODULO = 103;

// BARS[i] is the 11-module bar/space pattern for symbol value i, read as a
// string of "1" (bar) / "0" (space) modules left to right. Values 0-94 use
// the shared "value = charCode - 32" mapping code sets A and B both use;
// 95-102 are special function/shift symbols this encoder never reaches (no
// control characters pass through Set B here); 103 is the unused START A,
// 104 is START B (used below), 105 is the unused START C.
const BARS = [
  11011001100, 11001101100, 11001100110, 10010011000, 10010001100, 10001001100, 10011001000,
  10011000100, 10001100100, 11001001000, 11001000100, 11000100100, 10110011100, 10011011100,
  10011001110, 10111001100, 10011101100, 10011100110, 11001110010, 11001011100, 11001001110,
  11011100100, 11001110100, 11101101110, 11101001100, 11100101100, 11100100110, 11101100100,
  11100110100, 11100110010, 11011011000, 11011000110, 11000110110, 10100011000, 10001011000,
  10001000110, 10110001000, 10001101000, 10001100010, 11010001000, 11000101000, 11000100010,
  10110111000, 10110001110, 10001101110, 10111011000, 10111000110, 10001110110, 11101110110,
  11010001110, 11000101110, 11011101000, 11011100010, 11011101110, 11101011000, 11101000110,
  11100010110, 11101101000, 11101100010, 11100011010, 11101111010, 11001000010, 11110001010,
  10100110000, 10100001100, 10010110000, 10010000110, 10000101100, 10000100110, 10110010000,
  10110000100, 10011010000, 10011000010, 10000110100, 10000110010, 11000010010, 11001010000,
  11110111010, 11000010100, 10001111010, 10100111100, 10010111100, 10010011110, 10111100100,
  10011110100, 10011110010, 11110100100, 11110010100, 11110010010, 11011011110, 11011110110,
  11110110110, 10101111000, 10100011110, 10001011110, 10111101000, 10111100010, 11110101000,
  11110100010, 10111011110, 10111101110, 11101011110, 11110101110, 11010000100, 11010010000,
  11010011100,
] as const;
// 13 modules, not 11 -- the only symbol that's wider, per the spec.
const STOP_PATTERN = "1100011101011";

/** Set B covers ASCII 32 (space) through 126 (~) directly -- every printable
 *  character a keyboard can type. */
export function isCode128BEncodable(value: string): boolean {
  return /^[\x20-\x7E]+$/.test(value);
}

/** Encodes `value` into a string of "1" (bar) / "0" (space) modules, one
 *  fixed-width module per position, ready to draw left-to-right. Returns
 *  null for an empty string or anything outside Set B's range. */
export function encodeCode128B(value: string): string | null {
  if (!value || !isCode128BEncodable(value)) return null;

  const values = value.split("").map((ch) => ch.charCodeAt(0) - 32);
  let checksum = START_B;
  values.forEach((v, i) => {
    checksum += v * (i + 1);
  });
  checksum = checksum % MODULO;

  const symbolIndices = [START_B, ...values, checksum];
  return symbolIndices.map((i) => BARS[i].toString()).join("") + STOP_PATTERN;
}
