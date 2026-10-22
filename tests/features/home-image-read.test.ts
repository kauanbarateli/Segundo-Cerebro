import { describe, expect, it } from "vitest";
import { emptyHomeImage, isHomeImageRead } from "../e2e/helpers/home-image-read";

const origin = "https://image-fixture.test", owner = "a0000000-0000-4000-8000-000000000001";
const path = "/api/files/entity-image?purpose=home_focus_image&entity=" + owner;
function request(overrides: { method?: string; url?: string; body?: string | null; owner?: string } = {}) {
  return { method: () => overrides.method ?? "GET", url: () => overrides.url ?? origin + path,
    postData: () => overrides.body ?? null, headers: () => ({ "x-expected-user-id": overrides.owner ?? owner }) };
}
describe("auxiliary home image read boundary", () => {
  it("accepts only the exact owned GET and declares a null-image fixture", () => {
    expect(isHomeImageRead(request(), origin, owner)).toBe(true);
    expect(emptyHomeImage(owner)).toEqual({ version: 1, user_id: owner, id: owner, purpose: "home_focus_image", file_id: null });
  });
  for (const method of ["POST", "HEAD", "PUT", "DELETE"]) it(`refuses ${method}`, () => {
    expect(isHomeImageRead(request({ method }), origin, owner)).toBe(false);
  });
  it("refuses a body or another expected owner", () => {
    expect(isHomeImageRead(request({ body: "{}" }), origin, owner)).toBe(false);
    expect(isHomeImageRead(request({ body: "" }), origin, owner)).toBe(false);
    expect(isHomeImageRead(request({ owner: "20000000-0000-4000-8000-000000000001" }), origin, owner)).toBe(false);
  });
  for (const url of [
    "https://foreign.test" + path, "https://image-fixture.test:444" + path,
    "https://user:password@image-fixture.test" + path, origin + path + "#fragment",
    origin + path + "&extra=1", origin + path + "&entity=" + owner,
    origin + "/api/files/entity-image?entity=" + owner + "&purpose=home_focus_image",
    origin + path.replace("home_focus_image", "project_cover"), origin + path.replace("home_focus_image", "home%5Ffocus_image"),
    origin + path.replace(owner, owner.toUpperCase()), origin + path.replace(owner, "20000000-0000-4000-8000-000000000001"),
    origin + path.replace("entity-image?", "entity-image/?"), origin + "/api/files/read?id=" + owner,
  ].filter(url => url !== origin + path)) it(`refuses a noncanonical URL ${url}`, () => {
    expect(isHomeImageRead(request({ url }), origin, owner)).toBe(false);
  });
});
