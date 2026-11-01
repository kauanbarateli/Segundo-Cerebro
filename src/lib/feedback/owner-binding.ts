import 'server-only';
import { createHmac } from 'node:crypto';
/** Pseudonym is per user and purpose, not authorization. Rotation is unresolved. */
export function feedbackOwnerBinding(secret:string,userId:string):string {
  return createHmac('sha256',secret).update(JSON.stringify(['feedback-marker-owner-v1',userId])).digest('base64url');
}
