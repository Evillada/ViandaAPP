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

export interface Greeting {
  salutation: string;
  fact: string | null;
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

function salutation(now: Date, firstName: string): string {
  const hour = hourInBogota(now);
  const part = hour >= 5 && hour < 12 ? "Buenos días" : hour >= 12 && hour < 19 ? "Buenas tardes" : "Buenas noches";
  return `${part}, ${firstName}`;
}

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
  const fact =
    appointmentFact(input.now, input.nextAppointmentAt) ?? planFact(input.now, input.planActivatedAt) ?? progressFact(input.progress);
  const pm = input.professionalMessage;
  const message =
    pm && pm.text.trim() && (pm.until === null || pm.until.getTime() >= input.now.getTime())
      ? { text: pm.text.trim(), author: pm.professionalName }
      : { text: phraseOfTheDay(localDateKey(input.now), input.userId), author: null };
  return { salutation: salutation(input.now, input.firstName), fact, message };
}
