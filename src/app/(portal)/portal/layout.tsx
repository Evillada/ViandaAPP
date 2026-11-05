import { redirect } from "next/navigation";
import { AREA_LABELS, PATIENT_NAV, areaLinks } from "@/features/identity/navigation";
import { signOutAction, switchAreaAction } from "@/features/identity/session-actions";
import { getActorFor } from "@/infrastructure/access/access-context";
import { auth } from "@/infrastructure/auth/auth";
import { AppShell } from "@/shared/ui/navigation/app-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = await getActorFor("PATIENT");
  if (!actor) redirect("/start");

  return (
    <AppShell
      areaLabel={AREA_LABELS.PATIENT}
      items={PATIENT_NAV}
      areas={areaLinks(actor, "PATIENT")}
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
      switchAreaAction={switchAreaAction}
      signOutAction={signOutAction}
      accountLinks={[{ href: "/portal/cuenta", label: "Mi cuenta y profesionales" }]}
    >
      {children}
    </AppShell>
  );
}
