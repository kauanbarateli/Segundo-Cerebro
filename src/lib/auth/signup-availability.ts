import "server-only";
import { readAuthConfiguration } from "./config";
import { signupSameBrowserEnabled } from "./signup-http";

/** The candidate stays closed unless server configuration explicitly opens it. */
export function signupAvailable(): boolean {
  try { const config = readAuthConfiguration(); return config.mode === "supabase" && signupSameBrowserEnabled(config); } catch { return false; }
}
