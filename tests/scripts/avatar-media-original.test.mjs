import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadCaptureImageProcessor } from "../e2e-auth-local/capture-image-storage-support.mjs";

// Original processor/Sharp in RAM, through the reviewed official loader.
// These synthetic media checks do not exercise Auth, Storage, SQL or Next.
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

test("avatar: EXIF rotation and square crop preserve independently known quadrants", async () => {
  const { processor } = await loadCaptureImageProcessor();
  const width = 800, height = 600, channels = 3;
  const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
  const pixels = Buffer.alloc(width * height * channels);
  let input, output, decoded;
  try {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = colors[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)];
        for (let channel = 0; channel < channels; channel++) pixels[(y * width + x) * channels + channel] = color[channel];
      }
    }
    input = await processor.sharp(pixels, { raw: { width, height, channels } }).jpeg({ quality: 95 }).withMetadata({ orientation: 6 }).toBuffer();
    const original = await processor.sharp(input).metadata();
    assert.equal(original.orientation, 6);
    assert.ok(original.exif instanceof Buffer && original.exif.length > 0);

    output = await processor.prepararArquivo("avatar", "declared-avatar.png", input, processor.readFilePolicy({}));
    assert.equal(output.mime, "image/jpeg");
    assert.equal(output.name, "declared-avatar.jpg");
    assert.equal(output.width, 512);
    assert.equal(output.height, 512);
    assert.equal(output.sha256, sha256(output.bytes));
    assert.notEqual(output.sha256, sha256(input));
    assert.deepEqual([...output.bytes.subarray(0, 3)], [255, 216, 255]);
    const metadata = await processor.sharp(output.bytes).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
    for (const field of ["orientation", "exif", "icc", "iptc", "xmp"]) assert.equal(metadata[field], undefined);

    // EXIF6 means clockwise: source BL/TL/BR/TR become output TL/TR/BL/BR.
    // Far-from-edge samples avoid JPEG ringing and crop interpolation edges.
    const raw = await processor.sharp(output.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    decoded = raw.data;
    assert.equal(raw.info.channels, 3);
    const samples = [[128, 128, colors[2]], [384, 128, colors[0]], [128, 384, colors[3]], [384, 384, colors[1]]];
    for (const [x, y, expected] of samples) {
      const offset = (y * raw.info.width + x) * raw.info.channels;
      for (let channel = 0; channel < channels; channel++) {
        assert.ok(expected[channel] === 255 ? decoded[offset + channel] >= 180 : decoded[offset + channel] <= 80);
      }
    }
  } finally {
    pixels.fill(0); input?.fill(0); output?.bytes.fill(0); decoded?.fill(0);
  }
});

test("avatar: small original pixels are re-encoded without enlargement", async () => {
  const { processor } = await loadCaptureImageProcessor();
  let input, output;
  try {
    input = await processor.sharp({ create: { width: 160, height: 160, channels: 3, background: "#123456" } }).png().toBuffer();
    output = await processor.prepararArquivo("avatar", "small.png", input, processor.readFilePolicy({}));
    const metadata = await processor.sharp(output.bytes).metadata();
    assert.equal(output.mime, "image/jpeg");
    assert.deepEqual([output.width, output.height, metadata.width, metadata.height], [160, 160, 160, 160]);
    assert.equal(output.sha256, sha256(output.bytes));
    assert.equal(metadata.exif, undefined);
  } finally { input?.fill(0); output?.bytes.fill(0); }
});
