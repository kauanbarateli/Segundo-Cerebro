import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, copyFile, unlink } from "node:fs/promises";
import { constants } from "node:fs";
const MAGIC = Buffer.from("SCBK0001"), MAX_FRAME = 65536 + 4096, CHUNK = 65536;
export class BackupError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new BackupError(code); };
function keyBytes(value) { const key = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, "base64"); if (key.length !== 32 || typeof value === "string" && key.toString("base64") !== value) fail("INVALID_BACKUP_KEY"); return key; }
function headerBytes(header) { return Buffer.from(JSON.stringify(header)); }
function headerInfoValid(info) { return info && /^[a-z]{20}$/.test(info.project_ref??"") && /^[A-Za-z0-9_-]{1,50}$/.test(info.key_id??"") && typeof info.created_at==="string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:[.][0-9]{1,6})?Z$/.test(info.created_at) && Number.isFinite(Date.parse(info.created_at)); }
function fileKey(secret, salt) { const key = keyBytes(secret); try { return Buffer.from(hkdfSync("sha256", key, salt, Buffer.from("second-brain-backup-v1"), 32)); } finally { key.fill(0); } }
function nonce(prefix, sequence) { if (sequence > 0xffffffff) fail("FRAME_LIMIT"); const value = Buffer.alloc(12); prefix.copy(value); value.writeUInt32BE(sequence, 8); return value; }
function aad(digest, sequence) { const value = Buffer.alloc(36); digest.copy(value); value.writeUInt32BE(sequence, 32); return value; }
function updateManifest(hash, metadata, size, digest) { hash.update(JSON.stringify({ metadata, size, digest })); }
function metadataValid(v) {
 if (!v || typeof v !== "object" || Array.isArray(v)) return false;
 if (v.kind === "database") return Object.keys(v).sort().join(",") === "kind,preserves_auth_uuids,preserves_grants,preserves_owners,schemas" && v.preserves_auth_uuids === true && v.preserves_grants === true && v.preserves_owners === true && JSON.stringify(v.schemas) === JSON.stringify(["auth","public","app_private","storage"]);
 return v.kind === "storage" && Object.keys(v).sort().join(",") === "bucket,expected_bytes,kind,mime,object_id,path,source_updated_at" && ["second-brain-staging","second-brain-files"].includes(v.bucket) && typeof v.path === "string" && v.path.length > 0 && v.path.length <= 2048 && !v.path.split("/").some(part => [".","..",""].includes(part)) && typeof v.mime === "string" && v.mime.length <= 256 && typeof v.object_id === "string" && typeof v.source_updated_at === "string" && Number.isSafeInteger(v.expected_bytes) && v.expected_bytes >= 0;
}
/** Encrypts bounded records as they arrive; no plaintext backup or object bytes touch disk. */
export async function writeBackup(destination, secret, info, entries) {
 if(!headerInfoValid(info))fail("INVALID_HEADER");
 const salt = randomBytes(32), prefix = randomBytes(8), key = fileKey(secret, salt), header = { format: "second-brain-backup", version: 1, project_ref: info.project_ref, key_id: info.key_id, created_at: info.created_at, salt: salt.toString("base64"), nonce_prefix: prefix.toString("base64") };
 const encoded = headerBytes(header); if (encoded.length > 4096) fail("INVALID_HEADER"); const binding = createHash("sha256").update(encoded).digest(), partial = destination + ".partial-" + randomBytes(6).toString("hex"), file = await open(partial, "wx", 0o600);
 let sequence = 0, count = 0, total = 0, databases = 0, objects = 0; const manifest = createHash("sha256"), names = new Set();
 async function write(record) { if (record.length > MAX_FRAME) fail("FRAME_TOO_LARGE"); const cipher = createCipheriv("aes-256-gcm", key, nonce(prefix, sequence)); cipher.setAAD(aad(binding, sequence++)); const encrypted = Buffer.concat([cipher.update(record),cipher.final(),cipher.getAuthTag()]), length = Buffer.alloc(4); length.writeUInt32BE(encrypted.length); await file.writeFile(length); await file.writeFile(encrypted); }
 try {
  const length = Buffer.alloc(4); length.writeUInt32BE(encoded.length); await file.writeFile(MAGIC); await file.writeFile(length); await file.writeFile(encoded);
  for await (const entry of entries) {
   if (!metadataValid(entry.metadata)) fail("INVALID_ENTRY"); const identity = entry.metadata.kind === "database" ? "database" : JSON.stringify([entry.metadata.bucket,entry.metadata.path]); if (names.has(identity)) fail("DUPLICATE_ENTRY"); names.add(identity);
   await write(Buffer.concat([Buffer.from([1]),Buffer.from(JSON.stringify(entry.metadata))])); const hash = createHash("sha256"); let size = 0;
   for await (const value of entry.stream) { const chunk = Buffer.from(value); for (let offset = 0; offset < chunk.length; offset += CHUNK) { const part = chunk.subarray(offset,offset+CHUNK); size += part.length; if (!Number.isSafeInteger(size)) fail("BYTE_LIMIT"); if(entry.metadata.kind==="storage"&&size>entry.metadata.expected_bytes)fail("OBJECT_SIZE_CHANGED");hash.update(part); await write(Buffer.concat([Buffer.from([2]),part])); } }
   if (entry.metadata.kind === "storage" && size !== entry.metadata.expected_bytes) fail("OBJECT_SIZE_CHANGED"); const digest = hash.digest("hex"); updateManifest(manifest,entry.metadata,size,digest); total += size; count++; if (entry.metadata.kind === "database") databases++; else objects++;
   await write(Buffer.concat([Buffer.from([3]),Buffer.from(JSON.stringify({ size,digest }))]));
  }
  if (databases !== 1 || !Number.isSafeInteger(total)) fail("INCOMPLETE_BACKUP"); const result = { entries: count, database_entries: databases, storage_objects: objects, plaintext_bytes: total, manifest_sha256: manifest.digest("hex") };
  await write(Buffer.concat([Buffer.from([4]),Buffer.from(JSON.stringify(result))])); await file.sync(); await file.close(); await copyFile(partial,destination,constants.COPYFILE_EXCL); await unlink(partial); return result;
 } catch (error) { await file.close().catch(() => undefined); await unlink(partial).catch(() => undefined); throw error; } finally { key.fill(0); }
}
async function reader(source) { const iterator = source[Symbol.asyncIterator](); let buffer = Buffer.alloc(0), ended = false; return { async take(length, eof = false) { while (buffer.length < length && !ended) { const next = await iterator.next(); if (next.done) ended = true; else buffer = Buffer.concat([buffer,Buffer.from(next.value)]); } if (!buffer.length && ended && eof) return null; if (buffer.length < length) fail("TRUNCATED_BACKUP"); const result = buffer.subarray(0,length); buffer = buffer.subarray(length); return result; }, async close() { await iterator.return?.(); } }; }
/** Verifies every AEAD record, order, footer hash and final manifest before reporting success. */
export async function readBackup(path, secret, handlers = {}) {
 const input = await reader(createReadStream(path)); let key; let active = null, count = 0, total = 0, databases = 0, objects = 0, sequence = 0; const manifest = createHash("sha256"), names = new Set();
 try {
  if (!(await input.take(8)).equals(MAGIC)) fail("INVALID_BACKUP"); const length = (await input.take(4)).readUInt32BE(); if (length < 2 || length > 4096) fail("INVALID_HEADER"); const encoded = await input.take(length); let header; try { header = JSON.parse(encoded); } catch { fail("INVALID_HEADER"); }
  if (header?.format !== "second-brain-backup" || header.version !== 1 || !headerInfoValid(header) || Object.keys(header).sort().join(",")!=="created_at,format,key_id,nonce_prefix,project_ref,salt,version" || typeof header.salt !== "string" || typeof header.nonce_prefix !== "string") fail("INVALID_HEADER"); const salt = Buffer.from(header.salt,"base64"), prefix = Buffer.from(header.nonce_prefix,"base64"); if (salt.length !== 32 || prefix.length !== 8 || salt.toString("base64")!==header.salt || prefix.toString("base64")!==header.nonce_prefix) fail("INVALID_HEADER"); key = fileKey(secret,salt); const binding = createHash("sha256").update(encoded).digest(); await handlers.header?.(header);
  while (true) {
   const rawLength = await input.take(4,true); if (rawLength === null) fail("MISSING_MANIFEST"); const length = rawLength.readUInt32BE(); if (length < 17 || length > MAX_FRAME+16) fail("INVALID_FRAME"); const encrypted = await input.take(length), decipher = createDecipheriv("aes-256-gcm",key,nonce(prefix,sequence)); decipher.setAAD(aad(binding,sequence++)); decipher.setAuthTag(encrypted.subarray(-16)); let record;
   try { record = Buffer.concat([decipher.update(encrypted.subarray(0,-16)),decipher.final()]); } catch { fail("BACKUP_AUTHENTICATION_FAILED"); }
   try {
    const type = record[0], bytes = record.subarray(1);
    if (type === 1) { if (active) fail("INVALID_ORDER"); const metadata = JSON.parse(bytes); if (!metadataValid(metadata)) fail("INVALID_ENTRY"); const identity = metadata.kind === "database" ? "database" : JSON.stringify([metadata.bucket,metadata.path]); if (names.has(identity)) fail("DUPLICATE_ENTRY"); names.add(identity); active = { metadata, size: 0, hash: createHash("sha256") }; await handlers.begin?.(metadata); }
    else if (type === 2) { if (!active) fail("INVALID_ORDER"); active.size += bytes.length; if (!Number.isSafeInteger(active.size)) fail("BYTE_LIMIT"); active.hash.update(bytes); await handlers.chunk?.(bytes,active.metadata); }
    else if (type === 3) { if (!active) fail("INVALID_ORDER"); const footer = JSON.parse(bytes), digest = active.hash.digest("hex"); if (footer.size !== active.size || footer.digest !== digest || active.metadata.kind === "storage" && footer.size !== active.metadata.expected_bytes) fail("ENTRY_HASH_MISMATCH"); updateManifest(manifest,active.metadata,active.size,digest); count++; total += active.size; if (active.metadata.kind === "database") databases++; else objects++; await handlers.end?.({ size:active.size,digest },active.metadata); active = null; }
    else if (type === 4) { if (active || databases !== 1) fail("INCOMPLETE_BACKUP"); const result = JSON.parse(bytes), expected = { entries:count,database_entries:databases,storage_objects:objects,plaintext_bytes:total,manifest_sha256:manifest.digest("hex") }; if (JSON.stringify(result) !== JSON.stringify(expected)) fail("MANIFEST_MISMATCH"); if (await input.take(1,true) !== null) fail("TRAILING_DATA"); return expected; }
    else fail("INVALID_RECORD");
   } finally { record.fill(0); }
  }
 } catch (error) { if (error instanceof BackupError) throw error; throw new BackupError("INVALID_BACKUP"); } finally { key?.fill(0); await input.close(); }
}
