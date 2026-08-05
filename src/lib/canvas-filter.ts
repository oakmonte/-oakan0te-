// Manual re-implementation of CSS filter functions as color matrices,
// applied via getImageData/putImageData instead of ctx.filter.
// Needed because Safari/iOS WebKit has unreliable support for
// CanvasRenderingContext2D.filter — it silently no-ops or partially
// applies combined filter strings, while drawImage + pixel math works
// identically everywhere.

type Mat3 = number[]; // row-major 3x3
type Vec3 = [number, number, number];

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function mulMat3(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a[row * 3 + k] * b[k * 3 + col];
      r[row * 3 + col] = sum;
    }
  }
  return r;
}

function mulMat3Vec3(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

// --- individual filter matrices (matching CSS Filter Effects spec) ---

function brightnessMat(amount: number): Mat3 {
  return [amount, 0, 0, 0, amount, 0, 0, 0, amount];
}

function contrastOffset(amount: number): Vec3 {
  const o = 128 * (1 - amount);
  return [o, o, o];
}
function contrastMat(amount: number): Mat3 {
  return [amount, 0, 0, 0, amount, 0, 0, 0, amount];
}

function saturateMat(amount: number): Mat3 {
  return [
    0.213 + 0.787 * amount, 0.715 - 0.715 * amount, 0.072 - 0.072 * amount,
    0.213 - 0.213 * amount, 0.715 + 0.285 * amount, 0.072 - 0.072 * amount,
    0.213 - 0.213 * amount, 0.715 - 0.715 * amount, 0.072 + 0.928 * amount,
  ];
}

function grayscaleMat(amount: number): Mat3 {
  const inv = 1 - amount;
  return [
    0.2126 + 0.7874 * inv, 0.7152 - 0.7152 * inv, 0.0722 - 0.0722 * inv,
    0.2126 - 0.2126 * inv, 0.7152 + 0.2848 * inv, 0.0722 - 0.0722 * inv,
    0.2126 - 0.2126 * inv, 0.7152 - 0.7152 * inv, 0.0722 + 0.9278 * inv,
  ];
}

function sepiaMat(amount: number): Mat3 {
  const inv = 1 - amount;
  return [
    0.393 + 0.607 * inv, 0.769 - 0.769 * inv, 0.189 - 0.189 * inv,
    0.349 - 0.349 * inv, 0.686 + 0.314 * inv, 0.168 - 0.168 * inv,
    0.272 - 0.272 * inv, 0.534 - 0.534 * inv, 0.131 + 0.869 * inv,
  ];
}

function hueRotateMat(deg: number): Mat3 {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

export interface CompiledFilter {
  matrix: Mat3;
  offset: Vec3;
}

export const IDENTITY_FILTER: CompiledFilter = { matrix: IDENTITY, offset: [0, 0, 0] };

/** Parses a CSS filter string (e.g. "brightness(1.05) saturate(1.2) sepia(0.15)")
 *  into a single composed 3x3 matrix + offset. Functions compose left-to-right,
 *  matching how the browser applies CSS filter chains. */
export function compileFilter(css: string): CompiledFilter {
  if (!css || css === "none") return IDENTITY_FILTER;

  let matrix: Mat3 = IDENTITY;
  let offset: Vec3 = [0, 0, 0];

  const fnRe = /([\w-]+)\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = fnRe.exec(css))) {
    const name = match[1];
    const raw = match[2].trim();
    const value = raw.endsWith("deg") ? parseFloat(raw) : parseFloat(raw);

    let m: Mat3 = IDENTITY;
    let o: Vec3 = [0, 0, 0];

    switch (name) {
      case "brightness":
        m = brightnessMat(value);
        break;
      case "contrast":
        m = contrastMat(value);
        o = contrastOffset(value);
        break;
      case "saturate":
        m = saturateMat(value);
        break;
      case "grayscale":
        m = grayscaleMat(value);
        break;
      case "sepia":
        m = sepiaMat(value);
        break;
      case "hue-rotate":
        m = hueRotateMat(value);
        break;
      default:
        continue; // unknown function, skip
    }

    // Compose: apply this filter *after* everything accumulated so far.
    matrix = mulMat3(m, matrix);
    offset = addVec3(mulMat3Vec3(m, offset), o);
  }

  return { matrix, offset };
}

/** Applies a compiled filter to ImageData in place. */
export function applyCompiledFilter(imageData: ImageData, compiled: CompiledFilter): void {
  if (compiled === IDENTITY_FILTER) return;
  const { matrix: m, offset: o } = compiled;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = clamp(m[0] * r + m[1] * g + m[2] * b + o[0]);
    data[i + 1] = clamp(m[3] * r + m[4] * g + m[5] * b + o[1]);
    data[i + 2] = clamp(m[6] * r + m[7] * g + m[8] * b + o[2]);
    // alpha untouched
  }
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}