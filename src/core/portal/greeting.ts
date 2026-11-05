import { phraseOfTheDay } from "./daily-phrases";
import { PORTAL_TIME_ZONE, daysBetweenKeys, localDateKey } from "./plan-cycle";

export type GoalDirection = "DECREASE" | "INCREASE" | "MAINTAIN";

export interface MeasurementPoint {
  weightKg: number;
  waistCm: number | null;
}

export interface GreetingInput {
  now: Date;
  firstName: string;
  userId: string;
  nextAppointmentAt: Date | null;
  planActivatedAt: Date | null;
  progress: { enabled: boolean; bmiCategory: string | null; latest: MeasurementPoint | null; previous: MeasurementPoint | null };
  professionalMessage: { text: string; until: Date | null; professionalName: string } | null;
}

export type DayPeriod = "MORNING" | "AFTERNOON" | "NIGHT";
export type FactKind = "APPOINTMENT" | "PLAN" | "PROGRESS";

export interface Greeting {
  salutation: string;
  period: DayPeriod;
  fact: string | null;
  factKind: FactKind | null;
  message: { text: string; author: string | null };
}

const WEIGHT_STEP_KG = 0.3;
const WAIST_STEP_CM = 0.5;

export function goalDirection(bmiCategory: string | null): GoalDirection {
  if (bmiCategory === "UNDERWEIGHT") return "INCREASE";
  if (bmiCategory && ["OVERWEIGHT", "OBESE_I", "OBESE_II", "OBESE_III"].includes(bmiCategory)) return "DECREASE";
  return "MAINTAIN";
}

function hourInBogota(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: PORTAL_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now));
}

function dayPeriod(now: Date): DayPeriod {
  const hour = hourInBogota(now);
  return hour >= 5 && hour < 12 ? "MORNING" : hour >= 12 && hour < 19 ? "AFTERNOON" : "NIGHT";
}

const SALUTATIONS: Record<DayPeriod, string> = { MORNING: "Buenos días", AFTERNOON: "Buenas tardes", NIGHT: "Buenas noches" };

const formatNumber = (value: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(value);

function appointmentFact(now: Date, at: Date | null): string | null {
  if (!at) return null;
  const days = daysBetweenKeys(localDateKey(now), localDateKey(at));
  if (days < 0 || days > 7) return null;
  const label = new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(at);
  const time = new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(at);
  return `Tu próxima cita es el ${label.replace(",", "")} a las ${time}`;
}

function planFact(now: Date, activatedAt: Date | null): string | null {
  if (!activatedAt) return null;
  const days = daysBetweenKeys(localDateKey(activatedAt), localDateKey(now));
  if (days < 0) return null;
  return days === 0 ? "Hoy empiezas tu plan" : `Llevas ${days} días con tu plan`;
}

function progressFact(progress: GreetingInput["progress"]): string | null {
  const { enabled, latest, previous, bmiCategory } = progress;
  if (!enabled || !latest || !previous) return null;
  const direction = goalDirection(bmiCategory);
  if (direction !== "INCREASE" && latest.waistCm !== null && previous.waistCm !== null) {
    const drop = previous.waistCm - latest.waistCm;
    if (drop >= WAIST_STEP_CM) return `Tu cintura bajó ${formatNumber(drop)} cm desde tu última valoración`;
  }
  const delta = latest.weightKg - previous.weightKg;
  if (direction === "DECREASE" && -delta >= WEIGHT_STEP_KG) {
    return `Bajaste ${formatNumber(-delta)} kg desde tu última valoración, en la dirección de tu objetivo`;
  }
  if (direction === "INCREASE" && delta >= WEIGHT_STEP_KG) {
    return `Subiste ${formatNumber(delta)} kg desde tu última valoración, en la dirección de tu objetivo`;
  }
  return null;
}

export function buildGreeting(input: GreetingInput): Greeting {
  const facts: [FactKind, string | null][] = [
    ["APPOINTMENT", appointmentFact(input.now, input.nextAppointmentAt)],
    ["PLAN", planFact(input.now, input.planActivatedAt)],
    ["PROGRESS", progressFact(input.progress)],
  ];
  const [factKind, fact] = facts.find(([, text]) => text !== null) ?? [null, null];
  const period = dayPeriod(input.now);
  const pm = input.professionalMessage;
  const message =
    pm && pm.text.trim() && (pm.until === null || pm.until.getTime() >= input.now.getTime())
      ? { text: pm.text.trim(), author: pm.professionalName }
      : { text: phraseOfTheDay(localDateKey(input.now), input.userId), author: null };
  return { salutation: `${SALUTATIONS[period]}, ${input.firstName}`, period, fact, factKind, message };
}
