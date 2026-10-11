export type AuthEffectOperation = "login" | "login-drive" | "password-change" | "recovery-password" | "old-password";
export type AuthEffectEvent = "request" | "requestfinished" | "requestfailed";
export type AuthEffectUnknownCode = "OBSERVATION_REFUSED" | "COMPLETION_TIMEOUT" | "REQUEST_FAILED" | "RESPONSE_REFUSED" | "ORACLE_REFUSED";
export type AuthEffectUnknown = Readonly<{ status: "unknown"; code: AuthEffectUnknownCode }>;
export type AuthEffectRequest = Readonly<{ method(): string; url(): string; failure(): unknown }>;
export type AuthEffectResponse = Readonly<{ request(): AuthEffectRequest; status(): number; url(): string; allHeaders(): Promise<Record<string, string>> }>;
export type AuthEffectPage = Readonly<{
  url(): string;
  on(event: AuthEffectEvent, handler: (request: AuthEffectRequest) => void): unknown;
  off(event: AuthEffectEvent, handler: (request: AuthEffectRequest) => void): unknown;
}>;
declare const receiptBrand: unique symbol;
/** This local brand is backed by the implementation's WeakMap. It establishes
 * single-use protocol provenance, never Auth identity or a real CI outcome. */
export type AuthEffectReceipt = Readonly<{
  [receiptBrand]: true;
  status: "observed";
  operation: AuthEffectOperation;
  transport: "finished" | "aborted-candidate";
}>;
export type AuthEffectObservation = Readonly<{
  observe(request: AuthEffectRequest, response: AuthEffectResponse): Promise<AuthEffectReceipt | AuthEffectUnknown>;
  /** Request identity only; never proof of transport or Auth effect. False after disposal. */
  owns(request: AuthEffectRequest): boolean;
  dispose(): void;
}>;
export function prepareAuthEffectObservation(options: Readonly<{
  page: AuthEffectPage;
  operation: AuthEffectOperation;
  prerequisite: () => Promise<boolean>;
  timeoutMs?: number;
}>): Promise<AuthEffectObservation>;
export const PASSWORD_EFFECT_CHECKPOINTS: readonly ["terminal-notice-and-cookies", "old-a-denied", "b-intact", "old-password-denied", "new-password-login", "new-session-distinct", "new-a-protected"];
export type AuthEffectCheckpoint = "old-a-denied" | "b-intact" | "new-session-distinct" | "new-a-protected";
export type AuthEffectKnown = Readonly<{ status: "known"; operation: AuthEffectOperation }>;
export type AuthEffectPending = Readonly<{ status: "pending-password-effect"; operation?: "password-change" }>;
export type AuthEffectMetadata = Readonly<{
  authWriteOutcomeUncertain: boolean;
  pendingPasswordEffect: boolean;
  passwordCheckpoints: number;
  failed: boolean;
  disposed: boolean;
}>;
/** Callbacks are mandatory, explicit, bounded reads by the actual GUI/SDK
 * caller. Literal true alone is not proof that those reads were performed. */
export type AuthEffectLedger = Readonly<{
  begin(operation: Exclude<AuthEffectOperation, "recovery-password">): Readonly<{ status: "armed" }> | AuthEffectUnknown;
  confirmLogin(receipt: AuthEffectReceipt, oracles: Readonly<{
    destination: () => Promise<boolean>;
    newSessionIdentityAndAccess: () => Promise<boolean>;
    protectedSameSession: () => Promise<boolean>;
  }>): Promise<AuthEffectKnown | AuthEffectUnknown>;
  confirmDriveLogin(receipt: AuthEffectReceipt, oracles: Readonly<{
    destination: () => Promise<boolean>;
    newSessionIdentityAndAccess: () => Promise<boolean>;
    protectedSameSession: () => Promise<boolean>;
  }>): Promise<AuthEffectKnown | AuthEffectUnknown>;
  confirmPasswordTerminal(receipt: AuthEffectReceipt, terminalNoticeAndCookies: () => Promise<boolean>): Promise<AuthEffectPending | AuthEffectUnknown>;
  confirmOldPasswordRefusal(receipt: AuthEffectReceipt, genericRefusalAndNoSession: () => Promise<boolean>): Promise<AuthEffectKnown | AuthEffectUnknown>;
  checkpoint(name: AuthEffectCheckpoint, oracle: () => Promise<boolean>): Promise<AuthEffectPending | AuthEffectKnown | AuthEffectUnknown>;
  metadata(): AuthEffectMetadata;
  cleanupMayProceed(rlsOutcomeUncertain: boolean): boolean;
  dispose(): void;
}>;
export function createAuthEffectLedger(): AuthEffectLedger;
export type RecoveryEffectLedger = Readonly<{
  begin(): Readonly<{ status: "armed" }> | AuthEffectUnknown;
  confirmResetEffect(receipt: AuthEffectReceipt, oracles: Readonly<{
    terminalNoticeAndCookies: () => Promise<boolean>;
    revokedSessionsAndReceipt: () => Promise<boolean>;
    oldPasswordDenied: () => Promise<boolean>;
    newSessionProtectedAndReceipt: () => Promise<boolean>;
  }>): Promise<AuthEffectKnown | AuthEffectUnknown>;
  metadata(): Readonly<Pick<AuthEffectMetadata, "authWriteOutcomeUncertain" | "pendingPasswordEffect" | "failed" | "disposed">>;
  cleanupMayProceed(rlsOutcomeUncertain: boolean): boolean;
  dispose(): void;
}>;
export function createRecoveryEffectLedger(): RecoveryEffectLedger;
