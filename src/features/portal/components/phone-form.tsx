"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@/shared/ui/components";
import { updatePhoneAction } from "../actions";

export function PhoneForm({ initialPhone }: { initialPhone: string | null }) {
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setStatus(null);
    startTransition(async () => {
      const result = await updatePhoneAction(formData);
      setStatus(result.error ? { kind: "error", text: result.error } : { kind: "ok", text: "Teléfono actualizado" });
    });
  }

  return (
    <form action={submit} className="space-y-3 border-t border-border pt-4">
      <Input
        id="account-phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        label="Teléfono"
        defaultValue={initialPhone ?? ""}
        className="min-h-11"
      />
      {status &&
        (status.kind === "error" ? (
          <p role="alert" className="text-sm text-danger">{status.text}</p>
        ) : (
          <p role="status" className="text-sm text-primary">{status.text}</p>
        ))}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Guardando..." : "Guardar teléfono"}
      </Button>
    </form>
  );
}
