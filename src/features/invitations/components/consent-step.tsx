"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/shared/ui/components";
import { acceptInvitationAction } from "../actions";

export function ConsentStep({
  token,
  professionalName,
  accountEmail,
  documentVersion,
  documentBody,
}: {
  token: string;
  professionalName: string;
  accountEmail: string;
  documentVersion: string;
  documentBody: string;
}) {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitationAction(token, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={submit} className="space-y-5">
      <input type="hidden" name="documentVersion" value={documentVersion} />
      <div>
        <h1 className="text-xl font-bold text-text">Autorización de tratamiento de datos</h1>
        <p className="text-sm text-muted mt-1">Para que {professionalName} pueda acompañarte en Vianda. Versión {documentVersion}.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-4 py-2">
        <p className="text-sm text-text">
          Tu ficha quedará vinculada a <span className="font-medium break-all">{accountEmail}</span>
        </p>
        <button
          type="button"
          onClick={() => signOut({ redirectTo: `/invite/${token}` })}
          className="min-h-11 text-sm font-medium text-primary hover:underline"
        >
          Usar otra cuenta
        </button>
      </div>
      <div
        className="max-h-[45dvh] overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm text-text whitespace-pre-line"
        tabIndex={0}
        role="region"
        aria-label="Texto de la autorización"
      >
        {documentBody}
      </div>
      <label className="flex items-start gap-3 min-h-11 cursor-pointer">
        <input
          type="checkbox"
          name="consent"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
        />
        <span className="text-sm text-text">Autorizo el tratamiento de mis datos personales y de salud</span>
      </label>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" className="w-full min-h-11" disabled={!checked || isPending}>
        {isPending ? "Guardando..." : "Acepto"}
      </Button>
    </form>
  );
}
