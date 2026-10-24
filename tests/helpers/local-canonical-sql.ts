/** Disposable PostgreSQL only. Auth and Storage catalogue are fixtures; there
 * is no Auth/Storage HTTP service, object bytes, connection string or secret.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readCurrent27CanonicalMigrations, readHistorical026CanonicalMigrations, type CanonicalMigrationSource } from "./canonical-release-source.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
async function createCanonicalSql(migrations: readonly CanonicalMigrationSource[]) {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  try {
    // Reuse the existing loader's DECLARATIVE infrastructure fixture. Do not
    // import its top-level runner, evaluate JS, copy DDL or extract SQL functions.
    const loader = (await readFile(resolve(root, "scripts/test-local-sql.mjs"), "utf8")).replaceAll("\r\n", "\n");
    const start = "  await db.exec(`\n", end = "\n  `);\n  const files =";
    const begin = loader.indexOf(start), finish = loader.indexOf(end, begin);
    if (begin < 0 || finish < 0 || loader.indexOf(start, begin + start.length) !== -1 || loader.indexOf(end, finish + end.length) !== -1) throw new Error("Local SQL bootstrap boundary changed; inspect the canonical loader.");
    const bootstrap = loader.slice(begin + start.length, finish);
    if (bootstrap.includes("${") || bootstrap.includes("`") || bootstrap.includes("\\")) throw new Error("Only literal, unescaped SQL bootstrap is supported; JS is never executed.");
    await db.exec(bootstrap);
    for (const migration of migrations) await db.exec(migration.source.toString("utf8"));
    return db;
  } catch (error) { await db.close(); throw error; }
}

/** CURRENT27 remains the default; no historical fallback is implied. */
export async function createLocalCanonicalSql() {
  return createCanonicalSql(await readCurrent27CanonicalMigrations(root));
}
/** Explicit historical fixture, after the entire current chain passed its byte gate. */
export async function createHistorical026CanonicalSql() {
  return createCanonicalSql(await readHistorical026CanonicalMigrations(root));
}
