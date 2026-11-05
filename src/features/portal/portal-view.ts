import { canViewPatientRecord } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import { buildGreeting, type Greeting } from "@/core/portal/greeting";
import { cycleDayIndex, localDateKey, weekDateKeys, keyToNoonUtc } from "@/core/portal/plan-cycle";
import {
  getActivePlan,
  getAppointments,
  getPortalRecords,
  getProgressSnapshot,
  pickRecord,
  type PortalAppointment,
  type PortalDay,
  type PortalPlan,
  type PortalRecord,
} from "./portal-data";

export interface PortalContext {
  records: { patientId: string; professionalName: string }[];
  current: PortalRecord;
}

export interface PortalHome {
  context: PortalContext;
  greeting: Greeting;
  today: { dateKey: string; day: PortalDay | null; planName: string | null; instructions: string | null; goalKcal: number | null };
  nextAppointment: PortalAppointment | null;
}

export interface PortalWeek {
  context: PortalContext;
  plan: PortalPlan | null;
  todayKey: string;
  week: { dateKey: string; dayIndex: number | null }[];
  weekOffset: number;
}

export async function loadPortalContext(actor: Actor, requested: string | null): Promise<PortalContext | null> {
  if (actor.activeArea !== "PATIENT") return null;
  const records = await getPortalRecords(actor.userId);
  const current = pickRecord(records, requested);
  if (!current) return null;
  // getPortalRecords ya filtra por vínculo y consentimiento vigente; la política lo confirma explícitamente.
  if (!canViewPatientRecord(actor, { professionalId: "-", userId: actor.userId, consentActive: true })) return null;
  return { records: records.map((r) => ({ patientId: r.patientId, professionalName: r.professionalName })), current };
}

export async function buildPortalHome(actor: Actor, requested: string | null, now: Date, firstName: string): Promise<PortalHome | null> {
  const context = await loadPortalContext(actor, requested);
  if (!context) return null;
  const patientId = context.current.patientId;
  const [plan, appointments, progress] = await Promise.all([
    getActivePlan(patientId),
    getAppointments(patientId, now),
    getProgressSnapshot(patientId),
  ]);
  const index = plan ? cycleDayIndex({ activatedAt: plan.activatedAt, date: now, dayCount: plan.days.length }) : null;
  const nextAppointment = appointments.upcoming[0] ?? null;
  const greeting = buildGreeting({
    now,
    firstName: firstName || context.current.firstName,
    userId: actor.userId,
    nextAppointmentAt: nextAppointment?.date ?? null,
    planActivatedAt: plan?.activatedAt ?? null,
    progress: { enabled: context.current.progressMessagesEnabled, ...progress },
    professionalMessage: context.current.portalMessage
      ? { text: context.current.portalMessage, until: context.current.portalMessageUntil, professionalName: context.current.professionalName }
      : null,
  });
  return {
    context,
    greeting,
    today: {
      dateKey: localDateKey(now),
      day: index === null ? null : plan!.days[index] ?? null,
      planName: plan?.name ?? null,
      instructions: plan?.patientInstructions ?? null,
      goalKcal: plan?.goal?.targetKcal ?? null,
    },
    nextAppointment,
  };
}

export async function buildPortalWeek(actor: Actor, requested: string | null, now: Date, weekOffset: number): Promise<PortalWeek | null> {
  const context = await loadPortalContext(actor, requested);
  if (!context) return null;
  const plan = await getActivePlan(context.current.patientId);
  const offset = Math.max(-12, Math.min(12, Math.trunc(weekOffset) || 0));
  const week = weekDateKeys(now, offset).map((dateKey) => ({
    dateKey,
    dayIndex: plan ? cycleDayIndex({ activatedAt: plan.activatedAt, date: keyToNoonUtc(dateKey), dayCount: plan.days.length }) : null,
  }));
  return { context, plan, todayKey: localDateKey(now), week, weekOffset: offset };
}

export async function buildPortalAppointments(actor: Actor, requested: string | null, now: Date) {
  const context = await loadPortalContext(actor, requested);
  if (!context) return null;
  const { upcoming, past } = await getAppointments(context.current.patientId, now);
  return { context, upcoming, past };
}
