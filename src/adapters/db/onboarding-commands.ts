import { OnboardingPortError, type OnboardingIntentReceipt } from "../../core/onboarding/types";
import { onboardingFeature, onboardingRecord, type OnboardingPendingIntent } from "./onboarding-protocol";
import { decodeOnboardingReplacement } from "../../core/onboarding/validation";

const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const commands: Record<OnboardingIntentReceipt["kind"], string> = { profile: "settings.profile.v2.update", habit: "habit.create", project: "project.create", task: "task.create",
  notebook: "knowledge.notebook.create", page: "knowledge.page.create", link: "knowledge.link.create" };
export function parsePendingOnboardingIntent(value: unknown, roundId: string): OnboardingPendingIntent | null {
  if (value === null) return null;
  if (!onboardingRecord(value) || !uuid(value.intentId) || value.roundId !== roundId || !uuid(value.roundGeneration) || !Number.isSafeInteger(value.intentVersion) || Number(value.intentVersion)<1 || Number(value.intentVersion)>2147483647 || !uuid(value.itemKey) || typeof value.kind !== "string" ||
      !Object.hasOwn(commands, value.kind) || value.command !== commands[value.kind as OnboardingIntentReceipt["kind"]] || !onboardingFeature(String(value.command)) ||
      typeof value.slot !== "string" || value.slot !== `${value.kind}:${value.itemKey}` || !onboardingRecord(value.input) ||
      value.input.client_id !== `onb:${roundId}:${value.slot}:v${value.intentVersion}` || !Array.isArray(value.bindings) || value.bindings.length > 2 ||
      value.bindings.some(binding => !onboardingRecord(binding) || Object.keys(binding).length !== 2 ||
        !["project_id", "notebook_id", "from_id", "to_id"].includes(String(binding.field)) ||
        typeof binding.slot !== "string" || !/^(project|notebook|page):[a-f0-9-]{36}$/i.test(binding.slot)) || !onboardingRecord(value.extras) ||
      !Number.isSafeInteger(value.ordinal) || Number(value.ordinal) < 0 || Number(value.ordinal) > 20 ||
      Object.keys(value).some(key => !["intentId", "roundId", "roundGeneration", "intentVersion", "slot", "itemKey", "kind", "command", "input", "choice", "bindings", "extras", "ordinal"].includes(key))) throw new OnboardingPortError("UNAVAILABLE");
  if (Object.keys(value.extras).some(key => key !== "context") || value.extras.context !== undefined && !["personal", "work", "study"].includes(String(value.extras.context))) throw new OnboardingPortError("UNAVAILABLE");
  try { if(decodeOnboardingReplacement(value.choice).kind!==value.kind)throw new Error(); }catch{throw new OnboardingPortError("UNAVAILABLE");}
  return structuredClone(value) as unknown as OnboardingPendingIntent;
}
