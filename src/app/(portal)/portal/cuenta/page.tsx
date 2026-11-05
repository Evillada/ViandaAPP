import { LogOut, Stethoscope } from "lucide-react";
import { getAccountOverviewAction } from "@/features/portal/actions";
import { AccountDetails } from "@/features/portal/components/account-details";
import { ChangePasswordForm } from "@/features/portal/components/change-password-form";
import { DeleteAccountSection } from "@/features/portal/components/delete-account-section";
import { ProfessionalCard } from "@/features/portal/components/professional-card";
import { Button } from "@/shared/ui/components";
import { signOutAction } from "@/features/identity/session-actions";

export default async function PortalAccountPage() {
  const { email, records } = await getAccountOverviewAction();
  const latest = records[0] ?? null;

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-bold text-text">Mi cuenta</h1>

      <AccountDetails email={email} record={latest} />

      <ChangePasswordForm />

      <section aria-labelledby="account-professionals-title" className="space-y-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 id="account-professionals-title" className="text-lg font-semibold text-text">Mis profesionales</h2>
        </div>
        {records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
            <Stethoscope className="h-10 w-10 text-muted mx-auto" aria-hidden="true" />
            <p className="font-medium text-text mt-3">No tienes profesionales vinculados</p>
            <p className="text-sm text-muted mt-1">Pide a tu nutricionista un enlace de invitación.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {records.map((r) => (
              <ProfessionalCard key={r.patientId} record={r} />
            ))}
          </ul>
        )}
      </section>

      <DeleteAccountSection />

      <form action={signOutAction}>
        <Button type="submit" variant="outline" className="w-full">
          <LogOut className="h-5 w-5 mr-2" aria-hidden="true" />
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
