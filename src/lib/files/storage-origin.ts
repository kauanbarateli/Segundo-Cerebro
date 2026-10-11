/** Public origin only. Credentials and environment resolution stay on the server. */
export const PERSONAL_STORAGE_ORIGIN = "https://rishenjoikgmfubmnfiu.supabase.co";
export const LOCAL_STORAGE_ORIGIN = "http://127.0.0.1:54321";
export type StorageOrigin = typeof PERSONAL_STORAGE_ORIGIN | typeof LOCAL_STORAGE_ORIGIN;

export function isStorageOrigin(value: unknown): value is StorageOrigin {
  return value === PERSONAL_STORAGE_ORIGIN || value === LOCAL_STORAGE_ORIGIN;
}

export function signedUploadUrl(value: unknown, expectedOrigin: StorageOrigin, owner: string, upload: string, token: unknown): string | null {
  if (!isStorageOrigin(expectedOrigin) || typeof value !== "string" || value.length > 32768 || typeof token !== "string" || !token || token.length > 16384 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(upload)) return null;
  const path = `/storage/v1/object/upload/sign/second-brain-staging/${owner}/${upload}`;
  // Literal prefix also refuses decimal-IP, localhost and encoded-path aliases.
  if (!value.startsWith(expectedOrigin + path + "?")) return null;
  try {
    const url = new URL(value);
    if (url.origin !== expectedOrigin || url.pathname !== path || url.username || url.password || url.hash || url.searchParams.size !== 1 || url.searchParams.get("token") !== token) return null;
    return url.href;
  } catch { return null; }
}
