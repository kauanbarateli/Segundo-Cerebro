import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { FeedbackWorkspace } from "@/components/features/feedback/feedback-workspace";
import "@/components/features/feedback/feedback.css";

export const metadata: Metadata = { title: "Feedback · Segundo Cérebro" };
export const dynamic = "force-dynamic";
export default async function FeedbackPage() {
  const user = await requireUser();
  return <FeedbackWorkspace userId={user.userId} />;
}
