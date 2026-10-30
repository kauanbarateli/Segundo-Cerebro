/** Pure controls only: synthetic objects/reader; no process/Docker/filesystem/SQL/SDK. */
import assert from "node:assert/strict";
import test from "node:test";
import { PUBLIC_DB_IMAGE_FORMAT, publicDbImageReadRequest, projectPublicDbImageCandidate } from "../helpers/public-cli-db-image-metadata.mjs";
const imageId = "sha256:" + "a".repeat(64), repo = "public.example.invalid/synthetic/postgres@sha256:" + "b".repeat(64);
const metadata = () => ({ repoDigests: [repo], os: "linux", architecture: "amd64", imageId });
const refusal = (fn, code) => assert.throws(fn, error => error?.code === code && error.message === code);

test("request is exactly one image inspect with four public fields and fixed limits", () => {
  const r = publicDbImageReadRequest(imageId);
  assert.deepEqual(r.args, ["image", "inspect", "--format", PUBLIC_DB_IMAGE_FORMAT, imageId]);
  assert.equal(r.executable, "docker"); assert.equal(r.timeoutMs, 15000); assert.equal(r.stdoutMaxBytes, 65536); assert.equal(r.stderrMaxBytes, 4096);
  assert.equal(r.retry, false); assert.equal(r.attempts, 1); assert.equal(r.stdoutFileOnly, true); assert.equal(r.requireDurableAttemptMarkerBeforeStart, true);
  assert.doesNotMatch(PUBLIC_DB_IMAGE_FORMAT, /Env|Mount|Config|Labels|Ports/); assert.equal(Object.isFrozen(r.args), true);
});
test("argument builder rejects options, tags and arbitrary IDs", () => {
  for (const id of ["--all", "postgres:17", "sha256:" + "A".repeat(64), imageId + "\n", {}, null]) refusal(() => publicDbImageReadRequest(id), "IMAGE_ID_REFUSED");
});
test("valid four-field metadata remains nonnormative and public origin unbound", () => {
  const r = projectPublicDbImageCandidate(metadata(), imageId);
  assert.deepEqual(r.observed, metadata()); assert.equal(r.fourFieldsPresent, true); assert.equal(r.matchesCallerExpectedImageId, true);
  for (const field of ["normativeQualified", "baselineQualified", "restoreAccepted", "hostedAccepted", "productionAccepted", "leaseOwnershipProvenByHelper", "cliVersionProvenByHelper", "imageIdIsManifestDigest", "repoDigestIndexVsPlatformResolved", "publicOriginBound", "publicBuildBound", "bootstrapBound", "extensionInventoryBound"]) assert.equal(r[field], false);
  assert.equal(r.state, "STOP_ROOT_REVIEW_REQUIRED"); assert.equal(Object.isFrozen(r.observed.repoDigests), true);
});
test("missing digests/platform fields preserve explicit STOP without invented values", () => {
  for (const patch of [{ repoDigests: null }, { repoDigests: [] }, { os: "" }, { architecture: "" }]) {
    const r = projectPublicDbImageCandidate({ ...metadata(), ...patch }, imageId);
    assert.equal(r.fourFieldsPresent, false); assert.equal(r.normativeQualified, false); assert.equal(r.state, "STOP_ROOT_REVIEW_REQUIRED");
    assert.ok(r.stopReasons.includes(patch.repoDigests !== undefined ? "REPO_DIGESTS_MISSING" : "PLATFORM_FIELDS_MISSING"));
  }
});
test("mismatch and unexpected fields cannot produce a candidate", () => {
  refusal(() => projectPublicDbImageCandidate({ ...metadata(), imageId: "sha256:" + "c".repeat(64) }, imageId), "IMAGE_ID_MISMATCH");
  for (const patch of [{ os: "linux\n" }, { architecture: "amd64\r\n" }, { env: "NOT_EMITTED" }, { normativeQualified: true }, { Config: {} }]) refusal(() => projectPublicDbImageCandidate({ ...metadata(), ...patch }, imageId), "SHAPE_REFUSED");
});
test("accessor/inherited/proxy/revoked input is refused without provider evaluation", () => {
  let reads = 0; const x = metadata(); Object.defineProperty(x, "os", { enumerable: true, get() { reads++; throw Error("NOT_EMITTED"); } });
  refusal(() => projectPublicDbImageCandidate(x, imageId), "SHAPE_REFUSED");
  refusal(() => projectPublicDbImageCandidate(Object.create(metadata()), imageId), "SHAPE_REFUSED");
  const traps = { get() { reads++; throw Error("NOT_EMITTED"); }, getOwnPropertyDescriptor() { reads++; throw Error("NOT_EMITTED"); } };
  refusal(() => projectPublicDbImageCandidate(new Proxy(metadata(), traps), imageId), "SHAPE_REFUSED");
  const revoked = Proxy.revocable(metadata(), traps); revoked.revoke(); refusal(() => projectPublicDbImageCandidate(revoked.proxy, imageId), "SHAPE_REFUSED"); assert.equal(reads, 0);
});
test("digest array holes/getters/duplicates/proxies and nonrepository values are refused", () => {
  let reads = 0; const accessor = [repo]; Object.defineProperty(accessor, "0", { enumerable: true, get() { reads++; return repo; } });
  const hole = new Array(1), extra = [repo]; extra.extra = "unexpected";
  for (const rows of [hole, accessor, extra, [repo + "\n"], [repo + "\u2028"], [repo, repo], ["https://private.invalid/x@sha256:" + "b".repeat(64)], ["../private@sha256:" + "b".repeat(64)], new Proxy([repo], {})]) refusal(() => projectPublicDbImageCandidate({ ...metadata(), repoDigests: rows }, imageId), "SHAPE_REFUSED");
  assert.equal(reads, 0);
});
