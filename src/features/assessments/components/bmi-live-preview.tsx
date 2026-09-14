"use client";

import { getBmiFromAnthropometry } from "@/core/anthropometry/bmi-classifier";
import { Badge } from "@/shared/ui/components";
import { cn } from "@/shared/lib/utils";

const colorMap = {
  info: "bg-blue-50 text-secondary border-blue-100",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  warning: "bg-amber-50 text-amber-800 border-amber-100",
  danger: "bg-red-50 text-red-700 border-red-100",
};

interface BmiLivePreviewProps {
  weightKg: string;
  heightCm: string;
}

export function BmiLivePreview({ weightKg, heightCm }: BmiLivePreviewProps) {
  const weight = parseFloat(weightKg);
  const height = parseFloat(heightCm);
  const classification = getBmiFromAnthropometry(weight, height);

  if (!classification) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted">
        Ingresa peso y talla para calcular y clasificar el IMC (OMS).
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4 space-y-2",
        colorMap[classification.color]
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium opacity-80">IMC calculado (OMS)</p>
          <p className="text-3xl font-bold">{classification.bmi}</p>
          <p className="text-xs opacity-70">kg/m² · Rango OMS: {classification.range}</p>
        </div>
        <Badge
          variant={
            classification.color === "success"
              ? "success"
              : classification.color === "danger"
                ? "danger"
                : classification.color === "warning"
                  ? "warning"
                  : "info"
          }
          className="text-sm px-3 py-1"
        >
          {classification.label}
        </Badge>
      </div>
      <p className="text-sm leading-relaxed opacity-90">{classification.description}</p>
    </div>
  );
}
