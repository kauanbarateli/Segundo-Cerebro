/** Narrow auxiliary image-read seam. It does not certify Next/Auth/Storage. */
interface ImageReadRequest {
  method(): string;
  url(): string;
  postData(): string | null;
  headers(): Record<string, string>;
}
export function isHomeImageRead(request: ImageReadRequest, origin: string, owner: string) {
  return request.method() === "GET" && request.postData() === null &&
    request.url() === `${origin}/api/files/entity-image?purpose=home_focus_image&entity=${owner}` &&
    request.headers()["x-expected-user-id"] === owner;
}
export function emptyHomeImage(owner: string) {
  return { version: 1, user_id: owner, id: owner, purpose: "home_focus_image", file_id: null };
}
