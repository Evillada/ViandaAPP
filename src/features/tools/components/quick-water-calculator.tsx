"use client";

import { useState } from "react";
import { calculateWaterRequirement } from "@/core/nutrition/water-calculator";
import { Input, Button } from "@/shared/ui/components";

export function QuickWaterCalculator() {
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [activity, setActivity] = useState("SEDENTARY");
  const [result, setResult] = useState<ReturnType<typeof calculateWaterRequirement> | null>(null);

  function calculate() {
    const w = parseFloat(weight);
    const a = parseInt(age);
    if (!w || !a) return;
    setResult(calculateWaterRequirement(w, a, activity, "ADJUSTED"));
  }

  return (
    <div className="space-y-3">
      <Input
        label="Peso (kg)"
        type="number"
        step="0.1"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        placeholder="72.5"
      />
      <Input
        label="Edad"
        type="number"
        value={age}
        onChange={(e) => setAge(e.target.value)}
        placeholder="30"
      />
      <div className="space-y-1">
        <label className="block text-sm font-medium text-text">Actividad</label>
        <select
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm"
        >
          <option value="SEDENTARY">Sedentario</option>
          <option value="LIGHT">Ligera</option>
          <option value="MODERATE">Moderada</option>
          <option value="ACTIVE">Activa</option>
          <option value="VERY_ACTIVE">Muy activa</option>
        </select>
      </div>
      <Button onClick={calculate} className="w-full" size="sm">
        Calcular
      </Button>

      {result && (
        <div className="rounded-xl bg-primary-light p-4 text-center space-y-1">
          <p className="text-3xl font-bold text-primary">{result.litersPerDay}L</p>
          <p className="text-sm text-text">{result.mlPerDay} ml/día</p>
          <p className="text-xs text-muted">{result.glasses} vasos de 250ml</p>
          <p className="text-xs text-muted">{result.note}</p>
        </div>
      )}
    </div>
  );
}
