import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), auth: vi.fn(), factory: vi.fn(), observe: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.auth }));
vi.mock("../../src/adapters/db/image-upload-observation-runtime", () => ({ imageUploadObservationForRequest: seams.factory }));
import { GET } from "../../src/app/api/files/uploads/observe/route";
const user = "10000000-0000-4000-8000-000000000001", id = "10000000-0000-4000-8000-000000000002";
const actor = { userId: user, sessionId: id, mustChangePassword: false, role: "user", entitlements: {} };
const query = `version=1&purpose=project_cover&upload=${id}&client_id=original-reservation`;
const request = (search = query, expected = user) => new Request(`http://127.0.0.1:3000/api/files/uploads/observe?${search}`, { headers: expected ? { "X-Expected-User-ID": expected } : {} });
beforeEach(() => { vi.resetAllMocks(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: "http://127.0.0.1:3000" }); seams.auth.mockResolvedValue({ gateway: { readIdentity: async () => actor } }); seams.factory.mockReturnValue({ observe: seams.observe }); seams.observe.mockResolvedValue({ version: 1, user_id: user, upload_id: id, purpose: "project_cover", state: "indeterminate", file: null }); });
describe("Image observation cookie-only route", () => {
  it("passes only the closed intention and returns private no-store without capabilities", async () => {
    const result = await GET(request()); expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toContain("private, no-store");
    expect(seams.observe).toHaveBeenCalledWith(id, "project_cover", "original-reservation"); expect(Object.keys(await result.json()).sort()).toEqual(["file", "purpose", "state", "upload_id", "user_id", "version"]);
  });
  it.each([null, { ...actor, userId: id }, { ...actor, mustChangePassword: true }, { ...actor, entitlements: { projetos: false } }])("refuses visitors, switched account, password requirement and feature veto %#", async identity => {
    seams.auth.mockResolvedValue({ gateway: { readIdentity: async () => identity } }); expect([401, 403, 409]).toContain((await GET(request())).status); expect(seams.factory).not.toHaveBeenCalled();
  });
  it.each([query + "&path=free", query + "&version=1", query.replace("version=1", "version=2"), query.replace("project_cover", "habit_image"), query.replace("project_cover", "finance_goal_image"), query.replace("original-reservation", ""), query.replace(id, "invalid")])("rejects paths, duplicate/version/future-purpose and malformed parameters %#", async search => {
    expect((await GET(request(search))).status).toBe(400); expect(seams.factory).not.toHaveBeenCalled();
  });
  it("requires expected owner and authorizes Home independently of Drive/Settings", async () => {
    expect((await GET(request(query, ""))).status).toBe(400); expect(seams.factory).not.toHaveBeenCalled();
    seams.auth.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...actor, entitlements: { drive: false, configuracoes: false } }) } });
    expect((await GET(request(query.replace("project_cover", "home_focus_image")))).status).toBe(200);
  });
});
