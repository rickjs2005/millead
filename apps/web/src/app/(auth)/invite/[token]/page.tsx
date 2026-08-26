import type { Metadata } from "next";
import { AcceptInvitationForm } from "@/features/team/components/accept-invitation-form";

export const metadata: Metadata = { title: "Convite de equipe — MilLead" };

export default async function TeamInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AcceptInvitationForm token={token} />;
}
