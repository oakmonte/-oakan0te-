// GPU (WebGL2) implementation of canvas-filter.ts's CompiledFilter.
//
// canvas-filter.ts walks every pixel in JavaScript after a getImageData
// round trip. That's fine for a one-off thumbnail, and far too slow for the
// paths that run per video frame: live recording (where a graded filter
// couldn't keep up at all, so it used to be applied as a slow post-process
// after the shutter was released) and the three video exporters. Here the
// same op chain runs as a fragment shader, so a frame costs one texture
// upload and one draw.
//
// The op chain is compiled into a dedicated shader per *shape* of chain
// ("matrix,lut,blend"), cached, with the numbers passed as uniforms -- so
// dragging an intensity slider never recompiles. Semantics match the CPU
// path op for op: matrix ops clamp after each step (the CPU stores into a
// Uint8ClampedArray between ops), LUTs are trilinear over the same grid,
// blendOriginal and `amount` lerp toward the untouched source pixel, and
// alpha passes through untouched. The GPU keeps full float precision
// between ops instead of re-quantising to 8 bits, so it can only be the
// smoother of the two.
//
// Everything here is best-effort: if WebGL2 is missing, a shader fails to
// compile or the context is lost, callers fall back to the CPU path
// (applyFilterToContext below does that itself).

import { applyCompiledFilter, IDENTITY_FILTER, type CompiledFilter } from "@/lib/canvas-filter";
import type { LutTable } from "@/lib/lut/generate-lut";

type Op = CompiledFilter["ops"][number];

/** A source rectangle in source pixels, as drawImage's sx/sy/sw/sh. */
export type SourceRect = { sx: number; sy: number; sw: number; sh: number };

const VERTEX_SHADER = `#version 300 es
// One triangle that covers the whole viewport; vUv is that pixel's position
// in the cropped (and optionally mirrored) source.
uniform vec4 uCrop;   // u0, v0, u1, v1 in normalised source coordinates
uniform float uMirror;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  float x = mix(p.x, 1.0 - p.x, uMirror);
  // Clip space y is up; the uploaded image's first row is at v = 0.
  vUv = vec2(mix(uCrop.x, uCrop.z, x), mix(uCrop.w, uCrop.y, p.y));
}`;

function opKind(op: Op): "m" | "l" | "b" {
  return op.kind === "matrix" ? "m" : op.kind === "lut" ? "l" : "b";
}

/** The fragment shader for one chain shape. Exported for tests. */
export function buildFragmentShader(ops: readonly Op[], withAmount: boolean): string {
  const decls: string[] = [];
  const body: string[] = [];
  ops.forEach((op, i) => {
    if (op.kind === "matrix") {
      decls.push(`uniform mat3 uM${i};`, `uniform vec3 uO${i};`);
      body.push(`  c = clamp(uM${i} * c + uO${i}, 0.0, 1.0);`);
    } else if (op.kind === "lut") {
      decls.push(`uniform highp sampler3D uL${i};`, `uniform float uN${i};`);
      // Texel centres: grid point k of n sits at (k + 0.5) / n. The table is
      // indexed r-major / b-minor, which as a 3D texture is x = b, y = g, z = r.
      body.push(`  c = texture(uL${i}, (c.bgr * (uN${i} - 1.0) + 0.5) / uN${i}).rgb;`);
    } else {
      decls.push(`uniform float uB${i};`);
      body.push(`  c = mix(src.rgb, c, uB${i});`);
    }
  });
  if (withAmount) {
    decls.push("uniform float uAmount;");
    body.push("  c = mix(src.rgb, c, uAmount);");
  }
  return `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
${decls.join("\n")}
out vec4 outColor;
void main() {
  vec4 src = texture(uSrc, vUv);
  vec3 c = src.rgb;
${body.join("\n")}
  outColor = vec4(clamp(c, 0.0, 1.0), src.a);
}`;
}

type Program = {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
};

export class GlFilterRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private programs = new Map<string, Program>();
  private luts = new WeakMap<LutTable, WebGLTexture>();
  private srcTexture: WebGLTexture;
  private lost = false;
  private readonly maxTextureSize: number;

  /** null when WebGL2 isn't available. `opaque` for a renderer whose output
   *  is recorded: an alpha channel there only costs conversions (and on the
   *  WebM fallback, a needless alpha plane). Exports keep alpha, which the
   *  studio's transparent letterbox bars rely on. */
  static create({ opaque = false }: { opaque?: boolean } = {}): GlFilterRenderer | null {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", {
      alpha: !opaque,
      premultipliedAlpha: false,
      // Kept, because the canvas is read after drawing: by captureStream
      // (recording) and by drawImage (exports). Safari has captured blank
      // frames from a WebGL canvas without it.
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) return null;
    try {
      return new GlFilterRenderer(canvas, gl);
    } catch (err) {
      console.warn("GlFilterRenderer: setup failed, using the CPU path", err);
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
    });
    const tex = gl.createTexture();
    if (!tex) throw new Error("createTexture failed");
    this.srcTexture = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    // Compile the no-op chain up front: a broken driver surfaces here, at
    // create(), where the caller can still fall back cleanly.
    this.program([], false);
  }

  get usable(): boolean {
    return !this.lost && !this.gl.isContextLost();
  }

  setSize(width: number, height: number): void {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  /** Whether a source and an output of these sizes fit this GPU. Beyond
   *  MAX_TEXTURE_SIZE the upload fails WITHOUT throwing and samples black,
   *  and a drawing buffer the browser couldn't allocate in full comes back
   *  smaller -- both would "succeed" with a wrong picture. */
  fits(sourceWidth: number, sourceHeight: number): boolean {
    const max = this.maxTextureSize;
    return (
      sourceWidth > 0 &&
      sourceHeight > 0 &&
      sourceWidth <= max &&
      sourceHeight <= max &&
      this.gl.drawingBufferWidth === this.canvas.width &&
      this.gl.drawingBufferHeight === this.canvas.height
    );
  }

  /** Compiles `compiled`'s shader and uploads its LUTs ahead of time, so the
   *  first recorded frame or shutter press doesn't pay for it (shader
   *  compiles are slow on iOS's Metal backend). */
  warm(compiled: CompiledFilter): void {
    if (!this.usable) return;
    const ops = compiled === IDENTITY_FILTER ? [] : compiled.ops;
    this.program(ops, ops.length > 0 && (compiled.amount ?? 1) < 1);
    for (const op of ops) if (op.kind === "lut") this.lutTexture(op.table);
  }

  /** Drops the big buffers (drawing buffer + source texture) back to 1x1
   *  while keeping compiled shaders and LUTs. A 12 MP photo otherwise pins
   *  ~100 MB of GPU memory for the rest of the session -- jetsam territory
   *  for an installed iPhone app. */
  shrink(): void {
    if (!this.usable) return;
    this.setSize(1, 1);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  /** Draws `crop` of `source` through `compiled` onto this.canvas, scaled to
   *  fill it. Returns false if the GPU couldn't (context lost); the caller
   *  should fall back to the CPU path for this frame. */
  render(
    source: TexImageSource,
    sourceWidth: number,
    sourceHeight: number,
    compiled: CompiledFilter,
    crop?: SourceRect,
    mirror = false,
  ): boolean {
    if (!this.usable || !this.fits(sourceWidth, sourceHeight)) return false;
    const gl = this.gl;
    const ops = compiled === IDENTITY_FILTER ? [] : compiled.ops;
    const amount = compiled.amount ?? 1;
    const withAmount = ops.length > 0 && amount < 1;
    const prog = this.program(ops, withAmount);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(prog.uniforms.get("uSrc")!, 0);

    const r = crop ?? { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
    gl.uniform4f(
      prog.uniforms.get("uCrop")!,
      r.sx / sourceWidth,
      r.sy / sourceHeight,
      (r.sx + r.sw) / sourceWidth,
      (r.sy + r.sh) / sourceHeight,
    );
    gl.uniform1f(prog.uniforms.get("uMirror")!, mirror ? 1 : 0);

    let unit = 1;
    ops.forEach((op, i) => {
      if (op.kind === "matrix") {
        // Row-major on the CPU side; transpose=true uploads it as such.
        gl.uniformMatrix3fv(prog.uniforms.get(`uM${i}`)!, true, op.matrix);
        gl.uniform3f(
          prog.uniforms.get(`uO${i}`)!,
          op.offset[0] / 255,
          op.offset[1] / 255,
          op.offset[2] / 255,
        );
      } else if (op.kind === "lut") {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_3D, this.lutTexture(op.table));
        gl.uniform1i(prog.uniforms.get(`uL${i}`)!, unit);
        gl.uniform1f(prog.uniforms.get(`uN${i}`)!, op.table.size);
        unit++;
      } else {
        gl.uniform1f(prog.uniforms.get(`uB${i}`)!, op.amount);
      }
    });
    if (withAmount) gl.uniform1f(prog.uniforms.get("uAmount")!, amount);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.usable;
  }

  dispose(): void {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.lost = true;
  }

  private program(ops: readonly Op[], withAmount: boolean): Program {
    const key = ops.map(opKind).join("") + (withAmount ? "+a" : "");
    const cached = this.programs.get(key);
    if (cached) return cached;
    const gl = this.gl;
    const vs = this.shader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.shader(gl.FRAGMENT_SHADER, buildFragmentShader(ops, withAmount));
    const program = gl.createProgram();
    if (!program) throw new Error("createProgram failed");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`shader link failed: ${gl.getProgramInfoLog(program)}`);
    }
    const names = ["uSrc", "uCrop", "uMirror", "uAmount"];
    ops.forEach((op, i) => {
      if (op.kind === "matrix") names.push(`uM${i}`, `uO${i}`);
      else if (op.kind === "lut") names.push(`uL${i}`, `uN${i}`);
      else names.push(`uB${i}`);
    });
    const uniforms = new Map(names.map((n) => [n, gl.getUniformLocation(program, n)]));
    const entry = { program, uniforms };
    this.programs.set(key, entry);
    return entry;
  }

  private shader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("createShader failed");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`shader compile failed: ${log}`);
    }
    return shader;
  }

  // One upload per table for the renderer's lifetime. RGB16F is filterable
  // in core WebGL2 (32-bit float textures aren't, without an extension), so
  // the GPU's own trilinear sampling does the LUT interpolation.
  private lutTexture(table: LutTable): WebGLTexture {
    const cached = this.luts.get(table);
    if (cached) return cached;
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error("createTexture failed");
    gl.bindTexture(gl.TEXTURE_3D, tex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const n = table.size;
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, n, n, n, 0, gl.RGB, gl.FLOAT, table.data);
    this.luts.set(table, tex);
    return tex;
  }
}

// One shared renderer for the one-shot and export paths below. Created on
// first use; a creation failure is remembered so it isn't retried per frame.
// A context lost later (iOS reclaims them when the app is backgrounded) is
// recreated on next use.
let shared: GlFilterRenderer | null | undefined;
function sharedRenderer(): GlFilterRenderer | null {
  if (shared && !shared.usable) shared = undefined;
  if (shared === undefined) shared = GlFilterRenderer.create();
  return shared;
}

/** Whether applyFilterToContext will run on the GPU. Canvases that are only
 *  filtered through it should then NOT be created willReadFrequently: that
 *  hint keeps a canvas in CPU memory, turning every GPU frame into an extra
 *  upload plus a stalling readback. */
export function gpuFilterAvailable(): boolean {
  return sharedRenderer() !== null;
}

// Above this many output pixels the shared renderer gives its buffers back
// once it has sat idle for a moment -- not after every call, which would
// re-allocate 15-30 MB per frame of a large video export.
const KEEP_BUFFERS_MAX_PIXELS = 2_500_000;
let shrinkTimer: ReturnType<typeof setTimeout> | null = null;
function shrinkWhenIdle(gpu: GlFilterRenderer) {
  if (shrinkTimer) clearTimeout(shrinkTimer);
  shrinkTimer = setTimeout(() => {
    shrinkTimer = null;
    gpu.shrink();
  }, 1000);
}
// Filters whose shader failed for a reason other than a lost context: sent
// straight to the CPU from then on, instead of recompiling (and warning) on
// every frame of an export.
const gpuFailed = new WeakSet<CompiledFilter>();

/** Applies `compiled` to the whole of `ctx`'s canvas in place -- a drop-in
 *  for the getImageData / applyCompiledFilter / putImageData sequence. On
 *  the GPU when it can be, otherwise on the CPU. Alpha is left untouched
 *  either way (studio export relies on transparent letterbox bars staying
 *  transparent). */
export function applyFilterToContext(
  ctx: CanvasRenderingContext2D,
  compiled: CompiledFilter,
  width: number,
  height: number,
): void {
  if (compiled === IDENTITY_FILTER || compiled.ops.length === 0) return;
  const gpu = gpuFailed.has(compiled) ? null : sharedRenderer();
  if (gpu) {
    try {
      gpu.setSize(width, height);
      const done = gpu.render(ctx.canvas, ctx.canvas.width, ctx.canvas.height, compiled, {
        sx: 0,
        sy: 0,
        sw: width,
        sh: height,
      });
      if (done) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "copy";
        ctx.drawImage(gpu.canvas, 0, 0, width, height, 0, 0, width, height);
        ctx.restore();
      }
      if (width * height > KEEP_BUFFERS_MAX_PIXELS) shrinkWhenIdle(gpu);
      if (done) return;
    } catch (err) {
      // Only a dead context is worth dropping the renderer over; anything
      // else (a tainted canvas, say) is about this call, not the GPU.
      console.warn("GPU filter failed, using the CPU path", err);
      if (!gpu.usable) shared = undefined;
      else gpuFailed.add(compiled);
    }
  }
  const frame = ctx.getImageData(0, 0, width, height);
  applyCompiledFilter(frame, compiled);
  ctx.putImageData(frame, 0, 0);
}

/** Compiles `compiled`'s shader on the shared renderer ahead of use (see
 *  GlFilterRenderer.warm). */
export function warmFilter(compiled: CompiledFilter): void {
  sharedRenderer()?.warm(compiled);
}
