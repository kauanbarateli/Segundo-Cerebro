import type { OwnSessionsView } from "../../../core/configuracoes/own-sessions";
export type { OwnSessionsView } from "../../../core/configuracoes/own-sessions";

/** Presentation state; shares only the reduced DTO type with the separate Core. */
export type OwnSessionsState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly snapshot: OwnSessionsView }
  | { readonly status: "error"; readonly reason: "unavailable" | "session-changed" };
export type OwnSessionsReadResult =
  | { readonly ok: true; readonly snapshot: OwnSessionsView }
  | { readonly ok: false; readonly reason: "unavailable" | "session-changed" };
/** Caller validates the closed DTO before resolving. No RPC or identity here. */
export type OwnSessionsReader = (signal: AbortSignal) => Promise<OwnSessionsReadResult>;
