"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deactivatePatient, reactivatePatient, dischargePatient } from "../actions";
import { Badge, Card, ConfirmModal, useToast } from "@/shared/ui/components";
import { formatDate, getInitials } from "@/shared/lib/utils";
import { PATIENT_STATUS_LABELS } from "@/shared/lib/labels";

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

interface PatientListProps {
  patients: Patient[];
  searchQuery?: string;
  statusFilter?: string;
}

export function PatientList({ patients, searchQuery, statusFilter }: PatientListProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    name: string;
    action: "deactivate" | "discharge";
  } | null>(null);
  const { success, error } = useToast();

  // Client-side filtering as backup
  let filtered = patients;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.includes(q)
    );
  }
  if (statusFilter && statusFilter !== "ALL") {
    filtered = filtered.filter((p) => p.status === statusFilter);
  }

  function handleDeactivate(id: string) {
    startTransition(async () => {
      const result = await deactivatePatient(id);
      if (result.error) error(result.error);
      else success("Paciente desactivado");
      setConfirmAction(null);
    });
  }

  function handleDischarge(id: string) {
    startTransition(async () => {
      const result = await dischargePatient(id);
      if (result.error) error(result.error);
      else success("Paciente dado de alta");
      setConfirmAction(null);
    });
  }

  function handleReactivate(id: string) {
    startTransition(async () => {
      const result = await reactivatePatient(id);
      if (result.error) error(result.error);
      else success("Paciente reactivado");
    });
  }

  if (filtered.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-4xl mb-3">{searchQuery ? "🔍" : "👥"}</p>
          <p className="text-muted">
            {searchQuery
              ? `No se encontraron pacientes para "${searchQuery}"`
              : "Aún no tienes pacientes registrados"}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {filtered.map((patient) => (
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
                <Badge
                  variant={
                    patient.status === "ACTIVE"
                      ? "default"
                      : patient.status === "DISCHARGED"
                        ? "info"
                        : "muted"
                  }
                >
                  {PATIENT_STATUS_LABELS[patient.status] ?? patient.status}
                </Badge>
                <div className="flex gap-2">
                  {patient.status === "ACTIVE" && (
                    <>
                      <button
                        onClick={() =>
                          setConfirmAction({
                            id: patient.id,
                            name: `${patient.firstName} ${patient.lastName}`,
                            action: "discharge",
                          })
                        }
                        disabled={isPending}
                        className="text-xs text-secondary hover:underline disabled:opacity-50"
                      >
                        Alta
                      </button>
                      <button
                        onClick={() =>
                          setConfirmAction({
                            id: patient.id,
                            name: `${patient.firstName} ${patient.lastName}`,
                            action: "deactivate",
                          })
                        }
                        disabled={isPending}
                        className="text-xs text-warning hover:underline disabled:opacity-50"
                      >
                        Desactivar
                      </button>
                    </>
                  )}
                  {(patient.status === "INACTIVE" || patient.status === "DISCHARGED") && (
                    <button
                      onClick={() => handleReactivate(patient.id)}
                      disabled={isPending}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      Reactivar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.action === "deactivate") {
            handleDeactivate(confirmAction.id);
          } else {
            handleDischarge(confirmAction.id);
          }
        }}
        title={
          confirmAction?.action === "deactivate"
            ? "Desactivar paciente"
            : "Dar de alta"
        }
        message={
          confirmAction?.action === "deactivate"
            ? `¿Desactivar a ${confirmAction?.name}? No aparecerá en la lista principal pero sus datos se conservan.`
            : `¿Dar de alta a ${confirmAction?.name}? Se marcará como proceso completado.`
        }
        confirmLabel={confirmAction?.action === "deactivate" ? "Desactivar" : "Dar de alta"}
        variant={confirmAction?.action === "deactivate" ? "warning" : "primary"}
        isPending={isPending}
      />
    </>
  );
}
