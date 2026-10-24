import "server-only";
import { randomUUID } from "node:crypto";
import { exigir } from "../../core/contracts/base";
import { executarConhecimento } from "../../core/conhecimento";
import { OnboardingPortError, type OnboardingPort, type OnboardingSnapshot } from "../../core/onboarding/types";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { assertFeature } from "../../lib/auth/policy";
import type { AuthenticatedIdentity } from "../../lib/auth/types";
import { executeRoutineCommand, decodeRoutineRequest } from "./projects-habits-commands";
import { createRoutineStore, type RoutineGateway } from "./projects-habits-store";
import { routineGatewayForRequest } from "./projects-habits-runtime";
import { createCaptureTaskStore, type CaptureTaskGateway } from "./capture-task-store";
import { captureTaskGatewayForRequest } from "./capture-task-runtime";
import { decodeCaptureTaskRequest, executeCaptureTaskCommand } from "./capture-task-commands";
import { knowledgeGatewayForRequest } from "./knowledge-runtime";
import { createKnowledgeStore, type KnowledgeGateway } from "./knowledge-store";
import { decodeKnowledgeCommand } from "./knowledge-commands";
import { createOnboardingStore } from "./onboarding-store";
import { onboardingRpcForRequest } from "./onboarding-gateway";
import { onboardingFeature, onboardingRecord, type OnboardingRpc, type OnboardingPendingIntent } from "./onboarding-protocol";
import { readGoogleCalendarConfig } from "./google-calendar-security";

function moduleExecutor(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, rpc: OnboardingRpc) {
  const deps = { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, context = { user_id: actor.userId, canal: "web" as const };
  return async (intent: OnboardingPendingIntent) => {
    const feature = onboardingFeature(intent.command); if (!feature) throw new OnboardingPortError("FORBIDDEN"); assertFeature(actor, feature);
    const binding={roundId:intent.roundId,intentId:intent.intentId,roundGeneration:intent.roundGeneration,intentVersion:intent.intentVersion};
    if (intent.command === "settings.profile.v2.update") { await rpc("profile_update", binding, true); return; }
    if (intent.command === "habit.create" || intent.command === "project.create") {
      const request = decodeRoutineRequest({ command: intent.command, input: intent.input });
      const gateway = routineGatewayForRequest(config, actor, intent.command);
      gateway.commit = async body => {
        const result=await rpc("module_commit",{...binding,moduleCommit:body},true);
        exigir(onboardingRecord(result)&&["stale","committed","replayed"].includes(String(result.status))&&(result.status==="stale"||Object.hasOwn(result,"result")),"Resposta de rotina inválida.");
        return result as Awaited<ReturnType<RoutineGateway["commit"]>>;
      };
      await executeRoutineCommand(createRoutineStore(gateway), deps, context, request); return;
    }
    if (intent.command === "task.create") {
      const gateway=captureTaskGatewayForRequest(config,actor,"task.create");
      gateway.commit=async body=>{
        const result=await rpc("module_commit",{...binding,moduleCommit:body},true);
        exigir(onboardingRecord(result)&&["stale","committed","replayed"].includes(String(result.status))&&(result.status==="stale"||Object.hasOwn(result,"result")),"Resposta de tarefa inválida.");return result as Awaited<ReturnType<CaptureTaskGateway["commit"]>>;
      };
      await executeCaptureTaskCommand(createCaptureTaskStore(gateway), deps, context,
        decodeCaptureTaskRequest({ command: intent.command, input: intent.input })); return;
    }
    const request = decodeKnowledgeCommand({ command: intent.command, input: intent.input });
    const gateway=knowledgeGatewayForRequest(config,actor,intent.command);
    gateway.commit=async body=>{
      const result=await rpc("module_commit",{...binding,moduleCommit:body},true);
      exigir(onboardingRecord(result)&&["stale","committed","replayed"].includes(String(result.status))&&(result.status==="stale"||Object.hasOwn(result,"result")),"Resposta de conhecimento inválida.");return result as Awaited<ReturnType<KnowledgeGateway["commit"]>>;
    };
    await executarConhecimento(createKnowledgeStore(gateway), deps, context, request);
  };
}
export function onboardingForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity): OnboardingPort {
  const rpc = onboardingRpcForRequest(config, actor);
  const store = createOnboardingStore(actor.userId, rpc, moduleExecutor(config, actor, rpc));
  function calendarConfiguration(snapshot: OnboardingSnapshot): OnboardingSnapshot {
    if (snapshot.calendar.status !== "ready") return snapshot;
    try { readGoogleCalendarConfig(config); return snapshot; }
    catch { return { ...snapshot, calendar: { status: "not_configured", canConnect: false, accounts: [], sources: [] } }; }
  }
  return {
    load: async () => calendarConfiguration(await store.load()), choices: input => store.choices(input),
    start: async input => calendarConfiguration(await store.start(input)), save: async input => calendarConfiguration(await store.save(input)),
    pause: async input => calendarConfiguration(await store.pause(input)), confirm: async input => calendarConfiguration(await store.confirm(input)),
    advance: async input => calendarConfiguration(await store.advance(input)),
    amend: async input => calendarConfiguration(await store.amend(input)),
  };
}
