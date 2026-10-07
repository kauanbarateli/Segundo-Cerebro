import type { Metadata } from "next";
import { AuthForm } from "@/components/features/auth/auth-form";
import { authParameter } from "@/components/features/auth/auth-notices";
import { getAuthFormAvailability } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Recuperar senha · Segundo Cérebro" };
export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  const [params, available] = await Promise.all([searchParams, getAuthFormAvailability()]);
  return <AuthForm kind="recovery" available={available} notice={authParameter(params.notice)} />;
}
