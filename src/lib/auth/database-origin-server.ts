import "server-only";
import type { SupabaseAuthConfig } from "./config";
import { requiresIsolatedDestination, trustedHostedDatabaseOrigin } from "../environment/application-destination";

type Environment = Readonly<Record<string, string | undefined>>;
const LOCAL_DATABASE_ORIGIN = "http://127.0.0.1:54321";
const LOCAL_ADMIN_APP_ORIGIN = "http://127.0.0.1:3117";
const FOREIGN_ENV = /^(?:VERCEL|NETLIFY|CF_PAGES|GOOGLE_|SENTRY_|OPENAI_|AWS_|AZURE_|GH_TOKEN$|GITHUB_TOKEN$|NEXT_PUBLIC_|PG[A-Z_]*$|DATABASE_URL$|DOCKER_|CONTAINER_HOST$|SC_VERIFY_|SC_BACKUP_|SC_RELEASE_|SC_AUTH_LIVE_)/;
const LOCAL_SUPABASE_ENV = new Set(["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]);
const value = (descriptors: PropertyDescriptorMap, name: string): unknown => {
  const descriptor = descriptors[name];
  return descriptor?.enumerable && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
};

/** Hosted production/homologation use their exact independent destination policy. The local exception
 * belongs exclusively to the existing disposable Linux Admin browser job; this
 * environment boundary is not proof of its catalog, actors or cleanup. */
export function isTrustedDatabaseOrigin(config: SupabaseAuthConfig, environment: Environment = process.env, platform: NodeJS.Platform = process.platform): boolean {
  const configFields = Object.getOwnPropertyDescriptors(config);
  if (isTrustedHostedDatabaseOrigin(config, environment)) return true;
  if (requiresIsolatedDestination(environment, config)) return false;
  const fields = Object.getOwnPropertyDescriptors(environment), names = Reflect.ownKeys(fields);
  if (names.some(name => { const descriptor = typeof name === "string" ? fields[name] : undefined; return !descriptor?.enumerable || !Object.hasOwn(descriptor, "value") || descriptor.value !== undefined && typeof descriptor.value !== "string"; })) return false;
  const read = (name: string) => value(fields, name);
  if (platform !== "linux" || value(configFields, "mode") !== "supabase" || value(configFields, "supabaseUrl") !== LOCAL_DATABASE_ORIGIN || value(configFields, "appOrigin") !== LOCAL_ADMIN_APP_ORIGIN || value(configFields, "secureCookies") !== false || read("NODE_ENV") !== "development" || read("APP_MODE") !== "supabase" || read("APP_URL") !== LOCAL_ADMIN_APP_ORIGIN || read("SUPABASE_URL") !== LOCAL_DATABASE_ORIGIN || read("CI") !== "true" || read("GITHUB_ACTIONS") !== "true" || read("SC_AUTH_LOCAL_CI_RUN") !== "1" || read("SC_ADMIN_BROWSER_LOCAL_CI_RUN") !== "1" || read("SC_ADMIN_BROWSER_RUN") !== "1") return false;
  const caseName = read("SC_ADMIN_BROWSER_CASE"), namespace = read("SC_ADMIN_BROWSER_NAMESPACE"), project = read("SC_ADMIN_BROWSER_PROJECT"), system = read("SC_ADMIN_BROWSER_SYSTEM"), sha = read("GITHUB_SHA");
  if (typeof caseName !== "string" || !["BLOCK_LIVE_BROWSER", "FIRST_FORCED_BROWSER"].includes(caseName) || typeof namespace !== "string" || !/^sc-admin-native-[a-f0-9]{32}$/.test(namespace) || typeof project !== "string" || !/^sc-auth-ci-[a-f0-9]{24}$/.test(project) || typeof system !== "string" || !/^[0-9]{16,20}$/.test(system) || typeof sha !== "string" || !/^[a-f0-9]{40}$/.test(sha)) return false;
  const publishable = read("SUPABASE_PUBLISHABLE_KEY"), secret = read("SUPABASE_SECRET_KEY"), state = read("AUTH_STATE_SECRET"), rate = read("AUTH_RATE_LIMIT_SECRET"), admin = read("ADMIN_COMMAND_SECRET");
  if (typeof publishable !== "string" || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(publishable) || typeof secret !== "string" || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(secret) || publishable !== value(configFields, "publishableKey") || secret !== value(configFields, "secretKey") || state !== value(configFields, "stateSecret") || rate !== value(configFields, "rateLimitSecret") || [state, rate, admin].some(item => typeof item !== "string" || new TextEncoder().encode(item).length < 32) || new Set([state, rate, admin, secret]).size !== 4) return false;
  return !names.some(name => typeof name !== "string" || read(name) !== undefined && read(name) !== "" && (FOREIGN_ENV.test(name) || name.startsWith("SUPABASE_") && !LOCAL_SUPABASE_ENV.has(name)));
}

/** Hosted only: never exports the disposable Admin capability to domain adapters. */
export function isTrustedHostedDatabaseOrigin(config: Pick<SupabaseAuthConfig, "supabaseUrl" | "appOrigin">, environment: Environment = process.env): boolean {
  return trustedHostedDatabaseOrigin(config, environment) !== undefined;
}
