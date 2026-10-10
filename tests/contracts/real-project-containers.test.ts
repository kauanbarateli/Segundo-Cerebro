/** Actual Project Core/Store/Gateway and canonical disposable PostgreSQL.
 * Auth catalogue/RPC transport are fixtures. The task is declared metadata
 * seed; its creation is not attributed to a Core command or a domain event.
 * No browser, native Supabase, hosted write or multi-connection claim. */
import { describe, expect, it } from "vitest";
import { createHabitSqlFixture, habitForeign, habitForeignSession, habitOwner, loadHabitProduct, type HabitSqlFixture } from "../e2e/helpers/issue30-habits-sql";
import type { ProjectContainer } from "../../src/core/projetos";
import type { Projeto } from "../../src/core/contracts/modules";
import type { Tarefa } from "../../src/core/tarefas";

const sources = ["captures", "tasks", "knowledge_notebooks", "drive_folders"] as const;
const ledgerQueries = {
  users: "select to_jsonb(t) as row from auth.users t order by id",
  sessions: "select to_jsonb(t) as row from auth.sessions t order by id",
  projects: "select to_jsonb(t) as row from public.projects t order by id",
  captures: "select to_jsonb(t) as row from public.captures t order by id",
  tasks: "select to_jsonb(t) as row from public.tasks t order by id",
  notebooks: "select to_jsonb(t) as row from public.knowledge_notebooks t order by id",
  folders: "select to_jsonb(t) as row from public.drive_folders t order by id",
  pages: "select to_jsonb(t) as row from public.knowledge_pages t order by id",
  refs: "select to_jsonb(t) as row from public.page_refs t order by id",
  links: "select to_jsonb(t) as row from public.links t order by id",
  events: "select to_jsonb(t) as row from public.domain_events t order by id",
  receipts: "select to_jsonb(t) as row from app_private.command_receipts t order by user_id,command,client_id",
  captureRevisions: "select to_jsonb(t) as row from app_private.capture_task_revisions t order by user_id",
  routineRevisions: "select to_jsonb(t) as row from app_private.projects_habits_revisions t order by user_id",
  limits: "select to_jsonb(t) as row from app_private.rate_limits t order by scope,subject_hash",
};
type Row = Record<string, unknown>;
async function ledger(f: HabitSqlFixture) {
  const result = {} as Record<keyof typeof ledgerQueries, Row[]>;
  for (const [name, sql] of Object.entries(ledgerQueries)) result[name as keyof typeof ledgerQueries] = (await f.db.query<{ row: Row }>(sql)).rows.map(v => v.row);
  return result;
}
async function fixture() {
  const f = await createHabitSqlFixture(await loadHabitProduct());
  try {
    const create = (name: string, client_id: string, foreign = false) => f.command({ command: "project.create", input: { name, description: null, color_key: "neutral", position: 0, client_id } }, ...(foreign ? [habitForeign, habitForeignSession] as const : [])) as Promise<Projeto>;
    const project = await create("Projeto com fontes físicas", "project-sources");
    const foreign = await create("FOREIGN_PROJECT_SENTINEL", "foreign-project", true);
    const dead = await create("Projeto na lixeira", "dead-project");
    await f.command({ command: "project.delete", input: { id: dead.id, client_id: "delete-dead" } });
    const containers: ProjectContainer[] = [];
    for (const kind of ["capture", "notebook", "folder"] as const) containers.push(await f.command({ command: "project.container.create", input: { kind, name: "Fonte " + kind, project_id: project.id, client_id: "source-" + kind } }) as ProjectContainer);
    const folder = containers.find(v => v.kind === "folder")!;
    containers.push(await f.command({ command: "project.container.create", input: { kind: "folder", name: "Pasta filha preservada", project_id: project.id, parent_id: folder.id, client_id: "source-child" } }) as ProjectContainer);
    const task: Tarefa = { id: "50000000-0000-4000-8000-000000000900", user_id: habitOwner, client_id: "metadata-task", title: "Tarefa física preservada", description: null,
      category_id: null, project_id: project.id, status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null,
      all_day: false, estimated_minutes: null, board_position: null, source: "manual", origin_capture_id: null, completed_at: null, archived_at: null,
      deleted_at: null, created_at: f.now, updated_at: f.now };
    await f.db.query("insert into public.tasks(payload) values($1::jsonb)", [JSON.stringify(task)]);
    const ids = { captures: containers.find(v => v.kind === "capture")!.id, tasks: task.id, knowledge_notebooks: containers.find(v => v.kind === "notebook")!.id, drive_folders: folder.id };
    for (const table of sources) {
      const rows = (await f.db.query<{ payload: { id: string; user_id: string; project_id: string; deleted_at: null } }>(`select payload from public.${table} where id=$1`, [ids[table]])).rows;
      expect(rows).toHaveLength(1); expect(rows[0]!.payload).toMatchObject({ id: ids[table], user_id: habitOwner, project_id: project.id, deleted_at: null });
    }
    return { f, project, foreign, dead, containers, ids };
  } catch (error) { await f.db.close(); throw error; }
}

describe("Projeto — fontes físicas e guardas canônicos", () => {
  it("os quatro triggers ativos vinculam apenas projetos vivos do mesmo dono e recusas não alteram o ledger", async () => {
    const { f, project, foreign, dead, ids } = await fixture();
    try {
      const triggers = (await f.db.query<{ table_name: string; enabled: string; function_name: string; function_schema: string; definer: boolean; definition: string }>(
        "select c.relname as table_name,t.tgenabled::text as enabled,p.proname as function_name,n.nspname as function_schema,p.prosecdef as definer,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace where t.tgname='zz_project_live_owner' and not t.tgisinternal order by c.relname")).rows;
      expect(triggers.map(v => v.table_name)).toEqual([...sources].sort());
      for (const trigger of triggers) {
        expect(trigger).toMatchObject({ enabled: "O", function_name: "project_live_owner", function_schema: "app_private", definer: true });
        expect(trigger.definition).toMatch(/BEFORE INSERT OR UPDATE/);
      }
      const baseline = await ledger(f);
      for (const table of sources) for (const target of [foreign.id, dead.id]) {
        // Only a closed, constant table list is interpolated; values are bound.
        await expect(f.db.query(`update public.${table} set payload=jsonb_set(payload,'{project_id}',to_jsonb($1::text)) where id=$2 and user_id=$3`, [target, ids[table], habitOwner])).rejects.toMatchObject({ code: "23514" });
        expect(await ledger(f)).toEqual(baseline);
      }
      for (const target of [foreign.id, dead.id]) {
        await expect(f.command({ command: "project.container.create", input: { kind: "capture", name: "Recusada pelo Core", project_id: target, client_id: "refused-" + target } })).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(await ledger(f)).toEqual(baseline);
      }
      expect((await f.gateway("read.projects").snapshot()).projects.find(v => v.id === project.id)).toEqual(project);
      expect((await f.gateway("read.projects").snapshot()).projects.some(v => v.id === foreign.id)).toBe(false);
      expect(await ledger(f)).toEqual(baseline);
    } finally { await f.db.close(); }
  });

  it("excluir e restaurar o projeto conserva payloads, IDs e relações das quatro fontes e da pasta filha", async () => {
    const { f, project, containers, foreign } = await fixture();
    try {
      const baseline = await ledger(f);
      let previous = project;
      for (const command of ["project.delete", "project.restore"] as const) {
        const before = await ledger(f), client_id = command + "-main";
        const result = await f.command({ command, input: { id: project.id, client_id } }) as Projeto;
        expect(result).toEqual({ ...project, deleted_at: command === "project.delete" ? f.now : null });
        const after = await ledger(f);
        for (const name of ["users", "sessions", "captures", "tasks", "notebooks", "folders", "pages", "refs", "links"] as const) expect(after[name]).toEqual(baseline[name]);
        const ownLimit = after.limits.filter(v => v.user_id === habitOwner);
        expect(ownLimit).toHaveLength(1); expect(ownLimit[0]!.scope).toBe("capture_task_write");
        expect(Number.isFinite(Date.parse(String(ownLimit[0]!.updated_at)))).toBe(true);
        expect(after.limits).toEqual(before.limits.map(v => v.user_id === habitOwner
          ? { ...v, hits: [...v.hits as string[], ownLimit[0]!.updated_at], updated_at: ownLimit[0]!.updated_at } : v));
        // Project metadata participates in both adapters' snapshots. Its own
        // update bumps M1 once and Routine three times (row/event/receipt).
        expect(after.captureRevisions).toEqual(before.captureRevisions.map(v => v.user_id === habitOwner ? { ...v, revision: Number(v.revision) + 1 } : v));
        expect(after.routineRevisions).toEqual(before.routineRevisions.map(v => v.user_id === habitOwner ? { ...v, revision: Number(v.revision) + 3 } : v));
        expect(after.projects.filter(v => v.id !== project.id)).toEqual(baseline.projects.filter(v => v.id !== project.id));
        expect(after.projects.filter(v => v.id === project.id)).toEqual([expect.objectContaining({ payload: result, user_id: habitOwner })]);
        const addedEvents = after.events.filter(v => !before.events.some(old => old.id === v.id));
        expect(addedEvents).toEqual([expect.objectContaining({ entity_id: project.id, user_id: habitOwner, entity_type: "project", action: command === "project.delete" ? "deleted" : "restored", canal: "web", before: previous, after: result })]);
        expect(after.events.filter(v => !addedEvents.includes(v))).toEqual(before.events);
        const addedReceipts = after.receipts.filter(v => !before.receipts.some(old => old.user_id === v.user_id && old.command === v.command && old.client_id === v.client_id));
        expect(addedReceipts).toEqual([expect.objectContaining({ user_id: habitOwner, command, client_id, result })]);
        expect(after.receipts.filter(v => !addedReceipts.includes(v))).toEqual(before.receipts);
        expect(after.routineRevisions.filter(v => v.user_id === foreign.user_id)).toEqual(baseline.routineRevisions.filter(v => v.user_id === foreign.user_id));
        const snapshot = await f.gateway("read.projects").snapshot();
        expect(snapshot.projects.find(v => v.id === project.id)).toEqual(result);
        expect([...snapshot.containers].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...containers].sort((a, b) => a.id.localeCompare(b.id)));
        // Exact replay emits neither a second event nor an additional receipt.
        expect(await f.command({ command, input: { id: project.id, client_id } })).toEqual(result);
        expect(await ledger(f)).toEqual(after); previous = result;
      }
      expect((await f.gateway("read.projects").snapshot()).projects.find(v => v.id === project.id)?.deleted_at).toBeNull();
    } finally { await f.db.close(); }
  });
});
