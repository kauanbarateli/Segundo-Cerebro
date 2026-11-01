/**
 * Contract between the public presentation (Frente A) and the signup flow (Frente B).
 *
 * The landing page only reads this value on the server and never from a query string,
 * cookie or the existence of a page. It is closed by default: the landing offers the
 * existing login until the signup flow is complete and its producer returns `available`.
 * Server-side enforcement of signup belongs to the flow itself, not to this value.
 */
export interface SignupCapability {
  available: boolean;
}

export const SIGNUP_PATH = "/criar-conta";
export const LOGIN_PATH = "/entrar";

/** Replaced by the real server composition when the signup flow is operational. */
export function readSignupCapability(): SignupCapability {
  return { available: false };
}
