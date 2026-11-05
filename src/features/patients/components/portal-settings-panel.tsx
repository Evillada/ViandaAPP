"use client";

import { MessageCircleHeart } from "lucide-react";
import { useState, useTransition } from "react";
import { updatePortalSettingsAction } from "../actions";

interface Props {
  patientId: string;
  message: string | null;
  until: string | null; // "YYYY-MM-DD" (Bogotá) o null
  progressEnabled: boolean;
}

export function PortalSettingsPanel({ patientId, message, until, progressEnabled }: Props) {
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setStatus(null);
    startTransition(async () => {
      const result = await updatePortalSettingsAction(patientId, formData);
      setStatus(result.error ? { kind: "error", text: result.error } : { kind: "ok", text: "Guardado" });
    });
  }

  return (
    <form action={submit} className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircleHeart className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="font-semibold text-text">Mensaje en el portal</h3>
      </div>
      <label className="block text-sm">
        <span className="block font-medium text-text mb-1">Mensaje personal (opcional)</span>
        <textarea name="portalMessage" defaultValue={message ?? ""} maxLength={280} rows={3} className="w-full rounded-xl border border-border px-3 py-2" />
        <span className="text-xs text-muted">Reemplaza la frase del día mientras esté vigente.</span>
      </label>
      <label className="block text-sm">
        <span className="block font-medium text-text mb-1">Vigente hasta (opcional)</span>
        <input type="date" name="portalMessageUntil" defaultValue={until ?? ""} className="min-h-11 rounded-xl border border-border px-3" />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="progressMessagesEnabled" defaultChecked={progressEnabled} className="h-5 w-5 accent-primary" />
        <span>
          <span className="block">Mostrar progreso y medidas en el portal</span>
          <span className="block text-xs text-muted">Si lo apagas, el paciente no ve mensajes de progreso, gráficas, medidas ni diagnóstico.</span>
        </span>
      </label>
      {status && (
        <p role="status" className={status.kind === "error" ? "text-sm text-danger" : "text-sm text-primary"}>{status.text}</p>
      )}
      <button type="submit" disabled={isPending} className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-medium text-white disabled:opacity-60">
        {isPending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
