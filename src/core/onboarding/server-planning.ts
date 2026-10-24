import { exigir } from "../contracts/base";
import { documentoDeTexto } from "../conhecimento/document";
import { instanteDe } from "../tempo";
import type { OnboardingDraft, OnboardingIntentReceipt, OnboardingProjectRef, OnboardingReplacement } from "./types";
import { decodeOnboardingReplacement, validateOnboardingCompletion } from "./validation";

export interface OnboardingIntentPlan {
  slot: string; itemKey: string; kind: OnboardingIntentReceipt["kind"]; command: string;
  input: Record<string, unknown>; bindings: { field: string; slot: string }[];
  extras: { context?: string }; ordinal: number; choice: OnboardingReplacement;
}
const uuid = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

/** Called on the server from a saved/validated draft, never from a caller's command list. */
export function planOnboardingIntents(roundId: string, draft: OnboardingDraft, profileRevision: string): OnboardingIntentPlan[] {
  exigir(uuid(roundId) && typeof profileRevision === "string" && profileRevision.length >= 1 && profileRevision.length <= 256, "Rodada inválida.");
  // A saved draft may be structurally valid yet incomplete. Never freeze a
  // partial choice or run any module command until all selected items qualify.
  validateOnboardingCompletion(draft);
  const intents: OnboardingIntentPlan[] = [];
  function add(kind: OnboardingIntentReceipt["kind"], itemKey: string, command: string, fields: Record<string, unknown>, choice: OnboardingReplacement, bindings: OnboardingIntentPlan["bindings"] = [], extras: OnboardingIntentPlan["extras"] = {}) {
    exigir(uuid(itemKey), "Escolha inválida.");
    const slot = `${kind}:${itemKey}`, clientId = `onb:${roundId}:${slot}:v1`;
    exigir(!intents.some(item => item.slot === slot), "Escolha repetida.");
    intents.push({ slot, kind, itemKey, command, input: { ...fields, client_id: clientId }, choice: structuredClone(choice), bindings, extras, ordinal: intents.length });
  }
  function project(ref: OnboardingProjectRef | undefined, field: string) {
    if (!ref) return { id: null, bindings: [] as OnboardingIntentPlan["bindings"] };
    if (ref.kind === "existing") return { id: ref.id, bindings: [] as OnboardingIntentPlan["bindings"] };
    exigir(draft.projects.some(item => item.key === ref.key), "O projeto preparado não está disponível.");
    return { id: null, bindings: [{ field, slot: `project:${ref.key}` }] };
  }
  if (Object.keys(draft.profile).length) add("profile", roundId, "settings.profile.v2.update", { expectedRevision: profileRevision,
    patch: { ...draft.profile, ...(draft.profile.displayName !== undefined ? { displayName: draft.profile.displayName.trim() } : {}) } }, {kind:"profile",patch:{...draft.profile},expectedProfileRevision:profileRevision});
  for (const item of draft.habits) add("habit", item.key, "habit.create", { name: item.name.trim(), schedule_kind: item.cadence === "daily" ? "daily" : "weekly_target",
    weekdays: [], weekly_target: item.cadence === "daily" ? null : 3, started_on: item.startedOn, color_key: "personal", icon_key: null, position: 0 }, {kind:"habit",name:item.name,cadence:item.cadence,startedOn:item.startedOn});
  for (const item of draft.projects) add("project", item.key, "project.create", { name: item.name.trim(), description: null, color_key: "work", position: 0 }, {kind:"project",name:item.name,context:item.context??null}, [], item.context ? { context: item.context } : {});
  for (const item of draft.tasks) {
    const ref = project(item.project, "project_id");
    const due = item.due.kind === "day" ? instanteDe(item.due.day) : null;
    exigir(item.due.kind === "none" || due !== null, "O prazo preparado não é válido.");
    add("task", item.key, "task.create", { title: item.title.trim(), description: null, category_id: null, project_id: ref.id, status: "todo", priority: "medium",
      due_at: due, scheduled_start_at: null, scheduled_end_at: null, all_day: item.due.kind === "day", estimated_minutes: null, board_position: null }, {kind:"task",title:item.title,project:item.project??null,due:item.due}, ref.bindings);
  }
  if (draft.notes) {
    const notebook = draft.notes.notebook;
    if (notebook.kind === "new") add("notebook", notebook.key, "knowledge.notebook.create", { name: notebook.name.trim(), project_id: null }, {kind:"notebook",name:notebook.name});
    const page = draft.notes.page;
    if (page) {
      add("page", page.key, "knowledge.page.create", { notebook_id: notebook.kind === "existing" ? notebook.id : null, title: page.title.trim(), parent_id: null,
        document: documentoDeTexto(page.text) }, {kind:"page",title:page.title,text:page.text,notebook:notebook.kind==="new"?{kind:"prepared",key:notebook.key}:{kind:"existing",id:notebook.id}}, notebook.kind === "new" ? [{ field: "notebook_id", slot: `notebook:${notebook.key}` }] : []);
      if (page.project) {
        const ref = project(page.project, "to_id");
        add("link", page.key, "knowledge.link.create", { from_type: "page", from_id: null, to_type: "project", to_id: ref.id },
          {kind:"link",project:page.project}, [{ field: "from_id", slot: `page:${page.key}` }, ...ref.bindings]);
      }
    }
  }
  return intents;
}

/** Replaces one already existing slot; the coordinator validates all referenced
 * slots/ownership under its lock. This function never invents another slot. */
export function planOnboardingReplacement(roundId:string,itemKey:string,choice:OnboardingReplacement,version:number):OnboardingIntentPlan {
  exigir(uuid(roundId)&&uuid(itemKey)&&Number.isSafeInteger(version)&&version>=2&&version<=2147483647,"Versão inválida.");
  choice=decodeOnboardingReplacement(choice);
  const draft:OnboardingDraft={profile:{},habits:[],projects:[],tasks:[],notes:null};
  const project=(ref:OnboardingProjectRef|null)=>ref?.kind==="draft"?{kind:"existing" as const,id:ref.key}:ref??undefined;
  const first=(plans:OnboardingIntentPlan[])=>{const selected=plans[0];exigir(selected,"Escolha não produz intenção.");return selected;};
  let result:OnboardingIntentPlan;
  if(choice.kind==="profile") {draft.profile=choice.patch;result=first(planOnboardingIntents(roundId,draft,choice.expectedProfileRevision));}
  else if(choice.kind==="habit") {draft.habits=[{key:itemKey,name:choice.name,cadence:choice.cadence,startedOn:choice.startedOn}];result=first(planOnboardingIntents(roundId,draft,"unused"));}
  else if(choice.kind==="project") {draft.projects=[{key:itemKey,name:choice.name,...(choice.context?{context:choice.context}:{})}];result=first(planOnboardingIntents(roundId,draft,"unused"));}
  else if(choice.kind==="task") {draft.tasks=[{key:itemKey,title:choice.title,project:project(choice.project),due:choice.due}];result=first(planOnboardingIntents(roundId,draft,"unused"));}
  else if(choice.kind==="notebook") {draft.notes={notebook:{kind:"new",key:itemKey,name:choice.name}};result=first(planOnboardingIntents(roundId,draft,"unused"));}
  else if(choice.kind==="page") {draft.notes={notebook:{kind:"existing",id:choice.notebook.kind==="existing"?choice.notebook.id:choice.notebook.key},page:{key:itemKey,title:choice.title,text:choice.text}};result=first(planOnboardingIntents(roundId,draft,"unused"));}
  else {result={slot:`link:${itemKey}`,itemKey,kind:"link",command:"knowledge.link.create",input:{from_type:"page",from_id:null,to_type:"project",to_id:choice.project.kind==="existing"?choice.project.id:null},bindings:[{field:"from_id",slot:`page:${itemKey}`}],extras:{},ordinal:0,choice};}
  // Restore semantic dependencies after validating the standalone choice.
  result.choice=structuredClone(choice);result.input.client_id=`onb:${roundId}:${result.slot}:v${version}`;
  if((choice.kind==="task"||choice.kind==="link")&&choice.project?.kind==="draft") {
    const field=choice.kind==="task"?"project_id":"to_id";result.input[field]=null;result.bindings.push({field,slot:`project:${choice.project.key}`});
  }
  if(choice.kind==="page"&&choice.notebook.kind==="prepared") {result.input.notebook_id=null;result.bindings.push({field:"notebook_id",slot:`notebook:${choice.notebook.key}`});}
  exigir(result.kind===choice.kind&&result.itemKey===itemKey,"Escolha incompatível.");return result;
}
