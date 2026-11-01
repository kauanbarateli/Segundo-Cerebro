/** Closed transport contract: any ambiguous result is treated as uncertain. */
export type SignupReply = "sent" | "invalid" | "wait" | "unavailable" | "uncertain";
export function classifySignupReply(httpOk: boolean, value: unknown): SignupReply {
  if (!httpOk || !value || typeof value !== "object" || Array.isArray(value)) return "uncertain";
  const data = value as Record<string, unknown>;
  if (Object.keys(data).join(",") !== "status") return "uncertain";
  return data.status === "sent" || data.status === "invalid" || data.status === "wait" || data.status === "unavailable" ? data.status : "uncertain";
}
