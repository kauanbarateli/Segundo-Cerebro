// Fixed Entrada17 only; reuse the same owned CI supervisor and cleanup.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkEntryContract, runEntryCapture } from "./capture-project-ci.mjs";

export function entryEntrypointAction(args) {
  if (Array.isArray(args) && args.length === 0) return "capture";
  if (Array.isArray(args) && args.length === 1 && args[0] === "--check-contract") return "contract";
  throw new Error("CAPTURE_INTERFACE");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = entryEntrypointAction(process.argv.slice(2));
  if (action === "contract") checkEntryContract();
  else await runEntryCapture();
}
