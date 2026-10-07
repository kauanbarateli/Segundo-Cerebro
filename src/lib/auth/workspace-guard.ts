import "server-only";
import { notFound } from "next/navigation";
import type { FeatureKey } from "../../core/access/resolve-access";
import { getAppMode } from "./config";
import { requireFeature } from "./guards";
import { AuthGuardError } from "./types";

/** Called in each page, including RSC navigations that reuse the workspace layout.
 * Domain data is still demonstrative until T-015 implements its adapters. */
export async function authorizeWorkspaceFeature(feature: FeatureKey): Promise<void> {
  if (getAppMode() === "demo") return;
  try { await requireFeature(feature); }
  catch (error) {
    if (error instanceof AuthGuardError && error.code === "forbidden") notFound();
    throw error;
  }
}
