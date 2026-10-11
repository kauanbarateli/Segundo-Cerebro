import type { AvatarStorageReport } from "./avatar-storage-contract.mjs";
export const AVATAR_API: "http://127.0.0.1:54321";
export const AVATAR_BUCKETS: readonly ["second-brain-staging", "second-brain-files"];
export type AvatarQuery = "BASELINE" | "FINALIZED" | "LINKED" | "UNLINKED" | "STAGING_ABSENT" | "FINAL_ABSENT" | "AUTH_ABSENT";
export const AVATAR_SQL_QUERIES: readonly AvatarQuery[];
export interface AvatarActor { readonly id: string; readonly sessionId: string; readonly marker: string }
export interface AvatarActors { readonly a: AvatarActor; readonly b: AvatarActor }
export interface AvatarContext {
  readonly ci: true; readonly githubActions: true; readonly localAuthRun: true; readonly localAvatarRun: true;
  readonly supabaseUrl: typeof AVATAR_API; readonly sourceSha: string; readonly namespace: string;
  readonly systemIdentifier: string; readonly publishableKey: string; readonly serverSecretKey: string;
}
export interface AvatarPorts {
  readonly transport: typeof fetch;
  readonly registerActors: (actors: AvatarActors) => void | Promise<void>;
  readonly inspect: (query: AvatarQuery, request: Readonly<{ actors: AvatarActors; uploadId: string }>) => Promise<unknown>;
  readonly cleanupAllowed: () => boolean;
}
export function validateAvatarSetup(context: unknown, ports: unknown): void;
export function acceptsAvatarStorageAbsence(httpStatus: unknown, body: unknown, catalogueEmpty: unknown): boolean;
export interface AvatarGateMetadata { readonly counts: Readonly<Record<"authRequests" | "rpcRequests" | "publicRequests" | "storageRequests", number>>; readonly pending: number; readonly unknown: boolean; readonly deadlineRefused: boolean }
export interface AvatarRequest {
  readonly category: "authRequests" | "rpcRequests" | "publicRequests" | "storageRequests";
  readonly method: "GET" | "POST" | "PUT" | "DELETE";
  readonly url: string; readonly write: boolean; readonly capability?: boolean;
  readonly key?: string; readonly bearer?: string; readonly body?: unknown;
  readonly checkBody?: (body: BodyInit | null | undefined, headers: Headers) => void | Promise<void>;
  readonly checkResponse?: (httpStatus: number, bytes: Uint8Array, headers: Headers) => void;
  observedStatus?: number;
}
export interface AvatarRequestGate {
  readonly fetch: typeof fetch;
  readonly request: <T>(specification: AvatarRequest, operation: () => Promise<T>) => Promise<T>;
  readonly active: () => void; readonly uncertain: () => void; readonly deadline: () => void;
  readonly remaining: () => number; readonly metadata: () => AvatarGateMetadata;
  readonly settle: () => Promise<boolean>; readonly close: () => void;
}
export function createAvatarRequestGate(context: Readonly<{ supabaseUrl: typeof AVATAR_API }>, transport: typeof fetch, options?: Readonly<{ now?: () => number; ioMs?: number; caseMs?: number }>): AvatarRequestGate;
export interface AvatarCase {
  readonly run: () => Promise<AvatarStorageReport>;
  readonly metadata: () => AvatarGateMetadata & Readonly<{ pendingInspections: number; modules: readonly string[] }>;
  readonly settle: () => Promise<boolean>;
  readonly dispose: () => void;
}
export function createAvatarStorageCase(context: AvatarContext, ports: AvatarPorts): Promise<AvatarCase>;
