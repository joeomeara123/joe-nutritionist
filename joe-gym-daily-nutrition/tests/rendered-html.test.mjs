import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";

// Boot the real production server once and reuse it. The previous helper imported the
// Cloudflare Worker bundle directly; Next.js has no equivalent single-entry artifact, so we
// exercise the server the same way a browser would.
const PORT = 3100 + (process.pid % 400);
let server;
let booted;

function startServer() {
  booted ??= (async () => {
    server = spawn("npx", ["next", "start", "-p", String(PORT)], {
      cwd: new URL("..", import.meta.url).pathname,
      stdio: "ignore",
    });

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const probe = await fetch(`http://localhost:${PORT}/`, { headers: { accept: "text/html" } });
        if (probe.ok) return;
      } catch {
        // not listening yet
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`next start did not come up on port ${PORT}`);
  })();
  return booted;
}

after(() => server?.kill("SIGTERM"));

async function render() {
  await startServer();
  return fetch(`http://localhost:${PORT}/`, { headers: { accept: "text/html" } });
}

test("renders Joe's nutrition dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Joe(?:'|&#x27;)s Daily Nutrition<\/title>/i);
  assert.match(html, /Loading Joe/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("puts Joe's gym favicon inside the document head", async () => {
  const response = await render();
  const html = await response.text();
  const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] || "";
  assert.match(head, /rel="icon"[^>]+href="\/joe-gym-icon\.svg\?v=3"/i);
});

test("keeps Joe's targets and current Veetee pot values exact", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const { FOODS, scaled } = await import("../lib/food-parser.ts");
  const stickyRice = FOODS.find((food) => food.id === "sticky-rice");
  assert.ok(stickyRice);
  const fullPot = scaled(stickyRice, 130);
  assert.match(page, /calories:\s*1800,\s*protein:\s*160,\s*carbs:\s*155,\s*fat:\s*60,\s*fibre:\s*30/);
  assert.equal(fullPot.display, "1 pot");
  assert.equal(fullPot.calories, 198);
  assert.equal(fullPot.protein, 3);
  assert.equal(fullPot.carbs, 41.2);
  assert.equal(fullPot.fat, 2.3);
  // The example meal names its foods by id. It used to index FOODS positionally, and when a
  // food was inserted above them the card said "Nando's sauce" while logging 20g of oven
  // chips — so the guard is that the positional form never comes back.
  assert.match(page, /\["chicken-thigh",\s*192\]/);
  assert.match(page, /\["sticky-rice",\s*130\]/);
  assert.match(page, /\["nandos",\s*20\]/);
  // Comments stripped first: the guard is about code, and the comment explaining the bug
  // naturally quotes the very shape it is guarding against.
  const code = page.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
  assert.doesNotMatch(code, /FOODS\[\d+\]/);
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

test("counts proper meals separately from snacks for the next-food plan", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /properMealCount\s*=\s*meals\.filter\(\(meal\)\s*=>\s*meal\.name\s*!==\s*"Snack"\)\.length/);
  assert.match(page, /recommendDay\(consumed,\s*properMealCount/);
});
