import { Stethoscope } from "lucide-react";

export function PortalEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
      <Stethoscope className="h-10 w-10 text-muted mx-auto" aria-hidden="true" />
      <p className="font-medium text-text mt-3">{title}</p>
      <p className="text-sm text-muted mt-1">{text}</p>
    </div>
  );
}
