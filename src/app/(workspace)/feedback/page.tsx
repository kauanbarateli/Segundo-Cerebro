import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { LEGAL_SUPPORT_EMAIL } from "@/lib/legal/documents";
import { FeedbackWorkspace } from "@/components/features/feedback/feedback-workspace";
import "@/components/features/feedback/feedback.css";

export const metadata: Metadata = { title: "Feedback · Segundo Cérebro" };
export const dynamic = "force-dynamic";
export default async function FeedbackPage() {
  const user = await requireUser();
  return <FeedbackWorkspace key={user.userId} userId={user.userId} supportEmail={LEGAL_SUPPORT_EMAIL} />;
}
