/** Canonical-chain RAM qualification in a disposable fixture; no hosted service. */
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";

const owner = "74000000-0000-4000-8000-000000000001", session = "74000000-0000-4000-8000-000000000002", account = "74000000-0000-4000-8000-000000000003", source = "74000000-0000-4000-8000-000000000004", execution = "74000000-0000-4000-8000-000000000005", note = "74000000-0000-4000-8000-000000000006";
const window = { start_day: "2026-10-01", end_day: "2026-11-01" };
const participant = { name: "PRIVATE_PARTICIPANT_CANARY", email: "private@example.invalid", response_status: "accepted", self: true, organizer: true, optional: false, resource: false };
const event = { google_id: "event", cancelled: false, title: "Compromisso", starts_at: "2026-10-10T12:00:00Z", ends_at: "2026-10-10T13:00:00Z", all_day: false, location: null, html_link: null, reminder_minutes: null };
it("T049 canonical: owned RPC persists participants atomically; legacy refill, note links, cancelled events and narrow events survive", async () => {
  const db = await createLocalCanonicalSql();
  try {
    // The canonical fixture already applies all numbered migrations exactly once.
    // This separate assertion file always rolls back its synthetic observations.
    await db.exec(await readFile(new URL("../../supabase/tests/calendar-participants.sql", import.meta.url), "utf8"));
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','calendar@example.invalid')", [owner]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [session, owner]);
    await db.query("insert into public.calendar_accounts(id,user_id,google_sub,email,scopes) values($1,$2,'inert-sub','calendar@example.invalid',array['openid'])", [account, owner]);
    await db.query("insert into public.calendar_sources(id,user_id,account_id,google_id,name,selected) values($1,$2,$3,'source','Agenda',true)", [source, owner, account]);
    await db.query("insert into app_private.google_credentials(user_id,account_id,envelope) values($1,$2,$3::jsonb)", [owner, account, JSON.stringify({ version: 1, key_id: "test", iv: "A".repeat(16), tag: "A".repeat(22) + "==", ciphertext: "AAAA" })]);
    const call = async (command: string, input: unknown) => db.transaction(async tx => {
      await tx.exec("set local role service_role");
      return (await tx.query<{ value: Record<string, unknown> }>("select public.google_calendar_call($1::uuid,$2::uuid,$3,$4::jsonb,false,$5::uuid) as value", [owner, session, command, JSON.stringify(input), execution])).rows[0]!.value;
    });
    const run = await call("run", { account_id: account, client_id: "draft-participants", window });
    let revision = "0";
    const commit = (events: unknown[], reset = true) => call("commit_events", { account_id: account, revision, calendar_id: source, run_id: run.id, window, reset, sync_token: "cursor", events });
    // An old application may still submit the legacy shape. It must remain
    // unknown, and its private cursor forces one full, bounded refill next time.
    await commit([event]); revision = "1";
    // Event-window coverage survives; roster freshness is a separate dimension.
    expect((await call("snapshot", {})).window).toEqual(window);
    expect((await call("private_account", { account_id: account })).calendars).toMatchObject([{ sync_token: null }]);
    expect((await db.query("select attendees,attendees_omitted from public.calendar_events")).rows).toEqual([{ attendees: null, attendees_omitted: null }]);
    // A legacy empty delta is not a full response. It cannot certify an older
    // cache merely because this particular batch has no unknown active rows.
    await commit([], false); revision = "2";
    expect((await db.query("select attendees_version from app_private.google_calendar_cursors")).rows).toEqual([{ attendees_version: 0 }]);
    expect((await call("private_account", { account_id: account })).calendars).toMatchObject([{ sync_token: null }]);
    const cached = (await db.query<{ id: string }>("select id from public.calendar_events")).rows[0]!.id;
    await db.query("insert into public.captures(payload) values($1::jsonb)", [JSON.stringify({ id: note, user_id: owner, client_id: "draft-note", type: "note", title: "Nota", content: null, status: "inbox", category_id: null, project_id: null, converted_task_id: null, captured_at: "2026-10-01T12:00:00Z", organized_at: null, archived_at: null, deleted_at: null, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z" })]);
    await call("link", { event_id: cached, capture_id: note, client_id: "draft-note-link" });
    const before = (await db.query("select (select revision from public.calendar_accounts where id=$1) as revision,(select count(*) from public.domain_events) as events", [account])).rows;
    // The first valid row and reset are rolled back when a later roster fails.
    await expect(commit([{ ...event, attendees: [], attendees_omitted: false }, { ...event, google_id: "bad", attendees: [{ ...participant, photo: "PRIVATE_PHOTO_CANARY" }], attendees_omitted: false }])).rejects.toMatchObject({ code: "22023" });
    expect((await db.query("select (select revision from public.calendar_accounts where id=$1) as revision,(select count(*) from public.domain_events) as events", [account])).rows).toEqual(before);
    expect((await db.query("select id,linked_capture_id,attendees from public.calendar_events")).rows).toEqual([{ id: cached, linked_capture_id: note, attendees: null }]);
    await commit([{ ...event, attendees: [participant], attendees_omitted: true }]); revision = "3";
    const snapshot = await call("snapshot", {});
    expect(snapshot.window).toEqual(window);
    expect(snapshot.items).toMatchObject([{ id: cached, linked_capture_id: note, attendees: [participant], attendees_omitted: true }]);
    expect((await call("private_account", { account_id: account })).calendars).toMatchObject([{ sync_token: "cursor" }]);
    expect((await db.query("select attendees_version from app_private.google_calendar_cursors")).rows).toEqual([{ attendees_version: 1 }]);
    // Version1 confirms the event response schema, never a complete guest list.
    expect(JSON.stringify((await db.query('select "before","after" from public.domain_events')).rows)).not.toMatch(/PRIVATE_PARTICIPANT_CANARY|private@example|attendees/);
    // The same SQL reset used after HTTP410 preserves note links while deleting
    // the expired cursor/cache; only a subsequent full commit republishes rows.
    await call("reset_cursor", { account_id: account, revision, calendar_id: source, run_id: run.id }); revision = "4";
    expect((await db.query("select id from public.calendar_events")).rows).toEqual([]);
    expect((await db.query("select linked_capture_id from app_private.google_event_links")).rows).toEqual([{ linked_capture_id: note }]);
    await commit([{ ...event, attendees: [participant], attendees_omitted: true }]); revision = "5";
    expect((await call("snapshot", {})).items).toMatchObject([{ id: cached, linked_capture_id: note, attendees: [participant] }]);
    await commit([{ ...event, attendees: [], attendees_omitted: false }], false); revision = "6";
    expect((await call("snapshot", {})).items).toMatchObject([{ linked_capture_id: note, attendees: [], attendees_omitted: false }]);
    await commit([{ ...event, cancelled: true }], false);
    expect((await db.query("select id from public.calendar_events")).rows).toEqual([]);
    expect((await db.query("select google_id from app_private.google_event_links")).rows).toEqual([]);
    const settings = await db.transaction(async tx => {
      await tx.exec("set local role service_role");
      return tx.query<{ value: unknown }>("select public.settings_commit($1::uuid,$2::uuid,$3::jsonb) as value", [owner, session, JSON.stringify({ command: "settings.preferences.update", input: { client_id: "draft-list", patch: { default_calendar_view: "list" } } })]);
    });
    expect(settings.rows[0]!.value).toMatchObject({ preferences: { default_calendar_view: "list" } });
    expect((await db.query("select has_function_privilege('anon','public.google_calendar_call(uuid,uuid,text,jsonb,boolean,uuid)','EXECUTE') as anon,has_function_privilege('authenticated','public.google_calendar_call(uuid,uuid,text,jsonb,boolean,uuid)','EXECUTE') as authenticated")).rows).toEqual([{ anon: false, authenticated: false }]);
  } finally { await db.close(); }
}, 120_000);
