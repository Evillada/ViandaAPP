"use client";

import { useState, useTransition } from "react";
import { Button, ConfirmModal } from "@/shared/ui/components";
import { revokeConsentAction } from "../actions";

export function RevokeConsentButton({ patientId, professionalName }: { patientId: string; professionalName: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await revokeConsentAction(patientId);
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" className="w-full min-h-11" onClick={() => setOpen(true)}>
        Revocar autorización
      </Button>
      {error && <p className="text-sm text-danger mt-2" role="alert">{error}</p>}
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        title="Revocar autorización"
        message={`${professionalName} dejará de compartir tu información contigo en Vianda. Tu nutricionista conserva tu ficha clínica.`}
        confirmLabel="Sí, revocar"
        cancelLabel="Cancelar"
        variant="danger"
        isPending={isPending}
      />
    </>
  );
}
