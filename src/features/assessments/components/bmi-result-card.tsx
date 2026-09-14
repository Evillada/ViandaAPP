import { classifyBmiOms, type BmiClassification } from "@/core/anthropometry/bmi-classifier";
import { Badge } from "@/shared/ui/components";

export function BmiResultCard({ bmi }: { bmi: number }) {
  const classification = classifyBmiOms(bmi);
  return <BmiClassificationCard classification={classification} />;
}

export function BmiClassificationCard({
  classification,
}: {
  classification: BmiClassification;
}) {
  const variant =
    classification.color === "success"
      ? "success"
      : classification.color === "danger"
        ? "danger"
        : classification.color === "warning"
          ? "warning"
          : "info";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">IMC (OMS)</p>
          <p className="text-3xl font-bold text-text mt-1">{classification.bmi}</p>
          <p className="text-xs text-muted mt-1">kg/m² · {classification.range}</p>
        </div>
        <Badge variant={variant}>{classification.label}</Badge>
      </div>
      <p className="text-sm text-muted mt-3">{classification.description}</p>
    </div>
  );
}
