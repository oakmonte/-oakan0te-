// A small QR Code encoder: byte mode, versions 1-10, any error-correction
// level. Enough for a store link (~60 characters fits version 4 at level M).
//
// Written here rather than added as a dependency: nothing in node_modules
// encodes QR (barcode-detector only reads), and the job is a few hundred lines
// of well-specified arithmetic. The structure follows ISO/IEC 18004 by way of
// Project Nayuki's reference implementation (MIT), whose tables and step order
// are the ones every independent encoder is checked against. qr-code.test.ts
// round-trips the output through a real decoder (zxing), because a symbol that
// LOOKS like a QR code but has one wrong table entry scans as nothing.

export type QrEcc = "L" | "M" | "Q" | "H";

/** A finished symbol: `modules[y][x]` is true for a dark module. No quiet zone
 *  is included; the renderer adds it. */
export type QrMatrix = { size: number; version: number; modules: boolean[][] };

const MAX_VERSION = 10;

// Index 0 is padding so the tables read by version number. Only versions 1-10
// are listed because nothing longer is ever encoded here; extending the cap
// means extending both tables from the spec, not guessing.
const ECC_CODEWORDS_PER_BLOCK: Record<QrEcc, number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};
const NUM_ECC_BLOCKS: Record<QrEcc, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};
// The two format-information bits for each level. Not in L-M-Q-H order: the
// spec assigns M=00, L=01, H=10, Q=11.
const FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** Every module in the symbol that is not a function pattern, i.e. the bits
 *  available for data plus error correction (including remainder bits). */
function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version: number, ecc: QrEcc): number {
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecc][version] * NUM_ECC_BLOCKS[ecc][version]
  );
}

// --- Reed-Solomon over GF(2^8) with the QR polynomial 0x11D --------------

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

// --- Encoding ---------------------------------------------------------------

function utf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/** The data codewords for `bytes` in byte mode at `version`, padded to fill
 *  the version's data capacity. Null when it doesn't fit. */
function buildDataCodewords(bytes: number[], version: number, ecc: QrEcc): number[] | null {
  const capacityBits = dataCodewords(version, ecc) * 8;
  const countBits = version <= 9 ? 8 : 16;
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, countBits);
  for (const b of bytes) push(b, 8);
  if (bits.length > capacityBits) return null;

  // Terminator (up to four zeros), then zeros to a byte boundary, then the
  // alternating pad bytes the spec mandates.
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);

  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    out.push(byte);
  }
  return out;
}

/** Splits the data into blocks, appends each block's error correction, and
 *  interleaves them column by column, as the symbol stores them. */
function addEccAndInterleave(data: number[], version: number, ecc: QrEcc): number[] {
  const numBlocks = NUM_ECC_BLOCKS[ecc][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecc][version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(blockEccLen);

  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const eccBytes = rsRemainder(dat, divisor);
    // A placeholder so every block has the same length while interleaving;
    // skipped below.
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(eccBytes));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

// --- Drawing ------------------------------------------------------------------

class Grid {
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];
  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.isFunction = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  setFunction(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }
}

const bit = (value: number, i: number) => ((value >>> i) & 1) !== 0;

function alignmentPositions(version: number, size: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function drawFinder(g: Grid, cx: number, cy: number) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx;
      const y = cy + dy;
      // The ring at distance 4 is the light separator around the finder.
      if (x >= 0 && x < g.size && y >= 0 && y < g.size) g.setFunction(x, y, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignment(g: Grid, cx: number, cy: number) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      g.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFormatBits(g: Grid, ecc: QrEcc, mask: number) {
  const data = (FORMAT_BITS[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const size = g.size;

  // Copy beside the top-left finder.
  for (let i = 0; i <= 5; i++) g.setFunction(8, i, bit(bits, i));
  g.setFunction(8, 7, bit(bits, 6));
  g.setFunction(8, 8, bit(bits, 7));
  g.setFunction(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) g.setFunction(14 - i, 8, bit(bits, i));

  // Second copy, split between the other two finders.
  for (let i = 0; i < 8; i++) g.setFunction(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) g.setFunction(8, size - 15 + i, bit(bits, i));
  g.setFunction(8, size - 8, true); // the always-dark module
}

function drawVersionBits(g: Grid, version: number) {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = bit(bits, i);
    const a = g.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    g.setFunction(a, b, dark);
    g.setFunction(b, a, dark);
  }
}

function drawFunctionPatterns(g: Grid, version: number, ecc: QrEcc) {
  const size = g.size;
  for (let i = 0; i < size; i++) {
    g.setFunction(6, i, i % 2 === 0);
    g.setFunction(i, 6, i % 2 === 0);
  }
  drawFinder(g, 3, 3);
  drawFinder(g, size - 4, 3);
  drawFinder(g, 3, size - 4);

  const pos = alignmentPositions(version, size);
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // The three corners already hold finders.
      const onFinder = (i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0);
      if (!onFinder) drawAlignment(g, pos[i], pos[j]);
    }
  }
  // Reserve the format area now (any mask) so data placement skips it; the
  // real bits are written once the mask is chosen.
  drawFormatBits(g, ecc, 0);
  drawVersionBits(g, version);
}

/** Lays the codeword bits into the symbol in the spec's zigzag: two-module
 *  columns from the right edge, alternating upward and downward, hopping
 *  over the vertical timing pattern. */
function drawCodewords(g: Grid, codewords: number[]) {
  const size = g.size;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!g.isFunction[y][x] && i < codewords.length * 8) {
          g.modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
        // Remainder bits stay light (false), as the spec requires.
      }
    }
  }
}

function maskHit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** XOR is its own inverse, so applying the same mask twice undoes it. */
function applyMask(g: Grid, mask: number) {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.isFunction[y][x] && maskHit(mask, x, y)) g.modules[y][x] = !g.modules[y][x];
    }
  }
}

// The spec's four penalty rules. Masks only change how easily a symbol scans,
// never whether it decodes, but a symbol full of long runs or finder-lookalikes
// is the kind a cheap phone camera gives up on.
const FINDER_LIKE = [
  [true, false, true, true, true, false, true, false, false, false, false],
  [false, false, false, false, true, false, true, true, true, false, true],
];

export function penaltyScore(modules: boolean[][]): number {
  const size = modules.length;
  const at = (x: number, y: number, vertical: boolean) => (vertical ? modules[x][y] : modules[y][x]);
  let score = 0;

  for (const vertical of [false, true]) {
    for (let y = 0; y < size; y++) {
      // N1: runs of five or more same-coloured modules.
      let run = 1;
      for (let x = 1; x <= size; x++) {
        if (x < size && at(x, y, vertical) === at(x - 1, y, vertical)) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      // N3: 1:1:3:1:1 finder-like patterns with four light modules on a side.
      for (let x = 0; x + 11 <= size; x++) {
        for (const pattern of FINDER_LIKE) {
          if (pattern.every((dark, k) => at(x + k, y, vertical) === dark)) score += 40;
        }
      }
    }
  }

  // N2: 2x2 blocks of one colour.
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) {
        score += 3;
      }
    }
  }

  // N4: distance of the dark proportion from 50%, in 5% steps.
  let dark = 0;
  for (const row of modules) for (const m of row) if (m) dark++;
  const k = Math.floor(Math.abs((dark * 20) / (size * size) - 10));
  score += k * 10;

  return score;
}

/** Encodes `text` (as UTF-8) into the smallest version that fits. Throws when
 *  it would need more than version 10 — callers encode short links only. */
export function encodeQr(text: string, ecc: QrEcc = "M"): QrMatrix {
  const bytes = utf8Bytes(text);
  let version = 1;
  let data: number[] | null = null;
  for (; version <= MAX_VERSION; version++) {
    data = buildDataCodewords(bytes, version, ecc);
    if (data) break;
  }
  if (!data) throw new Error(`QR: ${bytes.length} bytes is too long for version ${MAX_VERSION}`);

  const size = version * 4 + 17;
  const g = new Grid(size);
  drawFunctionPatterns(g, version, ecc);
  drawCodewords(g, addEccAndInterleave(data, version, ecc));

  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(g, mask);
    drawFormatBits(g, ecc, mask);
    const score = penaltyScore(g.modules);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
    applyMask(g, mask);
  }
  applyMask(g, bestMask);
  drawFormatBits(g, ecc, bestMask);

  return { size, version, modules: g.modules };
}

/** One SVG path covering every dark module, offset by `margin` modules of
 *  quiet zone. A single path rather than a rect per module keeps the DOM to
 *  one node, however dense the symbol. */
export function qrPath(matrix: QrMatrix, margin = 4): string {
  const parts: string[] = [];
  matrix.modules.forEach((row, y) => {
    let x = 0;
    while (x < matrix.size) {
      if (!row[x]) {
        x++;
        continue;
      }
      // Merge horizontal runs into one rectangle.
      let end = x;
      while (end < matrix.size && row[end]) end++;
      parts.push(`M${x + margin} ${y + margin}h${end - x}v1h${x - end}z`);
      x = end;
    }
  });
  return parts.join("");
}

/** A PNG of the symbol with its quiet zone, for printing on packaging or a
 *  shop counter. Browser-only (canvas). Black on white regardless of the
 *  page's colour scheme: plenty of scanners can't read an inverted code. */
export function qrToPngBlob(matrix: QrMatrix, scale = 12, margin = 4): Promise<Blob | null> {
  const px = (matrix.size + margin * 2) * scale;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = "#000000";
  matrix.modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
    }),
  );
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
