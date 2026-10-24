import { assinatura, ErroDeDominio } from "../../core/contracts/base";
import { planOnboardingIntents, planOnboardingReplacement } from "../../core/onboarding/server-planning";
import { decodeOnboardingChoices, decodeOnboardingDraft, decodeOnboardingSnapshot } from "../../core/onboarding/validation";
import { OnboardingPortError, type OnboardingPort } from "../../core/onboarding/types";
import { onboardingRecord, type OnboardingPendingIntent, type OnboardingRpc } from "./onboarding-protocol";
import { parsePendingOnboardingIntent } from "./onboarding-commands";

export type OnboardingExecutor = (intent: OnboardingPendingIntent) => Promise<void>;
/** One bounded module effect per advance; no worker/TTL, new ID or background retry. */
export function createOnboardingStore(ownerId: string, rpc: OnboardingRpc, execute: OnboardingExecutor): OnboardingPort {
  const snapshot = async () => {
    const value=await rpc("snapshot",{},false);
    try{return decodeOnboardingSnapshot(value,ownerId);}catch{throw new OnboardingPortError("UNAVAILABLE");}
  };
  async function afterWrite() {
    try{return await snapshot();}catch(error){
      if(error instanceof OnboardingPortError && ["FORBIDDEN","CONFLICT"].includes(error.code))throw error;
      throw new OnboardingPortError("COMMIT_UNKNOWN");
    }
  }
  async function mutate(operation: "start" | "save" | "pause", input: object) {
    await rpc(operation, { ...input }, true); return afterWrite();
  }
  return {
    load: snapshot,
    start: input => mutate("start", input),
    save: input => mutate("save", { ...input, draft: decodeOnboardingDraft(input.draft) }),
    pause: input => mutate("pause", input),
    async confirm(input) {
      const context = await rpc("prepare_context", { ...input }, false);
      if(onboardingRecord(context) && context.roundId===input.roundId && context.prepared===true)return afterWrite();
      if (!onboardingRecord(context) || context.roundId !== input.roundId || typeof context.revision !== "string" || typeof context.profileRevision !== "string") throw new OnboardingPortError("UNAVAILABLE");
      // SQL checks expectedRevision before it uses this plan. The caller never supplies commands.
      let draft;try{draft=decodeOnboardingDraft(context.draft);}catch{throw new OnboardingPortError("UNAVAILABLE");}
      const plan = planOnboardingIntents(input.roundId, draft, context.profileRevision);
      await rpc("prepare", { ...input, plan }, true); return afterWrite();
    },
    async advance(input) {
      const intent = parsePendingOnboardingIntent(await rpc("peek_intent", { ...input }, true), input.roundId);
      if (intent) {
        // SQL first checks that the canonical string decodes to the exact frozen
        // body. Knowledge uses SHA-256, the other modules use this string itself.
        await rpc("bind_intent", { roundId: input.roundId, intentId: intent.intentId, roundGeneration:intent.roundGeneration, intentVersion:intent.intentVersion, canonicalInput: assinatura(intent.input) }, true);
        let outcome: "failed" | "unknown" | "reconcile" = "reconcile", reason: "validation" | "forbidden" | "conflict" | "commit_unknown" | null = null;
        try { await execute(intent); }
        catch (error) {
          outcome = error instanceof ErroDeDominio && ["VALIDATION", "NOT_FOUND", "CONFLICT"].includes(error.code) ? "failed" : "unknown";
          reason = error instanceof ErroDeDominio ? error.code === "CONFLICT" ? "conflict" : "validation" : "commit_unknown";
        }
        // No result/id/success boolean from JS can mark an effect confirmed.
        // SQL independently reads its real module receipt and frozen body.
        await rpc("record", { roundId: input.roundId, intentId: intent.intentId, intentVersion:intent.intentVersion, roundGeneration:intent.roundGeneration, outcome, reason }, true);
      }
      await rpc("complete", { ...input }, true); return afterWrite();
    },
    async amend(input) {
      const context=await rpc("amend_context",{...input},false);
      if(onboardingRecord(context)&&context.roundId===input.roundId&&context.prepared===true)return afterWrite();
      if(!onboardingRecord(context)||context.roundId!==input.roundId||typeof context.itemKey!=="string"||!Number.isSafeInteger(context.nextVersion)||Number(context.nextVersion)<2)throw new OnboardingPortError("UNAVAILABLE");
      const plan=input.change.kind==="replace"?planOnboardingReplacement(input.roundId,context.itemKey,input.change.value,Number(context.nextVersion)):null;
      // Same command/body is the only replay. An inconclusive write never emits
      // a new module client ID; SQL revokes/reconciles the old version first.
      await rpc("amend",{...input,plan},true);return afterWrite();
    },
    async choices(input) {
      const value = await rpc("choices", { ...input }, false);
      try{return decodeOnboardingChoices(value,input.kind);}catch{throw new OnboardingPortError("UNAVAILABLE");}
    },
  };
}
