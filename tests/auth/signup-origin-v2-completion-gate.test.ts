import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/database-origin-server", () => ({ isTrustedHostedDatabaseOrigin: () => true }));
import { signupOriginV2AllowsCompletion } from "../../src/lib/auth/signup-http";
afterEach(() => vi.unstubAllEnvs());
it("mantém conclusão fechada quando retirada v2 está habilitada sem reserva qualificada", () => {
  vi.stubEnv("ORIGIN_WITHDRAWAL_V2_ENABLED", undefined); expect(signupOriginV2AllowsCompletion()).toBe(true);
  vi.stubEnv("ORIGIN_WITHDRAWAL_V2_ENABLED", "true"); expect(signupOriginV2AllowsCompletion()).toBe(false);
});
