import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { LEGAL_SUPPORT_EMAIL } from "@/lib/legal/documents";
import { FeedbackWorkspace } from "@/components/features/feedback/feedback-workspace";
import "@/components/features/feedback/feedback.css";
import { feedbackReconciliationReady } from '@/lib/feedback/reconciliation-gate';
import { feedbackOwnerBinding } from '@/lib/feedback/owner-binding';
import { readAuthConfiguration } from '@/lib/auth/config';

export const metadata: Metadata = { title: "Feedback · Segundo Cérebro" };
export const dynamic = "force-dynamic";
export default async function FeedbackPage() {
  const user = await requireUser();
  const enabled=feedbackReconciliationReady();
  const config=enabled?readAuthConfiguration():null;
  const ownerBinding=config?.mode==='supabase'?feedbackOwnerBinding(config.stateSecret,user.userId):null;
  return <FeedbackWorkspace key={user.userId} userId={user.userId} supportEmail={LEGAL_SUPPORT_EMAIL} ownerBinding={ownerBinding} />;
}
