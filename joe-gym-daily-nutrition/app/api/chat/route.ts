import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";

import { FOODS, type Food, type Macros } from "@/lib/food-parser";
import { pantryFoods, type PantryFood } from "@/lib/pantry";
import { DAILY_TARGETS } from "@/lib/recommendations";
import { searchFoodDatabase } from "@/lib/food-lookup";
import { fitPortion, lookupFood, priceMeal, remainingFor, suggestMeals, type DayState, type MealItem } from "@/lib/nutrition-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-opus-5";

/** Crude per-process throttle. The real gate is Vercel deployment protection; this just stops
 *  a stuck client from looping the key away. */
const recent: number[] = [];
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function rateLimited() {
  const now = Date.now();
  while (recent.length && now - recent[0] > RATE_WINDOW_MS) recent.shift();
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  return false;
}

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    food: { type: "string", description: "Food name as Joe says it, e.g. 'chicken thighs', 'sticky rice', 'olive oil'." },
    grams: { type: "number", description: "Weight in grams, when Joe states a weight. Do not compute this from a count — use `portions` instead." },
    portions: { type: "number", description: "Number of whole items when Joe counts rather than weighs: 'three chicken thighs' is portions: 3. Never multiply a count by a portion size yourself; pass the count here and the tool does it." },
    per100g: {
      type: "object",
      description:
        "Only for a food that is NOT in the list below. Its macros per 100g, either from search_food_database or read off the packet by Joe. Never fill this in from your own knowledge — if you have neither, say so and ask.",
      properties: {
        calories: { type: "number" },
        protein: { type: "number" },
        carbs: { type: "number" },
        fat: { type: "number" },
        fibre: { type: "number" },
      },
      required: ["calories", "protein", "carbs", "fat", "fibre"],
      additionalProperties: false,
    },
    weighedAs: { type: "string", enum: ["cooked", "uncooked"], description: "Only meaningful alongside `grams`: the state Joe weighed it in. Pass it whenever he says, in either direction — meat is stored cooked and pasta is stored dry, so 'uncooked chicken' and 'cooked pasta' both need converting, opposite ways. Omit it if he did not say. A counted portion is already on the stored basis and ignores this." },
  },
  required: ["food"],
  additionalProperties: false,
} as const;

function foodCatalogue(pantry: Food[]) {
  return [...FOODS, ...pantry].map((food) => {
    const basis = food.basis === "portion" ? `per ${food.portionGrams}g ${food.portionLabel}` : "per 100g";
    // A 100g-basis food can still have a serving size; the model needs it to use `portions`.
    const serving = food.basis === "100g" && food.portionGrams ? `, 1 ${food.portionLabel} = ${food.portionGrams}g` : "";
    const raw = food.weighedAs && food.cookedRatio ? `, weighed ${food.weighedAs} (cooked = uncooked x${food.cookedRatio})` : "";
    // Flag the handful of foods whose numbers are estimates rather than label figures, so the
    // chat can say so instead of quoting them with the same confidence as the rest.
    const estimate = food.source ? "" : " [ESTIMATE, not from a label]";
    // A scanned food is his, but its numbers may be the database's rather than the packet's,
    // and a missing fibre figure is carried as 0. Both have to be sayable.
    const scanned = food.id.startsWith("pantry:")
      ? ` [SCANNED${food.provisional ? ", from the barcode database and not checked against the packet" : ", read off the packet"}${food.fibreUnknown ? "; fibre not published, counted as 0" : ""}]`
      : "";
    return `- ${food.name} [${food.aliases[0]}] ${basis}${serving}${raw}: ${food.calories}kcal ${food.protein}P ${food.carbs}C ${food.fat}F ${food.fibre}fib${estimate}${scanned}`;
  }).join("\n");
}

function systemPrompt(day: DayState, pantry: Food[]) {
  const left = remainingFor(day.consumed);
  return `You are Joe's nutrition coach, built into his own food tracker. He talks to you while he is cooking, so answer like a person standing next to him at the hob.

## His fixed daily targets
${DAILY_TARGETS.calories} kcal, ${DAILY_TARGETS.protein}g protein, ${DAILY_TARGETS.carbs}g carbs, ${DAILY_TARGETS.fat}g fat, at least ${DAILY_TARGETS.fibre}g fibre.
Fibre is a hard minimum, not something to optimise away. Never suggest changing the targets.

## Where he is today
Eaten so far: ${Math.round(day.consumed.calories)} kcal, ${day.consumed.protein.toFixed(1)}g protein, ${day.consumed.carbs.toFixed(1)}g carbs, ${day.consumed.fat.toFixed(1)}g fat, ${day.consumed.fibre.toFixed(1)}g fibre across ${day.mealCount} meal(s).
Still to go: ${left.calories} kcal, ${left.protein}g protein, ${left.carbs}g carbs, ${left.fat}g fat, ${left.fibre}g fibre.

## The one rule you must not break
**Never do the arithmetic yourself.** Do not add, scale, or estimate macros in your head, and never state a gram amount, calorie count or macro figure that did not come back from a tool call in this turn. Every number you give Joe must be one a tool returned. If you need a number, call a tool — that is what they are for. Getting a portion subtly wrong is worse than asking him to wait a second.

When he asks "how much X do I need" or "how much X can I add", that is \`fit_portion\`: the fixed things he is already cooking go in \`fixed\`, and X is the \`variable\`. It solves for the portion that best fits what is left of his day, so a mostly-empty day yields a big portion and a nearly-finished one yields a small one. You do not need to reason about that trade-off — the tool has.

When he names a craving ("I fancy pasta"), call \`suggest_meals\` with it, then quote the exact items and macros it returns.

**Answer first, refine after.** He is cooking, not filling in a form — a question costs him more than a slightly-off assumption. Only ask something back when no assumption is possible at all, and never ask for a number you could have taken from the food list.

How to express what he is cooking:
- He **counts** items ("three chicken thighs", "a bagel") — pass \`portions: 3\`. Do not work out the gram weight yourself; multiplying a count by a portion size is arithmetic, and arithmetic is the tool's job. Leave \`weighedAs\` unset: portion sizes are already on the food's own basis.
- He says **raw, uncooked, dry or cooked** — pass that as \`weighedAs\` ("raw" and "dry" are both \`uncooked\`). This matters in both directions and they are not symmetric: meat is stored cooked, so uncooked chicken converts *down*; pasta is stored dry, so cooked pasta converts *down* too. Never do that conversion yourself.
- He gives a **weight** without saying which ("428g chicken thighs") — pass \`grams\` with \`weighedAs: "uncooked"\`. He weighs things as they come out of the packet. Tell him you took it as uncooked so he can correct you.

## Formatting
Plain prose. No markdown — no \`**bold**\`, no headings, no bullet lists. The app renders your reply as plain text, so asterisks show up as literal asterisks.

## Style
Lead with the number he asked for, in the first sentence. Then one or two lines of why, and what it leaves him for the rest of the day. No preamble, no bullet-point walls, no restating his question back to him. He is holding a pan.

## When he names a food you do not stock
The list below is his usual shop, not the limit of what he eats. Never substitute a lookalike's numbers and never invent any, but do not dead-end either — that list is a starting point, not a boundary. In order:

1. Call \`search_food_database\`. Pick the candidate that matches what he actually has, then pass its \`per100g\` straight into \`price_meal\` or \`fit_portion\` alongside everything else on the plate. Mention in passing that the figure came from a lookup rather than his own shelf.
2. If nothing usable comes back, ask him to read the per-100g panel off the packet — four numbers — and pass those as \`per100g\`. That is the most accurate answer available, so it is worth one short question.

If he is standing there holding the packet, mention that tapping Scan in the app and pointing the camera at the barcode is quicker than reading numbers out, and that it saves the product so he never has to do it twice. Say it once, in passing — do not push it, and never make it a condition of answering.

Price the whole meal in one call, mixing stocked and looked-up foods freely. Do not make him choose between an answer and an accurate one.

Tool results can carry an \`assumed\` field on an item. \`"quantity"\` means he named a food without an amount; \`"portionSize"\` means he counted pieces of something whose pieces vary — a chicken thigh is stored at 64g, but the pack itself says sizes vary, so three thighs is a count and not a weight. When an assumed item is a meaningful part of the meal, say what you assumed in a half-sentence and offer to reprice if he weighs it. Do not hide it, and do not make a fuss about it either.

Most figures below come straight off the Sainsbury's label for the product he buys. The few marked ESTIMATE do not — Sainsbury's publishes no table for those. Use them normally, but if one is the main thing driving your answer, mention in passing that it is an estimate.

If he tells you he has eaten something, offer to log it and use \`log_meal\` when he says yes.

## What he actually keeps in
${foodCatalogue(pantry)}`;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not set on this deployment." }, { status: 500 });
  }
  if (rateLimited()) {
    return Response.json({ error: "Too many messages in the last minute. Give it a moment." }, { status: 429 });
  }

  const body = (await request.json()) as { messages?: Array<{ role: "user" | "assistant"; content: string }>; day?: DayState; pantry?: PantryFood[] };
  const messages = body.messages ?? [];
  // Foods Joe has scanned. They live in his browser, so they arrive with each request the
  // same way the diary does — the server holds no state of its own.
  const pantry = pantryFoods(body.pantry ?? []);
  const day: DayState = body.day ?? { consumed: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }, mealCount: 0, hour: new Date().getHours() };

  if (!messages.length) return Response.json({ error: "No messages." }, { status: 400 });

  const client = new Anthropic();
  // log_meal cannot touch localStorage from the server, so it records intent here and the
  // client applies it to the diary when the stream closes.
  const pendingLogs: Array<{ name: string; text: string }> = [];

  const tools = [
    betaTool({
      name: "lookup_food",
      description: "Look up one stored food and its exact macros. Use before quoting any per-100g or per-portion figure.",
      inputSchema: { type: "object", properties: { food: { type: "string" } }, required: ["food"], additionalProperties: false },
      run: ({ food }: { food: string }) => {
        const match = lookupFood(food, pantry);
        return JSON.stringify(match ?? { error: `Not stocked: ${food}` });
      },
    }),
    betaTool({
      name: "price_meal",
      description: "Get exact totals for a meal Joe describes, plus where his day lands after eating it. Use whenever he states the quantities himself.",
      inputSchema: { type: "object", properties: { items: { type: "array", items: ITEM_SCHEMA } }, required: ["items"], additionalProperties: false },
      run: ({ items }: { items: MealItem[] }) => JSON.stringify(priceMeal(items, day, pantry)),
    }),
    betaTool({
      name: "fit_portion",
      description:
        "Solve for how much of ONE food fits the rest of the day, given the things already going in the pan. This is the answer to 'how much rice do I need' and 'how much oil can I use'. Returns the exact grams plus the resulting day totals.",
      inputSchema: {
        type: "object",
        properties: {
          fixed: { type: "array", items: ITEM_SCHEMA, description: "What he is already cooking, with quantities." },
          variable: { type: "string", description: "The single food to solve the portion for." },
          variablePer100g: {
            type: "object",
            description: "Macros per 100g when the variable food is not in the list below. Same rule as `per100g`: from a lookup or from Joe, never from you.",
            properties: { calories: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" }, fibre: { type: "number" } },
            required: ["calories", "protein", "carbs", "fat", "fibre"],
            additionalProperties: false,
          },
        },
        required: ["fixed", "variable"],
        additionalProperties: false,
      },
      run: ({ fixed, variable, variablePer100g }: { fixed: MealItem[]; variable: string; variablePer100g?: Macros }) => {
        try {
          return JSON.stringify(fitPortion({ day, fixed, variable, variablePer100g, pantry }));
        } catch (error) {
          return JSON.stringify({ error: error instanceof Error ? error.message : "Could not solve that portion." });
        }
      },
    }),
    betaTool({
      name: "search_food_database",
      description:
        "Look up a food Joe does not keep in, when he names something outside the list below. Returns candidate products with macros per 100g from Open Food Facts. Pick the one matching what he actually has, then pass its per100g into price_meal or fit_portion. The data is community-maintained, so say the figure came from a lookup.",
      inputSchema: {
        type: "object",
        properties: { food: { type: "string", description: "What Joe called it, plus a brand if he gave one, e.g. \"Sainsbury's 0% fat Greek yogurt\"." } },
        required: ["food"],
        additionalProperties: false,
      },
      run: async ({ food }: { food: string }) => {
        const { foods, unreachable } = await searchFoodDatabase(food);
        // "The database is down" and "that food does not exist" are different answers, and
        // telling Joe the second when the first is true is how he gets told a food is not real.
        if (unreachable) return JSON.stringify({ error: "The food database is not responding right now. Ask Joe to read the per-100g panel off the packet, or to scan its barcode." });
        return JSON.stringify(foods.length ? foods : { error: `Nothing usable found for "${food}". Ask Joe to read the per-100g panel off the packet, or to scan its barcode.` });
      },
    }),
    betaTool({
      name: "suggest_meals",
      description: "Rank meals Joe can build from what he keeps in, sized to the rest of his day. Pass a craving like 'pasta' or 'chicken' to filter.",
      inputSchema: { type: "object", properties: { craving: { type: "string" } }, required: [], additionalProperties: false },
      run: ({ craving }: { craving?: string }) => JSON.stringify(suggestMeals(day, craving).slice(0, 5)),
    }),
    betaTool({
      name: "log_meal",
      description: "Log a meal to today's diary. Only call this after Joe confirms he has eaten it.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", enum: ["Lunch", "Dinner", "Snack"] },
          text: { type: "string", description: "Plain description with quantities, e.g. '308g cooked chicken thighs and 4g olive oil'." },
        },
        required: ["name", "text"],
        additionalProperties: false,
      },
      run: ({ name, text }: { name: string; text: string }) => {
        const priced = priceMeal([], day, pantry);
        pendingLogs.push({ name, text });
        return JSON.stringify({ logged: true, name, text, note: "Applied to the diary in the app.", remaining: priced.remaining });
      },
    }),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        const runner = client.beta.messages.toolRunner({
          model: MODEL,
          max_tokens: 4096,
          // Thinking is on (adaptive) by default on Claude Opus 5 — passing it explicitly
          // trips this SDK version's older typings, and omitting it is equivalent.
          output_config: { effort: "medium" },
          system: systemPrompt(day, pantry),
          tools,
          messages: messages.map((message) => ({ role: message.role, content: message.content })),
          stream: true,
        });

        for await (const messageStream of runner) {
          for await (const event of messageStream) {
            if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
              send({ type: "tool", name: event.content_block.name });
            }
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send({ type: "text", text: event.delta.text });
            }
          }
        }

        if (pendingLogs.length) send({ type: "log", meals: pendingLogs });
        send({ type: "done" });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Chat failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
