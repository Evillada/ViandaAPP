"use client";

import { useState, useTransition } from "react";
import { createAppointment } from "../actions";
import { Button, Input } from "@/shared/ui/components";
import type { SearchablePatient } from "@/core/patients/patient-search";
import { PatientPicker } from "@/features/patients/components/patient-picker";

export function AppointmentForm({ patients }: { patients: SearchablePatient[] }) {
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
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
    if (!formData.get("patientId")) {
      setError("Selecciona un paciente de la lista");
      return;
    }
    startTransition(async () => {
      const result = await createAppointment(formData);
      if (result.error) {
        setError(result.error);
      } else {
        const form = document.getElementById(
          "appointment-form"
        ) as HTMLFormElement;
        form?.reset();
        setFormKey((k) => k + 1);
      }
    });
  }

  return (
    <form id="appointment-form" action={handleSubmit} className="space-y-4">
      <PatientPicker key={formKey} patients={patients} name="patientId" />
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
