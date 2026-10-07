import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ headers: vi.fn(), services: vi.fn(), signIn: vi.fn(), recovery: vi.fn(), password: vi.fn(), redirect: vi.fn((value: string) => { throw new Error(`redirect:${value}`); }) }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: mocks.services }));
vi.mock("../../src/lib/auth/service", () => ({ signIn: mocks.signIn, recoverPassword: mocks.recovery, updatePassword: mocks.password }));
import { recoverPasswordAction, signInAction, updatePasswordAction } from "../../src/lib/auth/actions";

function configure() { for (const [name, value] of Object.entries({ APP_MODE: "supabase", APP_URL: "https://app.example.invalid", SUPABASE_URL: "https://project.example.invalid", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example", SUPABASE_SECRET_KEY: "sb_secret_example", AUTH_RATE_LIMIT_SECRET: "r".repeat(32), AUTH_STATE_SECRET: "s".repeat(32), NODE_ENV: "production" })) vi.stubEnv(name, value); }
function form() { const data = new FormData(); data.set("email", "user@example.invalid"); data.set("password", "a password never echoed"); return data; }
beforeEach(() => { vi.resetAllMocks(); configure(); mocks.headers.mockResolvedValue(new Headers({ origin: "https://app.example.invalid" })); mocks.services.mockResolvedValue({ flows: { get: () => null } }); mocks.signIn.mockResolvedValue({ state: { status: "error", message: "generic" } }); });
afterEach(() => vi.unstubAllEnvs());
describe("server actions reject direct calls independently of UI", () => {
  it("does not enter demo or instantiate clients when configuration is absent", async () => { vi.stubEnv("APP_MODE", "demo"); expect(await signInAction({ status: "idle" }, form())).toMatchObject({ status: "error" }); expect(mocks.services).not.toHaveBeenCalled(); expect(mocks.signIn).not.toHaveBeenCalled(); });
  it("missing real config fails closed instead of demo fallback", async () => { vi.stubEnv("SUPABASE_SECRET_KEY", ""); expect(await signInAction({ status: "idle" }, form())).toMatchObject({ status: "error" }); expect(mocks.services).not.toHaveBeenCalled(); });
  it.each([null, "https://evil.example.invalid"])("rejects mutation Origin %s before SDK", async (origin) => { mocks.headers.mockResolvedValue(new Headers(origin ? { origin } : {})); await signInAction({ status: "idle" }, form()); expect(mocks.services).not.toHaveBeenCalled(); });
  it("never serializes exceptions, credentials or provider diagnostic", async () => { mocks.signIn.mockRejectedValue(new Error("service-role-token and password and email")); const result = await signInAction({ status: "idle" }, form()); expect(JSON.stringify(result)).not.toMatch(/service-role-token|password and email|a password never echoed/); expect(result.status).toBe("error"); });
  it("duplicate fields and file inputs cannot enter the auth service", async () => { const duplicate = form(); duplicate.append("email", "other@example.invalid"); await signInAction({ status: "idle" }, duplicate); const file = form(); file.set("email", new Blob(["a"]), "file.txt"); await signInAction({ status: "idle" }, file); expect(mocks.signIn).not.toHaveBeenCalled(); });
  it("ignores a forged public completionPending state", async () => { mocks.password.mockResolvedValue({ state: { status: "error", completionPending: false } }); await updatePasswordAction({ status: "error", completionPending: true }, new FormData()); expect(mocks.password).toHaveBeenCalledWith(expect.anything(), { password: "", confirmPassword: "", currentPassword: "" }); });
  it("lets Next redirect escape the generic error boundary", async () => { mocks.signIn.mockResolvedValue({ redirectTo: "/tarefas" }); await expect(signInAction({ status: "idle" }, form())).rejects.toThrow("redirect:/tarefas"); });
  it("recovery also requires same-origin mutation", async () => { mocks.headers.mockResolvedValue(new Headers({ origin: "https://evil.example.invalid" })); await recoverPasswordAction({ status: "idle" }, form()); expect(mocks.recovery).not.toHaveBeenCalled(); });
});
