import { LOCAL_STORAGE_ORIGIN } from "./storage-origin";

export const LOCAL_FILES_APP_ORIGIN = "http://127.0.0.1:3117";
type Environment = Readonly<Record<string, string | undefined>>;
const FOREIGN_ENV = /^(?:VERCEL|NETLIFY|CF_PAGES|GOOGLE_|SENTRY_|OPENAI_|AWS_|AZURE_|GH_TOKEN$|GITHUB_TOKEN$|NEXT_PUBLIC_|PG[A-Z_]*$|DATABASE_URL$|DOCKER_|CONTAINER_HOST$|SC_VERIFY_|SC_BACKUP_|SC_RELEASE_|SC_AUTH_LIVE_)/;
const LOCAL_SUPABASE_ENV = new Set(["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]);

/** Shared environment boundary; the Node factory separately requires Linux.
 * Edge does not expose process.platform. This grants no SDK or database access. */
export function isLocalFilesEnvironment(config: { supabaseUrl?: string; appOrigin?: string }, environment: Environment): boolean {
  if (config.supabaseUrl !== LOCAL_STORAGE_ORIGIN || config.appOrigin !== LOCAL_FILES_APP_ORIGIN || environment.NODE_ENV !== "development" || environment.APP_MODE !== "supabase" || environment.APP_URL !== LOCAL_FILES_APP_ORIGIN || environment.SUPABASE_URL !== LOCAL_STORAGE_ORIGIN || environment.CI !== "true" || environment.GITHUB_ACTIONS !== "true" || environment.SC_AUTH_LOCAL_CI_RUN !== "1" || environment.SC_FILES_LOCAL_CI_RUN !== "1") return false;
  return !Object.entries(environment).some(([name, value]) => value !== undefined && value !== "" && (FOREIGN_ENV.test(name) || name.startsWith("SUPABASE_") && !LOCAL_SUPABASE_ENV.has(name)));
}
