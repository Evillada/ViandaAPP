"use client";

import { BadgeCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { PACKAGE_STATUS_LABELS, type PackageDisplayStatus } from "@/core/portal/package-status";
import { Badge, Button, ConfirmModal, Input, Modal } from "@/shared/ui/components";
import { createServicePackageAction, deleteServicePackageAction, updateServicePackageAction } from "../actions";

export interface ServicePackageView {
  id: string;
  name: string;
  includedSessions: number | null;
  startsAt: string; // "YYYY-MM-DD" (Bogotá)
  endsAt: string | null; // "YYYY-MM-DD" (Bogotá) o null
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  displayStatus: PackageDisplayStatus;
}

interface Props {
  patientId: string;
  packages: ServicePackageView[];
}

const BADGE_VARIANT: Record<PackageDisplayStatus, "success" | "warning" | "info" | "muted"> = {
  ACTIVE: "success",
  EXPIRED: "warning",
  COMPLETED: "info",
  CANCELLED: "muted",
};

const STATUS_OPTIONS: Array<{ value: ServicePackageView["status"]; label: string }> = [
  { value: "ACTIVE", label: "Vigente" },
  { value: "COMPLETED", label: "Finalizado" },
  { value: "CANCELLED", label: "Cancelado" },
];

function formatKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

function validity(pkg: ServicePackageView): string {
  return pkg.endsAt ? `${formatKey(pkg.startsAt)} – ${formatKey(pkg.endsAt)}` : `Desde ${formatKey(pkg.startsAt)}`;
}

export function ServicePackagesPanel({ patientId, packages }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServicePackageView | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [deleting, setDeleting] = useState<ServicePackageView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openForm(pkg: ServicePackageView | null) {
    setError(null);
    setEditing(pkg);
    setFormVersion((v) => v + 1);
    setFormOpen(true);
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = editing
        ? await updateServicePackageAction(editing.id, patientId, formData)
        : await createServicePackageAction(patientId, formData);
      if (result.error) setError(result.error);
      else setFormOpen(false);
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setError(null);
    startTransition(async () => {
      const result = await deleteServicePackageAction(target.id, patientId);
      if (result.error) setError(result.error);
      setDeleting(null);
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="font-semibold text-text">Plan contratado</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => openForm(null)}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          Agregar paquete
        </Button>
      </div>

      {error && !formOpen && (
        <p role="alert" className="text-sm text-danger">{error}</p>
      )}

      {packages.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay paquetes contratados para este paciente.</p>
      ) : (
        <ul className="space-y-3">
          {packages.map((pkg) => (
            <li key={pkg.id} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-text break-words min-w-0">{pkg.name}</p>
                <Badge variant={BADGE_VARIANT[pkg.displayStatus]}>{PACKAGE_STATUS_LABELS[pkg.displayStatus]}</Badge>
              </div>
              <p className="text-sm text-muted">
                {pkg.includedSessions != null ? `${pkg.includedSessions} consultas incluidas` : "Consultas sin tope"}
                {" · "}
                {validity(pkg)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openForm(pkg)}
                  aria-label={`Editar ${pkg.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted hover:bg-background"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(pkg)}
                  aria-label={`Eliminar ${pkg.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-danger hover:bg-background"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Editar paquete" : "Agregar paquete"}>
        <form key={formVersion} action={submit} className="space-y-4">
          <Input id="pkg-name" name="name" label="Nombre del paquete" defaultValue={editing?.name ?? ""} minLength={2} maxLength={80} required />
          <Input
            id="pkg-sessions"
            name="includedSessions"
            label="Consultas incluidas (opcional)"
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            step={1}
            defaultValue={editing?.includedSessions ?? ""}
            className="min-h-11"
          />
          <Input id="pkg-starts" name="startsAt" label="Inicio" type="date" defaultValue={editing?.startsAt ?? ""} required className="min-h-11" />
          <Input id="pkg-ends" name="endsAt" label="Fin (opcional)" type="date" defaultValue={editing?.endsAt ?? ""} className="min-h-11" />
          <div className="space-y-1">
            <label htmlFor="pkg-status" className="block text-sm font-medium text-text">Estado</label>
            <select
              id="pkg-status"
              name="status"
              defaultValue={editing?.status ?? "ACTIVE"}
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-text"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Eliminar paquete"
        message={deleting ? `Se eliminará el paquete "${deleting.name}". Esta acción no se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        variant="danger"
        isPending={isPending}
      />
    </section>
  );
}
