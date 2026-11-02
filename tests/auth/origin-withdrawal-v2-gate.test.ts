import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { originWithdrawalV2Enabled } from "../../src/lib/auth/origin-withdrawal-v2-gate";
afterEach(() => vi.unstubAllEnvs());
describe("gate da retirada versionada", () => {
  it("não habilita sem escolha explícita", () => {
    vi.stubEnv("ORIGIN_WITHDRAWAL_V2_ENABLED", undefined); expect(originWithdrawalV2Enabled()).toBe(false);
    vi.stubEnv("ORIGIN_WITHDRAWAL_V2_ENABLED", "1"); expect(originWithdrawalV2Enabled()).toBe(false);
    vi.stubEnv("ORIGIN_WITHDRAWAL_V2_ENABLED", "true"); expect(originWithdrawalV2Enabled()).toBe(true);
  });
});
