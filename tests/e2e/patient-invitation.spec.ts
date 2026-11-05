import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

test("invitar → crear cuenta en móvil → consentir → portal → revocar", async ({ page }) => {
  await login(page, "dev@gmail.com", "Dev123!");
  await page.goto("/dashboard/patients/seed-patient-carlos");
  await page.getByRole("button", { name: "Invitar al portal" }).click();
  const inviteUrl = await page.getByLabel("Enlace de invitación").inputValue();
  expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  await logout(page);

  await page.goto(new URL(inviteUrl).pathname);
  await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
  const patientEmail = `carlos-${Date.now()}@test.co`;
  await page.getByLabel("Email").fill(patientEmail);
  await page.getByLabel("Contraseña").fill("Secreta1");
  await page.getByRole("button", { name: "Crear cuenta y continuar" }).click();

  await expect(page.getByRole("heading", { name: "Autorización de tratamiento de datos" })).toBeVisible();
  await expect(page.getByText(patientEmail)).toBeVisible();
  await expect(page.getByRole("button", { name: "Usar otra cuenta" })).toBeVisible();
  const accept = page.getByRole("button", { name: "Acepto" });
  await expect(accept).toBeDisabled();
  await page.getByLabel("Autorizo el tratamiento de mis datos personales y de salud").check();
  await accept.click();

  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Dr. Desarrollador", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revocar autorización" }).click();
  await page.getByRole("button", { name: "Sí, revocar" }).click();
  await expect(page.getByText("No tienes profesionales vinculados")).toBeVisible();

  await page.goto(new URL(inviteUrl).pathname);
  await expect(page.getByText("Este enlace ya no es válido")).toBeVisible();
});
