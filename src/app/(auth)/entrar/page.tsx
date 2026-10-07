import type { Metadata } from "next";
import { AuthForm } from "@/components/features/auth/auth-form";
import { authParameter } from "@/components/features/auth/auth-notices";
import { getAuthFormAvailability } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Entrar · Segundo Cérebro" };
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ notice?: string | string[]; returnTo?: string | string[] }> }) {
  const [params, available] = await Promise.all([searchParams, getAuthFormAvailability()]);
  return <AuthForm kind="sign-in" available={available} notice={authParameter(params.notice)} returnTo={authParameter(params.returnTo)} />;
}
