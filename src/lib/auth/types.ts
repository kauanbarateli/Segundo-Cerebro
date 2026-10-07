import type { Entitlements } from "../../core/access/resolve-access";

/** Safe values for forms. Never add session, token, key, or provider error fields. */
export interface AuthActionState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "confirmPassword" | "currentPassword", string>>;
  retryAfterSeconds?: number;
  completionPending?: boolean;
}

/** Server identity; do not pass this complete object to a client component. */
export interface AuthenticatedIdentity {
  userId: string;
  sessionId: string;
  email?: string;
  mustChangePassword: boolean;
  role?: "user" | "master";
  entitlements?: Entitlements;
}

export class AuthGuardError extends Error {
  constructor(readonly code: "unauthenticated" | "unavailable" | "forbidden" | "demo") {
    super("Autenticação indisponível para esta operação.");
    this.name = "AuthGuardError";
  }
}

export type AuthActionOutcome = { state: AuthActionState } | { redirectTo: string };
