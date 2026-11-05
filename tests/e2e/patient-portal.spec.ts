import { expect, test } from "@playwright/test";
import { loginAsPatient } from "./helpers";

test("paciente: saludo, menú de hoy, plan semanal y completo, citas y cuenta", async ({ page }) => {
  await loginAsPatient(page);
  await expect(page).toHaveURL(/\/portal$/);

  await expect(page.getByRole("heading", { level: 1, name: /^(Buenos días|Buenas tardes|Buenas noches), María$/ })).toBeVisible();
  await expect(page.getByText(/^Tu próxima cita es el /)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tu menú de hoy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Desayuno" }).first()).toBeVisible();
  await expect(page.getByText("Toma 8 vasos de agua al día")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const label of ["Hoy", "Plan", "Citas", "Cuenta"]) await expect(nav.getByText(label, { exact: true })).toBeVisible();

  await nav.getByRole("link", { name: "Plan" }).click();
  await expect(page).toHaveURL(/\/portal\/plan/);
  // Selector estructural: el día abierto de hoy contiene más <li> anidados (comidas e ítems).
  await expect(page.locator('section[aria-label="Esta semana"] > ul > li')).toHaveCount(7);
  await expect(page.getByText(/· Hoy$/)).toBeVisible();

  await page.getByRole("link", { name: "Plan completo" }).click();
  await expect(page.getByRole("heading", { name: "Día 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Día 2" })).toBeVisible();

  await nav.getByRole("link", { name: "Citas" }).click();
  await expect(page.getByText("Tu próxima cita", { exact: true })).toBeVisible();
  await expect(page.getByText(/Control mensual/)).toBeVisible();

  await nav.getByRole("button", { name: "Cuenta" }).click();
  await page.getByRole("dialog", { name: "Cuenta" }).getByRole("link", { name: "Mi cuenta y profesionales" }).click();
  await expect(page).toHaveURL(/\/portal\/cuenta$/);
  await expect(page.getByText("Dr. Desarrollador", { exact: true })).toBeVisible();
});
