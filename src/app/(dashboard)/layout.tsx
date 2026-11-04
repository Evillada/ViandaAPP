import { redirect } from "next/navigation";
import { AREA_LABELS, PROFESSIONAL_NAV, areaLinks } from "@/features/identity/navigation";
import { signOutAction, switchAreaAction } from "@/features/identity/session-actions";
import { getActorFor } from "@/infrastructure/access/access-context";
import { auth } from "@/infrastructure/auth/auth";
import { AppShell } from "@/shared/ui/navigation/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) redirect("/start");

  return (
    <AppShell
      areaLabel={AREA_LABELS.PROFESSIONAL}
      items={PROFESSIONAL_NAV}
      areas={areaLinks(actor, "PROFESSIONAL")}
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
      switchAreaAction={switchAreaAction}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
