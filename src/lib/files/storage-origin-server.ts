import "server-only";
import type { SupabaseAuthConfig } from "../auth/config";
import { LOCAL_STORAGE_ORIGIN, type StorageOrigin } from "./storage-origin";
import { requiresIsolatedDestination, trustedHostedDatabaseOrigin } from "../environment/application-destination";
import { isLocalFilesEnvironment } from "./storage-local-policy";

type Environment = Readonly<Record<string, string | undefined>>;

/** Unavailable Storage must not block unrelated authenticated workspace pages.
 * Factories require a resolved origin before constructing their SDK client. */
export function resolveStorageOrigin(config: Pick<SupabaseAuthConfig, "supabaseUrl" | "appOrigin">, environment: Environment = process.env, platform: NodeJS.Platform = process.platform): StorageOrigin | undefined {
  const hosted = trustedHostedDatabaseOrigin(config, environment);
  if (hosted) return hosted;
  if (requiresIsolatedDestination(environment, config)) return undefined;
  if (platform !== "linux" || !isLocalFilesEnvironment(config, environment)) return undefined;
  return LOCAL_STORAGE_ORIGIN;
}
