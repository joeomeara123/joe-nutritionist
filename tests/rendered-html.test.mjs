import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders Joe's nutrition dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Joe(?:'|&#x27;)s Daily Nutrition<\/title>/i);
  assert.match(html, /Loading Joe/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps Joe's targets and current Veetee pot values exact", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /calories:\s*1800,\s*protein:\s*160,\s*carbs:\s*155,\s*fat:\s*60,\s*fibre:\s*30/);
  assert.match(page, /portionGrams:\s*130[\s\S]*?calories:\s*198,\s*protein:\s*3,\s*carbs:\s*41\.2,\s*fat:\s*2\.3/);
  assert.match(page, /scaled\(FOODS\[0\],\s*192\)/);
  assert.match(page, /scaled\(FOODS\[4\],\s*130\)/);
  assert.match(page, /Protein[\s\S]*?grams:\s*160,\s*calories:\s*640,\s*percent:\s*35\.6/);
  assert.match(page, /Carbs[\s\S]*?grams:\s*155,\s*calories:\s*620,\s*percent:\s*34\.4/);
  assert.match(page, /Fat[\s\S]*?grams:\s*60,\s*calories:\s*540,\s*percent:\s*30/);
  const splitStart = page.indexOf("const CALORIE_SPLIT");
  const split = page.slice(splitStart, page.indexOf("];", splitStart) + 2);
  const calorieSegments = [...split.matchAll(/calories:\s*(\d+)/g)].map((match) => Number(match[1]));
  const percentageSegments = [...split.matchAll(/percent:\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  assert.equal(calorieSegments.reduce((sum, value) => sum + value, 0), 1800);
  assert.equal(percentageSegments.reduce((sum, value) => sum + value, 0), 100);
});

test("fills each macro sector independently against its own target", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /consumed\.protein\s*\/\s*TARGETS\.protein/);
  assert.match(page, /consumed\.carbs\s*\/\s*TARGETS\.carbs/);
  assert.match(page, /consumed\.fat\s*\/\s*TARGETS\.fat/);
  assert.match(page, /--protein-fill/);
  assert.match(page, /--carbs-fill/);
  assert.match(page, /--fat-fill/);
  assert.match(styles, /repeating-conic-gradient/);
});

test("starts the protein progress at the 12 o'clock divider", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const progressRule = styles.match(/\.wheel-progress\s*\{[^}]+\}/)?.[0] || "";
  assert.doesNotMatch(progressRule, /from\s+-90deg/);
  assert.match(progressRule, /conic-gradient\(var\(--protein\)\s+0\s+var\(--protein-fill\)/);
});

test("uses vibrant category colours for both filled and unfinished wheel sectors", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const targetRule = styles.match(/\.wheel-target\s*\{[^}]+\}/)?.[0] || "";
  assert.match(styles, /--protein:#ff3b30/i);
  assert.match(styles, /--carbs:#1769ff/i);
  assert.match(styles, /--fat:#ffc400/i);
  assert.match(targetRule, /conic-gradient\(var\(--protein\)\s+0\s+128\.16deg,var\(--carbs\)\s+128\.16deg\s+252deg,var\(--fat\)\s+252deg\s+360deg\)/);
  assert.match(targetRule, /mask:repeating-conic-gradient/);
  assert.doesNotMatch(page, /wheel-spoke|spoke-protein|spoke-carbs|spoke-fat/);
});
