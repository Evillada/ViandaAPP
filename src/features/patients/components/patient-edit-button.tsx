"use client";

import { useState } from "react";
import { PatientForm } from "./patient-form";
import { Modal, Button } from "@/shared/ui/components";

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

export function PatientEditButton({ patient }: { patient: PatientData }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        ✏️ Editar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Editar paciente" maxWidth="max-w-lg">
        <PatientForm patient={patient} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
