"use client";

import { OnboardingAttributeSelect } from "@/components/layout/onboarding-attribute-select";
const choices = [{ value: "personal", label: "Pessoal" }, { value: "work", label: "Trabalho" }, { value: "study", label: "Estudos" }] as const;
export function ProjectContextSection({ userId, projectId }: { userId: string; projectId: string }) {
  return <section className="project-context-section">
    <OnboardingAttributeSelect key={userId + ":" + projectId} userId={userId} target={{ kind: "project", projectId }} title="Contexto do projeto" label="Contexto" choices={choices} savedMessage="O contexto do projeto foi salvo." description="Classifique este projeto, se quiser. Essa escolha não altera tarefas, categorias ou vínculos." />
  </section>;
}
