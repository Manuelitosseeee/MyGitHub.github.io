/**
 * Generates the PWA PNG icons (zero dependencies, pure Node).
 *
 *   bun run icons
 *
 * Renders the favicon design — dark rounded square with a metronome triangle
 * and pendulum — at every size the app needs, with 2x supersampling for
 * antialiasing. The maskable variant fills the whole canvas and keeps the
 * glyph inside the safe zone.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "icons");

/* ----------------------------- PNG encoder ----------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encode an RGBA pixel buffer (Uint8Array, size*size*4) as a PNG. */
function png(size, px) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < stride; x++) raw[row + 1 + x] = px[y * stride + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ----------------------------- Geometry ----------------------------- */

/** Signed distance to a rounded box (p relative to center, b = half-extents). */
function sdRoundBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Distance from (px,py) to the segment a->b. */
function sdSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : ((px - ax) * vx + (py - ay) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

const WHITE = [1, 1, 1];

/* ----------------------------- Drawing ----------------------------- */

/**
 * Rasterize one icon. `draw(px, py, ux, uy)` returns [r,g,b,a] 0..1 where
 * (ux, uy) are normalized 0..1 coordinates inside the canvas.
 */
function render(size, draw) {
  const S = size * 2; // supersampled buffer
  const px = new Uint8Array(size * size * 4);
  const src = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ux = (x + 0.5) / S;
      const uy = (y + 0.5) / S;
      const [r, g, b, a] = draw(ux, uy);
      const i = (y * S + x) * 4;
      src[i] = Math.round(r * 255);
      src[i + 1] = Math.round(g * 255);
      src[i + 2] = Math.round(b * 255);
      src[i + 3] = Math.round(a * 255);
    }
  }
  // 2x2 box downsample
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = ((y * 2 + dy) * S + (x * 2 + dx)) * 4;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          a += src[i + 3];
        }
      }
      const i = (y * size + x) * 4;
      px[i] = Math.round(r / 4);
      px[i + 1] = Math.round(g / 4);
      px[i + 2] = Math.round(b / 4);
      px[i + 3] = Math.round(a / 4);
    }
  }
  return png(size, px);
}

/** Metronome glyph (unit coords), returns coverage 0..1 for a sample point. */
function glyphCoverage(ux, uy, cx, cy, scale) {
  const X = (ux - cx) / scale + 0.5;
  const Y = (uy - cy) / scale + 0.5;
  const c = (p) => (p - 0.5) / scale + cx; // map back for distance fields

  const lw = 0.07; // stroke width in unit space
  const cov = (d) => Math.max(0, Math.min(1, 0.5 - d / lw));

  // triangle outline: apex (0.5,0.18), base (0.24,0.58)-(0.76,0.58)
  const dApex = sdSegment(X, Y, 0.5, 0.18, 0.24, 0.58);
  const dApex2 = sdSegment(X, Y, 0.5, 0.18, 0.76, 0.58);
  const dBase = sdSegment(X, Y, 0.24, 0.58, 0.76, 0.58);
  const tri = Math.max(cov(dApex), cov(dApex2), cov(dBase));

  // base bar (rounded): from (0.28,0.585) to (0.72,0.585), half-height 0.037
  const bar = cov(sdRoundBox(X - 0.5, Y - 0.585, 0.22, 0.037, 0.035));

  // pendulum line (0.5,0.18) -> (0.66,0.55)
  const pend = cov(sdSegment(X, Y, 0.5, 0.18, 0.66, 0.55));

  // pivot dot
  const pivot = cov(Math.hypot(X - 0.69, Y - 0.585) - 0.065);

  return Math.max(tri, bar, pend, pivot);
}

/**
 * Full icon draw callable per pixel.
 * `safe` true → maskable: full-bleed background, glyph inside the safe zone.
 */
function makeDraw(safe) {
  const margin = safe ? 0 : 0.045; // canvas margin (rounded rect inset)
  const glyphScale = safe ? 0.62 : 0.8;
  const cx = 0.5;
  const cy = safe ? 0.52 : 0.54;

  return (ux, uy) => {
    // background gradient #1e2634 -> #0b0e13
    const t = Math.max(0, Math.min(1, (uy - 0) / 1));
    const r = 0x1e + (0x0b - 0x1e) * t;
    const g = 0x26 + (0x0e - 0x26) * t;
    const b = 0x34 + (0x13 - 0x34) * t;

    let bgA = 1;
    if (!safe) {
      // rounded-square mask with 2px-ish soft edge
      const d = sdRoundBox(ux - 0.5, uy - 0.5, 0.5 - margin, 0.5 - margin, 0.22);
      bgA = Math.max(0, Math.min(1, 0.5 - d / 0.008));
      if (bgA <= 0) return [0, 0, 0, 0];
    }

    const cov = glyphCoverage(ux, uy, cx, cy, glyphScale);
    // composite white glyph over the gradient background
    const gr = r / 255, gg = g / 255, gb = b / 255;
    const out = [gr, gg, gb, bgA];
    if (cov > 0) {
      const a = cov * bgA;
      out[0] = gr * (1 - a) + WHITE[0] * a;
      out[1] = gg * (1 - a) + WHITE[1] * a;
      out[2] = gb * (1 - a) + WHITE[2] * a;
      out[3] = Math.max(out[3], a);
    }
    return out;
  };
}

/* ----------------------------- Output ----------------------------- */

mkdirSync(OUT, { recursive: true });

const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];

for (const [name, size, safe] of targets) {
  const draw = makeDraw(safe);
  writeFileSync(join(OUT, name), render(size, draw));
  console.log(`✓ ${name} (${size}×${size}${safe ? ", maskable" : ""})`);
}

console.log("Icone generate in public/icons/");