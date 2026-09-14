"use client";

import { useState } from "react";
import {
  calculateTmb,
  calculateTargetKcal,
  calculateMacros,
  MACRO_PRESETS,
  type ActivityLevel,
  type Sex,
} from "@/core/nutrition/nutrition-calculator";
import { Input, Button } from "@/shared/ui/components";

export function MacroCalculator() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("FEMALE");
  const [activity, setActivity] = useState<ActivityLevel>("SEDENTARY");
  const [preset, setPreset] = useState("STANDARD");
  const [result, setResult] = useState<{
    tmb: number;
    target: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);

  const selectClass = "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm";

  function calculate() {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age);
    if (!w || !h || !a) return;

    const tmb = calculateTmb(w, h, a, sex);
    const target = calculateTargetKcal(tmb, activity);
    const ratios = MACRO_PRESETS[preset];
    const macros = calculateMacros(target, ratios);

    setResult({ tmb, target, protein: macros.proteinG, carbs: macros.carbsG, fat: macros.fatG });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Input label="Peso (kg)" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="72" />
        <Input label="Talla (cm)" type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="165" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Edad" type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text">Sexo</label>
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className={selectClass}>
            <option value="FEMALE">Femenino</option>
            <option value="MALE">Masculino</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-text">Actividad</label>
        <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)} className={selectClass}>
          <option value="SEDENTARY">Sedentario</option>
          <option value="LIGHT">Ligera</option>
          <option value="MODERATE">Moderada</option>
          <option value="ACTIVE">Activa</option>
          <option value="VERY_ACTIVE">Muy activa</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-text">Perfil</label>
        <select value={preset} onChange={(e) => setPreset(e.target.value)} className={selectClass}>
          {Object.entries(MACRO_PRESETS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>
      <Button onClick={calculate} className="w-full" size="sm">
        Calcular
      </Button>

      {result && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm px-1">
            <span className="text-muted">TMB: {result.tmb} kcal</span>
            <span className="font-bold text-primary">Meta: {result.target} kcal</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-blue-50 p-3 text-center">
              <p className="text-lg font-bold text-secondary">{result.protein}g</p>
              <p className="text-xs text-muted">Proteína</p>
            </div>
            <div className="rounded-xl bg-primary-light p-3 text-center">
              <p className="text-lg font-bold text-primary">{result.carbs}g</p>
              <p className="text-xs text-muted">Carbos</p>
            </div>
            <div className="rounded-xl bg-accent-light p-3 text-center">
              <p className="text-lg font-bold text-accent">{result.fat}g</p>
              <p className="text-xs text-muted">Grasas</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
