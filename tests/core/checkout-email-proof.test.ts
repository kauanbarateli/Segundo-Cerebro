import { createHmac, timingSafeEqual } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decodeEmailProofCommand, EMAIL_PROOF_TTL_MS, executeEmailProof, isCurrentEmailProved,
  normalizeCheckoutEmail, type EmailProofAuthority, type EmailProofCommand, type EmailProofCommit,
  type EmailProofIntentV1, type EmailProofPort, type EmailProofReceipt,
} from "@/core/checkout/email-proof";

const intentId = "synthetic_intent_0001";
const issuedAt = Date.parse("2026-10-19T12:00:00Z");
const policy = { cooldownMs: 60_000 }; // Synthetic server policy, not a new product decision.
const resume: EmailProofAuthority = { intentId, scope: "resume", mutationOriginVerified: true };
const proofAuthority: EmailProofAuthority = { ...resume, scope: "email-proof", emailRevision: 0 };
const baseCommand = { schemaVersion: 1 as const, intentId, commandId: "synthetic_command_0001", expectedRevision: 0 };
const issue = { ...baseCommand, type: "issue" as const };

/** Test adapter models the transaction contract, not PostgreSQL/RLS proof. */
function fixture() {
  let state: EmailProofIntentV1 = { schemaVersion: 1, intentId, revision: 0, emailRevision: 0,
    email: "person+checkout@example.invalid", generation: 0, proof: null, nextIssueAt: 0 };
  let receipts = new Map<string, EmailProofReceipt>();
  let commits: EmailProofCommit[] = [];
  let fail: "none" | "mint" | "commit" | "after-stage" = "none";
  let pending = Promise.resolve();
  let mints = 0;
  const port: EmailProofPort = {
    commitment: async command => createHmac("sha256", "synthetic-test-only-key").update(JSON.stringify([
      command.schemaVersion, command.intentId, command.commandId, command.expectedRevision, command.type,
      command.type === "change-email" ? command.email : null,
      command.type === "confirm" ? [command.emailRevision, command.generation, command.digest] : null,
    ])).digest("hex"),
    equalDigest: (a, b) => timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex")),
    transaction: async run => {
      const before = pending;
      let release!: () => void;
      pending = new Promise<void>(resolve => { release = resolve; });
      await before;
      let draft = structuredClone(state);
      const stagedReceipts = new Map(receipts);
      const stagedCommits = [...commits];
      try {
        const result = await run({
          loadForUpdate: async id => { if (id !== state.intentId) throw new Error("not found"); return structuredClone(draft); },
          receipt: async (_id, id) => stagedReceipts.get(id) ?? null,
          mint: async binding => {
            if (fail === "mint") throw new Error("synthetic mint failure");
            mints++;
            return { digest: String(binding.generation).repeat(64), deliveryId: `synthetic_delivery_${binding.generation}`, envelopeRef: `synthetic_envelope_${binding.generation}` };
          },
          commit: async change => {
            if (fail === "commit") throw new Error("synthetic database failure");
            if (change.expectedRevision !== draft.revision) throw new Error("CAS conflict");
            draft = structuredClone(change.state);
            stagedReceipts.set(change.receipt.commandId, structuredClone(change.receipt));
            stagedCommits.push(structuredClone(change));
          },
        });
        if (fail === "after-stage") throw new Error("synthetic transaction rollback");
        state = draft; receipts = stagedReceipts; commits = stagedCommits;
        return result;
      } finally { release(); }
    },
  };
  const run = (command: unknown, authority: EmailProofAuthority = resume, now = issuedAt) => executeEmailProof(port, command, authority, now, policy);
  const confirm = (): EmailProofCommand => ({ ...baseCommand, type: "confirm", commandId: "synthetic_confirm_0001",
    expectedRevision: state.revision, generation: state.generation, emailRevision: state.emailRevision, digest: state.proof!.digest });
  return { port, run, confirm, state: () => structuredClone(state), commits: () => structuredClone(commits),
    fail: (value: typeof fail) => { fail = value; }, mints: () => mints,
    replaceState: (value: unknown) => { state = value as EmailProofIntentV1; } };
}

describe("pre-Auth email proof v1", () => {
  it("persists a private proof, delivery, receipt and allowlisted event as one plan", async () => {
    const f = fixture();
    expect(await f.run(issue)).toEqual({ schemaVersion: 1, intentId, revision: 1, emailRevision: 0, status: "verification-requested" });
    expect(f.state().proof?.expiresAt).toBe(issuedAt + EMAIL_PROOF_TTL_MS);
    const commit = f.commits()[0]!;
    expect(commit.delivery?.template).toBe("checkout-email-proof-v1");
    expect(Object.keys(commit.event).sort()).toEqual(["actor", "at", "emailRevision", "generation", "intentId", "revision", "type", "version"]);
    expect(JSON.stringify([commit.event, commit.receipt, commit.delivery])).not.toContain(f.state().email);
    expect(JSON.stringify([commit.event, commit.receipt, commit.delivery])).not.toContain(f.state().proof!.digest);
    expect(isCurrentEmailProved(f.state(), 0, issuedAt)).toBe(false);
  });
  it("deduplicates simultaneous identical commands without rotating or emitting twice", async () => {
    const f = fixture();
    const results = await Promise.all([f.run(issue), f.run(issue)]);
    expect(results[0]).toEqual(results[1]); expect(f.commits()).toHaveLength(1); expect(f.mints()).toBe(1);
  });
  it("rejects a divergent replay and two tabs at the same revision", async () => {
    const f = fixture(); await f.run(issue);
    await expect(f.run({ ...issue, expectedRevision: 1 })).rejects.toMatchObject({ code: "COMMAND_CONFLICT" });
    await expect(f.run({ ...issue, commandId: "synthetic_command_0002" })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(f.commits()).toHaveLength(1);
  });
  it("confirms once, returns the same receipt after a lost response, and grants no User/session/payment", async () => {
    const f = fixture(); await f.run(issue); const command = f.confirm();
    const result = await f.run(command, proofAuthority, issuedAt + 1);
    expect(result.status).toBe("email-confirmed");
    expect(await f.run(command, proofAuthority, issuedAt + 2)).toEqual(result);
    expect(f.commits()).toHaveLength(2);
    expect(isCurrentEmailProved(f.state(), 0, issuedAt + EMAIL_PROOF_TTL_MS + 1)).toBe(true);
    expect(Object.keys(result).sort()).toEqual(["emailRevision", "intentId", "revision", "schemaVersion", "status"]);
    await expect(f.run({ ...command, commandId: "synthetic_confirm_0002", expectedRevision: 2 }, proofAuthority, issuedAt + 3))
      .rejects.toMatchObject({ code: "PROOF_INVALID" });
  });
  it.each([-1, 0, 1])("honors the exact expiry boundary, offset %i ms", async offset => {
    const f = fixture(); await f.run(issue);
    const action = f.run(f.confirm(), proofAuthority, issuedAt + EMAIL_PROOF_TTL_MS + offset);
    if (offset < 0) expect((await action).status).toBe("email-confirmed");
    else await expect(action).rejects.toMatchObject({ code: "PROOF_INVALID" });
  });
  it("rotates on controlled resend and rejects the old generation even with its digest", async () => {
    const f = fixture(); await f.run(issue); const stale = f.confirm();
    await expect(f.run({ ...issue, expectedRevision: 1, commandId: "synthetic_command_0002" }, resume, issuedAt + 1))
      .rejects.toMatchObject({ code: "ISSUE_LIMITED" });
    await f.run({ ...issue, expectedRevision: 1, commandId: "synthetic_command_0002" }, resume, issuedAt + policy.cooldownMs);
    await expect(f.run({ ...stale, expectedRevision: 2 }, proofAuthority, issuedAt + policy.cooldownMs + 1))
      .rejects.toMatchObject({ code: "PROOF_INVALID" });
    expect(f.state().generation).toBe(2); expect(f.commits()).toHaveLength(2);
  });
  it("invalidates proof and authority after email change, preserving aliases and resend limits", async () => {
    const f = fixture(); await f.run(issue); const stale = f.confirm();
    await f.run({ ...baseCommand, commandId: "synthetic_change_0001", expectedRevision: 1, type: "change-email", email: " New.Person+Tag@EXAMPLE.INVALID " });
    expect(f.state().email).toBe("New.Person+Tag@example.invalid"); expect(f.state().proof).toBeNull();
    expect(isCurrentEmailProved(f.state(), 0, issuedAt)).toBe(false);
    await expect(f.run(stale, proofAuthority)).rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
    await expect(f.run({ ...issue, commandId: "synthetic_command_0002", expectedRevision: 2 }, resume))
      .rejects.toMatchObject({ code: "ISSUE_LIMITED" });
    await expect(f.run(issue, resume)).rejects.toMatchObject({ code: "PROOF_INVALID" });
  });
  it.each(["mint", "commit", "after-stage"] as const)("does not return success or persist partial changes after %s failure", async failure => {
    const f = fixture(); f.fail(failure);
    await expect(f.run(issue)).rejects.toThrow();
    expect(f.state().revision).toBe(0); expect(f.commits()).toHaveLength(0);
    f.fail("none"); await f.run(issue); expect(f.commits()).toHaveLength(1);
  });
  it.each([
    { ...resume, intentId: "another_intent_0001" },
    { ...resume, scope: "unexpected" },
    { ...resume, mutationOriginVerified: false },
    proofAuthority,
  ])("rejects mismatched authority before making a change", async authority => {
    const f = fixture();
    await expect(f.run(issue, authority as EmailProofAuthority)).rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
    expect(f.commits()).toHaveLength(0);
  });
  it("rejects a different digest without exposing the submitted value", async () => {
    const f = fixture(); await f.run(issue);
    await expect(f.run({ ...f.confirm(), digest: "f".repeat(64) }, proofAuthority)).rejects.toMatchObject({ code: "PROOF_INVALID", message: "PROOF_INVALID" });
    expect(f.commits()).toHaveLength(1);
  });
  it("recovers a lost email-edit response with the same intent capability, without proving the new email", async () => {
    const f = fixture(); await f.run(issue);
    const command = { ...baseCommand, commandId: "synthetic_change_0001", expectedRevision: 1,
      type: "change-email", email: "other@example.invalid" };
    const result = await f.run(command);
    expect(await f.run(command)).toEqual(result);
    expect(f.commits()).toHaveLength(2);
    expect(isCurrentEmailProved(f.state(), 1, issuedAt)).toBe(false);
    await expect(f.run({ ...issue, commandId: "synthetic_command_0002", expectedRevision: 2 }, proofAuthority))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
  });
  it.each([
    { ...issue, schemaVersion: 2 }, { ...issue, price: 1 }, { ...issue, type: "GET" },
    { ...issue, userId: "synthetic_user" }, { ...issue, expectedRevision: -1 },
    { ...issue, type: "confirm", generation: 1, emailRevision: 0, digest: "not-a-digest" },
    { ...issue, type: "change-email", email: "person\r\nBcc:other@example.invalid" },
  ])("refuses unknown fields, methods and malformed commands", value => {
    expect(() => decodeEmailProofCommand(value)).toThrow("INVALID_INPUT");
  });
  it("does not collapse local parts, dots or +aliases for identity deduplication", () => {
    expect(normalizeCheckoutEmail(" First.Last+Test@EXAMPLE.INVALID ")).toBe("First.Last+Test@example.invalid");
  });
  it.each([undefined, false, 0, "", { generation: 0 }])("fails closed on a malformed stored proof", async malformed => {
    const f = fixture(); f.replaceState({ ...f.state(), proof: malformed });
    await expect(f.run(issue)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(f.commits()).toHaveLength(0);
  });
  it("rejects unknown stored fields and generation zero in a shaped proof", async () => {
    const f = fixture(); f.replaceState({ ...f.state(), userId: "unexpected" });
    await expect(f.run(issue)).rejects.toMatchObject({ code: "INVALID_STATE" });
    const g = fixture(); await g.run(issue);
    g.replaceState({ ...g.state(), generation: 0, proof: { ...g.state().proof!, generation: 0 } });
    await expect(g.run(g.confirm(), proofAuthority)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(() => isCurrentEmailProved(g.state(), 0, issuedAt)).toThrow("INVALID_STATE");
  });
});
