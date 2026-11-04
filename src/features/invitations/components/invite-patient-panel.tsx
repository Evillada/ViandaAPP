"use client";

import { useRef, useState, useTransition } from "react";
import { Copy, Link2, MessageCircle, Share2 } from "lucide-react";
import { Badge, Button } from "@/shared/ui/components";
import { formatDate } from "@/shared/lib/utils";
import { createInvitationAction } from "../actions";
import type { InvitationStatus } from "../invitation-status";

const STATUS_COPY: Record<InvitationStatus["state"], string> = {
  NONE: "Sin invitar",
  PENDING: "Invitación pendiente",
  LINKED: "Vinculado",
  REVOKED_BY_PATIENT: "Acceso revocado por el paciente",
};

export function InvitePatientPanel({
  patientId,
  patientFirstName,
  status,
}: {
  patientId: string;
  patientFirstName: string;
  status: InvitationStatus;
}) {
  const [link, setLink] = useState<{ url: string; expiresAt: Date } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const message = link
    ? `Hola ${patientFirstName}, te invito a Vianda para seguir tu plan nutricional. Crea tu cuenta con este enlace (vence el ${formatDate(link.expiresAt)}): ${link.url}`
    : "";

  function generate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createInvitationAction(patientId);
      if ("error" in result) setError(result.error);
      else setLink(result);
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
    } catch {
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
  }

  async function share() {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: "Invitación a Vianda", text: message }).catch(() => undefined);
    } else {
      await copy();
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-3" aria-labelledby="invite-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="invite-title" className="font-semibold text-text flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" aria-hidden="true" />
          Portal del paciente
        </h3>
        <Badge variant={status.state === "LINKED" ? "success" : "default"}>{STATUS_COPY[status.state]}</Badge>
      </div>

      {status.state === "PENDING" && !link && (
        <p className="text-sm text-muted">Hay un enlace vigente hasta el {formatDate(status.expiresAt)}. Si lo perdiste, genera uno nuevo.</p>
      )}

      {status.state !== "LINKED" && !link && (
        <Button className="w-full min-h-11" onClick={generate} disabled={isPending}>
          {status.state === "PENDING" ? "Generar nuevo enlace" : "Invitar al portal"}
        </Button>
      )}

      {link && (
        <div className="space-y-3">
          <label htmlFor="invite-link" className="block text-sm font-medium text-text">
            Enlace de invitación
          </label>
          <input
            ref={inputRef}
            id="invite-link"
            readOnly
            value={link.url}
            className="w-full min-h-11 rounded-xl border border-border bg-background px-3 text-sm"
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="text-xs text-muted">Sólo se muestra una vez. Vence el {formatDate(link.expiresAt)}.</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="min-h-11 gap-1" onClick={share}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Compartir
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border-2 border-primary text-sm font-medium text-primary"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>
            <Button variant="outline" className="min-h-11 gap-1" onClick={copy}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </section>
  );
}
