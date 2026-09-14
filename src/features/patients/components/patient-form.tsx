"use client";

import { useState, useTransition } from "react";
import { createPatient } from "../actions";
import { Button, Input } from "@/shared/ui/components";

export function PatientForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createPatient(formData);
      if (result.error) setError(result.error);
      else {
        const form = document.getElementById("patient-form") as HTMLFormElement;
        form?.reset();
      }
    });
  }

  return (
    <form id="patient-form" action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nombre" id="firstName" name="firstName" required />
        <Input label="Apellido" id="lastName" name="lastName" required />
      </div>
      <Input label="Documento" id="documentId" name="documentId" placeholder="CC / CE" />
      <div className="space-y-1">
        <label htmlFor="sex" className="block text-sm font-medium text-text">Sexo</label>
        <select
          id="sex"
          name="sex"
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Seleccionar</option>
          <option value="FEMALE">Femenino</option>
          <option value="MALE">Masculino</option>
          <option value="OTHER">Otro</option>
        </select>
      </div>
      <Input label="Email" id="email" name="email" type="email" placeholder="opcional" />
      <Input label="Teléfono" id="phone" name="phone" type="tel" placeholder="opcional" />
      <Input label="Fecha de nacimiento" id="dateOfBirth" name="dateOfBirth" type="date" required />
      <div className="space-y-1">
        <label htmlFor="notes" className="block text-sm font-medium text-text">Notas</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-text placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          placeholder="Notas clínicas..."
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Guardando..." : "Agregar paciente"}
      </Button>
    </form>
  );
}
