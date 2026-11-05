import { Quote, Sparkles } from "lucide-react";
import type { Greeting } from "@/core/portal/greeting";

export function GreetingCard({ greeting }: { greeting: Greeting }) {
  return (
    <section aria-label="Saludo" className="rounded-2xl gradient-wellness border border-border p-5 space-y-3">
      <h1 className="text-2xl font-bold text-text">{greeting.salutation}</h1>
      {greeting.fact && (
        <p className="flex items-start gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          {greeting.fact}
        </p>
      )}
      <figure className="rounded-xl bg-surface/80 p-4">
        <blockquote className="flex gap-2 text-text">
          <Quote className="h-4 w-4 mt-1 shrink-0 text-muted" aria-hidden="true" />
          <p>{greeting.message.text}</p>
        </blockquote>
        {greeting.message.author && <figcaption className="mt-2 text-xs text-muted">— {greeting.message.author}</figcaption>}
      </figure>
    </section>
  );
}
