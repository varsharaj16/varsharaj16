// Draws the GitHub contribution calendar in pink with a pixel dino running underneath it,
// jumping over cacti planted at the busiest weeks (Chrome-dino style). No dependencies.
// usage: node dino.mjs <github-user> <out.svg>      (run daily by .github/workflows/main.yml)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [user = "varsharaj16", out = "dist/dino-run.svg"] = process.argv.slice(2);

// ---- 1. read the public contribution calendar ----
const html = await (await fetch(`https://github.com/users/${user}/contributions`)).text();
const cells = [...html.matchAll(/<td[^>]*ContributionCalendar-day[^>]*>/g)].map(([tag]) => {
  const [, row, col] = tag.match(/contribution-day-component-(\d+)-(\d+)/) || [];
  const level = tag.match(/data-level="(\d)"/)?.[1];
  return { row: +row, col: +col, level: +level };
}).filter(c => Number.isInteger(c.row) && Number.isInteger(c.col) && c.level >= 0);
if (cells.length < 300) throw new Error(`only found ${cells.length} calendar cells — did GitHub change its markup?`);

// ---- 2. layout ----
const STEP = 14, CELL = 11, PAD = 12, PX = 3;               // grid step, cell size, padding, dino pixel size
const weeks = Math.max(...cells.map(c => c.col)) + 1;
const W = PAD * 2 + weeks * STEP - 3, GROUND = 168, H = GROUND + 16;
const DUR = 14;                                              // seconds for one run across
const COLORS = ["#fbe9ef", "#f8cfdc", "#eeb3c6", "#e98aa6", "#d4587f"];
const colX = col => PAD + col * STEP;

// ---- 3. cacti on the busiest weeks (spaced out), with fallbacks so there's always something to jump ----
const weekSum = Array.from({ length: weeks }, (_, col) => cells.filter(c => c.col === col).reduce((s, c) => s + c.level, 0));
const cactusCols = [];
const tryAdd = col => { if (col > 3 && col < weeks - 2 && cactusCols.every(c => Math.abs(c - col) >= 8)) cactusCols.push(col); };
[...weekSum.keys()].filter(c => weekSum[c] > 0).sort((a, b) => weekSum[b] - weekSum[a]).forEach(c => cactusCols.length < 5 && tryAdd(c));
for (const col of [10, 22, 34, 46]) if (cactusCols.length < 3) tryAdd(Math.min(col, weeks - 3));
cactusCols.sort((a, b) => a - b);

// ---- 4. pixel art ----
const pixels = (rows, palette, x0, y0) => rows.flatMap((row, y) => [...row].map((ch, x) =>
  palette[ch] ? `<rect x="${x0 + x * PX}" y="${y0 + y * PX}" width="${PX}" height="${PX}" fill="${palette[ch]}"/>` : "")).join("");
const DINO_TOP = [
  "...........kkkkkkk..", "..........kgggggggk.", "..........kgwgggggk.", "..........kggggggggk",
  "..........kgggggkkk.", "k.........kggggk....", "k........kgggggkk...", "kk......kggggggggk..",
  "kgk....kgggggggk.k..", "kggkkkkggggggggk....", ".kgggggggggggggk....", "..kgggggggggggk.....",
  "...kgggggggggk......", "....kggggggk........"];
const LEGS_A = [".....kggk.kgk.......", ".....kgk...kk.......", ".....kggk...........", ".....kkkk..........."];
const LEGS_B = [".....kgk..kggk......", "......kk...kgk......", "...........kggk.....", "...........kkkk....."];
const CACTUS = ["..kk...", ".kgck..", ".kgck.k", "kkgckgk", "kgggck.", ".kgck..", ".kgck..", ".kgck..", ".kgck.."];
const DINO_PAL = { k: "#3d2f2b", g: "#8fd39a", w: "#ffffff" };
const CACTUS_PAL = { k: "#3d2f2b", g: "#7cc68a", c: "#5fae6d" };
const dinoH = (DINO_TOP.length + 4) * PX, dinoW = 20 * PX;

// ---- 5. timings: the dino's centre reaches each cactus at t, it jumps around that moment ----
const startX = -dinoW, endX = W + 10, travel = endX - startX;
const timeAt = x => (x - dinoW / 2 - startX) / travel;     // 0..1 of the run when the dino centre is at x
const pct = f => `${(f * 100).toFixed(2)}%`;
const jumpFrames = cactusCols.map(col => {
  const t = timeAt(colX(col) + 4);
  return `${pct(t - .04)}{transform:translateY(0);animation-timing-function:cubic-bezier(.2,.7,.4,1)}` +
         `${pct(t)}{transform:translateY(-46px);animation-timing-function:cubic-bezier(.6,0,.8,.3)}` +
         `${pct(t + .04)}{transform:translateY(0)}`;
}).join("");

// ---- 6. svg ----
const grid = Array.from({ length: weeks }, (_, col) => {
  const delay = (timeAt(colX(col) + CELL / 2) * DUR - .25).toFixed(2);  // column hops as the dino passes
  const rects = cells.filter(c => c.col === col).map(c =>
    `<rect x="${colX(col)}" y="${PAD + c.row * STEP}" width="${CELL}" height="${CELL}" rx="2.5" fill="${COLORS[c.level]}"/>`).join("");
  return `<g class="col" style="animation-delay:${delay}s">${rects}</g>`;
}).join("");
const cacti = cactusCols.map(col => pixels(CACTUS, CACTUS_PAL, colX(col) - 4, GROUND - CACTUS.length * PX)).join("");
const pebbles = Array.from({ length: Math.floor(W / 40) }, (_, i) =>
  `<rect x="${20 + i * 40 + (i * 17) % 23}" y="${GROUND + 5 + (i % 3) * 2}" width="${2 + (i % 2) * 2}" height="2" rx="1" fill="#e2b5c3"/>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${user}'s contributions with a dino running and jumping cacti">
<style>
  .run{animation:run ${DUR}s linear infinite}
  .jump{animation:jump ${DUR}s linear infinite}
  .legs-a{animation:legs .28s steps(1) infinite}
  .legs-b{animation:legs .28s steps(1) infinite;animation-delay:-.14s}
  .col{animation:hop ${DUR}s ease-out infinite}
  @keyframes run{from{transform:translateX(${startX}px)}to{transform:translateX(${endX}px)}}
  @keyframes jump{0%{transform:translateY(0)}${jumpFrames}100%{transform:translateY(0)}}
  @keyframes legs{0%{opacity:1}50%{opacity:0}}
  @keyframes hop{0%{transform:translateY(0)}1.2%{transform:translateY(-4px)}3%,100%{transform:translateY(0)}}
</style>
${grid}
<line x1="0" y1="${GROUND + 1}" x2="${W}" y2="${GROUND + 1}" stroke="#d9a0b2" stroke-width="2" stroke-dasharray="10 4"/>
${pebbles}${cacti}
<g class="run"><g class="jump">
  ${pixels(DINO_TOP, DINO_PAL, 0, GROUND - dinoH)}
  <g class="legs-a">${pixels(LEGS_A, DINO_PAL, 0, GROUND - 4 * PX)}</g>
  <g class="legs-b">${pixels(LEGS_B, DINO_PAL, 0, GROUND - 4 * PX)}</g>
</g></g>
</svg>`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, svg);
console.log(`wrote ${out}: ${cells.length} days, ${weeks} weeks, cacti at weeks ${cactusCols.join(", ")}`);
