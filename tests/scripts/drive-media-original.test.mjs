import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadCaptureImageProcessor } from "../e2e-auth-local/capture-image-storage-support.mjs";

// Original processor/policy only: no HTTP, Storage, SQL, browser or factory.
// Complements the Core magic-byte tests with the actual preparation boundary.
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

test("drive: actual PDF bytes survive a misleading image filename with measured metadata", async () => {
  const { processor } = await loadCaptureImageProcessor();
  const input = new TextEncoder().encode("%PDF-1.7\nSynthetic fixture, not a private document.\n%%EOF");
  let output;
  try {
    output = await processor.prepararArquivo("drive", "declared-image.png", input, processor.readFilePolicy({}));
    assert.equal(output.mime, "application/pdf");
    assert.equal(output.name, "declared-image.png");
    assert.deepEqual([output.width, output.height], [null, null]);
    assert.equal(output.bytes.byteLength, input.byteLength);
    assert.deepEqual(output.bytes, input);
    assert.equal(output.sha256, sha256(input));
  } finally { input.fill(0); output?.bytes.fill(0); }
});

test("drive: configured real byte ceiling is inclusive and rejects the extra byte", async () => {
  const { processor } = await loadCaptureImageProcessor();
  const policy = processor.readFilePolicy({ DRIVE_MAX_FILE_BYTES: "1024" });
  const input = new Uint8Array(1025).fill(65);
  let output;
  try {
    output = await processor.prepararArquivo("drive", "boundary.txt", input.subarray(0, 1024), policy);
    assert.equal(output.bytes.byteLength, 1024);
    assert.equal(output.mime, "text/plain");
    assert.equal(output.sha256, sha256(input.subarray(0, 1024)));
    await assert.rejects(processor.prepararArquivo("drive", "boundary.txt", input, policy), error => error?.code === "VALIDATION");
  } finally { input.fill(0); output?.bytes.fill(0); }
});

test("drive: preparation refuses an executable renamed as a document before publishing bytes", async () => {
  const { processor } = await loadCaptureImageProcessor();
  const input = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);
  try {
    await assert.rejects(processor.prepararArquivo("drive", "invoice.pdf", input, processor.readFilePolicy({})), error => error?.code === "VALIDATION");
  } finally { input.fill(0); }
});
