"use client";

import { useState, useTransition } from "react";
import { createAppointment } from "../actions";
import { Button, Input } from "@/shared/ui/components";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

export function AppointmentForm({ patients }: { patients: Patient[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (patients.length === 0) {
    return (
      <p className="text-sm text-muted">
        Primero debes registrar al menos un paciente.
      </p>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createAppointment(formData);
      if (result.error) {
        setError(result.error);
      } else {
        const form = document.getElementById(
          "appointment-form"
        ) as HTMLFormElement;
        form?.reset();
      }
    });
  }

  return (
    <form id="appointment-form" action={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="patientId" className="block text-sm font-medium text-text">
          Paciente
        </label>
        <select
          id="patientId"
          name="patientId"
          required
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
        >
          <option value="">Seleccionar paciente</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>
      <Input label="Fecha" id="date" name="date" type="date" required />
      <Input label="Hora" id="time" name="time" type="time" required />
      <Input
        label="Duración (min)"
        id="duration"
        name="duration"
        type="number"
        defaultValue={30}
        min={15}
        max={180}
        step={15}
      />
      <Input
        label="Motivo"
        id="reason"
        name="reason"
        placeholder="Consulta general"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Agendando..." : "Agendar cita"}
      </Button>
    </form>
  );
}
