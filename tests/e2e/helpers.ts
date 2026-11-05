import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  const submit = page.getByRole("button", { name: "Iniciar sesión" });
  await expect(submit).toBeEnabled(); // habilitado sólo tras hidratar React
  await submit.click();
  // Esperar a que termine el login (signIn + /start + redirección); en `next dev` la primera compilación es lenta.
  await page.waitForURL((url) => !["/login", "/start"].includes(url.pathname), { timeout: 60_000 });
}

export async function loginAsDev(page: Page) {
  const password = process.env.SEED_DEV_PASSWORD;
  if (!password) throw new Error("SEED_DEV_PASSWORD no está definida: la fija tests/e2e/global-setup.ts");
  await login(page, "dev@gmail.com", password);
}

export async function openAccount(page: Page) {
  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name: "Cuenta" }).click();
  return page.getByRole("dialog", { name: "Cuenta" });
}

/**
 * Cambia de área desde la hoja "Cuenta". Idempotente: el área activa queda deshabilitada y el login
 * aterriza en `lastArea` (persistido en BD entre specs), así que si ya está activa sólo cierra la hoja.
 */
export async function switchArea(page: Page, areaLabel: string) {
  const account = await openAccount(page);
  const target = account.getByRole("button", { name: areaLabel });
  if (await target.isDisabled()) {
    await account.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(account).toBeHidden();
    return;
  }
  await target.click();
}

export async function logout(page: Page) {
  const account = await openAccount(page);
  await account.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
}
