// news-image-20261124 r2 — "The World in One Day"
// A broadsheet for Tuesday 24 November 2026: masthead with the date in large
// type, then six story panels (two columns x three rows), each with a flat
// pictogram, a short headline and a one-line summary. Everything is drawn
// from scratch with Node's standard library only: a raw RGBA canvas, a
// 5x7 bitmap font written by hand, and a small PNG encoder (zlib + CRC32).
// No network, no Pillow, no dependencies. The output is fully deterministic:
// two runs write byte-identical PNG files.
//
// The six stories were all first reported on Tuesday 24 November 2026
// (Reuters, via its world-news summary and same-day wires):
//   1. Nvidia reinstates Jensen Huang as CEO after Trump intervenes.
//   2. Israeli airstrike in Gaza City kills Hamas security chief Naeem Abu Nahel.
//   3. Overnight Russian strike on Zaporizhzhia kills 2, wounds 22.
//   4. Bangladesh garment workers clash with police; factories shut over pay.
//   5. China investigates Politburo member Chen Jining.
//   6. About 175 migrants unaccounted for after contact lost with a boat
//      that left Dakar, Senegal, two weeks earlier.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------- canvas

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 4);

type RGBA = [number, number, number, number];

const PAPER: RGBA = [246, 241, 231, 255];
const INK: RGBA = [26, 26, 46, 255];
const NAVY: RGBA = [22, 35, 63, 255];
const CREAM: RGBA = [246, 241, 231, 255];
const GOLD: RGBA = [201, 162, 39, 255];
const WHITE: RGBA = [255, 255, 255, 255];

function fillAll(c: RGBA): void {
  for (let i = 0; i < W * H; i++) {
    buf[i * 4] = c[0];
    buf[i * 4 + 1] = c[1];
    buf[i * 4 + 2] = c[2];
    buf[i * 4 + 3] = c[3];
  }
}

function setPixel(x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = c[3];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGBA): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPixel(xx, yy, c);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGBA): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
  }
}

function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
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

function fillTriangle(
  x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
  c: RGBA,
): void {
  const minX = Math.min(x1, x2, x3);
  const maxX = Math.max(x1, x2, x3);
  const minY = Math.min(y1, y2, y3);
  const maxY = Math.max(y1, y2, y3);
  const d = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((x2 - x) * (y3 - y) - (y2 - y) * (x3 - x)) / d;
      const b = ((x3 - x) * (y1 - y) - (y3 - y) * (x1 - x)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) setPixel(x, y, c);
    }
  }
}

function fillPolygon(pts: Array<[number, number]>, c: RGBA): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = Math.ceil(minY); y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if (y1 === y2) continue;
      if (y >= Math.min(y1, y2) && y < Math.max(y1, y2)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.ceil(xs[k]);
      const x1 = Math.floor(xs[k + 1]);
      if (x1 >= x0) fillRect(x0, y, x1 - x0 + 1, 1, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, thick: number, c: RGBA): void {
  for (let a = 0; a < 360; a++) {
    const rad = (a * Math.PI) / 180;
    const px = Math.round(cx + r * Math.cos(rad));
    const py = Math.round(cy + r * Math.sin(rad));
    fillRect(px - Math.floor(thick / 2), py - Math.floor(thick / 2), thick, thick, c);
  }
}

function star(cx: number, cy: number, outer: number, inner: number, points: number, c: RGBA): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
  }
  fillPolygon(pts, c);
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph is 7 rows of 5 bits ("1" = ink). Hand-written, uppercase only;
// every label in the image is set in capitals on purpose.

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
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
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
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "*": ["00000", "10101", "01110", "10101", "00000", "00000", "00000"],
  "•": ["00000", "00000", "01110", "01110", "01110", "00000", "00000"],
};

function drawChar(ch: string, x: number, y: number, s: number, c: RGBA): void {
  const g = FONT[ch] ?? FONT[" "];
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "1") fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}

function textWidth(s: string, sc: number): number {
  return s.length * 6 * sc - sc;
}

function drawText(s: string, x: number, y: number, sc: number, c: RGBA): void {
  let cx = x;
  for (const ch of s) {
    drawChar(ch, cx, y, sc, c);
    cx += 6 * sc;
  }
}

function drawTextCentered(s: string, y: number, sc: number, c: RGBA): void {
  drawText(s, Math.round((W - textWidth(s, sc)) / 2), y, sc, c);
}

function wrapText(s: string, maxChars: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) {
      cur = w;
      continue;
    }
    if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- PNG encode

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    Buffer.from(buf.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- pictograms
// Each draws inside a 132x132 box at (bx, by) on its tinted background.

const ORANGE: RGBA = [230, 81, 0, 255];
const YELLOW: RGBA = [255, 193, 7, 255];
const GREY: RGBA = [120, 120, 120, 255];

function pictoChip(bx: number, by: number): void {
  const green: RGBA = [46, 125, 50, 255];
  const dark: RGBA = [27, 94, 32, 255];
  // pins
  for (let i = 0; i < 3; i++) {
    const o = 42 + i * 20;
    fillRect(bx + o, by + 18, 8, 12, dark);
    fillRect(bx + o, by + 102, 8, 12, dark);
    fillRect(bx + 18, by + o, 12, 8, dark);
    fillRect(bx + 102, by + o, 12, 8, dark);
  }
  fillRect(bx + 30, by + 30, 72, 72, green);
  fillRect(bx + 44, by + 44, 44, 44, WHITE);
  drawText("AI", bx + 48, by + 53, 3, green);
}

function pictoBurst(bx: number, by: number): void {
  // three building silhouettes, explosion star above them
  fillRect(bx + 14, by + 82, 26, 50, INK);
  fillRect(bx + 46, by + 66, 30, 66, INK);
  fillRect(bx + 82, by + 88, 28, 44, INK);
  // windows
  for (let i = 0; i < 2; i++) {
    fillRect(bx + 20 + i * 12, by + 92, 6, 8, GOLD);
    fillRect(bx + 52 + i * 12, by + 76, 6, 8, GOLD);
    fillRect(bx + 88 + i * 12, by + 98, 6, 8, GOLD);
  }
  star(bx + 66, by + 42, 36, 15, 8, ORANGE);
  star(bx + 66, by + 42, 20, 8, 8, YELLOW);
}

function pictoBuilding(bx: number, by: number): void {
  const blue: RGBA = [47, 93, 138, 255];
  // apartment block with a damaged top-right corner, smoke, small flame
  fillRect(bx + 30, by + 44, 72, 88, blue);
  // damage: pale triangle biting the top-right corner
  fillTriangle(bx + 102, by + 44, bx + 66, by + 44, bx + 102, by + 80, PAPER);
  // windows
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      fillRect(bx + 38 + c * 22, by + 56 + r * 18, 12, 10, WHITE);
    }
  }
  // flame at the notch
  fillTriangle(bx + 86, by + 54, bx + 100, by + 54, bx + 93, by + 30, ORANGE);
  fillTriangle(bx + 89, by + 54, bx + 97, by + 54, bx + 93, by + 40, YELLOW);
  // smoke
  fillCircle(bx + 84, by + 26, 9, GREY);
  fillCircle(bx + 96, by + 16, 11, GREY);
}

function pictoShirt(bx: number, by: number): void {
  const orange: RGBA = [194, 87, 27, 255];
  // t-shirt silhouette
  fillPolygon(
    [
      [44, 34], [88, 34], [110, 52], [97, 72], [88, 64],
      [88, 106], [44, 106], [44, 64], [35, 72], [22, 52],
    ].map(([x, y]) => [bx + x, by + y] as [number, number]),
    orange,
  );
  // collar + stitch lines
  drawLine(bx + 56, by + 36, bx + 66, by + 46, WHITE);
  drawLine(bx + 76, by + 36, bx + 66, by + 46, WHITE);
  drawLine(bx + 48, by + 78, bx + 84, by + 78, WHITE);
  drawLine(bx + 48, by + 92, bx + 84, by + 92, WHITE);
}

function pictoProbe(bx: number, by: number): void {
  const red: RGBA = [142, 31, 47, 255];
  // government building: pediment roof, three columns, steps
  fillTriangle(bx + 26, by + 52, bx + 66, by + 28, bx + 106, by + 52, red);
  fillRect(bx + 30, by + 52, 72, 6, red);
  for (let i = 0; i < 3; i++) fillRect(bx + 36 + i * 22, by + 58, 10, 40, red);
  fillRect(bx + 28, by + 98, 76, 6, red);
  fillRect(bx + 22, by + 104, 88, 6, red);
  // magnifying glass over the building
  ring(bx + 92, by + 84, 22, 5, GOLD);
  drawLine(bx + 108, by + 100, bx + 122, by + 114, GOLD);
  drawLine(bx + 110, by + 102, bx + 124, by + 116, GOLD);
}

function pictoBoat(bx: number, by: number): void {
  const sea: RGBA = [21, 101, 168, 255];
  const teal: RGBA = [15, 118, 110, 255];
  // waves: two scalloped bands
  for (let x = 0; x < 132; x += 22) {
    fillCircle(bx + x + 11, by + 104, 11, sea);
    fillCircle(bx + x, by + 118, 11, teal);
  }
  fillRect(bx, by + 104, 132, 10, sea);
  fillRect(bx, by + 118, 132, 14, teal);
  // hull, mast, sail, three people
  fillPolygon(
    [
      [30, 78], [102, 78], [92, 96], [40, 96],
    ].map(([x, y]) => [bx + x, by + y] as [number, number]),
    INK,
  );
  drawLine(bx + 66, by + 78, bx + 66, by + 40, INK);
  drawLine(bx + 66, by + 78, bx + 66, by + 40, INK);
  fillTriangle(bx + 68, by + 44, bx + 68, by + 76, bx + 98, by + 76, [255, 248, 225, 255]);
  fillCircle(bx + 48, by + 70, 4, INK);
  fillCircle(bx + 62, by + 70, 4, INK);
  fillCircle(bx + 76, by + 70, 4, INK);
}

// ---------------------------------------------------------------- stories

interface Story {
  tag: string;
  accent: RGBA;
  tint: RGBA;
  headline: string;
  summary: string;
  picto: (bx: number, by: number) => void;
}

const STORIES: Story[] = [
  {
    tag: "USA • TECH",
    accent: [46, 125, 50, 255],
    tint: [230, 242, 226, 255],
    headline: "HUANG BACK AS NVIDIA CEO",
    summary:
      "TRUMP INTERVENED TO RESTORE THE CHIPMAKER'S FOUNDER, LESS THAN TWO WEEKS AFTER HIS OUSTER.",
    picto: pictoChip,
  },
  {
    tag: "GAZA • WAR",
    accent: [179, 38, 30, 255],
    tint: [251, 233, 231, 255],
    headline: "HAMAS SECURITY CHIEF KILLED IN GAZA",
    summary:
      "ISRAELI AIRSTRIKE IN GAZA CITY KILLED NAEEM ABU NAHEL, HAMAS INTERNAL SECURITY HEAD.",
    picto: pictoBurst,
  },
  {
    tag: "UKRAINE • WAR",
    accent: [47, 93, 138, 255],
    tint: [232, 238, 244, 255],
    headline: "RUSSIAN STRIKE HITS ZAPORIZHZHIA",
    summary:
      "OVERNIGHT ATTACK ON AN APARTMENT BLOCK KILLED 2 AND WOUNDED 22, INCLUDING CHILDREN.",
    picto: pictoBuilding,
  },
  {
    tag: "BANGLADESH • LABOUR",
    accent: [194, 87, 27, 255],
    tint: [253, 239, 230, 255],
    headline: "GARMENT WORKERS CLASH WITH POLICE",
    summary:
      "PAY PROTESTS SHUT DOZENS OF FACTORIES NEAR DHAKA. WORKERS WANT WAGES MORE THAN DOUBLED.",
    picto: pictoShirt,
  },
  {
    tag: "CHINA • POLITICS",
    accent: [142, 31, 47, 255],
    tint: [249, 232, 234, 255],
    headline: "CHINA PROBES TOP LEADER CHEN JINING",
    summary:
      "SHANGHAI PARTY CHIEF CHEN JINING IS UNDER INVESTIGATION, THE FOURTH POLITBURO MEMBER SINCE 2025.",
    picto: pictoProbe,
  },
  {
    tag: "SENEGAL • MIGRATION",
    accent: [15, 118, 110, 255],
    tint: [226, 242, 240, 255],
    headline: "175 MIGRANTS UNACCOUNTED FOR",
    summary:
      "CONTACT LOST WITH A BOAT THAT LEFT DAKAR TWO WEEKS AGO. ABOUT 175 PEOPLE WERE ABOARD.",
    picto: pictoBoat,
  },
];

// ---------------------------------------------------------------- draw

function drawPanel(s: Story, px: number, py: number, pw: number, ph: number): void {
  // paper + ink frame
  fillRect(px, py, pw, ph, WHITE);
  fillRect(px, py, pw, 2, INK);
  fillRect(px, py + ph - 2, pw, 2, INK);
  fillRect(px, py, 2, ph, INK);
  fillRect(px + pw - 2, py, 2, ph, INK);
  // tag strip
  fillRect(px + 2, py + 2, pw - 4, 30, s.accent);
  drawText(s.tag, px + 16, py + 11, 2, WHITE);
  // pictogram box
  fillRect(px + 14, py + 46, 132, 132, s.tint);
  fillRect(px + 14, py + 46, 132, 2, s.accent);
  s.picto(px + 14, py + 46);
  // headline (scale 3, up to 3 lines, 17 chars/line)
  const headLines = wrapText(s.headline, 17);
  let hy = py + 50;
  for (const line of headLines) {
    drawText(line, px + 160, hy, 3, INK);
    hy += 26;
  }
  // summary (scale 2, up to 3 lines, 37 chars/line)
  const sumLines = wrapText(s.summary, 37);
  let sy = py + 192;
  for (const line of sumLines) {
    drawText(line, px + 14, sy, 2, INK);
    sy += 17;
  }
}

function draw(): void {
  fillAll(PAPER);
  // masthead
  fillRect(0, 0, W, 164, NAVY);
  fillRect(0, 164, W, 4, GOLD);
  drawTextCentered("THE WORLD IN ONE DAY", 26, 2, GOLD);
  drawTextCentered("TUESDAY 24 NOVEMBER 2026", 58, 6, CREAM);
  drawTextCentered("SIX STORIES THAT DEFINED THE DAY", 118, 2, CREAM);
  // grid: 2 cols x 3 rows
  const pw = 481;
  const ph = 256;
  const xs = [24, 519];
  const ys = [184, 454, 724];
  for (let i = 0; i < 6; i++) {
    drawPanel(STORIES[i], xs[i % 2], ys[Math.floor(i / 2)], pw, ph);
  }
  // footer
  drawTextCentered(
    "ALL SIX STORIES FIRST REPORTED ON TUESDAY 24 NOVEMBER 2026 • SOURCES: REUTERS",
    994,
    2,
    INK,
  );
}

function main(): void {
  draw();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
