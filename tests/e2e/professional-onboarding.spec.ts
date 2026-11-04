import { expect, test } from "@playwright/test";
import { login, logout, switchArea } from "./helpers";

test("registro → pendiente → aprobación → acceso", async ({ page }) => {
  const email = `nueva-${Date.now()}@test.co`;

  await page.goto("/register");
  await page.getByLabel("Nombre completo").fill("Laura Gómez");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("Secreta1");
  await page.getByLabel("Número de tarjeta profesional").fill("TP-998877");
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page.getByRole("heading", { name: "Tu cuenta está en revisión" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/pending$/);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();

  await login(page, "dev@gmail.com", "Dev123!");
  await switchArea(page, "Administración");
  await expect(page).toHaveURL(/\/admin\/professionals$/);
  await page.getByRole("article", { name: "Laura Gómez" }).getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByRole("article", { name: "Laura Gómez" }).getByText("Aprobado")).toBeVisible();
  await logout(page);

  await login(page, email, "Secreta1");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByText("Pacientes")).toBeVisible();
});
