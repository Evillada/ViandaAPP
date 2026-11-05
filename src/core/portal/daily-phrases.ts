/** Frases curadas: hábitos, constancia y autocuidado. Nunca peso, dieta, cuerpo ni promesas de resultados. */
export const DAILY_PHRASES = [
  "Cada comida es una nueva oportunidad para cuidarte.",
  "La constancia vale más que la perfección.",
  "Un vaso de agua al despertar es un buen comienzo.",
  "Come con calma y sin distracciones: es un momento para ti.",
  "Hoy basta con dar un paso pequeño en la dirección correcta.",
  "Preparar tus comidas con anticipación es un regalo para tu yo de mañana.",
  "Comer despacio te ayuda a disfrutar y a reconocer cuándo es suficiente.",
  "Agrega un color más a tu plato hoy.",
  "Dormir bien también es parte de alimentarte bien.",
  "No necesitas hacerlo perfecto, sólo seguir intentándolo.",
  "Tu bienestar se construye con decisiones sencillas repetidas cada día.",
  "Elige alimentos que te den energía para lo que quieres hacer hoy.",
  "Moverte un poco más hoy cuenta, aunque sea una caminata corta.",
  "Si un día no salió como esperabas, la siguiente comida es un nuevo comienzo.",
  "Ten a la mano fruta lavada: lo fácil se vuelve hábito.",
  "Hidratarte es una forma simple de cuidarte durante todo el día.",
  "Celebra lo que sí lograste esta semana.",
  "Comer en compañía también nutre.",
  "Planear tus compras te ayuda a elegir mejor.",
  "La paciencia contigo es parte del proceso.",
  "Hoy puedes probar una receta nueva y sencilla.",
  "Tu plan es una guía para acompañarte, no una obligación rígida.",
  "Respira hondo antes de comer y date un momento para ti.",
  "Las verduras en el almuerzo son una gran aliada de tu energía.",
  "Cuidarte hoy es invertir en cómo te sentirás mañana.",
  "Un desayuno tranquilo prepara un mejor día.",
  "Escribe una cosa por la que te sientas agradecido hoy.",
  "Pequeños cambios sostenidos hacen grandes diferencias.",
  "Pide ayuda cuando la necesites: no estás solo en esto.",
  "Tu esfuerzo de hoy merece reconocimiento.",
  "Lleva una botella de agua contigo y ve sumando sorbos.",
  "Cocinar en casa te permite conocer mejor lo que comes.",
  "Disfruta los sabores: comer también es placer.",
  "Cada día es una oportunidad para practicar un buen hábito.",
  "Organiza tu semana pensando en tus comidas principales.",
  "Prioriza el descanso: mañana lo vas a agradecer.",
  "Las legumbres son una gran opción para variar tus comidas.",
  "Hoy elige una merienda que te haga sentir bien.",
  "Un paseo después de comer es un buen momento para despejar la mente.",
  "Lo importante es la dirección, no la velocidad.",
  "Tu historia con la comida es tuya; trátala con amabilidad.",
  "Revisa tu plan de hoy y prepárate para cumplirlo con calma.",
  "La variedad en tu plato es variedad de nutrientes.",
  "Haz una pausa activa: estírate unos minutos.",
  "Prepara tu almuerzo de mañana esta noche.",
  "Reconoce tus señales de hambre y saciedad.",
  "Elegir agua en lugar de bebidas azucaradas es un gran hábito.",
  "Cada hábito nuevo empieza con una primera vez.",
  "Comparte con tu profesional cómo te has sentido esta semana.",
  "La fruta entera es una merienda práctica y deliciosa.",
  "Sonríe: cuidarte también es disfrutar el camino.",
  "Hoy puedes elegir con intención, sin culpa.",
  "Mantener horarios regulares de comida ayuda a tu energía.",
  "Reconoce todo lo que haces por ti cada día y agradécelo.",
  "Un buen hábito repetido se vuelve parte de ti.",
  "Las especias y hierbas dan sabor y alegría a tus comidas.",
  "Escoge una meta pequeña para hoy y cúmplela.",
  "Tu constancia de hoy es la base de tu bienestar.",
  "Sal a tomar un poco de sol y aire fresco.",
  "Cuidarte es un acto de cariño contigo.",
  "Haz de tus comidas un momento tranquilo.",
  "Recuerda: avanzar un poco cada día también es avanzar.",
] as const;

/** Términos prohibidos (minúsculas). Un test verifica que ninguna frase los contiene. */
export const FORBIDDEN_PHRASE_TERMS = [
  "peso", "kilo", " kg", "dieta", "adelgaz", "gord", "flac", "cuerpo", "ligero", "bajar de", "quemar", "garantiz", "resultado",
] as const;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function phraseOfTheDay(dateKey: string, userId: string): string {
  return DAILY_PHRASES[hash(`${dateKey}:${userId}`) % DAILY_PHRASES.length]!;
}
