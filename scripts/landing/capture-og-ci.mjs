// Fixed OG3 only; no extra output/receipt or caller-selected destination.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkOgContract, runOgCapture } from "./capture-project-ci.mjs";

export function ogEntrypointAction(args) {
  if (Array.isArray(args) && args.length === 0) return "capture";
  if (Array.isArray(args) && args.length === 1 && args[0] === "--check-contract") return "contract";
  throw new Error("CAPTURE_INTERFACE");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = ogEntrypointAction(process.argv.slice(2));
  if (action === "contract") checkOgContract();
  else await runOgCapture();
}
