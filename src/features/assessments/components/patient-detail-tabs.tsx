"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/shared/lib/utils";
import { buildEvolutionTimeline } from "@/core/anthropometry/evolution";
import { EvolutionCharts } from "./evolution-charts";
import { EvolutionTable } from "./evolution-table";
import { createMealPlanFromForm } from "@/features/nutrition/actions";
import { Card, Badge, Button } from "@/shared/ui/components";
import { formatDate, formatDateTime } from "@/shared/lib/utils";
import {
  ACTIVITY_LABELS,
  ASSESSMENT_TYPE_LABELS,
  BMI_CATEGORY_LABELS,
  PLAN_STATUS_LABELS,
} from "@/shared/lib/labels";

type PatientData = {
  id: string;
  firstName: string;
  lastName: string;
  documentId: string | null;
  sex: string | null;
  dateOfBirth: Date | null;
  phone: string | null;
  notes: string | null;
  assessments: {
    id: string;
    type: string;
    assessmentDate: Date;
    reason: string;
    createdAt: Date;
    activityLevel: string;
    anthropometry: {
      weightKg: number;
      bodyFatPercent: number | null;
      waistCm: number | null;
      waistHipRatio: number | null;
      leanMassKg: number | null;
    } | null;
    nutritionalGoal: {
      bmi: number;
      bmiCategory: string;
      targetKcal: number;
    } | null;
  }[];
  mealPlans: {
    id: string;
    name: string;
    status: string;
    createdAt: Date;
  }[];
};

const tabs = [
  { id: "resumen", label: "Resumen" },
  { id: "evolucion", label: "Evolución" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function PatientDetailTabs({ patient }: { patient: PatientData }) {
  const [activeTab, setActiveTab] = useState<TabId>("resumen");
  const timeline = buildEvolutionTimeline(patient.assessments);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "resumen" && (
        <div className="space-y-8">
          {patient.notes && (
            <Card><p className="text-sm text-muted">{patient.notes}</p></Card>
          )}

          <section>
            <h3 className="text-lg font-semibold text-text mb-4">Valoraciones</h3>
            {patient.assessments.length === 0 ? (
              <Card><p className="text-muted text-sm">Sin valoraciones aún</p></Card>
            ) : (
              <div className="space-y-3">
                {patient.assessments.map((a) => (
                  <Card key={a.id} hover>
                    <Link href={`/dashboard/patients/${patient.id}/assessments/${a.id}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-text">{a.reason}</p>
                            <Badge variant="default" className="text-xs">
                              {ASSESSMENT_TYPE_LABELS[a.type] ?? a.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted mt-1">
                            {formatDateTime(a.assessmentDate)}
                          </p>
                          <p className="text-xs text-muted mt-1">
                            {ACTIVITY_LABELS[a.activityLevel]}
                            {a.nutritionalGoal && (
                              <>
                                {" · "}IMC {a.nutritionalGoal.bmi}
                                {" · "}
                                {BMI_CATEGORY_LABELS[a.nutritionalGoal.bmiCategory]}
                              </>
                            )}
                            {a.anthropometry?.weightKg && (
                              <> · {a.anthropometry.weightKg} kg</>
                            )}
                          </p>
                        </div>
                        {a.nutritionalGoal && (
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">
                              {a.nutritionalGoal.targetKcal}
                            </p>
                            <p className="text-xs text-muted">kcal/día</p>
                          </div>
                        )}
                      </div>
                    </Link>
                    {a.nutritionalGoal && (
                      <form action={createMealPlanFromForm} className="mt-3 pt-3 border-t border-border">
                        <input type="hidden" name="patientId" value={patient.id} />
                        <input type="hidden" name="assessmentId" value={a.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Crear plan alimentario
                        </Button>
                      </form>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-lg font-semibold text-text mb-4">Planes alimentarios</h3>
            {patient.mealPlans.length === 0 ? (
              <Card>
                <p className="text-muted text-sm">Sin planes aún — crea uno desde una valoración</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {patient.mealPlans.map((plan) => (
                  <Card key={plan.id} hover>
                    <Link
                      href={`/dashboard/meal-plans/${plan.id}`}
                      className="flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium text-text">{plan.name}</p>
                        <p className="text-sm text-muted">{formatDate(plan.createdAt)}</p>
                      </div>
                      <Badge variant={plan.status === "ACTIVE" ? "success" : "default"}>
                        {PLAN_STATUS_LABELS[plan.status]}
                      </Badge>
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "evolucion" && (
        <div className="space-y-6">
          {patient.assessments.length === 0 ? (
            <Card>
              <p className="text-muted text-sm">
                Registra al menos una valoración para ver la evolución antropométrica.
              </p>
            </Card>
          ) : (
            <>
              <EvolutionCharts timeline={timeline} />
              <EvolutionTable rows={timeline} patientId={patient.id} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
