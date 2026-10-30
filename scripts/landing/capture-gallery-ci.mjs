// Thin entry only; the owned supervisor, caps and cleanup are shared with Project.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkGalleryContract, runGalleryCapture } from "./capture-project-ci.mjs";

export function galleryEntrypointAction(args) {
  if (Array.isArray(args) && args.length === 0) return "capture";
  if (Array.isArray(args) && args.length === 1 && args[0] === "--check-contract") return "contract";
  throw new Error("CAPTURE_INTERFACE");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = galleryEntrypointAction(process.argv.slice(2));
  if (action === "contract") checkGalleryContract();
  else await runGalleryCapture();
}
