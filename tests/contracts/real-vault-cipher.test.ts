/** Real Argon2id/WebCrypto -> Vault Core/Gateway -> canonical disposable SQL.
 * Auth catalogue and bound RPC transport are fixtures. Synthetic secrets/kit
 * remain in test RAM; no browser, Next handler, SDK, hosted or restore claim.
 * Direct envelope replacement below is an explicit database tampering probe.
 */
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { argon2id } from "hash-wasm";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import { createVaultGateway, type VaultOperationName, type VaultRpc } from "../../src/adapters/db/vault-gateway";
import { executeVaultCommand } from "../../src/core/cofre/use-cases";
import { prepareVault, changeMasterPassword, recoverVault, unlockVault, type VaultKdfPort } from "../../src/core/cofre/crypto";
import type { VaultInput, VaultPlainItem } from "../../src/core/cofre/types";

const owner = "61000000-0000-4000-8000-000000000001", sid = "61000000-0000-4000-8000-000000000002";
const foreign = "61000000-0000-4000-8000-000000000003", foreignSid = "61000000-0000-4000-8000-000000000004";
const itemIds = ["61000000-0000-4000-8000-000000000200", "61000000-0000-4000-8000-000000000201"] as const;
const password = "FixtureMestraSemDestino2026!", nextPassword = "FixtureRewrapSemDestino2027!", recoveryPassword = "FixtureRecuperadaSemDestino2028!";
const plain: VaultPlainItem = { title: "TITLE_CIPHER_CANARY", kind: "login", username: "USER_CIPHER_CANARY", password: "SECRET_CIPHER_CANARY", url: "https://fixture.invalid", note: "NOTE_CIPHER_CANARY" };
const derive: VaultKdfPort = async (bytes, salt, kdf) => new Uint8Array(await argon2id({ password: bytes, salt, memorySize: kdf.memory_kib, iterations: kdf.iterations, parallelism: kdf.parallelism, hashLength: 32, outputType: "binary" }));
const queries = {
  keys: "select to_jsonb(t) as row from public.vault_master_keys t order by user_id",
  items: "select to_jsonb(t) as row from public.vault_items t order by id",
  events: "select to_jsonb(t) as row from public.domain_events t order by id",
  receipts: "select to_jsonb(t) as row from app_private.command_receipts t order by user_id,command,client_id",
  revisions: "select to_jsonb(t) as row from app_private.vault_revisions t order by user_id",
  limits: "select to_jsonb(t) as row from app_private.rate_limits t order by scope,subject_hash",
  users: "select to_jsonb(t) as row from auth.users t order by id",
  sessions: "select to_jsonb(t) as row from auth.sessions t order by id",
};
type Row = Record<string, unknown>;
async function fixture() {
  const db = await createLocalCanonicalSql();
  try {
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','vault-owner@example.invalid'),($2,'authenticated','authenticated','vault-foreign@example.invalid')", [owner, foreign]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)", [sid, owner, foreignSid, foreign]);
    const now = new Date((await db.query<{ stamp: string }>("select to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as stamp")).rows[0]!.stamp).toISOString();
    let sequence = 10;
    const deps = { clock: { now: () => now }, ids: { next: () => "61000000-0000-4000-8000-" + String(sequence++).padStart(12, "0") } };
    const wire: unknown[] = [];
    const signatures = {
      vault_snapshot: "select public.vault_snapshot($1::uuid,$2::uuid,$3::text) as data",
      vault_commit: "select public.vault_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data",
      vault_receipt: "select public.vault_receipt($1::uuid,$2::uuid,$3::text,$4::jsonb) as data",
    };
    function gateway(operation: VaultOperationName, actor = owner, session = sid) {
      const rpc: VaultRpc = async (name, args) => {
        expect(args.p_user).toBe(actor); expect(args.p_session).toBe(session); expect(args.p_operation).toBe(operation);
        expect(Object.keys(args).sort()).toEqual(["p_user", "p_session", "p_operation", ...(name === "vault_snapshot" ? [] : ["p_request"])].sort());
        wire.push(structuredClone({ name, args }));
        try {
          const reply = await db.transaction(async tx => {
            await tx.exec("set local role service_role");
            return tx.query<{ data: unknown }>(signatures[name], [actor, session, operation, ...(name === "vault_snapshot" ? [] : [JSON.stringify(args.p_request)])]);
          });
          return { data: reply.rows[0]!.data, error: null };
        } catch (error) {
          const code = (error as { code?: unknown }).code;
          if (typeof code !== "string") throw error;
          return { data: null, error: { code } };
        }
      };
      return createVaultGateway(actor, session, operation, rpc);
    }
    const command = (request: VaultInput) => executeVaultCommand(gateway(request.command), deps, { user_id: owner, canal: "web" }, request);
    async function ledger() {
      const value = {} as Record<keyof typeof queries, Row[]>;
      for (const [name, sql] of Object.entries(queries)) value[name as keyof typeof queries] = (await db.query<{ row: Row }>(sql)).rows.map(row => row.row);
      return value;
    }
    return { db, now, command, gateway, wire, ledger };
  } catch (error) { await db.close(); throw error; }
}

it("o servidor recebe só cifra e metadados; chaves sem grants/policies e sessões alheias recusam leitura", async () => {
  const f = await fixture();
  let prepared: Awaited<ReturnType<typeof prepareVault>> | undefined;
  try {
    const provisioned = await f.ledger();
    prepared = await prepareVault(owner, password, derive);
    expect(await prepared.prove(prepared.kit.a, prepared.kit.b)).toBe(true);
    const create: VaultInput = { command: "vault.create", input: { client_id: "create", expected_revision: "0", consent: true, master: prepared.master, recovery: prepared.recovery } };
    await f.command(create);
    const header = (await f.gateway("read.vault").snapshot()).header!;
    expect(header).toEqual({ user_id: owner, schema_version: 1, master: prepared.master, recovery: prepared.recovery, consent_at: f.now, created_at: f.now, updated_at: f.now });
    const snapshot = await f.gateway("read.vault").snapshot();
    const request: VaultInput = { command: "vault.item.create", input: { client_id: "item-create", expected_revision: snapshot.revision, id: itemIds[0], version: 1, envelope: await prepared.session.encrypt(itemIds[0], 1, plain) } };
    const result = await f.command(request), persisted = await f.gateway("read.vault").snapshot();
    expect(persisted.revision).toBe(result.revision); expect(result.id).toBe(itemIds[0]);
    expect(persisted.items).toEqual([{ id: itemIds[0], user_id: owner, version: 1, envelope: request.input.envelope, created_at: f.now, updated_at: f.now, deleted_at: null }]);
    expect(await prepared.session.decrypt(persisted.items[0]!)).toEqual(plain);
    const baseline = await f.ledger();
    expect(await f.command(request)).toEqual(result); expect(await f.ledger()).toEqual(baseline);
    const vaultEvents = baseline.events.filter(v => !provisioned.events.some(old => old.id === v.id));
    expect(vaultEvents).toHaveLength(2); expect(baseline.receipts).toHaveLength(2);
    expect(baseline.events.filter(v => !vaultEvents.includes(v))).toEqual(provisioned.events);
    expect(baseline.users).toEqual(provisioned.users); expect(baseline.sessions).toEqual(provisioned.sessions);
    for (const event of vaultEvents) {
      expect(event).toMatchObject({ user_id: owner, entity_type: "vault_metadata", canal: "web", before: null });
      expect(Object.keys(event.after as Row).sort()).toEqual(["id", "user_id", "operation", "version", "occurred_at"].sort());
    }
    for (const receipt of baseline.receipts) {
      expect(Object.keys(receipt.request as Row)).toEqual(["digest"]); expect((receipt.request as Row).digest).toMatch(/^[a-f0-9]{64}$/);
      expect(Object.keys(receipt.result as Row).sort()).toEqual(["id", "revision"]);
    }
    const server = JSON.stringify({ wire: f.wire, ledger: baseline });
    for (const marker of [password, prepared.kit.a, prepared.kit.b, ...Object.values(plain).filter(v => typeof v === "string" && v.includes("CIPHER_CANARY"))]) expect(server).not.toContain(marker);
    expect(JSON.stringify(f.wire)).not.toMatch(/"(?:password|username|title|note|kit)"\s*:/);
    const catalog = (await f.db.query<{ rls: boolean; policies: number; jwt_select: boolean }>("select c.relrowsecurity as rls,(select count(*)::int from pg_policy p where p.polrelid=c.oid) as policies,has_table_privilege('authenticated',c.oid,'SELECT') as jwt_select from pg_class c where c.oid='public.vault_master_keys'::regclass")).rows;
    expect(catalog).toEqual([{ rls: true, policies: 0, jwt_select: false }]);
    for (const role of ["authenticated", "anon"] as const) await expect(f.db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.query("select payload from public.vault_master_keys"); })).rejects.toMatchObject({ code: "42501" });
    await expect(f.gateway("read.vault", owner, foreignSid).snapshot()).rejects.toMatchObject({ code: "forbidden" });
    expect(await f.gateway("read.vault", foreign, foreignSid).snapshot()).toEqual({ revision: "0", header: null, items: [] });
    expect(await f.ledger()).toEqual(baseline);
  } finally { prepared?.dispose(); await f.db.close(); }
});

it("trocar envelopes no banco é detectado por AAD e kit antigo recupera os registros SQL após rewrap", async () => {
  const f = await fixture();
  let prepared: Awaited<ReturnType<typeof prepareVault>> | undefined;
  let recovered: Awaited<ReturnType<typeof recoverVault>> | undefined;
  try {
    prepared = await prepareVault(owner, password, derive); await prepared.prove(prepared.kit.a, prepared.kit.b);
    await f.command({ command: "vault.create", input: { client_id: "create", expected_revision: "0", consent: true, master: prepared.master, recovery: prepared.recovery } });
    for (const [index, id] of itemIds.entries()) {
      const snapshot = await f.gateway("read.vault").snapshot();
      await f.command({ command: "vault.item.create", input: { client_id: "item-" + index, expected_revision: snapshot.revision, id, version: 1, envelope: await prepared.session.encrypt(id, 1, { ...plain, title: plain.title + index }) } });
    }
    const initial = await f.gateway("read.vault").snapshot(), header = initial.header!, kit = { ...prepared.kit };
    const master = await changeMasterPassword(header, password, nextPassword, derive);
    await f.command({ command: "vault.master.rewrap", input: { client_id: "rewrap", expected_revision: initial.revision, master } });
    const changed = await f.gateway("read.vault").snapshot();
    expect(changed.items).toEqual(initial.items); expect(changed.header).toEqual({ ...header, master });
    prepared.dispose(); await expect(unlockVault(changed.header!, password, derive)).rejects.toThrow();
    recovered = await recoverVault(changed.header!, kit.a, kit.b, recoveryPassword, derive);
    for (const [index, item] of changed.items.entries()) expect(await recovered.session.decrypt(item)).toEqual({ ...plain, title: plain.title + index });
    await f.command({ command: "vault.master.rewrap", input: { client_id: "recover", expected_revision: changed.revision, master: recovered.master } });
    const afterRecovery = await f.gateway("read.vault").snapshot();
    expect(afterRecovery.items).toEqual(initial.items); expect(afterRecovery.header?.recovery).toEqual(header.recovery);
    const fresh = await unlockVault(afterRecovery.header!, recoveryPassword, derive);
    try { expect(await fresh.decrypt(afterRecovery.items[0]!)).toEqual({ ...plain, title: plain.title + "0" }); } finally { fresh.lock(); }
    const beforeAttack = await f.ledger();
    await f.db.query("update public.vault_items set payload=jsonb_set(payload,'{envelope}',$1::jsonb) where user_id=$2 and id=$3", [JSON.stringify(afterRecovery.items[1]!.envelope), owner, itemIds[0]]);
    const attacked = await f.gateway("read.vault").snapshot();
    expect(attacked.items).toEqual([{ ...afterRecovery.items[0]!, envelope: afterRecovery.items[1]!.envelope }, afterRecovery.items[1]!]);
    await expect(recovered.session.decrypt(attacked.items[0]!)).rejects.toThrow();
    expect(await recovered.session.decrypt(attacked.items[1]!)).toEqual({ ...plain, title: plain.title + "1" });
    const afterAttack = await f.ledger(); expect(afterAttack.events).toEqual(beforeAttack.events); expect(afterAttack.receipts).toEqual(beforeAttack.receipts);
    expect(afterAttack.keys).toEqual(beforeAttack.keys); expect(afterAttack.limits).toEqual(beforeAttack.limits);
    expect(await f.gateway("read.vault", foreign, foreignSid).snapshot()).toEqual({ revision: "0", header: null, items: [] });
    expect(await f.ledger()).toEqual(afterAttack);
    // Client decryption/recovery never sends the kit, master passwords or item fields.
    const server = JSON.stringify({ wire: f.wire, ledger: afterAttack });
    for (const marker of [password, nextPassword, recoveryPassword, kit.a, kit.b, plain.password, plain.username, plain.note]) expect(server).not.toContain(marker);
  } finally { prepared?.dispose(); recovered?.session.lock(); await f.db.close(); }
});
