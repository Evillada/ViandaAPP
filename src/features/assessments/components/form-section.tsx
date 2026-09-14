"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function FormSection({
  title,
  description,
  defaultOpen = true,
  children,
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background/50 transition-colors"
      >
        <div>
          <p className="text-sm font-semibold text-text">{title}</p>
          {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
        </div>
        <span className={cn("text-muted text-sm transition-transform", open && "rotate-180")}>
          ▼
        </span>
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">{children}</div>}
    </div>
  );
}
