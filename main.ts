// news-image-20261124 — "Sum up 24 November's world news in one image"
// Draws a newspaper front page for Tuesday 24 November 2026 with pure
// Node stdlib: a hand-rolled RGBA canvas, a 5x7 bitmap font, and a minimal
// PNG encoder (zlib deflate + CRC32). No network, no randomness, no time
// dependence — every run writes byte-identical output.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER: [number, number, number] = [247, 243, 232];
const INK: [number, number, number] = [17, 17, 17];
const RED: [number, number, number] = [179, 38, 30];
const BLUE: [number, number, number] = [26, 68, 128];
const TEAL: [number, number, number] = [14, 110, 96];
const ORANGE: [number, number, number] = [196, 94, 10];
const GREEN: [number, number, number] = [46, 110, 44];
const GOLD: [number, number, number] = [176, 132, 24];
const LIGHT: [number, number, number] = [255, 255, 255];
const GREY: [number, number, number] = [90, 88, 80];
const PANEL: [number, number, number] = [255, 252, 244];
type RGB = [number, number, number];

// ------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 bits ("#" = ink). Uppercase, digits, punctuation.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "*": ["00000", "10101", "01110", "10101", "00000", "00000", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
};

// ---------------------------------------------------------------- canvas
class Canvas {
  data: Buffer;
  w: number;
  h: number;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4, 255);
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }
  frame(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c);
  }
  ring(cx: number, cy: number, r: number, c: RGB, t = 3): void {
    for (let a = 0; a < 360; a++) {
      const rad = (a * Math.PI) / 180;
      for (let k = 0; k < t; k++) {
        this.px(
          Math.round(cx + (r - k) * Math.cos(rad)),
          Math.round(cy + (r - k) * Math.sin(rad)),
          c,
        );
      }
    }
  }
  // Filled triangle (scanline).
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minY = Math.min(y0, y1, y2);
    const maxY = Math.max(y0, y1, y2);
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      const edges: [number, number, number, number][] = [
        [x0, y0, x1, y1],
        [x1, y1, x2, y2],
        [x2, y2, x0, y0],
      ];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      if (xs.length >= 2) {
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        for (let x = Math.ceil(lo); x <= Math.floor(hi); x++) this.px(x, y, c);
      }
    }
  }
}

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(
  cv: Canvas,
  s: string,
  x: number,
  y: number,
  scale: number,
  c: RGB,
): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 5; col++)
        if (g[row][col] === "1")
          cv.rect(cx + col * scale, y + row * scale, scale, scale, c);
    cx += 6 * scale;
  }
}
function drawTextCentered(
  cv: Canvas,
  s: string,
  cx: number,
  y: number,
  scale: number,
  c: RGB,
): void {
  drawText(cv, s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}
// Word-wrap a string to lines fitting maxWidth px at the given scale.
function wrapText(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (textWidth(test, scale) <= maxWidth || !cur) cur = test;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(
  cv: Canvas,
  s: string,
  x: number,
  y: number,
  maxWidth: number,
  scale: number,
  c: RGB,
  lineGap = 4,
): number {
  const lines = wrapText(s, maxWidth, scale);
  let yy = y;
  for (const ln of lines) {
    drawText(cv, ln, x, yy, scale, c);
    yy += 7 * scale + lineGap;
  }
  return yy;
}

// ------------------------------------------------------------ PNG encode
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(cv: Canvas): Buffer {
  const raw = Buffer.alloc((cv.w * 3 + 1) * cv.h);
  for (let y = 0; y < cv.h; y++) {
    raw[y * (cv.w * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < cv.w; x++) {
      const si = (y * cv.w + x) * 4;
      const di = y * (cv.w * 3 + 1) + 1 + x * 3;
      raw[di] = cv.data[si];
      raw[di + 1] = cv.data[si + 1];
      raw[di + 2] = cv.data[si + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- pictograms
// Simple flat pictograms, drawn from rectangles, discs and triangles.

function picChip(cv: Canvas, x: number, y: number, s: number): void {
  // A computer chip: dark body, gold pins, inner die.
  cv.rect(x, y, 10 * s, 10 * s, INK);
  cv.rect(x + 2 * s, y + 2 * s, 6 * s, 6 * s, GREEN);
  cv.rect(x + 3 * s, y + 3 * s, 4 * s, 4 * s, LIGHT);
  drawText(cv, "AI", x + 3 * s + Math.floor(s / 2), y + 3 * s + Math.floor(s / 2), Math.max(1, Math.floor(s / 2)), INK);
  for (let i = 0; i < 3; i++) {
    cv.rect(x + (2 + i * 3) * s, y - s, s, s, GOLD);
    cv.rect(x + (2 + i * 3) * s, y + 10 * s, s, s, GOLD);
    cv.rect(x - s, y + (2 + i * 3) * s, s, s, GOLD);
    cv.rect(x + 10 * s, y + (2 + i * 3) * s, s, s, GOLD);
  }
}

function picShipFire(cv: Canvas, x: number, y: number, s: number): void {
  // A ship hull with smoke and flame.
  cv.rect(x, y + 6 * s, 12 * s, 3 * s, BLUE);
  cv.tri(x, y + 6 * s, x + 12 * s, y + 6 * s, x + 10 * s, y + 9 * s, BLUE);
  cv.rect(x + 3 * s, y + 2 * s, 2 * s, 4 * s, INK);
  cv.rect(x + 7 * s, y + 3 * s, 2 * s, 3 * s, INK);
  cv.tri(x + 4 * s, y + 2 * s, x + 5 * s, y - 2 * s, x + 6 * s, y + 2 * s, ORANGE);
  cv.tri(x + 8 * s, y + 3 * s, x + 9 * s, y, x + 10 * s, y + 3 * s, RED);
  cv.disc(x + 5 * s, y - 3 * s, Math.max(1, Math.floor(s / 2)), GREY);
  cv.disc(x + 8 * s, y - 4 * s, Math.max(1, Math.floor(s / 2)), GREY);
  cv.rect(x, y + 10 * s, 12 * s, s, BLUE);
}

function picGlobe(cv: Canvas, x: number, y: number, s: number): void {
  // Earth with a crack: climate talks failing.
  cv.disc(x + 5 * s, y + 5 * s, 5 * s, TEAL);
  cv.ring(x + 5 * s, y + 5 * s, 5 * s, INK, 2);
  cv.rect(x + 2 * s, y + 3 * s, 3 * s, 2 * s, GREEN);
  cv.rect(x + 6 * s, y + 6 * s, 3 * s, 2 * s, GREEN);
  cv.line(x + 4 * s, y + 1 * s, x + 6 * s, y + 4 * s, RED);
  cv.line(x + 6 * s, y + 4 * s, x + 4 * s, y + 7 * s, RED);
  cv.line(x + 4 * s, y + 7 * s, x + 7 * s, y + 9 * s, RED);
}

function picFlame(cv: Canvas, x: number, y: number, s: number): void {
  // Factory block with flame above it.
  cv.rect(x, y + 6 * s, 12 * s, 4 * s, INK);
  cv.rect(x + 1 * s, y + 4 * s, 3 * s, 2 * s, INK);
  cv.rect(x + 8 * s, y + 2 * s, 2 * s, 4 * s, INK);
  cv.tri(x + 5 * s, y + 6 * s, x + 6 * s, y + 1 * s, x + 7 * s, y + 6 * s, ORANGE);
  cv.tri(x + 3 * s, y + 6 * s, x + 4 * s, y + 3 * s, x + 5 * s, y + 6 * s, RED);
  cv.tri(x + 7 * s, y + 6 * s, x + 8 * s, y + 3 * s, x + 9 * s, y + 6 * s, RED);
  cv.disc(x + 6 * s, y, Math.max(1, Math.floor(s / 2)), GREY);
}

function picTanker(cv: Canvas, x: number, y: number, s: number): void {
  // Oil tanker on waves, one container tipped.
  cv.rect(x, y + 5 * s, 12 * s, 3 * s, RED);
  cv.tri(x, y + 5 * s, x + 12 * s, y + 5 * s, x + 10 * s, y + 8 * s, RED);
  cv.rect(x + 2 * s, y + 2 * s, 3 * s, 3 * s, INK);
  cv.rect(x + 6 * s, y + 2 * s, 3 * s, 3 * s, INK);
  cv.rect(x + 9 * s, y + 3 * s, 2 * s, 2 * s, GOLD);
  cv.tri(x + 10 * s, y + 2 * s, x + 11 * s, y - 1 * s, x + 12 * s, y + 2 * s, ORANGE);
  cv.rect(x, y + 9 * s, 3 * s, s, BLUE);
  cv.rect(x + 4 * s, y + 9 * s, 3 * s, s, BLUE);
  cv.rect(x + 8 * s, y + 9 * s, 4 * s, s, BLUE);
}

function picTrophy(cv: Canvas, x: number, y: number, s: number): void {
  // A cup with handles on a base.
  cv.rect(x + 3 * s, y, 6 * s, 2 * s, GOLD);
  cv.rect(x + 3 * s, y + 2 * s, 6 * s, 4 * s, GOLD);
  cv.tri(x + 3 * s, y + 6 * s, x + 9 * s, y + 6 * s, x + 6 * s, y + 8 * s, GOLD);
  cv.rect(x + 5 * s, y + 8 * s, 2 * s, 2 * s, GOLD);
  cv.rect(x + 3 * s, y + 10 * s, 6 * s, s, GOLD);
  cv.rect(x + 1 * s, y + 1 * s, 2 * s, 3 * s, GOLD);
  cv.rect(x + 9 * s, y + 1 * s, 2 * s, 3 * s, GOLD);
  cv.disc(x + 6 * s, y + 3 * s, Math.max(1, Math.floor(s / 2)), LIGHT);
}

// ---------------------------------------------------------------- layout
function kicker(cv: Canvas, x: number, y: number, text: string, c: RGB): void {
  drawText(cv, text, x, y, 2, c);
  cv.rect(x, y + 18, textWidth(text, 2), 3, c);
}

function panel(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: RGB,
): void {
  cv.rect(x, y, w, h, PANEL);
  cv.frame(x, y, w, h, INK, 2);
  cv.rect(x, y, w, 6, accent);
}

function buildImage(): Buffer {
  const cv = new Canvas(W, H);
  cv.rect(0, 0, W, H, PAPER);
  cv.frame(8, 8, W - 16, H - 16, INK, 3);

  // ---- masthead
  drawTextCentered(cv, "THE WORLD IN ONE DAY", 512, 34, 4, INK);
  cv.rect(48, 78, 928, 4, RED);
  drawTextCentered(cv, "TUESDAY 24 NOVEMBER 2026", 512, 96, 5, RED);
  drawTextCentered(cv, "THE DAY'S NEWS - IN ONE IMAGE", 512, 140, 2, GREY);

  // ---- lead story: Nvidia / Huang
  const lx = 32;
  const ly = 176;
  const lw = 960;
  const lh = 248;
  panel(cv, lx, ly, lw, lh, GREEN);
  picChip(cv, lx + 36, ly + 78, 9);
  kicker(cv, lx + 180, ly + 22, "BUSINESS - UNITED STATES", GREEN);
  drawText(cv, "HUANG BACK AT NVIDIA", lx + 180, ly + 52, 5, INK);
  drawPara(
    cv,
    "Nvidia board reinstates Jensen Huang as chief executive after pressure from President Trump. Shares surge, adding almost $1 trillion in value as tech stocks rally.",
    lx + 180,
    ly + 116,
    lw - 216,
    2,
    INK,
  );
  drawText(cv, "THE DAY'S BIGGEST BUSINESS STORY", lx + 180, ly + 208, 2, GREY);

  // ---- grid row 1
  const gy1 = 440;
  const gh = 216;
  const gw = 472;
  const gx1 = 32;
  const gx2 = 520;

  panel(cv, gx1, gy1, gw, gh, BLUE);
  picShipFire(cv, gx1 + 24, gy1 + 58, 6);
  kicker(cv, gx1 + 150, gy1 + 18, "WAR - LIBYA & FINLAND", BLUE);
  drawText(cv, "RUSSIAN SHIPS", gx1 + 150, gy1 + 48, 4, INK);
  drawText(cv, "HIT AT SEA", gx1 + 150, gy1 + 84, 4, INK);
  drawPara(
    cv,
    "Ukraine's war reaches new waters: a Russian warship is struck in Libya and the cargo ship Sparta II burns off Finland.",
    gx1 + 24,
    gy1 + 132,
    gw - 48,
    2,
    INK,
  );

  panel(cv, gx2, gy1, gw, gh, TEAL);
  picGlobe(cv, gx2 + 24, gy1 + 58, 6);
  kicker(cv, gx2 + 150, gy1 + 18, "CLIMATE - GLOBAL", TEAL);
  drawText(cv, "COP31 ENDS", gx2 + 150, gy1 + 48, 4, INK);
  drawText(cv, "WITH NO DEAL", gx2 + 150, gy1 + 84, 4, INK);
  drawPara(
    cv,
    "World climate talks collapse without a final agreement as nations split over fossil fuels.",
    gx2 + 24,
    gy1 + 132,
    gw - 48,
    2,
    INK,
  );

  // ---- grid row 2
  const gy2 = 672;
  panel(cv, gx1, gy2, gw, gh, ORANGE);
  picFlame(cv, gx1 + 24, gy2 + 58, 6);
  kicker(cv, gx1 + 150, gy2 + 18, "ASIA - INDONESIA", ORANGE);
  drawText(cv, "24 KILLED IN", gx1 + 150, gy2 + 48, 4, INK);
  drawText(cv, "FACTORY FIRE", gx1 + 150, gy2 + 84, 4, INK);
  drawPara(
    cv,
    "A blaze at a candy factory kills at least 24 people. Rescuers search for 34 workers still missing.",
    gx1 + 24,
    gy2 + 132,
    gw - 48,
    2,
    INK,
  );

  panel(cv, gx2, gy2, gw, gh, RED);
  picTanker(cv, gx2 + 24, gy2 + 58, 6);
  kicker(cv, gx2 + 150, gy2 + 18, "MIDDLE EAST - HORMUZ", RED);
  drawText(cv, "IRAN VOWS TO", gx2 + 150, gy2 + 48, 4, INK);
  drawText(cv, "DEFY BLOCKADE", gx2 + 150, gy2 + 84, 4, INK);
  drawPara(
    cv,
    "Tehran says it will use every means to counter a US naval blockade. Two tankers are hit in the strait.",
    gx2 + 24,
    gy2 + 132,
    gw - 48,
    2,
    INK,
  );

  // ---- sport strip
  const sy = 904;
  const sh = 96;
  panel(cv, 32, sy, 960, sh, GOLD);
  picTrophy(cv, 56, sy + 22, 5);
  kicker(cv, 150, sy + 14, "SPORT - TURIN", GOLD);
  drawText(cv, "ALCARAZ WINS ATP FINALS", 150, sy + 40, 3, INK);
  drawPara(
    cv,
    "Carlos Alcaraz beats Alexander Zverev for his first ATP Finals title. ALSO TODAY: UK confirmed as host of the 2035 Women's World Cup - World Chess title match begins in Geneva.",
    150,
    sy + 66,
    960 - 150 - 24,
    1,
    INK,
    2,
  );

  return encodePNG(cv);
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const png = buildImage();
  writeFileSync(`${outDir}/entry.png`, png);
}

main();
