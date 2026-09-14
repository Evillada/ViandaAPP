import type { Sex } from "@/core/nutrition/nutrition-calculator";

export type BodyFatMethod = "MANUAL" | "DURNIN_WOMERSLEY" | "JACKSON_POLLOCK_3" | "YUHASZ";

export interface SkinfoldInput {
  biceps?: number | null;
  triceps?: number | null;
  subscapular?: number | null;
  suprailiac?: number | null;
  abdominal?: number | null;
  thigh?: number | null;
  calf?: number | null;
  midaxillary?: number | null;
  pectoral?: number | null;
}

export interface BodyCompositionResult {
  bodyFatPercent: number;
  method: BodyFatMethod;
  fatMassKg: number;
  leanMassKg: number;
}

function siriBodyFatPercent(density: number): number {
  return Math.round(((495 / density) - 450) * 10) / 10;
}

function durninWomersleyConstants(
  age: number,
  sex: Sex
): { a: number; b: number } | null {
  const bracket =
    age < 20 ? 0 : age < 30 ? 1 : age < 40 ? 2 : age < 50 ? 3 : 4;

  const male = [
    { a: 1.1533, b: 0.0643 },
    { a: 1.1631, b: 0.0642 },
    { a: 1.1422, b: 0.0544 },
    { a: 1.162, b: 0.07 },
    { a: 1.1715, b: 0.0779 },
  ];
  const female = [
    { a: 1.1549, b: 0.0678 },
    { a: 1.1599, b: 0.0717 },
    { a: 1.1423, b: 0.0632 },
    { a: 1.1333, b: 0.0612 },
    { a: 1.1339, b: 0.0645 },
  ];

  if (sex === "OTHER") return null;
  return sex === "MALE" ? male[bracket]! : female[bracket]!;
}

/** Durnin & Womersley — 4 pliegues: bíceps, tríceps, subescapular, suprailíaco. */
export function calculateBodyFatDurninWomersley(
  skinfolds: SkinfoldInput,
  age: number,
  sex: Sex
): number | null {
  const { biceps, triceps, subscapular, suprailiac } = skinfolds;
  if (
    biceps == null ||
    triceps == null ||
    subscapular == null ||
    suprailiac == null
  ) {
    return null;
  }

  const sum = biceps + triceps + subscapular + suprailiac;
  if (sum <= 0) return null;

  const constants = durninWomersleyConstants(age, sex);
  if (!constants) return null;

  const density = constants.a - constants.b * Math.log10(sum);
  if (density <= 0) return null;

  return siriBodyFatPercent(density);
}

/** Jackson-Pollock 3 sitios — mujeres: tríceps, suprailíaco, muslo; hombres: abdominal, suprailíaco, muslo. */
export function calculateBodyFatJacksonPollock3(
  skinfolds: SkinfoldInput,
  age: number,
  sex: Sex
): number | null {
  if (sex === "OTHER") return null;

  let sum: number;
  if (sex === "FEMALE") {
    const { triceps, suprailiac, thigh } = skinfolds;
    if (triceps == null || suprailiac == null || thigh == null) return null;
    sum = triceps + suprailiac + thigh;
    const density =
      1.0994921 -
      0.0009929 * sum +
      0.0000023 * sum * sum -
      0.0001392 * age;
    if (density <= 0) return null;
    return siriBodyFatPercent(density);
  }

  const { abdominal, suprailiac, thigh } = skinfolds;
  if (abdominal == null || suprailiac == null || thigh == null) return null;
  sum = abdominal + suprailiac + thigh;
  const density =
    1.10938 -
    0.0008267 * sum +
    0.0000016 * sum * sum -
    0.0002574 * age;
  if (density <= 0) return null;
  return siriBodyFatPercent(density);
}

/**
 * Yuhasz (Carter, 1982) — 6 pliegues: tríceps, subescapular, suprailiaco, abdominal, muslo, pantorrilla.
 * Hombres: %GC = 0.1051 × ΣP + 2.585
 * Mujeres: %GC = 0.1548 × ΣP + 3.580
 */
export function calculateBodyFatYuhasz(
  skinfolds: SkinfoldInput,
  sex: Sex
): number | null {
  const { triceps, subscapular, suprailiac, abdominal, thigh, calf } = skinfolds;
  if (
    triceps == null || subscapular == null || suprailiac == null ||
    abdominal == null || thigh == null || calf == null
  ) {
    return null;
  }

  if (sex === "OTHER") return null;

  const sum = triceps + subscapular + suprailiac + abdominal + thigh + calf;
  if (sum <= 0) return null;

  const pct =
    sex === "MALE"
      ? 0.1051 * sum + 2.585
      : 0.1548 * sum + 3.58;

  return Math.round(pct * 10) / 10;
}

export function calculateBodyComposition(
  weightKg: number,
  skinfolds: SkinfoldInput,
  age: number,
  sex: Sex,
  manualBodyFatPercent?: number | null
): BodyCompositionResult | null {
  if (manualBodyFatPercent != null && manualBodyFatPercent > 0) {
    const fatMassKg = Math.round(weightKg * (manualBodyFatPercent / 100) * 10) / 10;
    return {
      bodyFatPercent: manualBodyFatPercent,
      method: "MANUAL",
      fatMassKg,
      leanMassKg: Math.round((weightKg - fatMassKg) * 10) / 10,
    };
  }

  const durnin = calculateBodyFatDurninWomersley(skinfolds, age, sex);
  if (durnin != null) {
    const fatMassKg = Math.round(weightKg * (durnin / 100) * 10) / 10;
    return {
      bodyFatPercent: durnin,
      method: "DURNIN_WOMERSLEY",
      fatMassKg,
      leanMassKg: Math.round((weightKg - fatMassKg) * 10) / 10,
    };
  }

  const jp3 = calculateBodyFatJacksonPollock3(skinfolds, age, sex);
  if (jp3 != null) {
    const fatMassKg = Math.round(weightKg * (jp3 / 100) * 10) / 10;
    return {
      bodyFatPercent: jp3,
      method: "JACKSON_POLLOCK_3",
      fatMassKg,
      leanMassKg: Math.round((weightKg - fatMassKg) * 10) / 10,
    };
  }

  const yuhasz = calculateBodyFatYuhasz(skinfolds, sex);
  if (yuhasz != null) {
    const fatMassKg = Math.round(weightKg * (yuhasz / 100) * 10) / 10;
    return {
      bodyFatPercent: yuhasz,
      method: "YUHASZ",
      fatMassKg,
      leanMassKg: Math.round((weightKg - fatMassKg) * 10) / 10,
    };
  }

  return null;
}
