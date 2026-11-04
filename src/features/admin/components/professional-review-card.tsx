"use client";

import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { Badge, Button } from "@/shared/ui/components";
import { formatDate } from "@/shared/lib/utils";
import { approveProfessionalAction, rejectProfessionalAction, suspendProfessionalAction } from "../actions";
import type { ProfessionalForReview } from "../review-professionals";

const STATUS_LABEL = { PENDING: "Pendiente", APPROVED: "Aprobado", SUSPENDED: "Suspendido", REJECTED: "Rechazado" } as const;

export function ProfessionalReviewCard({ professional }: { professional: ProfessionalForReview }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<{ error?: string }>, extra?: Record<string, string>) {
    const fd = new FormData();
    fd.set("profileId", professional.profileId);
    for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
    setError(null);
    startTransition(async () => {
      const result = await action(fd);
      if (result.error) setError(result.error);
    });
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 space-y-3" aria-label={professional.name ?? professional.email}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-text truncate">{professional.name ?? "Sin nombre"}</h3>
          <p className="text-sm text-muted truncate">{professional.email}</p>
        </div>
        <Badge variant={professional.status === "APPROVED" ? "success" : professional.status === "PENDING" ? "warning" : "muted"}>
          {STATUS_LABEL[professional.status]}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted">Tarjeta profesional</dt>
          <dd className="font-medium text-text break-all">{professional.licenseNumber}</dd>
        </div>
        <div>
          <dt className="text-muted">Solicitud</dt>
          <dd className="font-medium text-text">{formatDate(professional.createdAt)}</dd>
        </div>
      </dl>

      {professional.licenseShared && (
        <div role="note" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Tarjeta repetida.</span> Otro perfil registró este número; verifícalo antes de aprobar.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      {professional.isOwn && <p className="text-sm text-muted">Es tu propio perfil: otro administrador debe revisarlo.</p>}

      {!professional.isOwn && professional.status === "PENDING" && !rejecting && (
        <div className="grid grid-cols-2 gap-2">
          <Button className="min-h-11" disabled={isPending} onClick={() => run(approveProfessionalAction)}>
            Aprobar
          </Button>
          <Button variant="outline" className="min-h-11" disabled={isPending} onClick={() => setRejecting(true)}>
            Rechazar
          </Button>
        </div>
      )}

      {!professional.isOwn && professional.status === "PENDING" && rejecting && (
        <div className="space-y-2">
          <label htmlFor={`reason-${professional.profileId}`} className="block text-sm font-medium text-text">
            Motivo del rechazo
          </label>
          <textarea
            id={`reason-${professional.profileId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" className="min-h-11" disabled={isPending} onClick={() => run(rejectProfessionalAction, { reason })}>
              Confirmar rechazo
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!professional.isOwn && professional.status === "APPROVED" && (
        <Button variant="outline" className="w-full min-h-11" disabled={isPending} onClick={() => run(suspendProfessionalAction)}>
          Suspender
        </Button>
      )}

      {!professional.isOwn && professional.status === "SUSPENDED" && (
        <Button className="w-full min-h-11" disabled={isPending} onClick={() => run(approveProfessionalAction)}>
          Reactivar
        </Button>
      )}
    </article>
  );
}
