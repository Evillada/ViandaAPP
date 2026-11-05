import { CalendarHeart, Flame, Moon, Sprout, Sun, SunMedium, type LucideIcon } from "lucide-react";
import type { DayPeriod, FactKind, Greeting } from "@/core/portal/greeting";
import { cn, getInitials } from "@/shared/lib/utils";

const PERIOD_STYLE: Record<DayPeriod, { card: string; Icon: LucideIcon; title: string; chip: string; quote: string; mark: string }> = {
  MORNING: {
    card: "bg-gradient-to-br from-[#ffd9b0] via-[#ffeedd] to-[#c8ece6]",
    Icon: Sun,
    title: "text-text",
    chip: "bg-white/80 text-primary-dark",
    quote: "bg-white/75 text-text",
    mark: "text-accent",
  },
  AFTERNOON: {
    card: "bg-gradient-to-br from-[#b9e6df] via-[#dff1f8] to-[#ffdcb8]",
    Icon: SunMedium,
    title: "text-text",
    chip: "bg-white/80 text-primary-dark",
    quote: "bg-white/75 text-text",
    mark: "text-primary",
  },
  NIGHT: {
    card: "bg-gradient-to-br from-text via-[#24555f] to-primary-dark",
    Icon: Moon,
    title: "text-white",
    chip: "bg-white/15 text-white",
    quote: "bg-white/10 text-white",
    mark: "text-accent",
  },
};

const FACT_ICONS: Record<FactKind, LucideIcon> = { APPOINTMENT: CalendarHeart, PLAN: Flame, PROGRESS: Sprout };

export function GreetingCard({ greeting }: { greeting: Greeting }) {
  const style = PERIOD_STYLE[greeting.period];
  const FactIcon = greeting.factKind ? FACT_ICONS[greeting.factKind] : null;
  const author = greeting.message.author;

  return (
    <section aria-label="Saludo" className={cn("greeting-enter relative overflow-hidden rounded-3xl p-5 shadow-sm space-y-4", style.card)}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/25" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/15" />
      <style.Icon aria-hidden="true" className={cn("greeting-float pointer-events-none absolute right-5 top-5 h-12 w-12", style.mark)} strokeWidth={1.5} />

      <h1 className={cn("relative pr-16 text-[1.75rem] font-bold leading-tight", style.title)}>{greeting.salutation}</h1>

      {greeting.fact && FactIcon && (
        <p className={cn("relative flex items-center gap-3 rounded-2xl py-2 pl-2 pr-3 text-sm font-semibold shadow-sm", style.chip)}>
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <FactIcon className="h-4 w-4" />
          </span>
          {greeting.fact}
        </p>
      )}

      <figure className={cn("relative rounded-2xl p-4 backdrop-blur-sm", style.quote)}>
        <span aria-hidden="true" className={cn("absolute -top-3 left-3 font-serif text-6xl leading-none", style.mark)}>
          &ldquo;
        </span>
        {!author && <p className="mb-1 pl-7 text-xs font-semibold uppercase tracking-wide opacity-70">Tu frase de hoy</p>}
        <blockquote className="pl-7 text-lg font-medium leading-snug">{greeting.message.text}</blockquote>
        {author && (
          <figcaption className="mt-3 flex items-center gap-2 pl-7 text-sm">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {getInitials(author)}
            </span>
            <span>
              <span className="block text-xs opacity-70">Mensaje de</span>
              <span className="block font-semibold">{author}</span>
            </span>
          </figcaption>
        )}
      </figure>
    </section>
  );
}
