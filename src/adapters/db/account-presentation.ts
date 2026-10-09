import "server-only";
import { cache } from "react";
import { readAuthConfiguration } from "../../lib/auth/config";
import { requestAuthServices } from "../../lib/auth/runtime";
import { settingsForRequest } from "./settings-runtime";

/** Optional presentation fallback only; protected page guards remain mandatory. */
export const accountPresentation = cache(async () => {
  try {
    const config = readAuthConfiguration(); if (config.mode === "demo") return null;
    const identity = await (await requestAuthServices()).gateway.readIdentity();
    if (!identity || identity.mustChangePassword) return null;
    return await settingsForRequest(config, identity).load();
  } catch { return null; }
});
