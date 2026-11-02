import { expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ cookies: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: calls.cookies }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfiguration: () => ({ mode: "supabase", appOrigin: "https://app.example.invalid" }) }));
vi.mock("@/lib/auth/clients", () => ({ createRequestClient: calls.client }));
vi.mock("@/lib/auth/database-origin-server", () => ({ isTrustedHostedDatabaseOrigin: () => true }));
import { POST } from "../../src/app/api/signup-origin-pending/route";

it("mantém a rota fechada antes de ler cookies ou chamar o banco", async () => {
  vi.stubEnv("PUBLIC_SIGNUP_ENABLED", "true");
  try {
    const request = new Request("https://app.example.invalid/api/signup-origin-pending", { method: "POST", headers: { origin: "https://app.example.invalid" } });
    const response = await POST(request);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(calls.cookies).not.toHaveBeenCalled(); expect(calls.client).not.toHaveBeenCalled(); expect(calls.rpc).not.toHaveBeenCalled();
  } finally { vi.unstubAllEnvs(); }
});
