import { expect, test } from "@playwright/test";
import { login, logout, switchArea } from "./helpers";

test("navegación móvil con etiquetas, cambio de área y cierre de sesión", async ({ page }) => {
  await login(page, "dev@gmail.com", "Dev123!");
  await switchArea(page, "Consulta"); // el login aterriza en la última área usada (puede ser Administración)
  await expect(page).toHaveURL(/\/dashboard$/);

  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const label of ["Inicio", "Pacientes", "Citas", "Herramientas", "Cuenta"]) {
    await expect(nav.getByText(label, { exact: true })).toBeVisible();
  }

  await nav.getByRole("link", { name: "Pacientes" }).click();
  await expect(page).toHaveURL(/\/dashboard\/patients$/);
  await expect(nav.getByRole("link", { name: "Pacientes" })).toHaveAttribute("aria-current", "page");

  await switchArea(page, "Administración");
  await expect(page).toHaveURL(/\/admin\/professionals$/);

  await logout(page);
});
