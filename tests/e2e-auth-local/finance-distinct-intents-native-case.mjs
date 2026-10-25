/** D3 uses actual psql sessions. Pure helpers below do not certify native origin. */
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { GoalNativeError, GOAL_NATIVE_LIMITS, nativeRecord, nativeRefuse } from "./finance-goals-terminal-native-contract.mjs";
import { DISTINCT_NATIVE_CASES, DISTINCT_NATIVE_CHECKS, DISTINCT_NATIVE_COUNTS, assertDistinctNativeBarrier } from "./finance-distinct-intents-native-contract.mjs";
import { createGoalNativeSession } from "./finance-goals-terminal-native-session.mjs";
import { goalDistinctNativeStatement, goalNativeStatement } from "./finance-goals-terminal-native-sql.mjs";

const ensure = (value, code = "MATERIAL_REFUSED") => { if (!value) nativeRefuse(code); };
const equal = (a, b) => ensure(isDeepStrictEqual(a, b));
const copy = value => structuredClone(value);
const TABLES = Object.freeze({ finance_goal: "goals", finance_goal_reservation: "reservations", finance_goal_release: "releases", finance_series: "series", finance_series_occurrence: "occurrences", finance_transaction: "ledger" });
const KEYS = ["goals", "reservations", "releases", "highlights", "ledger", "accounts", "events", "receipts", "dispositions", "limits", "revisions", "accountTotals", "goalTotals", "releaseTotals", "series", "occurrences", "permits", "categories", "tags", "transactionTags", "budgets"];
const without = (value, key) => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
function cents(value) { ensure(typeof value === "number" && Number.isSafeInteger(value) || typeof value === "string" && /^-?(0|[1-9][0-9]*)$/.test(value)); return BigInt(value); }
function material(value) { nativeRecord(value, ["ack", "a", "b"], "MATERIAL_REFUSED"); ensure(value.ack === "material"); for (const owner of [value.a, value.b]) { nativeRecord(owner, KEYS, "MATERIAL_REFUSED"); for (const key of KEYS) ensure(Array.isArray(owner[key]) && owner[key].length <= 128); } }
function totals(owner) {
  const released = id => owner.releases.filter(r => r.reservation_id === id).reduce((n, r) => n + cents(r.amount_cents), 0n);
  const reserved = (account, goal) => owner.reservations.filter(r => (!account || r.account_id === account) && (!goal || r.goal_id === goal)).reduce((n, r) => n + cents(r.amount_cents) - released(r.id), 0n);
  ensure(owner.accountTotals.length === owner.accounts.length && owner.goalTotals.length === owner.goals.length && owner.releaseTotals.length === owner.reservations.length);
  for (const account of owner.accounts) {
    let real = cents(account.opening_balance_cents);
    for (const row of owner.ledger) if (row.account_id === account.id && row.deleted_at === null && ["confirmed", "reconciled"].includes(row.status)) real += (row.kind === "income" ? 1n : -1n) * cents(account.kind === "credit_card" ? row.amount_cents : row.paid_cents);
    const total = owner.accountTotals.find(t => t.account_id === account.id); ensure(total && total.user_id === account.user_id && cents(total.real_balance_cents) === real && cents(total.reserved_cents) === reserved(account.id, null));
  }
  for (const goal of owner.goals) ensure(cents(owner.goalTotals.find(t => t.goal_id === goal.id)?.saved_cents) === reserved(null, goal.id));
  for (const row of owner.reservations) ensure(cents(owner.releaseTotals.find(t => t.reservation_id === row.id)?.released_cents) === released(row.id));
  const revision = owner.revisions[0]?.revision ?? "0"; for (const key of ["accountTotals", "goalTotals", "releaseTotals"]) for (const total of owner[key]) ensure(total.finance_revision === revision);
}
export function assertDistinctNativeIntents(a, b) {
  const left = a.request, right = b.request;
  ensure(left && right && left.command === right.command && left.input.client_id !== right.input.client_id && a.expected_finance_revision === b.expected_finance_revision && a.expected_finance_revision === left.input.expected_finance_revision && b.expected_finance_revision === right.input.expected_finance_revision);
  equal(without(left.input, "client_id"), without(right.input, "client_id")); equal(a.context, b.context);
  for (const body of [a, b]) { ensure(body.receipt.command === body.request.command && body.receipt.client_id === body.request.input.client_id && body.receipt.user_id === body.context.user_id); for (const change of body.changes) if (Object.hasOwn(change.after, "client_id")) ensure(change.after.client_id === body.request.input.client_id); }
  const ids = body => [...body.changes.filter(c => c.before === null).map(c => c.after.id), ...body.events.map(e => e.id)];
  const idsA = ids(a), idsB = ids(b), all = [...idsA, ...idsB, left.input.client_id, right.input.client_id]; ensure(idsA.length > 0 && idsB.length === idsA.length && all.every(value => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) && new Set(all).size === all.length);
  return true;
}
export function assertDistinctNativeLoser(value) { const v = nativeRecord(value, ["status"], "MATERIAL_REFUSED"); ensure(v.status === "stale"); return true; }
export function assertDistinctCoreRefusal(error, commitCalls) { ensure(error instanceof Error && error.code === "VALIDATION" && commitCalls === 0); return true; }
export function assertDistinctSeriesInitialMaterial(value) {
  material(value); ensure(value.a.series.length === 1 && value.a.occurrences.length === 2 && value.a.ledger.length === 2);
  const row = nativeRecord(value.a.series[0], ["id", "user_id", "payload", "state", "revision"], "MATERIAL_REFUSED");
  ensure(row.payload?.next_index === 3 && row.state === "active" && row.payload.state === row.state && row.payload.id === row.id && row.payload.user_id === row.user_id && row.payload.revision === String(row.revision)); return true;
}

/** Compare full old rows plus exact payload/event/receipt identities; no count-only acceptance. */
export function assertDistinctNativeMaterial(kind, before, after, body, loserBody, reply, weights) {
  ensure(DISTINCT_NATIVE_CASES.includes(kind)); assertDistinctNativeIntents(body, loserBody); material(before); material(after); equal(before.b, after.b); totals(before.a); totals(after.a); totals(after.b);
  equal(weights, { goal: 1, event: 1, receipt: 0, disposition: 0, series: 1, occurrence: 1, ledger: 1, seriesReceipt: 0 });
  const a = before.a, b = after.a, series = kind === "SERIES_MATERIALIZE_DISTINCT";
  ensure(body.request.command === (series ? "finance.recurring.materialize" : kind === "CONTRIBUTE_DISTINCT" ? "finance.goal.contribute" : "finance.goal.release"));
  nativeRecord(reply, ["status", "result"], "MATERIAL_REFUSED"); ensure(reply.status === "committed"); equal(reply.result, body.receipt.result);
  ensure(body.changes.length === (series ? 5 : 1) && body.events.length === body.changes.length && body.receipt.user_id === body.context.user_id);
  if (series) { for (const [type, count] of [["finance_series", 1], ["finance_series_occurrence", 2], ["finance_transaction", 2]]) ensure(body.changes.filter(change => change.type === type).length === count); }
  else ensure(body.changes[0].type === (kind === "CONTRIBUTE_DISTINCT" ? "finance_goal_reservation" : "finance_goal_release") && body.changes[0].before === null);
  for (const table of ["goals", "reservations", "releases", "highlights", "ledger", "accounts", "series", "occurrences", "permits", "categories", "tags", "transactionTags", "budgets", "dispositions"]) {
    const changes = body.changes.filter(change => TABLES[change.type] === table), ids = new Set(changes.map(change => change.after.id));
    ensure(ids.size === changes.length); equal(b[table].filter(row => !ids.has(row.id)), a[table].filter(row => !ids.has(row.id)));
    ensure(b[table].length === a[table].length + changes.filter(change => change.before === null).length);
    for (const change of changes) {
      const old = a[table].find(row => row.id === change.after.id), rows = b[table].filter(row => row.id === change.after.id); ensure(rows.length === 1 && (change.before === null ? old === undefined : old !== undefined));
      if (old) equal(old.payload, change.before); const row = rows[0]; equal(row.payload, change.after);
      for (const field of ["id", "user_id", "goal_id", "account_id", "reservation_id", "series_id", "transaction_id", "amount_cents"]) if (Object.hasOwn(change.after, field)) equal(row[field], change.after[field]);
      if (change.type === "finance_series_occurrence") ensure(row.ordinal === change.after.index);
      if (change.type === "finance_series") { nativeRecord(row, ["id", "user_id", "payload", "state", "revision"], "MATERIAL_REFUSED"); ensure(String(row.revision) === change.after.revision && row.state === change.after.state && row.payload.next_index === change.after.next_index); }
      for (const field of ["created_at", "updated_at"]) if (Object.hasOwn(row, field) && Object.hasOwn(change.after, field)) ensure(Number.isFinite(Date.parse(row[field])) && Date.parse(row[field]) === Date.parse(change.after[field]));
    }
  }
  ensure(b.permits.length === 0 && a.permits.length === 0);
  const newEvents = b.events.filter(event => !a.events.some(old => old.id === event.id)); equal(b.events.filter(event => a.events.some(old => old.id === event.id)), a.events); ensure(newEvents.length === body.events.length);
  for (const event of body.events) { const rows = newEvents.filter(row => row.id === event.id); ensure(rows.length === 1); const row = rows[0]; for (const field of ["id", "user_id", "entity_type", "entity_id", "action", "canal", "before", "after"]) equal(row[field], event[field]); ensure(Date.parse(row.occurred_at) === Date.parse(event.occurred_at)); const effects = body.changes.filter(c => c.type === event.entity_type && c.after.id === event.entity_id && isDeepStrictEqual(c.before, event.before) && isDeepStrictEqual(c.after, event.after)); ensure(effects.length === 1); }
  ensure(b.receipts.length === a.receipts.length + 1); const added = b.receipts.filter(row => row.command === body.request.command && row.client_id === body.request.input.client_id); ensure(added.length === 1); equal(b.receipts.filter(row => row !== added[0]), a.receipts); equal(added[0].request, body.receipt.fingerprint); equal(added[0].result, body.receipt.result); ensure(added[0].user_id === body.context.user_id && !b.receipts.some(row => row.command === loserBody.request.command && row.client_id === loserBody.request.input.client_id));
  ensure(a.revisions.length === 1 && b.revisions.length === 1); equal(without(a.revisions[0], "revision"), without(b.revisions[0], "revision")); ensure(cents(b.revisions[0].revision) - cents(a.revisions[0].revision) === BigInt(series ? weights.series + 2 * weights.occurrence + 2 * weights.ledger + 5 * weights.event + weights.seriesReceipt : weights.goal + weights.event + weights.receipt));
  const prior = a.limits.filter(row => row.scope === "capture_task_write"), current = b.limits.filter(row => row.scope === "capture_task_write"); ensure(prior.length === 1 && current.length === 1); equal(without(without(prior[0], "hits"), "updated_at"), without(without(current[0], "hits"), "updated_at")); ensure(current[0].hits.length === prior[0].hits.length + 1 && Number.isFinite(Date.parse(current[0].updated_at)) && Date.parse(current[0].updated_at) === Date.parse(current[0].hits.at(-1))); equal(current[0].hits.slice(0, -1), prior[0].hits); equal(a.limits.filter(row => row.scope !== "capture_task_write"), b.limits.filter(row => row.scope !== "capture_task_write"));
  if (series) {
    ensure(a.series.length === 1 && b.series.length === 1 && a.occurrences.length === 2 && b.occurrences.length === 4 && a.ledger.length === 2 && b.ledger.length === 4);
    equal(b.occurrences.map(row => row.ordinal).sort((x, y) => x - y), [1, 2, 3, 4]); ensure(new Set(b.occurrences.map(row => row.transaction_id)).size === 4 && b.series[0].payload.next_index === 5 && cents(b.series[0].revision) - cents(a.series[0].revision) === 1n);
    ensure(b.ledger.every(row => row.status === "planned" && cents(row.paid_cents) === 0n)); equal(body.receipt.result.affected, { created: 2, updated: 0, suppressed: 0, restored: 0, skipped: 0 });
  } else {
    const accountId = kind === "CONTRIBUTE_DISTINCT" ? body.request.input.account_id : a.reservations.find(row => row.id === body.request.input.reservation_id)?.account_id, account = b.accountTotals.find(row => row.account_id === accountId);
    ensure(account && cents(account.real_balance_cents) === 100000n && cents(account.reserved_cents) === (kind === "CONTRIBUTE_DISTINCT" ? 60000n : 5000n) && b.ledger.length === 0);
  }
  return true;
}

/** No injectable session factory: native provenance comes from actual child backends. */
export async function runDistinctNativeCase({ kind, product, context, sessionOptions, actors, cleanupActors, weights, signal }) {
  ensure(DISTINCT_NATIVE_CASES.includes(kind), "ENVIRONMENT_REFUSED");
  const row = { case: kind, status: "failed", code: "NOT_RUN", phase: "baseline", checks: Object.fromEntries(DISTINCT_NATIVE_CHECKS.map(k => [k, false])), counts: Object.fromEntries(DISTINCT_NATIVE_COUNTS.map(k => [k, 0])), loserGate: "NOT_OBSERVED", businessGuardReached: false, unknown: false };
  const sessions = new Map(); let clockAt = null; const series = kind === "SERIES_MATERIALIZE_DISTINCT", writeContext = { user_id: actors.a.id, canal: "web" };
  const sql = (session, action, data = {}) => session.request((["SERIES_RPC", "DISTINCT_MATERIAL", "DISTINCT_ABSENCE"].includes(action) ? goalDistinctNativeStatement : goalNativeStatement)(context, action, data));
  const begin = (session, role = "service_role") => sql(session, "BEGIN", { role });
  const call = async (session, actor, intent, request, seriesCall = false) => (await sql(session, seriesCall ? "SERIES_RPC" : "RPC", { rpc: seriesCall ? "finance_series_commit" : "finance_goals_commit", owner: actor.id, session: actor.sessionId, operation: intent.command, request: copy(request) })).value;
  const transaction = async (session, work, role = "service_role") => { await begin(session, role); try { const value = await work(); await sql(session, "COMMIT"); return value; } catch (error) { if (!session.metadata().failed && session.metadata().transaction === "open") await sql(session, "ROLLBACK"); throw error; } };
  function gateway(session, actor, intent, seriesCall) { return product[seriesCall ? "createFinanceSeriesGateway" : "createFinanceGoalsGateway"](actor.id, actor.sessionId, intent.command, async (name, args) => { ensure(name === (seriesCall ? "finance_series_snapshot" : "finance_goals_snapshot")); return (await sql(session, seriesCall ? "SERIES_RPC" : "RPC", { rpc: name, owner: actor.id, session: actor.sessionId, operation: intent.command, request: copy(args.p_request) })).value; }); }
  async function plan(session, intent, actor, seriesCall) {
    let body = null; const original = gateway(session, actor, intent, seriesCall), planner = { ...original, async commit(value) { ensure(body === null); body = copy(value); return { status: "stale" }; } };
    const store = product[seriesCall ? "createFinanceSeriesStore" : "createFinanceGoalsStore"](planner, intent), execute = product[seriesCall ? "executeFinanceSeriesCommand" : "executeGoalCommand"]; let conflict = false;
    const at = clockAt; ensure(typeof at === "string"); try { await execute(store, { ids: { next: () => randomUUID() }, clock: { now: () => at } }, writeContext, intent); } catch (error) { conflict = error?.code === "CONFLICT"; }
    ensure(conflict && body); return body;
  }
  try {
    for (const role of ["winner", "loser", "observer", "control"]) { const name = sessionOptions.environment.PGAPPNAME.replace(/control$/, role), session = createGoalNativeSession({ ...sessionOptions, context, signal, applicationName: name, environment: { ...sessionOptions.environment, PGAPPNAME: name } }); sessions.set(role, session); await sql(session, "IDENTITY"); }
    ensure(new Set([...sessions.values()].map(session => session.metadata().backendPid)).size === 4, "INSTANCE_REFUSED"); row.counts.sessions = 4; row.checks.instanceBound = row.checks.distinctBackends = true;
    const control = sessions.get("control"), winner = sessions.get("winner"), loser = sessions.get("loser"), observer = sessions.get("observer"), accountA = randomUUID(), accountB = randomUUID();
    const state = async () => { const value = await sql(control, "STATE", { owner: actors.a.id }); ensure(Number.isFinite(Date.parse(value.at))); clockAt = new Date(value.at).toISOString(); return value; }, read = () => sql(control, "DISTINCT_MATERIAL", { a: actors.a.id, b: actors.b.id }); let current = await state();
    await transaction(control, () => sql(control, "FIXTURE", { a: actors.a.id, b: actors.b.id, a1: actors.a.sessionId, a2: actors.a2.sessionId, b1: actors.b.sessionId, accountA, accountB, at: clockAt }), "postgres"); row.checks.actorsBound = true; current = await state(); const day = current.day;
    async function setup(intent, seriesCall = false) { return transaction(control, async () => { const body = await plan(control, intent, actors.a, seriesCall), value = await call(control, actors.a, intent, body, seriesCall); ensure(value.status === "committed"); return value.result; }); }
    let baseIntent;
    if (series) {
      const nextDay = value => { const [y, m, d] = value.split("-").map(Number); const date = new Date(0); date.setUTCFullYear(y, m - 1, d + 1); return date.toISOString().slice(0, 10); }, anchor = nextDay(day), d3 = product.seriesOccurrenceDay(anchor, "weekly", 2), d4 = product.seriesOccurrenceDay(anchor, "weekly", 3);
      const created = await setup(product.decodeFinanceSeriesCommand({ command: "finance.recurring.create", input: { client_id: randomUUID(), expected_finance_revision: current.revision, definition: { kind: "recorrencia", frequency: "weekly", anchor_on: anchor, first_index: 1, total: 4, ends_on: null, template: { account_id: accountA, category_id: null, kind: "expense", amount_cents: 1000, description: "Série nativa sintética", payee: null, notes: null, tag_ids: [], statement_mode: "none" } }, horizon: { from_on: anchor, until_exclusive: d3 }, statement_assignments: [] } }), true);
      current = await state(); baseIntent = { command: "finance.recurring.materialize", input: { expected_finance_revision: current.revision, series_id: created.series.id, expected_revision: created.series.revision, horizon: { from_on: anchor, until_exclusive: nextDay(d4) }, statement_assignments: [] } };
    } else {
      const created = await setup(product.decodeGoalCommand({ command: "finance.goal.create", input: { client_id: randomUUID(), expected_finance_revision: current.revision, name: "Meta nativa sintética", target_cents: 100000, deadline: null, image_file_id: null } })); current = await state();
      if (kind === "CONTRIBUTE_DISTINCT") baseIntent = { command: "finance.goal.contribute", input: { expected_finance_revision: current.revision, goal_id: created.goal.id, expected_revision: created.goal.revision, account_id: accountA, amount_cents: 60000, occurred_on: day } };
      else { const reserved = await setup(product.decodeGoalCommand({ command: "finance.goal.contribute", input: { client_id: randomUUID(), expected_finance_revision: current.revision, goal_id: created.goal.id, expected_revision: created.goal.revision, account_id: accountA, amount_cents: 20000, occurred_on: day } })); current = await state(); await setup(product.decodeGoalCommand({ command: "finance.goal.release", input: { client_id: randomUUID(), expected_finance_revision: current.revision, reservation_id: reserved.reservation.id, amount_cents: 5000, occurred_on: day } })); current = await state(); baseIntent = { command: "finance.goal.release", input: { expected_finance_revision: current.revision, reservation_id: reserved.reservation.id, amount_cents: 10000, occurred_on: day } }; }
    }
    ensure(current.day === day, "MATERIAL_REFUSED"); const decode = product[series ? "decodeFinanceSeriesCommand" : "decodeGoalCommand"], intentA = decode({ ...copy(baseIntent), input: { ...copy(baseIntent.input), client_id: randomUUID() } }), intentB = decode({ ...copy(baseIntent), input: { ...copy(baseIntent.input), client_id: randomUUID() } });
    row.phase = "planning"; await begin(control); const bodyA = await plan(control, intentA, actors.a, series); await sql(control, "ROLLBACK"); await begin(control); const bodyB = await plan(control, intentB, actors.a2, series); await sql(control, "ROLLBACK"); assertDistinctNativeIntents(bodyA, bodyB); row.checks.intentsDistinct = true; const before = await read();
    if (series) assertDistinctSeriesInitialMaterial(before);
    row.phase = "winner"; await begin(winner); const won = await call(winner, actors.a, intentA, bodyA, series); ensure(won.status === "committed"); await begin(loser);
    let settled = false; const outcome = call(loser, actors.a2, intentB, bodyB, series).then(value => { settled = true; return { value }; }, error => { settled = true; return { error }; });
    row.phase = "blocked"; const deadline = Date.now() + GOAL_NATIVE_LIMITS.barrierMs; let observed = false;
    while (Date.now() < deadline && !settled && !signal.aborted) { let timer; const timeout = new Promise((_, reject) => { timer = setTimeout(() => { observer.abort(); reject(new GoalNativeError("BARRIER_REFUSED")); }, Math.max(1, deadline - Date.now())); }); let observation; try { observation = await Promise.race([sql(observer, "BLOCKING", { waiter: loser.metadata().backendPid, winner: winner.metadata().backendPid }), timeout]); } finally { clearTimeout(timer); } if (observation.blocked && observation.advisory && observation.waitType === "Lock") { assertDistinctNativeBarrier(observation, loser.metadata().backendPid, winner.metadata().backendPid, settled, Date.now() < deadline); observed = true; break; } await new Promise(resolve => setTimeout(resolve, Math.min(GOAL_NATIVE_LIMITS.pollMs, Math.max(0, deadline - Date.now())))); }
    ensure(observed && !settled && !signal.aborted, "BARRIER_REFUSED"); row.checks.barrierObserved = true; row.phase = "release"; await sql(winner, "COMMIT"); row.checks.winnerCommitted = true;
    const lost = await outcome; ensure(!lost.error); assertDistinctNativeLoser(lost.value); await sql(loser, "ROLLBACK"); row.loserGate = "STALE_FINANCE"; row.checks.loserKnown = true;
    row.phase = "oracle"; const after = await read(); assertDistinctNativeMaterial(kind, before, after, bodyA, bodyB, won, weights); for (const key of ["oldRowsUnchanged", "eventBijection", "receiptExclusive", "totalsExact", "otherOwnerUnchanged"]) row.checks[key] = true; row.checks.ordinalUnique = series;
    if (!series) {
      current = await state(); ensure(current.day === day); const intentC = product.decodeGoalCommand({ ...copy(baseIntent), input: { ...copy(baseIntent.input), expected_finance_revision: current.revision, client_id: randomUUID() } }); ensure(![intentA.input.client_id, intentB.input.client_id].includes(intentC.input.client_id)); const stable = await read(); let refusal, commitCalls = 0;
      await begin(control); try { const original = gateway(control, actors.a, intentC, false), guarded = { ...original, async commit() { commitCalls++; nativeRefuse("MATERIAL_REFUSED"); } }; await product.executeGoalCommand(product.createFinanceGoalsStore(guarded, intentC), { ids: { next: () => randomUUID() }, clock: { now: () => clockAt } }, writeContext, intentC); } catch (error) { refusal = error; } finally { if (!control.metadata().failed && control.metadata().transaction === "open") await sql(control, "ROLLBACK"); }
      assertDistinctCoreRefusal(refusal, commitCalls); equal(await read(), stable); row.checks.serialCoreValidation = row.checks.serialSnapshotUnchanged = true; row.counts.serialControls = row.counts.serialRefusals = 1;
    }
    row.counts.receipts = row.counts.quotaDelta = 1; row.counts.financialEffects = row.counts.financialEvents = series ? 5 : 1;
    for (const role of ["winner", "loser", "observer"]) { const session = sessions.get(role), terminal = await session.finish(); ensure(terminal.code === "PASSED" && !terminal.unknown && terminal.stdoutEof && terminal.stderrEof && terminal.groupAbsent && Object.values(session.metadata().terminalCounts).every(n => n === 1), "PROCESS_REFUSED"); }
    ensure((await sql(control, "BACKENDS")).other === 0, "CLEANUP_UNCONFIRMED"); row.checks.quiescent = true; row.phase = "cleanup"; await cleanupActors(); ensure((await sql(control, "DISTINCT_ABSENCE", { a: actors.a.id, b: actors.b.id })).absent, "CLEANUP_UNCONFIRMED"); row.checks.fixtureAbsent = true;
    const terminal = await control.finish(); ensure(terminal.code === "PASSED" && !terminal.unknown && terminal.groupAbsent && terminal.stdoutEof && terminal.stderrEof && Object.values(control.metadata().terminalCounts).every(n => n === 1), "CLEANUP_UNCONFIRMED");
  } catch (error) { row.code = error instanceof GoalNativeError ? error.code : "MATERIAL_REFUSED"; for (const session of sessions.values()) session.abort(); }
  finally { for (const session of sessions.values()) { const terminal = await session.terminal(); row.unknown ||= terminal.unknown || session.metadata().unknown; if (session.metadata().pending || session.metadata().processPending || !terminal.groupAbsent) row.code = "CLEANUP_UNCONFIRMED"; } if (row.unknown) row.code = "WRITE_OUTCOME_UNCERTAIN"; }
  const quiet = [...sessions.values()].every(session => !session.metadata().pending && !session.metadata().processPending && session.metadata().groupAbsent), completed = quiet && !row.unknown && row.code === "NOT_RUN" && row.checks.fixtureAbsent;
  return { row, quiet, unknown: row.unknown, completed };
}
