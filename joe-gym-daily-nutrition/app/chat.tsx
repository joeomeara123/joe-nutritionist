"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import type { DayState } from "@/lib/nutrition-tools";

type ChatMessage = { role: "user" | "assistant"; content: string };

const TOOL_LABELS: Record<string, string> = {
  lookup_food: "checking the food values",
  price_meal: "working out the totals",
  fit_portion: "solving the portion",
  suggest_meals: "looking at what you can build",
  log_meal: "logging it",
};

const PROMPTS = [
  "I'm about to cook 3 chicken thighs, how much rice do I need?",
  "I'm craving pasta — what can I make?",
  "How much oil can I use with 400g of raw chicken?",
];

export default function Chat({ day, onLogMeal }: { day: DayState; onLogMeal: (name: string, text: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activity, setActivity] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activity]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || streaming) return;

    const history: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError("");
    setStreaming(true);
    setActivity("thinking");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, day }),
      });

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => ({ error: "Chat is unavailable." }));
        throw new Error(detail.error ?? "Chat is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          const event = JSON.parse(chunk.slice(6));

          if (event.type === "text") {
            setActivity("");
            setMessages((current) => {
              const next = [...current];
              next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + event.text };
              return next;
            });
          } else if (event.type === "tool") {
            setActivity(TOOL_LABELS[event.name] ?? "working");
          } else if (event.type === "log") {
            for (const meal of event.meals) onLogMeal(meal.name, meal.text);
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chat is unavailable.");
      setMessages((current) => current.filter((message, index) => !(index === current.length - 1 && !message.content)));
    } finally {
      setStreaming(false);
      setActivity("");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <section className="chat-card" id="chat">
      <p className="eyebrow">Ask</p>
      <h2>What should I make?</h2>
      <p className="chat-blurb">
        It knows today&apos;s targets, what you&apos;ve already eaten and everything you keep in. Every gram it quotes is
        calculated, not guessed.
      </p>

      <div className="chat-log" ref={scrollRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-prompts">
            {PROMPTS.map((prompt) => (
              <button type="button" key={prompt} className="chat-prompt" onClick={() => void ask(prompt)} disabled={streaming}>
                {prompt}
              </button>
            ))}
          </div>
        )}

        {messages.map((message, index) => (
          <div className={`chat-bubble ${message.role}`} key={index}>
            {message.content || (message.role === "assistant" && !activity ? "…" : message.content)}
          </div>
        ))}

        {activity && <div className="chat-activity">{activity}…</div>}
        {error && <div className="chat-error">{error}</div>}
      </div>

      <form className="chat-form" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="e.g. I'm cooking 3 chicken thighs, how much rice?"
          aria-label="Ask about your food"
          disabled={streaming}
        />
        <button type="submit" className="chat-send" disabled={streaming || !draft.trim()}>
          {streaming ? "…" : "Ask"}
        </button>
      </form>
    </section>
  );
}
