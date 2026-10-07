import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cli = join(process.cwd(), "node_modules/dependency-cruiser/bin/dependency-cruise.mjs");
const args = (scenario: string) => [cli, `tests/fixtures/architecture/${scenario}/src`, "--config", ".dependency-cruiser.cjs", "--output-type", "err-long"];

describe("contrato de camadas do Núcleo (ADR-0002)", () => {
  it("recusa uma dependência de framework dentro do Núcleo", () => {
    const result = spawnSync(process.execPath, args("framework"), { encoding: "utf8" });
    expect(result.status).toBeGreaterThan(0);
    expect(result.stdout).toContain("core-is-pure");
  });

  it("permite regras puras que dependem de outros tipos do Núcleo", () => {
    expect(() => execFileSync(process.execPath, args("valid"))).not.toThrow();
  });

  it.each([
    ["adapter", "core-is-pure"],
    ["ui-feature", "ui-does-not-import-features"],
    ["cross-feature", "features-are-independent"],
    ["component-db", "database-only-at-server-boundary"],
    ["browser-sdk", "supabase-sdk-stays-at-server-boundary"],
    ["generated-core", "generated-database-types-stay-at-server-boundary"],
    ["generated-ui", "generated-database-types-stay-at-server-boundary"],
    ["generated-feature", "generated-database-types-stay-at-server-boundary"],
  ])("recusa %s pelo portão %s", (scenario, rule) => {
    const result = spawnSync(process.execPath, args(scenario), { encoding: "utf8" });
    expect(result.status).toBeGreaterThan(0);
    expect(result.stdout).toContain(rule);
  });
  it("permite imports somente de tipo do schema gerado em Auth e adapters de banco", () => {
    expect(() => execFileSync(process.execPath, args("generated-server"))).not.toThrow();
  });
});
