import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssessment } from "@/features/assessments/actions";
import { createMealPlanFromForm, generateAutomaticMealPlanFromForm } from "@/features/nutrition/actions";
import { MealPlanActions } from "@/features/nutrition/components/meal-plan-actions";
import { BmiResultCard } from "@/features/assessments/components/bmi-result-card";
import { Card, Badge } from "@/shared/ui/components";
import { formatDate, formatDateTime } from "@/shared/lib/utils";
import {
  ACTIVITY_LABELS,
  ASSESSMENT_TYPE_LABELS,
  BODY_FAT_METHOD_LABELS,
  TMB_FORMULA_LABELS,
} from "@/shared/lib/labels";
import { classifyWaistHipRatio } from "@/core/anthropometry/perimeters";
import { Somatochart } from "@/features/assessments/components/somatochart";

function MetricGrid({ items }: { items: { label: string; value: string | number | null | undefined }[] }) {
  const visible = items.filter((i) => i.value != null && i.value !== "");
  if (visible.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
      {visible.map((item) => (
        <div key={item.label}>
          <span className="text-muted">{item.label}</span>
          <p className="font-medium">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = {
    low: "bg-emerald-100 text-emerald-800",
    moderate: "bg-amber-100 text-amber-800",
    high: "bg-orange-100 text-orange-800",
    very_high: "bg-red-100 text-red-800",
  };
  const labels: Record<string, string> = {
    low: "Bajo",
    moderate: "Moderado",
    high: "Alto",
    very_high: "Muy alto",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[risk] ?? ""}`}>
      Riesgo {labels[risk] ?? risk}
    </span>
  );
}

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  const { id: patientId, assessmentId } = await params;
  const assessment = await getAssessment(assessmentId);
  if (!assessment) notFound();

  const goal = assessment.nutritionalGoal;
  const anthro = assessment.anthropometry;
  const whrRisk =
    anthro?.waistHipRatio && assessment.patient.sex
      ? classifyWaistHipRatio(
          anthro.waistHipRatio,
          assessment.patient.sex as "MALE" | "FEMALE" | "OTHER"
        )
      : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={`/dashboard/patients/${patientId}`} className="text-sm text-primary hover:underline">
          ← {assessment.patient.firstName} {assessment.patient.lastName}
        </Link>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <h2 className="text-2xl font-bold text-text">{assessment.reason}</h2>
          <Badge>{ASSESSMENT_TYPE_LABELS[assessment.type]}</Badge>
        </div>
        <p className="text-sm text-muted">
          {formatDateTime(assessment.assessmentDate)} · {ACTIVITY_LABELS[assessment.activityLevel]}
        </p>
      </div>

      {/* Diagnóstico nutricional */}
      {goal?.nutritionalDiagnosis && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-text mb-1">Diagnóstico nutricional</h3>
              <p className="text-sm text-text">{goal.nutritionalDiagnosis}</p>
              {goal.cie10Code && (
                <p className="text-xs text-muted mt-1">CIE-10: {goal.cie10Code}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {(assessment.allergies || assessment.conditions || assessment.medications) && (
        <Card>
          <h3 className="font-semibold text-text mb-3">Contexto clínico</h3>
          <MetricGrid
            items={[
              { label: "Alergias", value: assessment.allergies },
              { label: "Condiciones", value: assessment.conditions },
              { label: "Medicamentos", value: assessment.medications },
            ]}
          />
        </Card>
      )}

      {goal && <BmiResultCard bmi={goal.bmi} />}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "TMB", value: goal?.tmbKcal, unit: "kcal", sub: goal?.tmbFormula ? TMB_FORMULA_LABELS[goal.tmbFormula] : null },
          { label: "Meta diaria", value: goal?.targetKcal, unit: "kcal", sub: null },
          { label: "Actividad", value: ACTIVITY_LABELS[assessment.activityLevel], unit: "", sub: null },
          { label: "💧 Agua/día", value: goal?.waterMlPerDay ? `${(goal.waterMlPerDay / 1000).toFixed(1)}L` : "—", unit: goal?.waterMlPerDay ? `${Math.round(goal.waterMlPerDay / 250)} vasos` : "", sub: goal?.waterMethod },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-xs text-muted">{stat.label}</p>
            <p className="text-2xl font-bold text-primary mt-1">{stat.value}</p>
            {stat.unit && <p className="text-xs text-muted">{stat.unit}</p>}
            {stat.sub && <p className="text-[10px] text-muted mt-1">{stat.sub}</p>}
          </Card>
        ))}
      </div>

      {anthro && (
        <>
          <Card>
            <h3 className="font-semibold text-text mb-3">Medidas básicas</h3>
            <MetricGrid
              items={[
                { label: "Peso", value: `${anthro.weightKg} kg` },
                { label: "Talla", value: `${anthro.heightCm} cm` },
                {
                  label: "% Grasa",
                  value: anthro.bodyFatPercent != null ? `${anthro.bodyFatPercent}%` : null,
                },
                {
                  label: "Método % grasa",
                  value: anthro.bodyFatMethod
                    ? BODY_FAT_METHOD_LABELS[anthro.bodyFatMethod]
                    : null,
                },
                { label: "Masa grasa", value: anthro.fatMassKg != null ? `${anthro.fatMassKg} kg` : null },
                { label: "Masa magra", value: anthro.leanMassKg != null ? `${anthro.leanMassKg} kg` : null },
              ]}
            />
          </Card>

          <Card>
            <h3 className="font-semibold text-text mb-3">Perímetros</h3>
            <MetricGrid
              items={[
                { label: "Cefálico", value: anthro.headCm != null ? `${anthro.headCm} cm` : null },
                { label: "Cuello", value: anthro.neckCm != null ? `${anthro.neckCm} cm` : null },
                { label: "Mesoesternal", value: anthro.chestCm != null ? `${anthro.chestCm} cm` : null },
                { label: "Braquial (relajado)", value: anthro.armRelaxedCm != null ? `${anthro.armRelaxedCm} cm` : null },
                { label: "Brazo contraído", value: anthro.armContractedCm != null ? `${anthro.armContractedCm} cm` : null },
                { label: "Antebrazo", value: anthro.forearmCm != null ? `${anthro.forearmCm} cm` : null },
                { label: "Muñeca", value: anthro.wristCm != null ? `${anthro.wristCm} cm` : null },
                { label: "Cintura", value: anthro.waistCm != null ? `${anthro.waistCm} cm` : null },
                { label: "Abdominal", value: anthro.abdominalCm != null ? `${anthro.abdominalCm} cm` : null },
                { label: "Cadera", value: anthro.hipCm != null ? `${anthro.hipCm} cm` : null },
                {
                  label: "ICC",
                  value: anthro.waistHipRatio != null
                    ? `${anthro.waistHipRatio}${whrRisk ? ` (${whrRisk.label})` : ""}`
                    : null,
                },
                { label: "Muslo a 1 cm", value: anthro.thighProximalCm != null ? `${anthro.thighProximalCm} cm` : null },
                { label: "Muslo", value: anthro.thighCm != null ? `${anthro.thighCm} cm` : null },
                { label: "Pantorrilla", value: anthro.calfCm != null ? `${anthro.calfCm} cm` : null },
                { label: "Área muscular brazo", value: anthro.armMuscleAreaCm2 != null ? `${anthro.armMuscleAreaCm2} cm²` : null },
              ]}
            />
          </Card>

          <Card>
            <h3 className="font-semibold text-text mb-3">Pliegues cutáneos (mm)</h3>
            <MetricGrid
              items={[
                { label: "Tricipital", value: anthro.skinfoldTricepsMm },
                { label: "Bicipital", value: anthro.skinfoldBicepsMm },
                { label: "Subescapular", value: anthro.skinfoldSubscapularMm },
                { label: "Iliocrestal", value: anthro.skinfoldIliacCrestMm },
                { label: "Suprailiaco", value: anthro.skinfoldSuprailiacMm },
                { label: "Abdominal", value: anthro.skinfoldAbdominalMm },
                { label: "Muslo frontal", value: anthro.skinfoldThighMm },
                { label: "Pantorrilla medial", value: anthro.skinfoldCalfMm },
                { label: "Axilar medial", value: anthro.skinfoldMidaxillaryMm },
                { label: "Pectoral", value: anthro.skinfoldPectoralMm },
              ]}
            />
          </Card>

          {(anthro.humerusBreadthCm != null || anthro.femurBreadthCm != null) && (
            <Card>
              <h3 className="font-semibold text-text mb-3">Diámetros óseos</h3>
              <MetricGrid
                items={[
                  { label: "Biepicondíleo húmero", value: anthro.humerusBreadthCm != null ? `${anthro.humerusBreadthCm} cm` : null },
                  { label: "Biepicondíleo fémur", value: anthro.femurBreadthCm != null ? `${anthro.femurBreadthCm} cm` : null },
                ]}
              />
            </Card>
          )}

          {anthro.somatotypeEndo != null && anthro.somatotypeMeso != null && anthro.somatotypeEcto != null && (
            <Somatochart
              result={{
                endomorphy: anthro.somatotypeEndo,
                mesomorphy: anthro.somatotypeMeso,
                ectomorphy: anthro.somatotypeEcto,
                x: Math.round((anthro.somatotypeEcto - anthro.somatotypeEndo) * 10) / 10,
                y: Math.round((2 * anthro.somatotypeMeso - (anthro.somatotypeEndo + anthro.somatotypeEcto)) * 10) / 10,
              }}
            />
          )}
        </>
      )}

      {goal && (
        <Card>
          <h3 className="font-semibold text-text mb-3">Distribución de macronutrientes</h3>
          {goal.macroPreset && goal.macroPreset !== "STANDARD" && (
            <p className="text-xs text-muted mb-3">
              Perfil: {goal.macroPreset} ({goal.proteinPct}/{goal.carbsPct}/{goal.fatPct})
            </p>
          )}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Proteína", value: goal.proteinG, pct: goal.proteinPct, color: "bg-blue-50 text-secondary" },
              { label: "Carbohidratos", value: goal.carbsG, pct: goal.carbsPct, color: "bg-primary-light text-primary" },
              { label: "Grasas", value: goal.fatG, pct: goal.fatPct, color: "bg-accent-light text-accent" },
            ].map((m) => (
              <div key={m.label} className={`rounded-xl p-4 text-center ${m.color}`}>
                <p className="text-2xl font-bold">{m.value}g</p>
                <p className="text-sm mt-1">{m.label}</p>
                <p className="text-xs mt-0.5 opacity-70">{m.pct}%</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(assessment.notes || anthro?.anthropometryNotes) && (
        <Card>
          <h3 className="font-semibold text-text mb-2">Notas</h3>
          {assessment.notes && <p className="text-sm text-muted">{assessment.notes}</p>}
          {anthro?.anthropometryNotes && (
            <p className="text-sm text-muted mt-2">{anthro.anthropometryNotes}</p>
          )}
        </Card>
      )}

      <MealPlanActions
        patientId={patientId}
        assessmentId={assessmentId}
        createManual={createMealPlanFromForm}
        createAutomatic={generateAutomaticMealPlanFromForm}
      />
    </div>
  );
}
