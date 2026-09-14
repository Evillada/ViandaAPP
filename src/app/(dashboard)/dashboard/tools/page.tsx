import { Card } from "@/shared/ui/components";
import { QuickWaterCalculator } from "@/features/tools/components/quick-water-calculator";
import { QuickBmiCalculator } from "@/features/tools/components/quick-bmi-calculator";
import { MacroCalculator } from "@/features/tools/components/macro-calculator";

export default function ToolsPage() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-text">Herramientas clínicas</h2>
        <p className="text-muted mt-1">
          Calculadoras rápidas para consulta — sin necesidad de crear una valoración
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-text mb-4">💧 Requerimiento hídrico</h3>
          <QuickWaterCalculator />
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-text mb-4">📊 IMC rápido</h3>
          <QuickBmiCalculator />
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-text mb-4">🥩 Macronutrientes</h3>
          <MacroCalculator />
        </Card>
      </div>
    </div>
  );
}
