import "server-only";
import { readAuthConfiguration } from "./config";
import { signupEnabled } from "./signup-http";

/** The candidate stays closed unless server configuration explicitly opens it. */
export function signupAvailable(): boolean {
  try { const config = readAuthConfiguration(); return config.mode === "supabase" && signupEnabled(config); } catch { return false; }
}
