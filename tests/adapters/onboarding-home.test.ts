import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), config: vi.fn(), requireUser: vi.fn(), load: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/workspace-guard", () => ({ authorizeWorkspaceFeature: mocks.authorize }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfiguration: mocks.config }));
vi.mock("@/lib/auth/guards", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/adapters/db/onboarding-runtime", () => ({ onboardingForRequest: () => ({ load: mocks.load }) }));
vi.mock("@/components/layout/workspace-page", () => ({ WorkspacePage: () => null }));
vi.mock("@/components/features/inicio/home-view", () => ({ HomeView: () => null }));

import HomePage from "../../src/app/(workspace)/page";

describe("home: oferta de onboarding só para coorte explícita", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue(undefined);
    mocks.config.mockReturnValue({ mode: "supabase" });
    mocks.requireUser.mockResolvedValue({ userId: "ordinary-user", sessionId: "current-session" });
    mocks.load.mockResolvedValue({ eligibility: { kind: "new_explicit", canStart: true, offerPending: true } });
  });

  it("oferece a primeira configuração após autorizar e preserva o redirect", async () => {
    await expect(HomePage()).rejects.toThrow("REDIRECT:/onboarding");
    expect(mocks.authorize).toHaveBeenCalledWith("inicio");
    expect(mocks.authorize.mock.invocationCallOrder[0]!).toBeLessThan(mocks.load.mock.invocationCallOrder[0]!);
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/onboarding");
  });

  it.each([
    ["existing_opt_in", true, false], ["existing_opt_in", true, true],
    ["new_explicit", true, false], ["new_explicit", false, true], ["denied", false, true],
  ])("não interrompe estado %s/%s/%s", async (kind, canStart, offerPending) => {
    mocks.load.mockResolvedValue({ eligibility: { kind, canStart, offerPending } });
    await expect(HomePage()).resolves.toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("reavalia a oferta persistida a cada entrada: pendente redireciona, adiada e inelegível permitem Home", async () => {
    // Invoke the REAL server page, not a duplicated eligibility predicate or
    // href assertion. UI/HTTP persistence of this transition is covered by the
    // new_explicit workspace browser regression using start + pause + reload.
    const eligibility = { kind: "new_explicit", canStart: true, offerPending: true };
    mocks.load.mockImplementation(async () => ({ eligibility: structuredClone(eligibility) }));
    await expect(HomePage()).rejects.toThrow("REDIRECT:/onboarding");
    eligibility.offerPending = false; mocks.redirect.mockClear();
    await expect(HomePage()).resolves.toBeDefined(); expect(mocks.redirect).not.toHaveBeenCalled();
    eligibility.offerPending = true; eligibility.canStart = false;
    await expect(HomePage()).resolves.toBeDefined(); expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.authorize.mock.calls).toEqual([["inicio"], ["inicio"], ["inicio"]]);
    expect(mocks.requireUser).toHaveBeenCalledTimes(3); expect(mocks.load).toHaveBeenCalledTimes(3);
  });

  it("demo não consulta identidade nem backend do onboarding", async () => {
    mocks.config.mockReturnValue({ mode: "demo" });
    await expect(HomePage()).resolves.toBeDefined();
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("indisponibilidade da configuração opcional não bloqueia a home", async () => {
    mocks.load.mockRejectedValue(new Error("PRIVATE_PROVIDER_DIAGNOSTIC"));
    await expect(HomePage()).resolves.toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("recusa do recurso e troca de senha têm precedência, sem consulta opcional", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(HomePage()).rejects.toThrow("FORBIDDEN");
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
    mocks.requireUser.mockRejectedValueOnce(new Error("REDIRECT:/trocar-senha"));
    await expect(HomePage()).rejects.toThrow("REDIRECT:/trocar-senha");
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
