import { expect, test } from "@playwright/test";
import { loginAsDev, logout } from "./helpers";

test("invitar → crear cuenta en móvil → consentir → portal → revocar", async ({ page }) => {
  await loginAsDev(page);
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
  await page.getByLabel("Contraseña", { exact: true }).fill("Secreta1");
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Crear cuenta y continuar" }).click();

  await expect(page.getByRole("heading", { name: "Autorización de tratamiento de datos" })).toBeVisible();
  await expect(page.getByText(patientEmail)).toBeVisible();
  await expect(page.getByRole("button", { name: "Usar otra cuenta" })).toBeVisible();
  const accept = page.getByRole("button", { name: "Acepto" });
  await expect(accept).toBeDisabled();
  await page.getByLabel("Autorizo el tratamiento de mis datos personales y de salud").check();
  await accept.click();

  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Aún no tienes un plan activo")).toBeVisible();
  await page.goto("/portal/cuenta");
  await expect(page.getByText("Dr. Desarrollador", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revocar autorización" }).click();
  await page.getByRole("button", { name: "Sí, revocar" }).click();
  await expect(page.getByText("No tienes profesionales vinculados")).toBeVisible();

  await page.goto(new URL(inviteUrl).pathname);
  await expect(page.getByText("Este enlace ya no es válido")).toBeVisible();

  // Eliminar la cuenta recién creada: cierra sesión y redirige al login con aviso.
  await page.goto("/portal/cuenta");
  await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
  const dialog = page.getByRole("dialog"); // el <dialog> del Modal no expone nombre accesible
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Eliminar mi cuenta" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page).toHaveURL(/\/login\?deleted=1$/, { timeout: 30_000 });
  await expect(page.getByRole("status").filter({ hasText: "Tu cuenta fue eliminada" })).toBeVisible();

  // La cuenta eliminada ya no puede iniciar sesión con las mismas credenciales.
  await page.getByLabel("Email").fill(patientEmail);
  await page.getByLabel("Contraseña", { exact: true }).fill("Secreta1");
  const submit = page.getByRole("button", { name: "Iniciar sesión" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Email o contraseña incorrectos")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
