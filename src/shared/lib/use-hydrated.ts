import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/**
 * false en el servidor y durante la hidratación; true cuando React ya controla la página.
 * Los formularios con onSubmit deben deshabilitar el envío hasta entonces: antes de hidratar
 * el navegador haría un GET nativo con los campos (contraseña incluida) en la URL.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}
