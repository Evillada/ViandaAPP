"use client";

import Link from "next/link";
import { formatDelta, type EvolutionRow } from "@/core/anthropometry/evolution";
import { formatDate } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/components";

interface EvolutionTableProps {
  rows: EvolutionRow[];
  patientId: string;
}

function DeltaCell({ value, unit = "" }: { value: number | null; unit?: string }) {
  if (value == null) return <span className="text-muted">—</span>;
  const color =
    value > 0 ? "text-amber-700" : value < 0 ? "text-emerald-700" : "text-muted";
  return <span className={color}>{formatDelta(value, unit)}</span>;
}

export function EvolutionTable({ rows, patientId }: EvolutionTableProps) {
  const reversed = [...rows].reverse();

  if (reversed.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">Sin valoraciones para comparar.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <h3 className="font-semibold text-text mb-3">Comparativa por consulta</h3>
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-left text-xs text-muted border-b border-border">
            <th className="pb-2 pr-3">Fecha</th>
            <th className="pb-2 pr-3">Peso</th>
            <th className="pb-2 pr-3">Δ</th>
            <th className="pb-2 pr-3">IMC</th>
            <th className="pb-2 pr-3">Δ</th>
            <th className="pb-2 pr-3">% Grasa</th>
            <th className="pb-2 pr-3">Cintura</th>
            <th className="pb-2 pr-3">ICC</th>
          </tr>
        </thead>
        <tbody>
          {reversed.map((row) => (
            <tr key={row.assessmentId} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 pr-3">
                <Link
                  href={`/dashboard/patients/${patientId}/assessments/${row.assessmentId}`}
                  className="text-primary hover:underline"
                >
                  {formatDate(row.date)}
                </Link>
              </td>
              <td className="py-2.5 pr-3 font-medium">{row.weightKg ?? "—"}</td>
              <td className="py-2.5 pr-3">
                <DeltaCell value={row.delta?.weightKg ?? null} unit=" kg" />
              </td>
              <td className="py-2.5 pr-3">{row.bmi ?? "—"}</td>
              <td className="py-2.5 pr-3">
                <DeltaCell value={row.delta?.bmi ?? null} />
              </td>
              <td className="py-2.5 pr-3">{row.bodyFatPercent ?? "—"}</td>
              <td className="py-2.5 pr-3">{row.waistCm ?? "—"}</td>
              <td className="py-2.5 pr-3">{row.waistHipRatio ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
