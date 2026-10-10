import type { CaptureImageAcceptance, CaptureImageOptions } from "./capture-image-storage-support.mjs";
import type { CaptureNativeContext } from "./capture-task-persistence-support.mjs";
import type { StorageLocalCaseReport } from "./capture-image-storage-local-ci-contract.mjs";
export const STORAGE_NATIVE_AUTH_LIMITS: Readonly<{ requests: 24; bytes: 1048576; timeoutMs: 15000 }>;
export interface NativeCaseSetup { readonly ci: true; readonly githubActions: true; readonly localAuthRun: true; readonly appUrl: "http://127.0.0.1:3117"; readonly supabaseUrl: "http://127.0.0.1:54321"; readonly publishableKey: string; readonly serverSecretKey: string }
export interface VerifiedLocalActor { readonly id: string; readonly sessionId: string; readonly marker: string }
export interface VerifiedLocalActors { readonly a: VerifiedLocalActor; readonly b: VerifiedLocalActor }
export interface NativeCaseOptions { readonly transport: typeof fetch; readonly inspectSql: CaptureImageOptions["inspectSql"]; readonly registerActors: (actors: VerifiedLocalActors) => void | Promise<void>; readonly cleanupAllowed: () => boolean; readonly createAcceptance?: (context: CaptureNativeContext, options: CaptureImageOptions) => Promise<CaptureImageAcceptance> }
export function validateNativeCaseSetup(context: unknown, options: unknown): void;
export function runCaptureImageLocalCase(context: NativeCaseSetup, options: NativeCaseOptions): Promise<Readonly<StorageLocalCaseReport>>;
