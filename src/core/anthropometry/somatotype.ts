import type { Sex } from "@/core/nutrition/nutrition-calculator";

/**
 * Somatotipo Heath-Carter
 *
 * Calcula los tres componentes del somatotipo:
 *   - Endomorfia: predominancia de grasa (pliegues)
 *   - Mesomorfia: predominancia musculoesquelética (diámetros + perímetros corregidos)
 *   - Ectomorfia: linealidad (relación talla/peso)
 *
 * Coordenadas de la somatocarta:
 *   X = Ectomorfia − Endomorfia
 *   Y = 2 × Mesomorfia − (Endomorfia + Ectomorfia)
 */

export interface SomatotypeInput {
  heightCm: number;
  weightKg: number;
  // Pliegues (mm)
  skinfoldTricepsMm: number;
  skinfoldSubscapularMm: number;
  skinfoldSuprailiacMm: number;
  skinfoldCalfMm: number;
  // Perímetros (cm)
  armContractedCm: number; // Brazo flexionado y contraído
  calfCm: number;          // Pantorrilla máxima
  // Diámetros óseos (cm)
  humerusBreadthCm: number; // Biepicondíleo del húmero
  femurBreadthCm: number;   // Biepicondíleo del fémur
}

export interface SomatotypeResult {
  endomorphy: number;
  mesomorphy: number;
  ectomorphy: number;
  x: number; // Coordenada X de la somatocarta
  y: number; // Coordenada Y de la somatocarta
}

/**
 * Endomorfia (Heath-Carter):
 * X = (Σ pliegues) × (170.18 / talla en cm)
 * Endo = −0.7182 + 0.1451(X) − 0.00068(X²) + 0.0000014(X³)
 *
 * Σ pliegues = tríceps + subescapular + suprailiaco
 */
function calculateEndomorphy(
  skinfoldTriceps: number,
  skinfoldSubscapular: number,
  skinfoldSuprailiac: number,
  heightCm: number
): number {
  const sumSF = skinfoldTriceps + skinfoldSubscapular + skinfoldSuprailiac;
  const x = sumSF * (170.18 / heightCm);
  const endo = -0.7182 + 0.1451 * x - 0.00068 * x * x + 0.0000014 * x * x * x;
  return Math.max(0.1, Math.round(endo * 10) / 10);
}

/**
 * Mesomorfia (Heath-Carter):
 * Meso = 0.858(H) + 0.601(F) + 0.188(CAG) + 0.161(CCG) − 0.131(h) + 4.5
 *
 * H = diámetro biepicondíleo húmero
 * F = diámetro biepicondíleo fémur
 * CAG = perímetro brazo corregido = brazo contraído − (pliegue tríceps mm / 10)
 * CCG = perímetro pantorrilla corregido = pantorrilla − (pliegue pantorrilla mm / 10)
 * h = talla en cm
 */
function calculateMesomorphy(
  humerusBreadth: number,
  femurBreadth: number,
  armContracted: number,
  calfCirc: number,
  skinfoldTriceps: number,
  skinfoldCalf: number,
  heightCm: number
): number {
  const correctedArm = armContracted - skinfoldTriceps / 10;
  const correctedCalf = calfCirc - skinfoldCalf / 10;

  const meso =
    0.858 * humerusBreadth +
    0.601 * femurBreadth +
    0.188 * correctedArm +
    0.161 * correctedCalf -
    0.131 * heightCm +
    4.5;

  return Math.round(meso * 10) / 10;
}

/**
 * Ectomorfia (Heath-Carter):
 * HWR = talla / ∛peso
 *   Si HWR ≥ 40.75: Ecto = 0.732 × HWR − 28.58
 *   Si 38.25 ≤ HWR < 40.75: Ecto = 0.463 × HWR − 17.63
 *   Si HWR < 38.25: Ecto = 0.1
 */
function calculateEctomorphy(heightCm: number, weightKg: number): number {
  const hwr = heightCm / Math.cbrt(weightKg);

  let ecto: number;
  if (hwr >= 40.75) {
    ecto = 0.732 * hwr - 28.58;
  } else if (hwr >= 38.25) {
    ecto = 0.463 * hwr - 17.63;
  } else {
    ecto = 0.1;
  }

  return Math.max(0.1, Math.round(ecto * 10) / 10);
}

/**
 * Calcula el somatotipo completo Heath-Carter.
 * Retorna null si faltan datos obligatorios.
 */
export function calculateSomatotype(
  input: Partial<SomatotypeInput>
): SomatotypeResult | null {
  const {
    heightCm,
    weightKg,
    skinfoldTricepsMm,
    skinfoldSubscapularMm,
    skinfoldSuprailiacMm,
    skinfoldCalfMm,
    armContractedCm,
    calfCm,
    humerusBreadthCm,
    femurBreadthCm,
  } = input;

  if (
    !heightCm || !weightKg ||
    skinfoldTricepsMm == null || skinfoldSubscapularMm == null ||
    skinfoldSuprailiacMm == null || skinfoldCalfMm == null ||
    !armContractedCm || !calfCm ||
    !humerusBreadthCm || !femurBreadthCm
  ) {
    return null;
  }

  const endomorphy = calculateEndomorphy(
    skinfoldTricepsMm,
    skinfoldSubscapularMm,
    skinfoldSuprailiacMm,
    heightCm
  );

  const mesomorphy = calculateMesomorphy(
    humerusBreadthCm,
    femurBreadthCm,
    armContractedCm,
    calfCm,
    skinfoldTricepsMm,
    skinfoldCalfMm,
    heightCm
  );

  const ectomorphy = calculateEctomorphy(heightCm, weightKg);

  const x = Math.round((ectomorphy - endomorphy) * 10) / 10;
  const y = Math.round((2 * mesomorphy - (endomorphy + ectomorphy)) * 10) / 10;

  return { endomorphy, mesomorphy, ectomorphy, x, y };
}

/** Clasificación textual del somatotipo dominante */
export function classifySomatotype(result: SomatotypeResult): string {
  const { endomorphy, mesomorphy, ectomorphy } = result;
  const max = Math.max(endomorphy, mesomorphy, ectomorphy);

  if (endomorphy === max && endomorphy > mesomorphy + 0.5 && endomorphy > ectomorphy + 0.5) {
    return "Endomorfo dominante";
  }
  if (mesomorphy === max && mesomorphy > endomorphy + 0.5 && mesomorphy > ectomorphy + 0.5) {
    return "Mesomorfo dominante";
  }
  if (ectomorphy === max && ectomorphy > endomorphy + 0.5 && ectomorphy > mesomorphy + 0.5) {
    return "Ectomorfo dominante";
  }
  if (endomorphy >= mesomorphy && endomorphy >= ectomorphy) {
    if (Math.abs(mesomorphy - ectomorphy) <= 0.5) return "Endomorfo balanceado";
    return mesomorphy > ectomorphy ? "Meso-endomorfo" : "Ecto-endomorfo";
  }
  if (mesomorphy >= endomorphy && mesomorphy >= ectomorphy) {
    if (Math.abs(endomorphy - ectomorphy) <= 0.5) return "Mesomorfo balanceado";
    return endomorphy > ectomorphy ? "Endo-mesomorfo" : "Ecto-mesomorfo";
  }
  if (Math.abs(endomorphy - mesomorphy) <= 0.5) return "Ectomorfo balanceado";
  return endomorphy > mesomorphy ? "Endo-ectomorfo" : "Meso-ectomorfo";
}
