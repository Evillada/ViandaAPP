"use client";

import { useTransition } from "react";
import { updateAppointmentStatus } from "../actions";
import { Badge, Card } from "@/shared/ui/components";
import { formatDateTime } from "@/shared/lib/utils";

interface Appointment {
  id: string;
  date: Date;
  duration: number;
  reason: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  patient: {
    firstName: string;
    lastName: string;
  };
}

const statusLabels = {
  SCHEDULED: { label: "Programada", variant: "info" as const },
  COMPLETED: { label: "Completada", variant: "success" as const },
  CANCELLED: { label: "Cancelada", variant: "danger" as const },
};

export function AppointmentList({
  appointments,
}: {
  appointments: Appointment[];
}) {
  const [isPending, startTransition] = useTransition();

  if (appointments.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-muted">No hay citas programadas</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{appointments.length} cita(s)</p>
      {appointments.map((apt) => {
        const status = statusLabels[apt.status];
        return (
          <Card key={apt.id} hover>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-text">
                    {apt.patient.firstName} {apt.patient.lastName}
                  </h4>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="text-sm text-primary font-medium">
                  {formatDateTime(apt.date)}
                </p>
                <p className="text-sm text-muted mt-1">
                  {apt.reason ?? "Consulta general"} · {apt.duration} min
                </p>
              </div>
              {apt.status === "SCHEDULED" && (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() =>
                      startTransition(() => {
                        void updateAppointmentStatus(apt.id, "COMPLETED");
                      })
                    }
                    disabled={isPending}
                    className="text-xs text-success hover:underline disabled:opacity-50"
                  >
                    Completar
                  </button>
                  <button
                    onClick={() =>
                      startTransition(() => {
                        void updateAppointmentStatus(apt.id, "CANCELLED");
                      })
                    }
                    disabled={isPending}
                    className="text-xs text-danger hover:underline disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
