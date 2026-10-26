/** Public image metadata candidate only. No process, Docker, filesystem, SQL or SDK. */
import { types } from "node:util";

export const PUBLIC_DB_IMAGE_FORMAT = '{"repoDigests":{{json .RepoDigests}},"os":{{json .Os}},"architecture":{{json .Architecture}},"imageId":{{json .Id}}}';
export const PUBLIC_DB_IMAGE_LIMITS = Object.freeze({ timeoutMs: 15000, stdoutBytes: 65536, stderrBytes: 4096, attempts: 1 });
const IMAGE = /^sha256:[a-f0-9]{64}$/;
const REPO = /^[a-z0-9][a-z0-9._:/-]{0,400}@sha256:[a-f0-9]{64}$/;
const TOKEN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const CODES = new Set(["IMAGE_ID_REFUSED", "SHAPE_REFUSED", "IMAGE_ID_MISMATCH", "ALREADY_ATTEMPTED", "READER_REFUSED", "READ_FAILED", "TRANSPORT_REFUSED", "JSON_REFUSED"]);
class ImageMetadataRefusal extends Error {
  constructor(code) { super(CODES.has(code) ? code : "SHAPE_REFUSED"); this.name = "ImageMetadataRefusal"; this.code = this.message; }
}
const refuse = code => { throw new ImageMetadataRefusal(code); };
const need = (condition, code = "SHAPE_REFUSED") => { if (!condition) refuse(code); };
function record(value, keys) {
  need(value !== null && typeof value === "object" && !types.isProxy(value));
  need(Object.getPrototypeOf(value) === Object.prototype);
  const descriptors = Object.getOwnPropertyDescriptors(value), own = Reflect.ownKeys(descriptors);
  need(own.length === keys.length && own.every(key => typeof key === "string" && keys.includes(key)));
  const out = {};
  for (const key of keys) {
    const d = descriptors[key]; need(d && d.enumerable && Object.hasOwn(d, "value")); out[key] = d.value;
  }
  return out;
}
function repoDigests(value) {
  if (value === null) return null;
  need(value !== null && typeof value === "object" && !types.isProxy(value));
  need(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype);
  const descriptors = Object.getOwnPropertyDescriptors(value), length = descriptors.length?.value;
  need(Number.isSafeInteger(length) && length >= 0 && length <= 8);
  need(Reflect.ownKeys(descriptors).length === length + 1);
  const rows = [], seen = new Set();
  for (let i = 0; i < length; i++) {
    const d = descriptors[String(i)]; need(d && d.enumerable && Object.hasOwn(d, "value"));
    const text = d.value;
    need(typeof text === "string" && text.length <= 512 && REPO.test(text) && text.trim() === text && !text.includes("://") && !text.split("/").includes("..") && !seen.has(text));
    seen.add(text); rows.push(text);
  }
  return Object.freeze(rows);
}
function expectedId(value) { need(typeof value === "string" && value.length === 71 && IMAGE.test(value), "IMAGE_ID_REFUSED"); return value; }

/** Caller must obtain imageId from its already validated db lease. This does not validate ownership. */
export function publicDbImageReadRequest(callerExpectedImageId) {
  const imageId = expectedId(callerExpectedImageId);
  return Object.freeze({
    executable: "docker",
    args: Object.freeze(["image", "inspect", "--format", PUBLIC_DB_IMAGE_FORMAT, imageId]),
    timeoutMs: 15000, stdoutMaxBytes: 65536, stderrMaxBytes: 4096,
    stdoutFileOnly: true, naturalStdoutEofRequired: true, naturalStderrEofRequired: true,
    exitCodeRequired: 0, attempts: 1, retry: false, requireDurableAttemptMarkerBeforeStart: true,
  });
}

/** Valid shape and matching caller ID are observations, never public/normative provenance. */
export function projectPublicDbImageCandidate(value, callerExpectedImageId) {
  const imageId = expectedId(callerExpectedImageId), input = record(value, ["repoDigests", "os", "architecture", "imageId"]);
  need(typeof input.imageId === "string" && input.imageId.length === 71 && IMAGE.test(input.imageId));
  need(input.imageId === imageId, "IMAGE_ID_MISMATCH");
  need(typeof input.os === "string" && (input.os === "" || TOKEN.test(input.os) && input.os.trim() === input.os));
  need(typeof input.architecture === "string" && (input.architecture === "" || TOKEN.test(input.architecture) && input.architecture.trim() === input.architecture));
  const digests = repoDigests(input.repoDigests);
  const missing = [];
  if (digests === null || digests.length === 0) missing.push("REPO_DIGESTS_MISSING");
  if (!input.os || !input.architecture) missing.push("PLATFORM_FIELDS_MISSING");
  return Object.freeze({
    version: 1, kind: "PUBLIC_CLI_DB_IMAGE_CANDIDATE",
    observed: Object.freeze({ repoDigests: digests, os: input.os, architecture: input.architecture, imageId: input.imageId }),
    fourFieldsPresent: missing.length === 0, matchesCallerExpectedImageId: true,
    stopReasons: Object.freeze([...missing, "PLATFORM_MANIFEST_UNBOUND", "PUBLIC_BUILD_UNBOUND", "BOOTSTRAP_UNBOUND", "EXTENSION_INVENTORY_UNBOUND"]),
    state: "STOP_ROOT_REVIEW_REQUIRED",
    leaseOwnershipProvenByHelper: false, cliVersionProvenByHelper: false,
    imageIdIsManifestDigest: false, repoDigestIndexVsPlatformResolved: false,
    publicOriginBound: false, publicBuildBound: false, bootstrapBound: false, extensionInventoryBound: false,
    normativeQualified: false, baselineQualified: false, restoreAccepted: false, hostedAccepted: false, productionAccepted: false,
  });
}
