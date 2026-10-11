import "server-only";
import type { SupabaseAuthConfig } from "../auth/config";
import { LOCAL_STORAGE_ORIGIN, PERSONAL_STORAGE_ORIGIN, type StorageOrigin } from "./storage-origin";

type Environment = Readonly<Record<string, string | undefined>>;
const LOCAL_APP_ORIGIN = "http://127.0.0.1:3117";
const FOREIGN_ENV = /^(?:VERCEL|NETLIFY|CF_PAGES|GOOGLE_|SENTRY_|OPENAI_|AWS_|AZURE_|GH_TOKEN$|GITHUB_TOKEN$|NEXT_PUBLIC_|PG[A-Z_]*$|DATABASE_URL$|DOCKER_|CONTAINER_HOST$|SC_VERIFY_|SC_BACKUP_|SC_RELEASE_|SC_AUTH_LIVE_)/;
const LOCAL_SUPABASE_ENV = new Set(["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]);

/** Unavailable Storage must not block unrelated authenticated workspace pages.
 * Factories require a resolved origin before constructing their SDK client. */
export function resolveStorageOrigin(config: Pick<SupabaseAuthConfig, "supabaseUrl" | "appOrigin">, environment: Environment = process.env, platform: NodeJS.Platform = process.platform): StorageOrigin | undefined {
  if (config.supabaseUrl === PERSONAL_STORAGE_ORIGIN) return PERSONAL_STORAGE_ORIGIN;
  if (config.supabaseUrl !== LOCAL_STORAGE_ORIGIN || config.appOrigin !== LOCAL_APP_ORIGIN || platform !== "linux" || environment.NODE_ENV !== "development" || environment.APP_MODE !== "supabase" || environment.APP_URL !== LOCAL_APP_ORIGIN || environment.SUPABASE_URL !== LOCAL_STORAGE_ORIGIN || environment.CI !== "true" || environment.GITHUB_ACTIONS !== "true" || environment.SC_AUTH_LOCAL_CI_RUN !== "1" || environment.SC_FILES_LOCAL_CI_RUN !== "1") return undefined;
  if (Object.entries(environment).some(([name, value]) => value !== undefined && value !== "" && (FOREIGN_ENV.test(name) || name.startsWith("SUPABASE_") && !LOCAL_SUPABASE_ENV.has(name)))) return undefined;
  return LOCAL_STORAGE_ORIGIN;
}
