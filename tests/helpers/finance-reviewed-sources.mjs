/** Historical Finance source projections; no database or remote service. */
import { fileURLToPath } from "node:url";
import { assertFinance026Sources } from "./finance-026-candidate-source.ts";
import { readHistorical026FromReviewedFrontB, readHistorical027FromReviewedFrontB } from "./canonical-front-b-source.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
/** The entire 27 or draft30 chain is checked before returning historical026. */
export async function readFinance026FromReviewedSources(reviewRoot = root) {
  const rows = (await readHistorical026FromReviewedFrontB(reviewRoot)).map(({file, source}) => ({file, source: source.toString("utf8")}));
  assertFinance026Sources(rows);
  return rows;
}
/** Historical027 is not a representation of the current hosted schema. */
export async function readFinance027FromReviewedSources(reviewRoot = root) {
  const rows = (await readHistorical027FromReviewedFrontB(reviewRoot)).map(({file, source}) => ({file, source: source.toString("utf8")}));
  assertFinance026Sources(rows.slice(0, 26));
  return rows;
}
