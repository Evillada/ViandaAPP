import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CONSENT_V1_BODY = `BORRADOR — pendiente de revisión legal.

Autorización para el tratamiento de datos personales y datos de salud (Ley 1581 de 2012).

Al aceptar, autorizo de manera previa, expresa e informada a mi profesional de nutrición, a través de la plataforma Vianda, para recolectar, almacenar y usar mis datos personales y mis datos de salud (antropometría, valoraciones, planes alimentarios y registros que yo aporte) con la única finalidad de prestarme atención nutricional.

Entiendo que mis datos de salud son datos sensibles, que no estoy obligado(a) a autorizar su tratamiento, y que puedo conocer, actualizar, rectificar y revocar esta autorización en cualquier momento desde mi cuenta. La revocación corta mi acceso al portal; la ficha clínica que el profesional conserve se rige por las normas de historia clínica aplicables.`;

const NUTRIENTS = [
  { name: "Energía", unit: "kcal", category: "ENERGY" as const },
  { name: "Proteína", unit: "g", category: "MACRO" as const },
  { name: "Carbohidratos", unit: "g", category: "MACRO" as const },
  { name: "Fibra", unit: "g", category: "MACRO" as const },
  { name: "Grasas totales", unit: "g", category: "LIPID" as const },
  { name: "Grasas saturadas", unit: "g", category: "LIPID" as const },
  { name: "Calcio", unit: "mg", category: "MINERAL" as const },
  { name: "Hierro", unit: "mg", category: "MINERAL" as const },
];

const CATEGORIES = [
  { name: "Cereales y tubérculos", slug: "cereales" },
  { name: "Verduras y hortalizas", slug: "verduras" },
  { name: "Frutas", slug: "frutas" },
  { name: "Carnes y derivados", slug: "carnes" },
  { name: "Lácteos", slug: "lacteos" },
  { name: "Grasas y aceites", slug: "grasas" },
  { name: "Leguminosas", slug: "leguminosas" },
];

// Valores aproximados por 100g — ICBF referencia
const FOODS: {
  name: string;
  category: string;
  nutrients: Record<string, number>;
  portion: { name: string; grams: number };
}[] = [
  { name: "Arroz blanco cocido", category: "cereales", nutrients: { Energía: 130, Proteína: 2.7, Carbohidratos: 28, Fibra: 0.4, "Grasas totales": 0.3 }, portion: { name: "taza", grams: 150 } },
  { name: "Papa cocida", category: "cereales", nutrients: { Energía: 87, Proteína: 1.9, Carbohidratos: 20, Fibra: 1.8, "Grasas totales": 0.1 }, portion: { name: "unidad mediana", grams: 150 } },
  { name: "Avena en hojuelas", category: "cereales", nutrients: { Energía: 389, Proteína: 16.9, Carbohidratos: 66, Fibra: 10.6, "Grasas totales": 6.9 }, portion: { name: "taza", grams: 40 } },
  { name: "Plátano maduro", category: "frutas", nutrients: { Energía: 89, Proteína: 1.1, Carbohidratos: 23, Fibra: 2.6, "Grasas totales": 0.3 }, portion: { name: "unidad mediana", grams: 120 } },
  { name: "Manzana", category: "frutas", nutrients: { Energía: 52, Proteína: 0.3, Carbohidratos: 14, Fibra: 2.4, "Grasas totales": 0.2 }, portion: { name: "unidad mediana", grams: 180 } },
  { name: "Brócoli cocido", category: "verduras", nutrients: { Energía: 35, Proteína: 2.4, Carbohidratos: 7, Fibra: 3.3, "Grasas totales": 0.4 }, portion: { name: "taza", grams: 90 } },
  { name: "Espinaca cruda", category: "verduras", nutrients: { Energía: 23, Proteína: 2.9, Carbohidratos: 3.6, Fibra: 2.2, "Grasas totales": 0.4 }, portion: { name: "taza", grams: 30 } },
  { name: "Pechuga de pollo sin piel", category: "carnes", nutrients: { Energía: 165, Proteína: 31, Carbohidratos: 0, Fibra: 0, "Grasas totales": 3.6 }, portion: { name: "porción", grams: 120 } },
  { name: "Carne de res magra", category: "carnes", nutrients: { Energía: 250, Proteína: 26, Carbohidratos: 0, Fibra: 0, "Grasas totales": 15 }, portion: { name: "porción", grams: 100 } },
  { name: "Huevo entero", category: "carnes", nutrients: { Energía: 155, Proteína: 13, Carbohidratos: 1.1, Fibra: 0, "Grasas totales": 11 }, portion: { name: "unidad", grams: 50 } },
  { name: "Leche entera", category: "lacteos", nutrients: { Energía: 61, Proteína: 3.2, Carbohidratos: 4.8, Fibra: 0, "Grasas totales": 3.3, Calcio: 113 }, portion: { name: "vaso", grams: 240 } },
  { name: "Yogurt natural", category: "lacteos", nutrients: { Energía: 59, Proteína: 10, Carbohidratos: 3.6, Fibra: 0, "Grasas totales": 0.4, Calcio: 110 }, portion: { name: "vaso", grams: 200 } },
  { name: "Queso fresco", category: "lacteos", nutrients: { Energía: 264, Proteína: 18, Carbohidratos: 3, Fibra: 0, "Grasas totales": 20, Calcio: 510 }, portion: { name: "rebanada", grams: 30 } },
  { name: "Aceite de oliva", category: "grasas", nutrients: { Energía: 884, Proteína: 0, Carbohidratos: 0, Fibra: 0, "Grasas totales": 100 }, portion: { name: "cucharada", grams: 15 } },
  { name: "Aguacate", category: "grasas", nutrients: { Energía: 160, Proteína: 2, Carbohidratos: 9, Fibra: 7, "Grasas totales": 15 }, portion: { name: "mitad", grams: 100 } },
  { name: "Lentejas cocidas", category: "leguminosas", nutrients: { Energía: 116, Proteína: 9, Carbohidratos: 20, Fibra: 8, "Grasas totales": 0.4, Hierro: 3.3 }, portion: { name: "taza", grams: 180 } },
  { name: "Frijol rojo cocido", category: "leguminosas", nutrients: { Energía: 127, Proteína: 8.7, Carbohidratos: 23, Fibra: 6.4, "Grasas totales": 0.5, Hierro: 2.1 }, portion: { name: "taza", grams: 180 } },
  { name: "Pan integral", category: "cereales", nutrients: { Energía: 247, Proteína: 13, Carbohidratos: 41, Fibra: 7, "Grasas totales": 3.4 }, portion: { name: "rebanada", grams: 30 } },
  { name: "Salmón", category: "carnes", nutrients: { Energía: 208, Proteína: 20, Carbohidratos: 0, Fibra: 0, "Grasas totales": 13 }, portion: { name: "porción", grams: 120 } },
  { name: "Naranja", category: "frutas", nutrients: { Energía: 47, Proteína: 0.9, Carbohidratos: 12, Fibra: 2.4, "Grasas totales": 0.1 }, portion: { name: "unidad mediana", grams: 150 } },
];

/** El repositorio es público: las contraseñas demo sólo viven en .env (o en el entorno de quien ejecuta el seed). */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 12) {
    throw new Error(`${name} debe estar definida en .env (mínimo 12 caracteres) para ejecutar el seed`);
  }
  return value;
}

async function main() {
  const devPassword = await bcrypt.hash(requiredEnv("SEED_DEV_PASSWORD"), 12);
  const patientPassword = await bcrypt.hash(requiredEnv("SEED_PATIENT_PASSWORD"), 12);

  const dev = await prisma.user.upsert({
    where: { email: "dev@gmail.com" },
    update: { name: "Dr. Desarrollador", password: devPassword, roles: ["PROFESSIONAL", "ADMIN"] },
    create: { email: "dev@gmail.com", name: "Dr. Desarrollador", password: devPassword, roles: ["PROFESSIONAL", "ADMIN"] },
  });

  await prisma.professionalProfile.upsert({
    where: { userId: dev.id },
    update: { status: "APPROVED", licenseNumber: "RETHUS-DEMO-0001", reviewedAt: new Date() },
    create: { userId: dev.id, status: "APPROVED", licenseNumber: "RETHUS-DEMO-0001", reviewedAt: new Date() },
  });

  const patientUser = await prisma.user.upsert({
    where: { email: "paciente@emuj.health" },
    update: { name: "María García", password: patientPassword, roles: ["PATIENT"] },
    create: { email: "paciente@emuj.health", name: "María García", password: patientPassword, roles: ["PATIENT"] },
  });

  const consentDocument = await prisma.consentDocument.upsert({
    where: { version: "2026-11-v1" },
    update: { body: CONSENT_V1_BODY },
    create: { version: "2026-11-v1", body: CONSENT_V1_BODY, effectiveAt: new Date("2026-11-01T00:00:00Z") },
  });

  for (const n of NUTRIENTS) {
    await prisma.nutrient.upsert({
      where: { name: n.name },
      update: {},
      create: n,
    });
  }

  const nutrientMap = Object.fromEntries(
    (await prisma.nutrient.findMany()).map((n) => [n.name, n.id])
  );

  for (const c of CATEGORIES) {
    await prisma.foodCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
  }

  const categoryMap = Object.fromEntries(
    (await prisma.foodCategory.findMany()).map((c) => [c.slug, c.id])
  );

  for (const food of FOODS) {
    const existing = await prisma.food.findFirst({ where: { name: food.name } });
    const foodRecord = existing
      ? await prisma.food.update({
          where: { id: existing.id },
          data: { categoryId: categoryMap[food.category]! },
        })
      : await prisma.food.create({
          data: {
            name: food.name,
            categoryId: categoryMap[food.category]!,
            source: "ICBF",
            isGlobal: true,
          },
        });

    for (const [nutrientName, amount] of Object.entries(food.nutrients)) {
      const nutrientId = nutrientMap[nutrientName];
      if (!nutrientId) continue;
      await prisma.foodNutrient.upsert({
        where: { foodId_nutrientId: { foodId: foodRecord.id, nutrientId } },
        update: { amountPer100g: amount },
        create: { foodId: foodRecord.id, nutrientId, amountPer100g: amount },
      });
    }

    await prisma.foodPortion.deleteMany({ where: { foodId: foodRecord.id } });
    await prisma.foodPortion.create({
      data: {
        foodId: foodRecord.id,
        name: food.portion.name,
        grams: food.portion.grams,
        isDefault: true,
      },
    });
  }

  const patient = await prisma.patient.upsert({
    where: { id: "seed-patient-maria" },
    update: {
      firstName: "María",
      lastName: "García",
      documentId: "1001234567",
      sex: "FEMALE",
      email: "maria.garcia@email.com",
      phone: "+57 300 123 4567",
      dateOfBirth: new Date("1990-05-15"),
      notes: "Paciente demo — sedentaria, objetivo pérdida de peso",
      professionalId: dev.id,
      userId: patientUser.id,
    },
    create: {
      id: "seed-patient-maria",
      firstName: "María",
      lastName: "García",
      documentId: "1001234567",
      sex: "FEMALE",
      email: "maria.garcia@email.com",
      phone: "+57 300 123 4567",
      dateOfBirth: new Date("1990-05-15"),
      notes: "Paciente demo — sedentaria, objetivo pérdida de peso",
      professionalId: dev.id,
      userId: patientUser.id,
    },
  });

  await prisma.patientConsent.deleteMany({ where: { patientId: patient.id } });
  await prisma.patientConsent.create({
    data: { patientId: patient.id, userId: patientUser.id, documentId: consentDocument.id, ip: "seed", userAgent: "seed" },
  });

  await prisma.patient.upsert({
    where: { id: "seed-patient-carlos" },
    update: { professionalId: dev.id },
    create: {
      id: "seed-patient-carlos",
      firstName: "Carlos",
      lastName: "Ruiz",
      sex: "MALE",
      dateOfBirth: new Date("1985-03-10"),
      phone: "+57 310 555 0101",
      notes: "Paciente demo sin cuenta — para probar invitaciones",
      professionalId: dev.id,
    },
  });

  await prisma.assessment.deleteMany({ where: { patientId: patient.id } });

  const demoAssessments = [
    {
      id: "seed-assessment-maria-1",
      date: new Date("2026-05-15"),
      type: "INITIAL" as const,
      reason: "Valoración inicial — pérdida de peso",
      weightKg: 78,
      waistCm: 88,
      hipCm: 102,
      skinfolds: { triceps: 22, subscapular: 18, biceps: 14, suprailiac: 24, thigh: 28 },
    },
    {
      id: "seed-assessment-maria-2",
      date: new Date("2026-07-01"),
      type: "FOLLOW_UP" as const,
      reason: "Control mensual",
      weightKg: 75.5,
      waistCm: 85,
      hipCm: 100,
      skinfolds: { triceps: 20, subscapular: 17, biceps: 13, suprailiac: 22, thigh: 26 },
    },
    {
      id: "seed-assessment-maria-3",
      date: new Date("2026-08-20"),
      type: "FOLLOW_UP" as const,
      reason: "Control nutricional",
      weightKg: 73.2,
      waistCm: 82,
      hipCm: 98,
      skinfolds: { triceps: 18, subscapular: 15, biceps: 12, suprailiac: 20, thigh: 24 },
    },
  ];

  const heightCm = 165;
  const age = 36;

  for (const demo of demoAssessments) {
    const bmi = Math.round((demo.weightKg / (heightCm / 100) ** 2) * 10) / 10;
    const bmiCategory =
      bmi < 18.5 ? "UNDERWEIGHT" :
      bmi < 25 ? "NORMAL" :
      bmi < 30 ? "OVERWEIGHT" :
      bmi < 35 ? "OBESE_I" : "OBESE_II";
    const tmb = Math.round(10 * demo.weightKg + 6.25 * heightCm - 5 * age - 161);
    const targetKcal = Math.round(tmb * 1.2);
    const waistHipRatio = Math.round((demo.waistCm / demo.hipCm) * 100) / 100;
    const sum = demo.skinfolds.triceps + demo.skinfolds.suprailiac + demo.skinfolds.thigh;
    const density = 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age;
    const bodyFatPercent = Math.round(((495 / density) - 450) * 10) / 10;
    const fatMassKg = Math.round(demo.weightKg * (bodyFatPercent / 100) * 10) / 10;

    await prisma.assessment.create({
      data: {
        id: demo.id,
        type: demo.type,
        assessmentDate: demo.date,
        reason: demo.reason,
        allergies: "Nueces",
        conditions: "Resistencia a la insulina",
        activityLevel: "SEDENTARY",
        patientId: patient.id,
        professionalId: dev.id,
        anthropometry: {
          create: {
            weightKg: demo.weightKg,
            heightCm,
            bodyFatPercent,
            bodyFatMethod: "JACKSON_POLLOCK_3",
            fatMassKg,
            leanMassKg: Math.round((demo.weightKg - fatMassKg) * 10) / 10,
            waistCm: demo.waistCm,
            hipCm: demo.hipCm,
            waistHipRatio,
            armContractedCm: 28,
            skinfoldTricepsMm: demo.skinfolds.triceps,
            skinfoldSubscapularMm: demo.skinfolds.subscapular,
            skinfoldBicepsMm: demo.skinfolds.biceps,
            skinfoldSuprailiacMm: demo.skinfolds.suprailiac,
            skinfoldThighMm: demo.skinfolds.thigh,
          },
        },
        nutritionalGoal: {
          create: {
            bmi,
            bmiCategory,
            tmbKcal: tmb,
            targetKcal,
            proteinG: Math.round((targetKcal * 0.25) / 4),
            carbsG: Math.round((targetKcal * 0.5) / 4),
            fatG: Math.round((targetKcal * 0.25) / 9),
          },
        },
      },
    });
  }

  console.log("✅ Vianda seed completado");
  console.log("   Nutricionista: dev@gmail.com (contraseña: SEED_DEV_PASSWORD en .env)");
  console.log("   Paciente demo:", patient.firstName, patient.lastName);
  console.log(`   ${demoAssessments.length} valoraciones demo con historial`);
  console.log(`   ${FOODS.length} alimentos ICBF cargados`);
  console.log("   Consentimiento v1, María vinculada a paciente@emuj.health, Carlos sin cuenta");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
