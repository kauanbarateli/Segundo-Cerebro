"use client";

import Link from "next/link";
import { OnboardingAttributeSelect } from "@/components/layout/onboarding-attribute-select";
const choices = [{ value: "work", label: "Trabalho" }, { value: "study", label: "Estudos" }, { value: "personal", label: "Vida pessoal" }, { value: "mixed", label: "Um pouco de tudo" }] as const;
export function SettingsFocusSection({ userId }: { userId: string }) {
  return <>
    <OnboardingAttributeSelect key={userId} userId={userId} target={{ kind: "profile" }} title="Foco pessoal" label="Seu foco" choices={choices} savedMessage="Seu foco foi salvo." description="Uma informação opcional sobre seu momento. Ela não muda permissões, módulos ou registros." />
    <p className="settings-text"><Link className="settings-link" href="/onboarding" prefetch={false}>Preparar meu espaço</Link> · Retome a configuração inicial quando quiser.</p>
  </>;
}
