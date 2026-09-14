"use client";

import { useState } from "react";
import { calculateBmi } from "@/core/nutrition/nutrition-calculator";
import { classifyBmiOms } from "@/core/anthropometry/bmi-classifier";
import { Input, Button } from "@/shared/ui/components";

export function QuickBmiCalculator() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [result, setResult] = useState<{ bmi: number; label: string; color: string } | null>(null);

  function calculate() {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!w || !h) return;
    const bmi = calculateBmi(w, h);
    const classification = classifyBmiOms(bmi);

    const colors: Record<string, string> = {
      UNDERWEIGHT: "text-secondary",
      NORMAL: "text-primary",
      OVERWEIGHT: "text-accent",
      OBESE_I: "text-warning",
      OBESE_II: "text-danger",
      OBESE_III: "text-danger",
    };

    setResult({
      bmi,
      label: classification.label,
      color: colors[classification.category] ?? "text-text",
    });
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
        label="Talla (cm)"
        type="number"
        step="0.1"
        value={height}
        onChange={(e) => setHeight(e.target.value)}
        placeholder="165"
      />
      <Button onClick={calculate} className="w-full" size="sm">
        Calcular
      </Button>

      {result && (
        <div className="rounded-xl bg-primary-light p-4 text-center space-y-1">
          <p className={`text-3xl font-bold ${result.color}`}>{result.bmi}</p>
          <p className="text-sm text-text">kg/m²</p>
          <p className={`text-sm font-medium ${result.color}`}>{result.label}</p>
        </div>
      )}
    </div>
  );
}
