"use client";

import { KeyRound } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button, PasswordInput } from "@/shared/ui/components";
import { changePasswordAction } from "../actions";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setStatus(null);
    startTransition(async () => {
      const result = await changePasswordAction(formData);
      if (result.error) {
        setStatus({ kind: "error", text: result.error });
      } else {
        formRef.current?.reset();
        setStatus({ kind: "ok", text: "Contraseña actualizada" });
      }
    });
  }

  return (
    <section aria-labelledby="account-password-title" className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id="account-password-title" className="font-semibold text-text">Contraseña</h2>
      </div>
      <form ref={formRef} action={submit} className="space-y-3">
        <PasswordInput
          id="account-current-password"
          name="currentPassword"
          label="Contraseña actual"
          autoComplete="current-password"
          required
          className="min-h-11"
        />
        <PasswordInput
          id="account-new-password"
          name="newPassword"
          label="Nueva contraseña"
          autoComplete="new-password"
          required
          className="min-h-11"
        />
        {status &&
          (status.kind === "error" ? (
            <p role="alert" className="text-sm text-danger">{status.text}</p>
          ) : (
            <p role="status" className="text-sm text-primary">{status.text}</p>
          ))}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Cambiando..." : "Cambiar contraseña"}
        </Button>
      </form>
    </section>
  );
}
