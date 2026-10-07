import type { Metadata } from "next";
import { AuthForm } from "@/components/features/auth/auth-form";
import { getPasswordFormContext } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Definir nova senha · Segundo Cérebro" };
export default async function ResetPasswordPage() {
  const context = await getPasswordFormContext("recovery");
  return <AuthForm kind="reset" available={context.available} completionPending={context.completionPending} />;
}
