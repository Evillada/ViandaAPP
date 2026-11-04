import type { Metadata } from "next";
import { LinkIcon } from "lucide-react";
import { getCurrentConsentDocument } from "@/features/consent/consent-documents";
import { ConsentStep } from "@/features/invitations/components/consent-step";
import { InviteSignUp } from "@/features/invitations/components/invite-sign-up";
import { INVALID_INVITATION_MESSAGE, getInvitationPreview } from "@/features/invitations/invitation-preview";
import { auth } from "@/infrastructure/auth/auth";
import { Logo } from "@/shared/ui/brand/logo";

// The URL carries a secret token: never send it as Referer and keep it out of search indexes.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const now = new Date();
  const [preview, session, document] = await Promise.all([getInvitationPreview(token, now), auth(), getCurrentConsentDocument(now)]);

  return (
    <main className="flex min-h-dvh items-start sm:items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 sm:p-8 shadow-sm border border-border">
        <Logo />
        <div className="mt-6">
          {preview.state !== "VALID" ? (
            <div className="text-center space-y-3 py-6">
              <LinkIcon className="h-10 w-10 text-muted mx-auto" aria-hidden="true" />
              <p className="text-text font-medium">{INVALID_INVITATION_MESSAGE}</p>
            </div>
          ) : !session?.user?.id ? (
            <>
              <p className="text-sm text-muted mb-4">{preview.professionalName} te invitó a Vianda.</p>
              <InviteSignUp token={token} defaultName={preview.patientFirstName} />
            </>
          ) : document ? (
            <ConsentStep
              token={token}
              professionalName={preview.professionalName}
              documentVersion={document.version}
              documentBody={document.body}
            />
          ) : (
            <p className="text-sm text-danger">No hay un documento de consentimiento vigente. Contacta a soporte.</p>
          )}
        </div>
      </div>
    </main>
  );
}
