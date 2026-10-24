/** Public destination facts only: no SDK, secret, process.env or I/O. Shared by
 * the build validator, Edge middleware and server factories. */
export const PERSONAL_DATABASE_ORIGIN = "https://rishenjoikgmfubmnfiu.supabase.co";
export const HOMOLOGATION_DATABASE_ORIGIN = "https://twrydxsdemaykgvdlpyd.supabase.co";
export const HOMOLOGATION_BRANCH = "codex/homologacao-twry-20261022";
export const HOMOLOGATION_PROJECT = "prj_68nPrMlzdTLhvhXF2zWvNK6BFaW2";
export type HostedDatabaseOrigin = typeof PERSONAL_DATABASE_ORIGIN | typeof HOMOLOGATION_DATABASE_ORIGIN;
type Fields = Readonly<Record<string, unknown>>;
const ENVIRONMENT_FIELDS = ["APP_DEPLOYMENT_TARGET", "APP_MODE", "APP_URL", "SUPABASE_URL", "NODE_ENV", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV", "VERCEL_PROJECT_ID", "VERCEL_GIT_PROVIDER", "VERCEL_GIT_REPO_OWNER", "VERCEL_GIT_REPO_SLUG", "VERCEL_GIT_COMMIT_REF", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;

function fields(value: unknown, names: readonly string[], stringsOnly: boolean): Fields | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  try {
    for (const name of names) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor && name in value) return undefined;
      if (descriptor && (!descriptor.enumerable || !Object.hasOwn(descriptor, "value"))) return undefined;
      const item: unknown = descriptor?.value;
      if (stringsOnly && item !== undefined && typeof item !== "string") return undefined;
      result[name] = item;
    }
    return result;
  } catch { return undefined; }
}
function isolatedRequired(environment: Fields, config: Fields | undefined): boolean {
  return environment.APP_DEPLOYMENT_TARGET !== undefined || environment.VERCEL_GIT_COMMIT_REF === HOMOLOGATION_BRANCH ||
    environment.SUPABASE_URL === HOMOLOGATION_DATABASE_ORIGIN || config?.supabaseUrl === HOMOLOGATION_DATABASE_ORIGIN ||
    (environment.VERCEL_ENV === "preview" && (environment.APP_MODE === "supabase" || config?.mode === "supabase"));
}

/** An incomplete/hostile relevant record must not select a production fallback.
 * Ordinary credential-free demo previews and existing local CI are unchanged. */
export function requiresIsolatedDestination(environment: unknown, configuration?: unknown): boolean {
  const env = fields(environment, ENVIRONMENT_FIELDS, true);
  const config = configuration === undefined ? undefined : fields(configuration, ["supabaseUrl", "appOrigin", "mode", "secureCookies"], false);
  return !env || (configuration !== undefined && !config) || isolatedRequired(env, config);
}

function homologationOrigin(environment: Fields): string | undefined {
  if (environment.APP_DEPLOYMENT_TARGET !== "homologation" || environment.APP_MODE !== "supabase" || environment.NODE_ENV !== "production" ||
      environment.SUPABASE_URL !== HOMOLOGATION_DATABASE_ORIGIN || environment.VERCEL !== "1" || environment.VERCEL_ENV !== "preview" ||
      (environment.VERCEL_TARGET_ENV !== undefined && environment.VERCEL_TARGET_ENV !== "preview") ||
      environment.VERCEL_PROJECT_ID !== HOMOLOGATION_PROJECT || environment.VERCEL_GIT_PROVIDER !== "github" ||
      environment.VERCEL_GIT_REPO_OWNER !== "kauanbarateli" || environment.VERCEL_GIT_REPO_SLUG !== "Segundo-Cerebro" ||
      environment.VERCEL_GIT_COMMIT_REF !== HOMOLOGATION_BRANCH) return undefined;
  const branchUrl = environment.VERCEL_BRANCH_URL;
  if (typeof branchUrl !== "string" || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+vercel\.app$/.test(branchUrl) ||
      !branchUrl.includes("-git-") || branchUrl === environment.VERCEL_PROJECT_PRODUCTION_URL) return undefined;
  const origin = "https://" + branchUrl;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.hostname !== branchUrl || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash || environment.APP_URL !== origin) return undefined;
    return origin;
  } catch { return undefined; }
}

export function isolatedApplicationOrigin(environment: unknown): string | undefined {
  const env = fields(environment, ENVIRONMENT_FIELDS, true);
  return env ? homologationOrigin(env) : undefined;
}

export function trustedHostedDatabaseOrigin(configuration: unknown, environment: unknown): HostedDatabaseOrigin | undefined {
  const env = fields(environment, ENVIRONMENT_FIELDS, true);
  const config = fields(configuration, ["supabaseUrl", "appOrigin", "mode", "secureCookies"], false);
  if (!env || !config) return undefined;
  if (isolatedRequired(env, config)) {
    const origin = homologationOrigin(env);
    return origin && config.appOrigin === origin && config.supabaseUrl === HOMOLOGATION_DATABASE_ORIGIN &&
      (config.mode === undefined || config.mode === "supabase") && (config.secureCookies === undefined || config.secureCookies === true)
      ? HOMOLOGATION_DATABASE_ORIGIN : undefined;
  }
  return config.supabaseUrl === PERSONAL_DATABASE_ORIGIN ? PERSONAL_DATABASE_ORIGIN : undefined;
}

/** Preview/homologation is checked before constructing even an Auth SDK client.
 * Other Auth local/demo/production behavior remains governed by its old policy. */
export function authDeploymentAllowed(environment: unknown, configuration?: unknown): boolean {
  if (!requiresIsolatedDestination(environment, configuration)) return true;
  if (configuration !== undefined) return trustedHostedDatabaseOrigin(configuration, environment) === HOMOLOGATION_DATABASE_ORIGIN;
  return isolatedApplicationOrigin(environment) !== undefined;
}
