"use client";

import { useState, useTransition } from "react";
import { createPatient, updatePatient } from "../actions";
import { Button, Input, useToast } from "@/shared/ui/components";

interface PatientData {
  id: string;
  firstName: string;
  lastName: string;
  documentId: string | null;
  sex: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
  notes: string | null;
}

interface PatientFormProps {
  patient?: PatientData;
  onSuccess?: () => void;
}

export function PatientForm({ patient, onSuccess }: PatientFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();
  const isEditing = !!patient;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = isEditing
        ? await updatePatient(patient.id, formData)
        : await createPatient(formData);

      if (result.error) {
        setError(result.error);
        toastError(result.error);
      } else {
        success(isEditing ? "Paciente actualizado" : "Paciente registrado");
        if (!isEditing) {
          const form = document.getElementById("patient-form") as HTMLFormElement;
          form?.reset();
        }
        onSuccess?.();
      }
    });
  }

  const dobDefault = patient?.dateOfBirth
    ? new Date(patient.dateOfBirth).toISOString().slice(0, 10)
    : undefined;

  return (
    <form id="patient-form" action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nombre" id="firstName" name="firstName" required defaultValue={patient?.firstName} />
        <Input label="Apellido" id="lastName" name="lastName" required defaultValue={patient?.lastName} />
      </div>
      <Input label="Documento" id="documentId" name="documentId" placeholder="CC / CE" defaultValue={patient?.documentId ?? ""} />
      <div className="space-y-1">
        <label htmlFor="sex" className="block text-sm font-medium text-text">Sexo</label>
        <select
          id="sex"
          name="sex"
          defaultValue={patient?.sex ?? ""}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Seleccionar</option>
          <option value="FEMALE">Femenino</option>
          <option value="MALE">Masculino</option>
          <option value="OTHER">Otro</option>
        </select>
      </div>
      <Input label="Email" id="email" name="email" type="email" placeholder="opcional" defaultValue={patient?.email ?? ""} />
      <Input label="Teléfono" id="phone" name="phone" type="tel" placeholder="opcional" defaultValue={patient?.phone ?? ""} />
      <Input label="Fecha de nacimiento" id="dateOfBirth" name="dateOfBirth" type="date" required defaultValue={dobDefault} />
      <div className="space-y-1">
        <label htmlFor="notes" className="block text-sm font-medium text-text">Notas</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={patient?.notes ?? ""}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-text placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          placeholder="Notas clínicas..."
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Agregar paciente"}
      </Button>
    </form>
  );
}
