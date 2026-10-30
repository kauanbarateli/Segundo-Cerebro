import { describe, expect, it } from "vitest";
import { decodeOnboardingDraft } from "../../src/core/onboarding/validation";
import { planOnboardingIntents, planOnboardingReplacement } from "../../src/core/onboarding/server-planning";
import { textoDoDocumento, validarDocumento } from "../../src/core/conhecimento/document";
const round = "27000000-0000-4000-8000-000000000001";
const project = "27000000-0000-4000-8000-000000000002", task = "27000000-0000-4000-8000-000000000003";
const habit = "27000000-0000-4000-8000-000000000004", notebook = "27000000-0000-4000-8000-000000000005", page = "27000000-0000-4000-8000-000000000006";
const empty = () => ({ profile: {}, habits: [], projects: [], tasks: [], notes: null });
describe("onboarding server composition into existing module commands", () => {
 it("skip everything creates no example, profile update or external effect", () => expect(planOnboardingIntents(round, decodeOnboardingDraft(empty()), "baseline")).toEqual([]));
 it("can preserve a partial draft but refuses to compose any domain effects from it",()=>{
  const partial=decodeOnboardingDraft({...empty(),projects:[{key:project,name:""}],notes:{notebook:{kind:"new",key:notebook,name:""},page:{key:page,title:"",text:"Anotação primeiro"}}});
  expect(partial.notes?.page?.text).toBe("Anotação primeiro");expect(()=>planOnboardingIntents(round,partial,"baseline")).toThrow();
 });
 it("normalizes command names only after confirmation and preserves the saved draft and note text",()=>{
  const draft=decodeOnboardingDraft({...empty(),profile:{displayName:"  Kauan  "},projects:[{key:project,name:"  Pessoal  "}],notes:{notebook:{kind:"new",key:notebook,name:"  Notas  "},page:{key:page,title:"  Ideia  ",text:"  conteúdo  "}}});
  const plan=planOnboardingIntents(round,draft,"baseline");expect(draft.profile.displayName).toBe("  Kauan  ");expect(draft.notes?.page?.title).toBe("  Ideia  ");
  expect(plan[0]?.input.patch).toEqual({displayName:"Kauan"});expect(plan[1]?.input.name).toBe("Pessoal");expect(plan[2]?.input.name).toBe("Notas");expect(plan[3]?.input.title).toBe("Ideia");
  const document=plan[3]?.input.document;validarDocumento(document);expect(textoDoDocumento(document)).toBe("  conteúdo  ");
 });
 it("omitted profile fields remain omitted; context stays outside the closed project v1 DTO", () => {
  const plan = planOnboardingIntents(round, decodeOnboardingDraft({ ...empty(), profile: { focus: "work" }, projects: [{ key: project, name: "Mesmo nome", context: "study" }] }), "baseline");
  expect(plan[0]?.input).toMatchObject({ patch: { focus: "work" }, expectedRevision: "baseline" });
  expect(plan[0]?.input.patch).not.toHaveProperty("displayName");
  expect(plan[1]?.input).not.toHaveProperty("context");expect(plan[1]?.extras).toEqual({ context: "study" });
 });
 it("three times per week uses a weekly target without inventing weekdays or a start date", () => {
  const plan = planOnboardingIntents(round, decodeOnboardingDraft({ ...empty(), habits: [{ key: habit, name: "Ler", cadence: "three_per_week", startedOn: "2026-10-24" }] }), "baseline");
  expect(plan[0]?.input).toMatchObject({ schedule_kind: "weekly_target", weekly_target: 3, weekdays: [], started_on: "2026-10-24" });
 });
 it("an all-day due date maps civil São Paulo midnight, independently of server timezone", () => {
  const plan = planOnboardingIntents(round, decodeOnboardingDraft({ ...empty(), tasks: [{ key: task, title: "Uma tarefa", due: { kind: "day", day: "2026-10-24" } }] }), "baseline");
  expect(plan[0]?.input).toMatchObject({ due_at: "2026-10-24T03:00:00.000Z", all_day: true, scheduled_start_at: null });
 });
 it("explicit existing project identity is preserved even when a prepared project has the same name", () => {
  const plan = planOnboardingIntents(round, decodeOnboardingDraft({ ...empty(), projects: [{ key: project, name: "Pessoal" }], tasks: [{ key: task, title: "Fazer", project: { kind: "existing", id: notebook }, due: { kind: "none" } }] }), "baseline");
  expect(plan[1]?.input.project_id).toBe(notebook);expect(plan[1]?.bindings).toEqual([]);
 });
 it("binds draft identities through receipts and creates a separate explicit page/project link", () => {
  const draft = decodeOnboardingDraft({ ...empty(), projects: [{ key: project, name: "Pessoal" }], tasks: [{ key: task, title: "Fazer", project: { kind: "draft", key: project }, due: { kind: "none" } }],
   notes: { notebook: { kind: "new", key: notebook, name: "Notas" }, page: { key: page, title: "Ideias", text: "Uma nota.", project: { kind: "draft", key: project } } } });
  const plan = planOnboardingIntents(round, draft, "baseline");
  expect(plan.map(value => value.kind)).toEqual(["project", "task", "notebook", "page", "link"]);
  expect(plan[1]?.bindings).toEqual([{ field: "project_id", slot: `project:${project}` }]);
  expect(plan[3]?.bindings).toEqual([{ field: "notebook_id", slot: `notebook:${notebook}` }]);
  expect(plan[3]?.input).not.toHaveProperty("project_id");
  const document=plan[3]?.input.document;validarDocumento(document);expect(textoDoDocumento(document)).toBe("Uma nota.");
  expect(plan[4]?.bindings).toEqual([{ field: "from_id", slot: `page:${page}` }, { field: "to_id", slot: `project:${project}` }]);
  expect(planOnboardingIntents(round, draft, "baseline")).toEqual(plan);
  expect(new Set(plan.map(value => value.input.client_id)).size).toBe(plan.length);
 });
 it("does not create a notebook just to reference an existing notebook", () => {
  const plan = planOnboardingIntents(round, decodeOnboardingDraft({ ...empty(), notes: { notebook: { kind: "existing", id: notebook }, page: { key: page, title: "Ideia", text: "" } } }), "baseline");
  expect(plan.map(value => value.kind)).toEqual(["page"]);expect(plan[0]?.input.notebook_id).toBe(notebook);
 });
 it("page correction chooses an existing notebook without renaming or recreating a confirmed notebook or link",()=>{
  const replacement=planOnboardingReplacement(round,page,{kind:"page",title:" Corrigido ",text:"preservar",notebook:{kind:"existing",id:notebook}},2);
  expect(replacement.command).toBe("knowledge.page.create");expect(replacement.input.notebook_id).toBe(notebook);expect(replacement.input.title).toBe("Corrigido");
  expect(replacement.input).not.toHaveProperty("project_id");expect(replacement.bindings).toEqual([]);expect(replacement.input.client_id).toBe(`onb:${round}:page:${page}:v2`);
 });
 it("a replacement keeps the profile baseline explicitly selected by the human",()=>{
  const replacement=planOnboardingReplacement(round,round,{kind:"profile",patch:{focus:"study"},expectedProfileRevision:"original-baseline"},2);
  expect(replacement.input.expectedRevision).toBe("original-baseline");expect(replacement.choice).toMatchObject({expectedProfileRevision:"original-baseline"});
 });
 it("a corrected task binds only an explicitly selected prepared project and preserves its civil due date",()=>{
  const replacement=planOnboardingReplacement(round,task,{kind:"task",title:"Fazer",project:{kind:"draft",key:project},due:{kind:"day",day:"2026-10-24"}},3);
  expect(replacement.bindings).toEqual([{field:"project_id",slot:`project:${project}`}]);expect(replacement.input.project_id).toBeNull();expect(replacement.input.due_at).toBe("2026-10-24T03:00:00.000Z");
 });
 it.each([0,1,2.5,2147483648])("cannot invent an unversioned or overflowing replacement %s",version=>expect(()=>planOnboardingReplacement(round,project,{kind:"project",name:"Válido",context:null},version)).toThrow());
 it("refuses an incomplete replacement before any coordinator could submit it",()=>expect(()=>planOnboardingReplacement(round,task,{kind:"task",title:" ",project:null,due:{kind:"none"}},2)).toThrow());
});
