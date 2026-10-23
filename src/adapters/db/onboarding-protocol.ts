import type { OnboardingIntentPlan } from "../../core/onboarding/server-planning";
import type { OnboardingDraft } from "../../core/onboarding/types";

/** Draft RPC contracts; no overlay or replacement of the official Database type. */
export type OnboardingRpcOperation = "snapshot" | "start" | "save" | "pause" | "prepare_context" | "prepare" | "peek_intent" | "bind_intent" | "record" | "complete" | "choices" | "profile_read" | "profile_update" | "module_commit" | "amend_context" | "amend" | "attributes_read" | "attributes_update" | "oauth_bind" | "oauth_classify" | "oauth_take" | "oauth_connect";
export type OnboardingRpc = (operation: OnboardingRpcOperation, request: Record<string, unknown>, write: boolean) => Promise<unknown>;
export interface OnboardingPrepareContext { roundId: string; revision: string; draft: OnboardingDraft; profileRevision: string }
export interface OnboardingPendingIntent extends OnboardingIntentPlan { intentId: string; roundId: string; roundGeneration:string; intentVersion:number; input: Record<string, unknown> }
export const onboardingRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function onboardingFeature(command: string) {
  if (command.startsWith("settings.")) return "configuracoes" as const;
  if (command.startsWith("habit.")) return "habitos" as const;
  if (command.startsWith("project.")) return "projetos" as const;
  if (command.startsWith("task.")) return "tarefas" as const;
  if (command.startsWith("knowledge.")) return "conhecimento" as const;
  return null;
}
