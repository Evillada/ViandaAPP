"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, Input, Modal } from "@/shared/ui/components";
import { deleteAccountAction } from "../actions";

const CONFIRMATION = "ELIMINAR";

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    if (isPending) return;
    setOpen(false);
    setText("");
    setError(null);
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      // On success the action signs out and redirects, so a returned value is always an error.
      const result = await deleteAccountAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <section aria-labelledby="account-delete-title" className="rounded-2xl border border-danger/40 bg-surface p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trash2 className="h-5 w-5 text-danger" aria-hidden="true" />
        <h2 id="account-delete-title" className="font-semibold text-danger">Eliminar mi cuenta</h2>
      </div>
      <p className="text-sm text-muted">
        Se cerrará tu cuenta y se revocarán todas tus autorizaciones. Tu historia clínica la conserva el profesional que te atiende.
      </p>
      <Button variant="danger" className="w-full" onClick={() => setOpen(true)}>
        Eliminar mi cuenta
      </Button>
      <Modal open={open} onClose={close} title="Eliminar mi cuenta">
        <form action={submit} className="space-y-4">
          <p className="text-sm text-muted">
            Esta acción no se puede deshacer. Perderás el acceso a tu portal y dejarás de ver la información de tus profesionales.
          </p>
          <Input
            id="delete-confirmation"
            name="confirmation"
            label="Escribe ELIMINAR para confirmar"
            autoComplete="off"
            autoCapitalize="characters"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-11"
          />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={close} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={text !== CONFIRMATION || isPending}>
              {isPending ? "Eliminando..." : "Eliminar mi cuenta"}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
