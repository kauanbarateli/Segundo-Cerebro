/** Private, pre-Auth contract. Nothing in this module creates a User or a charge.
 * This is not a browser DTO. The server must authenticate the resume capability,
 * validate Origin/CSRF and rate limits before entering the transaction below. */
export const EMAIL_PROOF_VERSION = 1 as const;
export const EMAIL_PROOF_TTL_MS = 30 * 60 * 1000;

export interface EmailProof {
  readonly generation: number;
  readonly emailRevision: number;
  readonly digest: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly confirmedAt: number | null;
  readonly deliveryId: string;
}
export interface EmailProofIntentV1 {
  readonly schemaVersion: 1;
  readonly intentId: string;
  readonly revision: number;
  readonly emailRevision: number;
  /** Private storage only. Preserve dots and +aliases. Never put it in events. */
  readonly email: string;
  readonly generation: number;
  readonly proof: EmailProof | null;
  readonly nextIssueAt: number;
}
export type EmailProofCommand = {
  readonly schemaVersion: 1;
  readonly intentId: string;
  readonly commandId: string;
  readonly expectedRevision: number;
} & (
  | { readonly type: "issue" }
  | { readonly type: "change-email"; readonly email: string }
  | { readonly type: "confirm"; readonly generation: number; readonly emailRevision: number; readonly digest: string }
);
export type EmailProofAuthority = {
  readonly intentId: string;
  /** Verified by the channel, never taken from request JSON. */
  readonly mutationOriginVerified: true;
} & (
  // Intent control survives an email edit, so a lost response can recover its
  // exact receipt. It never proves the new address or authenticates a User.
  | { readonly scope: "resume" }
  | { readonly scope: "email-proof"; readonly emailRevision: number }
);
export interface EmailProofResult {
  readonly schemaVersion: 1;
  readonly intentId: string;
  readonly revision: number;
  readonly emailRevision: number;
  readonly status: "verification-requested" | "email-changed" | "email-confirmed";
}
export interface EmailProofReceipt {
  readonly commandId: string;
  /** Server-keyed commitment to the whole decoded command, not a client hash. */
  readonly commitment: string;
  readonly result: EmailProofResult;
}
export interface EmailProofEvent {
  readonly version: 1;
  readonly actor: "checkout-capability";
  readonly type: "email-proof-issued" | "email-proof-confirmed" | "checkout-email-changed";
  readonly intentId: string;
  readonly revision: number;
  readonly emailRevision: number;
  readonly generation: number;
  readonly at: number;
}
/** Opaque reference to a PRIVATE encrypted delivery envelope. No plaintext token,
 * recipient, URL or reusable credential belongs in the work item or event. */
export interface EmailProofDelivery {
  readonly version: 1;
  readonly template: "checkout-email-proof-v1";
  readonly intentId: string;
  readonly emailRevision: number;
  readonly generation: number;
  readonly deliveryId: string;
  readonly envelopeRef: string;
}
export interface MintedEmailProof {
  readonly digest: string;
  readonly deliveryId: string;
  readonly envelopeRef: string;
}
export interface EmailProofCommit {
  readonly expectedRevision: number;
  readonly state: EmailProofIntentV1;
  readonly event: EmailProofEvent;
  readonly receipt: EmailProofReceipt;
  readonly delivery: EmailProofDelivery | null;
}
export type EmailProofErrorCode = "INVALID_INPUT" | "NOT_AUTHORIZED" | "REVISION_CONFLICT" |
  "COMMAND_CONFLICT" | "PROOF_INVALID" | "ISSUE_LIMITED" | "INVALID_STATE";
export class EmailProofError extends Error {
  constructor(readonly code: EmailProofErrorCode) {
    super(code); this.name = "EmailProofError";
  }
}
function requireProof(condition: unknown, code: EmailProofErrorCode): asserts condition {
  if (!condition) throw new EmailProofError(code);
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k));
const opaque = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(v);
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const time = (v: unknown): v is number => natural(v) && Number(v) <= 8_640_000_000_000_000;

export function normalizeCheckoutEmail(value: unknown): string {
  requireProof(typeof value === "string", "INVALID_INPUT");
  const email = value.trim();
  // Intentionally conservative mailbox syntax. Do not canonicalize the local
  // part, strip aliases, infer ownership or use this as an Auth lookup result.
  requireProof(email.length <= 254 && /^[^\s@<>\u0000-\u001f\u007f]+@[^\s@<>\u0000-\u001f\u007f]+\.[^\s@<>\u0000-\u001f\u007f]+$/.test(email), "INVALID_INPUT");
  const at = email.lastIndexOf("@");
  return email.slice(0, at) + "@" + email.slice(at + 1).toLowerCase();
}
export function decodeEmailProofCommand(value: unknown): EmailProofCommand {
  requireProof(object(value), "INVALID_INPUT");
  const common = ["schemaVersion", "intentId", "commandId", "expectedRevision", "type"];
  const extra = value.type === "confirm" ? ["generation", "emailRevision", "digest"] : value.type === "change-email" ? ["email"] : [];
  requireProof(Object.keys(value).length === common.length + extra.length && Object.keys(value).every(k => [...common, ...extra].includes(k)), "INVALID_INPUT");
  requireProof(value.schemaVersion === 1 && opaque(value.intentId) && opaque(value.commandId) && natural(value.expectedRevision), "INVALID_INPUT");
  requireProof(["issue", "confirm", "change-email"].includes(String(value.type)), "INVALID_INPUT");
  if (value.type === "confirm") requireProof(natural(value.generation) && value.generation > 0 && natural(value.emailRevision) && digest(value.digest), "INVALID_INPUT");
  if (value.type === "change-email") return { ...value, email: normalizeCheckoutEmail(value.email) } as EmailProofCommand;
  return { ...value } as EmailProofCommand;
}
function validateState(state: EmailProofIntentV1, now: number) {
  requireProof(object(state) && exact(state, ["schemaVersion", "intentId", "revision", "emailRevision", "email", "generation", "proof", "nextIssueAt"]) &&
    state.schemaVersion === 1 && opaque(state.intentId) && natural(state.revision) &&
    natural(state.emailRevision) && natural(state.generation) && time(state.nextIssueAt) && time(now), "INVALID_STATE");
  requireProof(normalizeCheckoutEmail(state.email) === state.email, "INVALID_STATE");
  const p = state.proof;
  requireProof(p === null || object(p), "INVALID_STATE");
  if (p !== null) requireProof(exact(p, ["generation", "emailRevision", "digest", "issuedAt", "expiresAt", "confirmedAt", "deliveryId"]) &&
    natural(p.generation) && p.generation > 0 && p.generation === state.generation && p.emailRevision === state.emailRevision &&
    digest(p.digest) && opaque(p.deliveryId) && time(p.issuedAt) && p.issuedAt <= now &&
    p.expiresAt === p.issuedAt + EMAIL_PROOF_TTL_MS && time(p.expiresAt) &&
    (p.confirmedAt === null || time(p.confirmedAt) && p.confirmedAt >= p.issuedAt && p.confirmedAt < p.expiresAt && p.confirmedAt <= now), "INVALID_STATE");
}

/** One adapter transaction MUST lock the intent and atomically persist CAS state,
 * receipt, event, delivery and its sealed envelope. Minting has no network effect.
 * An exception (including commit uncertainty) must never be translated to success.
 * No production implementation or migration is supplied by this first slice. */
export interface EmailProofTransaction {
  loadForUpdate(intentId: string): Promise<EmailProofIntentV1>;
  receipt(intentId: string, commandId: string): Promise<EmailProofReceipt | null>;
  mint(binding: { intentId: string; emailRevision: number; generation: number; expiresAt: number }): Promise<MintedEmailProof>;
  commit(change: EmailProofCommit): Promise<void>;
}
export interface EmailProofPort {
  transaction<T>(run: (tx: EmailProofTransaction) => Promise<T>): Promise<T>;
  commitment(command: EmailProofCommand): Promise<string>;
  equalDigest(left: string, right: string): boolean;
}
export interface EmailProofIssuePolicy {
  /** Server policy; positive cooldown is mandatory. Abuse limits additionally
   * cover destination and origin in the channel before this use case. */
  readonly cooldownMs: number;
}

export async function executeEmailProof(
  port: EmailProofPort, input: unknown, authority: EmailProofAuthority, now: number, policy: EmailProofIssuePolicy,
): Promise<EmailProofResult> {
  const command = decodeEmailProofCommand(input);
  requireProof(authority.mutationOriginVerified === true && authority.intentId === command.intentId &&
    (command.type === "confirm" ? authority.scope === "email-proof" : authority.scope === "resume"), "NOT_AUTHORIZED");
  requireProof(time(now) && Number.isSafeInteger(policy.cooldownMs) && policy.cooldownMs > 0 && policy.cooldownMs <= EMAIL_PROOF_TTL_MS, "INVALID_INPUT");
  const commitment = await port.commitment(command);
  requireProof(digest(commitment), "INVALID_STATE");
  return port.transaction(async tx => {
    const state = await tx.loadForUpdate(command.intentId);
    validateState(state, now);
    requireProof(state.intentId === authority.intentId &&
      (authority.scope === "resume" || state.emailRevision === authority.emailRevision), "NOT_AUTHORIZED");
    if (command.type === "confirm") requireProof(command.emailRevision === state.emailRevision &&
      state.proof && command.generation === state.proof.generation && port.equalDigest(command.digest, state.proof.digest), "PROOF_INVALID");
    // Authenticate before reading a receipt; replay never bypasses possession.
    const previous = await tx.receipt(command.intentId, command.commandId);
    if (previous) {
      requireProof(previous.commandId === command.commandId && previous.result.intentId === state.intentId &&
        previous.result.emailRevision === state.emailRevision, "PROOF_INVALID");
      requireProof(previous.commitment === commitment, "COMMAND_CONFLICT");
      return previous.result;
    }
    requireProof(state.revision === command.expectedRevision, "REVISION_CONFLICT");
    let next: EmailProofIntentV1;
    let delivery: EmailProofDelivery | null = null;
    let status: EmailProofResult["status"];
    let eventType: EmailProofEvent["type"];
    if (command.type === "issue") {
      requireProof(now >= state.nextIssueAt, "ISSUE_LIMITED");
      requireProof(state.proof?.confirmedAt == null, "PROOF_INVALID");
      const generation = state.generation + 1;
      requireProof(natural(generation) && time(now + EMAIL_PROOF_TTL_MS), "INVALID_STATE");
      const material = await tx.mint({ intentId: state.intentId, emailRevision: state.emailRevision, generation, expiresAt: now + EMAIL_PROOF_TTL_MS });
      requireProof(object(material) && exact(material, ["digest", "deliveryId", "envelopeRef"]) &&
        digest(material.digest) && opaque(material.deliveryId) && opaque(material.envelopeRef) &&
        material.digest !== state.proof?.digest && material.deliveryId !== state.proof?.deliveryId, "INVALID_STATE");
      next = { ...state, revision: state.revision + 1, generation, nextIssueAt: now + policy.cooldownMs,
        proof: { generation, emailRevision: state.emailRevision, digest: material.digest, issuedAt: now,
          expiresAt: now + EMAIL_PROOF_TTL_MS, confirmedAt: null, deliveryId: material.deliveryId } };
      delivery = { version: 1, template: "checkout-email-proof-v1", intentId: state.intentId,
        emailRevision: state.emailRevision, generation, deliveryId: material.deliveryId, envelopeRef: material.envelopeRef };
      status = "verification-requested"; eventType = "email-proof-issued";
    } else if (command.type === "change-email") {
      requireProof(command.email !== state.email, "INVALID_INPUT");
      // Keep the resend fence across edits: changing email cannot evade limits.
      next = { ...state, revision: state.revision + 1, emailRevision: state.emailRevision + 1, email: command.email, proof: null };
      status = "email-changed"; eventType = "checkout-email-changed";
    } else {
      const proof = state.proof;
      requireProof(proof && proof.confirmedAt === null && now < proof.expiresAt, "PROOF_INVALID");
      next = { ...state, revision: state.revision + 1, proof: { ...proof, confirmedAt: now } };
      status = "email-confirmed"; eventType = "email-proof-confirmed";
    }
    requireProof(natural(next.revision) && natural(next.emailRevision), "INVALID_STATE");
    const result: EmailProofResult = { schemaVersion: 1, intentId: next.intentId, revision: next.revision, emailRevision: next.emailRevision, status };
    await tx.commit({ expectedRevision: state.revision, state: next,
      event: { version: 1, actor: "checkout-capability", type: eventType, intentId: next.intentId,
        revision: next.revision, emailRevision: next.emailRevision, generation: next.generation, at: now },
      receipt: { commandId: command.commandId, commitment, result }, delivery });
    return result;
  });
}

/** Payment consumers must reload CURRENT authoritative state. A successful
 * command receipt is historical evidence, never permission to charge or login. */
export function isCurrentEmailProved(state: EmailProofIntentV1, expectedEmailRevision: number, now: number): boolean {
  validateState(state, now);
  return state.emailRevision === expectedEmailRevision && state.proof?.confirmedAt != null;
}
