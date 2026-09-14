"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deactivatePatient, reactivatePatient } from "../actions";
import { Badge, Card } from "@/shared/ui/components";
import { formatDate, getInitials } from "@/shared/lib/utils";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
  status: string;
  _count?: { assessments: number; mealPlans: number };
  assessments?: {
    anthropometry: { weightKg: number } | null;
    nutritionalGoal: { targetKcal: number } | null;
  }[];
}

export function PatientList({ patients }: { patients: Patient[] }) {
  const [isPending, startTransition] = useTransition();

  if (patients.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-muted">Aún no tienes pacientes registrados</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {patients.map((patient) => (
        <Card key={patient.id} hover>
          <div className="flex items-start justify-between gap-4">
            <Link href={`/dashboard/patients/${patient.id}`} className="flex items-start gap-3 flex-1">
              <div className="w-11 h-11 rounded-full bg-primary-light flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                {getInitials(`${patient.firstName} ${patient.lastName}`)}
              </div>
              <div>
                <h4 className="font-semibold text-text hover:text-primary transition-colors">
                  {patient.firstName} {patient.lastName}
                </h4>
                <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted">
                  {patient.email && <span>{patient.email}</span>}
                  {patient._count && (
                    <span>{patient._count.assessments} valoración(es)</span>
                  )}
                </div>
                {patient.assessments?.[0]?.anthropometry && (
                  <p className="text-xs text-primary mt-1">
                    {patient.assessments[0].anthropometry.weightKg} kg
                    {patient.assessments.length > 1 &&
                      patient.assessments[1]?.anthropometry && (
                        <>
                          {" "}
                          {(() => {
                            const curr = patient.assessments[0]!.anthropometry!.weightKg;
                            const prev = patient.assessments[1]!.anthropometry!.weightKg;
                            const diff = Math.round((curr - prev) * 10) / 10;
                            return diff < 0 ? `▼ ${Math.abs(diff)} kg` : diff > 0 ? `▲ ${diff} kg` : "sin cambio";
                          })()}
                        </>
                      )}
                    {patient.assessments[0].nutritionalGoal && (
                      <> · Meta {patient.assessments[0].nutritionalGoal.targetKcal} kcal</>
                    )}
                  </p>
                )}
              </div>
            </Link>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={patient.status === "ACTIVE" ? "default" : patient.status === "DISCHARGED" ? "info" : "muted"}>
                {patient.status === "ACTIVE" ? "Activo" : patient.status === "DISCHARGED" ? "Alta" : "Inactivo"}
              </Badge>
              {patient.status === "ACTIVE" ? (
                <button
                  onClick={() => startTransition(() => { void deactivatePatient(patient.id); })}
                  disabled={isPending}
                  className="text-xs text-warning hover:underline disabled:opacity-50"
                >
                  Desactivar
                </button>
              ) : (
                <button
                  onClick={() => startTransition(() => { void reactivatePatient(patient.id); })}
                  disabled={isPending}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  Reactivar
                </button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
