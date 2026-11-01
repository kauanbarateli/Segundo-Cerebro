/** Optional, untrusted campaign values submitted with one signup intent. */
export const SIGNUP_UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type SignupUtmField = (typeof SIGNUP_UTM_FIELDS)[number];
export type SignupOrigin = Readonly<Partial<Record<SignupUtmField, string>>>;

/** This only validates a submitted snapshot; it performs no collection or persistence. */
export function parseSignupOrigin(consented: boolean, candidate: unknown): SignupOrigin | null {
  if (!consented || !candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const result: Partial<Record<SignupUtmField, string>> = {};
  for (const field of SIGNUP_UTM_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(candidate, field);
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string") continue;
    const value = descriptor.value.normalize("NFC").trim();
    if (!value || [...value].length > 200 || /[\u0000-\u001f\u007f-\u009f<>]/u.test(value)) continue;
    result[field] = value;
    if (new TextEncoder().encode(JSON.stringify(result)).length > 1024) delete result[field];
  }
  return Object.keys(result).length ? result : null;
}
