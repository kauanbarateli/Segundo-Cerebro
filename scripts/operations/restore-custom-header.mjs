import { types } from "node:util";
import { BackupError } from "./backup-format.mjs";

// Public source pin: PostgreSQL 18.4, tag REL_18_4. No moving branch is used.
// ReadHead/WriteHead fix bytes 0..11 for archive version 1.16-0:
//   0..4 PGDMP; 5 major; 6 minor; 7 revision; 8 intSize; 9 offSize;
//   10 archCustom; 11 compression algorithm. Dates/strings start AFTER this.
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup_archiver.c
// K_VERS_MAJOR/MINOR/REV and the version-dependent layout:
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup_archiver.h
// ArchiveFormat: archCustom = 1:
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup.h
// pg_compress_algorithm, in on-disk order NONE/GZIP/LZ4/ZSTD = 0/1/2/3:
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/include/common/compression.h

const freeze = Object.freeze, apply = Reflect.apply;
const uncurry = fn => (value, ...args) => apply(fn, value, args);
const typedArray = Object.getPrototypeOf(Uint8Array.prototype);
const intrinsicGetter = name => uncurry(Object.getOwnPropertyDescriptor(typedArray, name).get);
const tagOf = intrinsicGetter(Symbol.toStringTag), lengthOf = intrinsicGetter("byteLength"), bufferOf = intrinsicGetter("buffer");
const { isProxy, isSharedArrayBuffer } = types;
const View = DataView;
const DATABASE_BYTES_LIMIT = 64 * 1024 * 1024, FIXED_PREFIX_BYTES = 12;
const compression = freeze(["NONE", "GZIP", "LZ4", "ZSTD"]);

export const CUSTOM_HEADER_ERROR_CODES = freeze(["RESTORE_CUSTOM_HEADER_INPUT_INVALID", "RESTORE_CUSTOM_HEADER_LIMIT_EXCEEDED", "RESTORE_CUSTOM_HEADER_TRUNCATED", "RESTORE_CUSTOM_HEADER_UNSUPPORTED"]);
const fail = code => { throw new BackupError(code); };

/**
 * Observes ONLY the bounded, fixed prefix of a genuine non-shared Uint8Array.
 * No IO, TOC parsing, date/string decoding, authentication or capability mint.
 * Exactly 12 bytes can establish this tuple; they cannot establish a complete
 * header/archive, a PostgreSQL producer version, native codec support or any
 * restore acceptance. The owned inspector alone qualifies provenance AFTER
 * complete archive authentication, ciphertext recheck and native planning.
 * Input bytes are neither changed nor retained; results contain public enums.
 */
export function observeCustomArchiveHeader(database) {
  if (isProxy(database) || !database || typeof database !== "object") fail("RESTORE_CUSTOM_HEADER_INPUT_INVALID");
  let length;
  try {
    if (tagOf(database) !== "Uint8Array") fail("RESTORE_CUSTOM_HEADER_INPUT_INVALID");
    length = lengthOf(database);
    const store = bufferOf(database);
    if (isSharedArrayBuffer(store)) fail("RESTORE_CUSTOM_HEADER_INPUT_INVALID");
    // A zero-length native view detects detach without ArrayBuffer.slice,
    // which would consult an input-controlled constructor/Symbol.species.
    new View(store, 0, 0);
  } catch { fail("RESTORE_CUSTOM_HEADER_INPUT_INVALID"); }
  if (length > DATABASE_BYTES_LIMIT) fail("RESTORE_CUSTOM_HEADER_LIMIT_EXCEEDED");
  if (length < FIXED_PREFIX_BYTES) fail("RESTORE_CUSTOM_HEADER_TRUNCATED");
  if (database[0] !== 0x50 || database[1] !== 0x47 || database[2] !== 0x44 || database[3] !== 0x4d || database[4] !== 0x50) fail("RESTORE_CUSTOM_HEADER_INPUT_INVALID");
  // Refuse an unknown version BEFORE applying its potentially different byte
  // layout. In particular, 1.0 has no revision byte; it is never guessed here.
  if (database[5] !== 1 || database[6] !== 16) fail("RESTORE_CUSTOM_HEADER_UNSUPPORTED");
  if (database[7] !== 0 || database[8] !== 4 || database[9] !== 8 || database[10] !== 1 || database[11] > 3) fail("RESTORE_CUSTOM_HEADER_UNSUPPORTED");
  return freeze({ archiveVersion: "1.16-0", intSize: 4, offSize: 8, format: "CUSTOM", compression: compression[database[11]] });
}
