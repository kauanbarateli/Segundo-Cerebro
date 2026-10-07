import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthGuardError } from "../src/lib/auth/types";
import { DemoAccessProvider, useDemoAccess } from "../src/lib/navigation/demo-access-provider";

const mocks = vi.hoisted(() => ({ mode: vi.fn(), feature: vi.fn(), notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("../src/lib/auth/config", () => ({ getAppMode: mocks.mode }));
vi.mock("../src/lib/auth/guards", () => ({ requireFeature: mocks.feature }));
import { authorizeWorkspaceFeature } from "../src/lib/auth/workspace-guard";

describe("workspace server boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.mode.mockReturnValue("supabase"); mocks.feature.mockResolvedValue({}); });
  it("does not contact authentication for the explicit demo", async () => {
    mocks.mode.mockReturnValue("demo");
    await authorizeWorkspaceFeature("admin");
    expect(mocks.feature).not.toHaveBeenCalled();
  });
  it("revalidates authorization per page render, including repeated navigation", async () => {
    await authorizeWorkspaceFeature("configuracoes");
    mocks.feature.mockRejectedValueOnce(new AuthGuardError("forbidden"));
    await expect(authorizeWorkspaceFeature("configuracoes")).rejects.toThrow("NOT_FOUND");
    expect(mocks.feature.mock.calls).toEqual([["configuracoes"], ["configuracoes"]]);
  });
  it("preserves redirects and unavailable errors instead of falling back to a demo", async () => {
    for (const error of [new Error("NEXT_REDIRECT"), new AuthGuardError("unavailable")]) {
      mocks.feature.mockRejectedValueOnce(error);
      await expect(authorizeWorkspaceFeature("tarefas")).rejects.toBe(error);
    }
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
  it("presents only the server policy when connected, with no initial demo grants", () => {
    function Consumer() {
      const { policy, ready, connected } = useDemoAccess();
      return createElement("output", null, JSON.stringify({ policy, ready, connected }));
    }
    const policy = { entitlements: { tarefas: false }, preferences: {}, isAdmin: false };
    const html = renderToStaticMarkup(<DemoAccessProvider serverPolicy={policy}><Consumer /></DemoAccessProvider>);
    expect(html).toContain("&quot;tarefas&quot;:false");
    expect(html).toContain("&quot;ready&quot;:true");
    expect(html).toContain("&quot;connected&quot;:true");
  });
});
