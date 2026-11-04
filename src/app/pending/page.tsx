import { redirect } from "next/navigation";
import { Clock, ShieldOff, XCircle } from "lucide-react";
import { getPendingStatus } from "@/features/identity/pending-status";
import { signOutAction } from "@/features/identity/session-actions";
import { auth } from "@/infrastructure/auth/auth";
import { Logo } from "@/shared/ui/brand/logo";

const COPY = {
  PENDING: { icon: Clock, title: "Tu cuenta está en revisión", body: "Estamos verificando tu tarjeta profesional. Te daremos acceso apenas se apruebe." },
  REJECTED: { icon: XCircle, title: "No pudimos aprobar tu cuenta", body: "Revisa el motivo y contáctanos si crees que es un error." },
  SUSPENDED: { icon: ShieldOff, title: "Tu cuenta está suspendida", body: "Tus fichas se conservan, pero el acceso está desactivado." },
  NO_ACCESS: { icon: ShieldOff, title: "Tu cuenta no tiene acceso activo", body: "Si eres paciente, pide a tu nutricionista un enlace de invitación." },
} as const;

export default async function PendingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const result = await getPendingStatus(userId);
  if ("redirectTo" in result) redirect(result.redirectTo);

  const copy = COPY[result.status];
  const Icon = copy.icon;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 sm:p-8 shadow-sm border border-border text-center">
        <Logo className="justify-center" />
        <Icon className="h-12 w-12 text-primary mx-auto mt-8" aria-hidden="true" />
        <h1 className="text-xl font-bold text-text mt-4">{copy.title}</h1>
        <p className="text-sm text-muted mt-2">{copy.body}</p>
        {result.status === "REJECTED" && result.rejectionReason && (
          <p className="text-sm text-text mt-4 rounded-xl bg-background p-3">Motivo: {result.rejectionReason}</p>
        )}
        <form action={signOutAction} className="mt-8">
          <button type="submit" className="w-full min-h-11 rounded-xl border border-border text-sm font-medium text-text hover:bg-background">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
