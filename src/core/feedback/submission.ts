import { exigir } from "../contracts/base";

export const FEEDBACK_CATEGORIES = ["suggestion", "complaint", "problem", "improvement", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export interface FeedbackSubmission { readonly category: FeedbackCategory; readonly text: string; readonly clientId: string }

/** Decode only user input; author and timestamps come from the authenticated channel. */
export function decodeFeedbackSubmission(input: unknown): FeedbackSubmission {
  exigir(input !== null && typeof input === "object" && !Array.isArray(input), "Envio inválido.");
  const value = input as Record<string, unknown>;
  exigir(Object.keys(value).every((key) => ["category", "text", "clientId"].includes(key)), "Envio inválido.");
  exigir(typeof value.category === "string" && FEEDBACK_CATEGORIES.includes(value.category as FeedbackCategory), "Escolha uma categoria.");
  exigir(typeof value.text === "string" && value.text.length <= 10000, "Revise sua mensagem.");
  const text = value.text.normalize("NFC").trim();
  exigir([...text].length >= 10 && [...text].length <= 5000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text), "Escreva uma mensagem entre 10 e 5.000 caracteres.");
  exigir(typeof value.clientId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.clientId), "Envio inválido.");
  return { category: value.category as FeedbackCategory, text, clientId: value.clientId.toLowerCase() };
}
