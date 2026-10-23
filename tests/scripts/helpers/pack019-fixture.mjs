import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createCatalogueFixture } from "./catalogue-fixture.mjs";
import { RESTORE_RELEASE_PACK_019 } from "../../../scripts/operations/restore-release-pack-019.mjs";

/** Disposable, explicit019 only. Never widens the current canonical025 loader.
 * The existing DECLARATIVE Auth/Storage fixture is synthetic, not a service.
 * No directory selection, environment, connection, user seed or runtime SQL
 * supplied by a caller can choose another migration list.
 */
export async function createPack019Fixture() {
  const db = await createCatalogueFixture();
  try {
    for (const pin of RESTORE_RELEASE_PACK_019.migrations) {
      const bytes = await readFile(new URL("../../../" + pin.path, import.meta.url));
      if (bytes.length !== pin.bytes || createHash("sha256").update(bytes).digest("hex") !== pin.sha256) throw new Error("PACK019_FIXTURE_SOURCE_REFUSED");
      await db.exec(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    }
    return db;
  } catch (error) { await db.close(); throw error; }
}
