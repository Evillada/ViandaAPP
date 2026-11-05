export const ACTIVITY_LABELS: Record<string, string> = {
  SEDENTARY: "Sedentario",
  LIGHT: "Ligera",
  MODERATE: "Moderada",
  ACTIVE: "Activa",
  VERY_ACTIVE: "Muy activa",
};

export const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: "Desayuno",
  MORNING_SNACK: "Media mañana",
  LUNCH: "Almuerzo",
  AFTERNOON_SNACK: "Media tarde",
  DINNER: "Cena",
  EVENING_SNACK: "Refrigerio nocturno",
  OTHER: "Otro",
};

export const PORTAL_MEAL_LABELS: Record<string, string> = { ...MEAL_TYPE_LABELS, AFTERNOON_SNACK: "Onces" };

export const SEX_LABELS: Record<string, string> = {
  MALE: "Masculino",
  FEMALE: "Femenino",
  OTHER: "Otro",
};

export const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  INITIAL: "Valoración inicial",
  FOLLOW_UP: "Control / seguimiento",
  REASSESSMENT: "Revaloración",
  DISCHARGE: "Alta",
};

export const BODY_FAT_METHOD_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  DURNIN_WOMERSLEY: "Durnin-Womersley (4 pliegues)",
  JACKSON_POLLOCK_3: "Jackson-Pollock (3 sitios)",
  YUHASZ: "Yuhasz (6 pliegues)",
};

export const TMB_FORMULA_LABELS: Record<string, string> = {
  MIFFLIN_ST_JEOR: "Mifflin-St Jeor (1990)",
  HARRIS_BENEDICT: "Harris-Benedict revisada (1984)",
  FAO_OMS: "FAO/OMS/UNU (1985)",
};

export const MACRO_PRESET_LABELS: Record<string, string> = {
  STANDARD: "Estándar (25/50/25)",
  HIGH_PROTEIN: "Alta en proteína (30/40/30)",
  LOW_CARB: "Baja en carbohidratos (30/30/40)",
  KETOGENIC: "Cetogénica (20/5/75)",
  ATHLETIC: "Deportista (25/55/20)",
  RENAL: "Renal (10/60/30)",
  CUSTOM: "Personalizado",
};

export const WATER_METHOD_LABELS: Record<string, string> = {
  STANDARD: "Estándar (ml/kg)",
  HOLLIDAY_SEGAR: "Holliday-Segar",
  ADJUSTED: "Ajustada por actividad",
};

export const MEAL_TEMPLATE_LABELS: Record<string, string> = {
  "3_MEALS": "3 comidas",
  "5_MEALS": "5 comidas (con snacks)",
  "6_MEALS": "6 comidas (completo)",
};

export const PATIENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  DISCHARGED: "Alta",
};

export const BMI_CATEGORY_LABELS: Record<string, string> = {
  UNDERWEIGHT: "Bajo peso",
  NORMAL: "Peso normal",
  OVERWEIGHT: "Sobrepeso",
  OBESE_I: "Obesidad grado I",
  OBESE_II: "Obesidad grado II",
  OBESE_III: "Obesidad grado III",
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  REPLACED: "Reemplazado",
  CANCELLED: "Cancelado",
};
