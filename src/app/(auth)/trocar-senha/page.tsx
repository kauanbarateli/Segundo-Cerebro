import type { Metadata } from "next";
import { AuthForm } from "@/components/features/auth/auth-form";
import { getPasswordFormContext } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Trocar senha · Segundo Cérebro" };
export default async function ChangePasswordPage() {
  const context = await getPasswordFormContext("change");
  return <AuthForm kind="change" available={context.available} requiresCurrentPassword={context.requiresCurrentPassword} completionPending={context.completionPending} />;
}
