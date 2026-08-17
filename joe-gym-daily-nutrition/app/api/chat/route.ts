import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";

import { FOODS } from "@/lib/food-parser";
import { DAILY_TARGETS } from "@/lib/recommendations";
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
    grams: { type: "number", description: "Weight in grams. Omit to use one standard portion." },
    raw: { type: "boolean", description: "True if Joe weighed it raw. Meats are stored on a cooked basis, so this matters." },
  },
  required: ["food"],
  additionalProperties: false,
} as const;

function foodCatalogue() {
  return FOODS.map((food) => {
    const basis = food.basis === "portion" ? `per ${food.portionGrams}g ${food.portionLabel}` : "per 100g";
    const raw = food.rawYield ? `, cooked basis (raw x${food.rawYield})` : "";
    return `- ${food.name} [${food.aliases[0]}] ${basis}${raw}: ${food.calories}kcal ${food.protein}P ${food.carbs}C ${food.fat}F ${food.fibre}fib`;
  }).join("\n");
}

function systemPrompt(day: DayState) {
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

## Style
Lead with the number he asked for, in the first sentence. Then one or two lines of why, and what it leaves him for the rest of the day. No preamble, no bullet-point walls, no restating his question back to him. He is holding a pan.

If he mentions a food you have no entry for, say so plainly and give him the closest stocked option — do not invent macros for it.

If he tells you he has eaten something, offer to log it and use \`log_meal\` when he says yes.

## What he actually keeps in
${foodCatalogue()}`;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not set on this deployment." }, { status: 500 });
  }
  if (rateLimited()) {
    return Response.json({ error: "Too many messages in the last minute. Give it a moment." }, { status: 429 });
  }

  const body = (await request.json()) as { messages?: Array<{ role: "user" | "assistant"; content: string }>; day?: DayState };
  const messages = body.messages ?? [];
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
        const match = lookupFood(food);
        return JSON.stringify(match ?? { error: `Not stocked: ${food}` });
      },
    }),
    betaTool({
      name: "price_meal",
      description: "Get exact totals for a meal Joe describes, plus where his day lands after eating it. Use whenever he states the quantities himself.",
      inputSchema: { type: "object", properties: { items: { type: "array", items: ITEM_SCHEMA } }, required: ["items"], additionalProperties: false },
      run: ({ items }: { items: MealItem[] }) => JSON.stringify(priceMeal(items, day)),
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
        },
        required: ["fixed", "variable"],
        additionalProperties: false,
      },
      run: ({ fixed, variable }: { fixed: MealItem[]; variable: string }) => {
        try {
          return JSON.stringify(fitPortion({ day, fixed, variable }));
        } catch (error) {
          return JSON.stringify({ error: error instanceof Error ? error.message : "Could not solve that portion." });
        }
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
        const priced = priceMeal([], day);
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
          system: systemPrompt(day),
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
