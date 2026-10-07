import type { AuthFlow } from "./flow-state";
import type { AuthenticatedIdentity } from "./types";

export interface AuthGateway {
  readIdentity(): Promise<AuthenticatedIdentity | null>;
  signIn(email: string, password: string): Promise<boolean>;
  requestRecovery(email: string, redirectTo: string): Promise<void>;
  exchangeCode(code: string, flowId?: string): Promise<boolean>;
  updatePassword(password: string, currentPassword?: string): Promise<boolean>;
  signOut(scope: "local" | "global" | "others"): Promise<boolean>;
  completePasswordChange(identity: AuthenticatedIdentity, clientId: string): Promise<void>;
}
export interface AuthFlowStore {
  get(kind: AuthFlow["kind"]): AuthFlow | null;
  put(flow: AuthFlow): void;
  clear(kind: AuthFlow["kind"]): void;
  clearSessionCookies(): void;
}
export interface AuthServices {
  gateway: AuthGateway;
  flows: AuthFlowStore;
  appOrigin: string;
  stateSecret: string;
  now(): number;
  randomId(): string;
  limit(kind: "login" | "recovery" | "password", subject: string, identity?: AuthenticatedIdentity): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}
