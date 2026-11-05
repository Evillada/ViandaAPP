"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-md" }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={`${maxWidth} w-full rounded-2xl border border-border bg-surface p-0 shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-sm`}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-text">{title}</h3>
          <button
            onClick={onClose}
            className="-mr-3 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:text-text text-xl transition-colors"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      )}
      <div className="p-6">{children}</div>
    </dialog>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  isPending?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "primary",
  isPending = false,
}: ConfirmModalProps) {
  const variantStyles = {
    danger: "bg-danger hover:bg-danger/90 text-white",
    warning: "bg-accent hover:bg-accent/90 text-white",
    primary: "bg-primary hover:bg-primary/90 text-white",
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={isPending}
          className="min-h-11 px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted hover:bg-background transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className={`min-h-11 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${variantStyles[variant]}`}
        >
          {isPending ? "Procesando..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
