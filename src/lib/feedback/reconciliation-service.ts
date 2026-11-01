import type { AuthenticatedIdentity } from '../auth/types';
import type { FeedbackSubmission } from '../../core/feedback/submission';
import type { BarrierResult } from '../../core/feedback/barrier-contract';

export type Command = {action:'status'|'cancel';clientId:string}|{action:'submit';input:FeedbackSubmission};
export class ReconciliationUnavailable extends Error {}
export interface ReconciliationPorts {
  ready():boolean;
  perform(actor:AuthenticatedIdentity,command:Command):Promise<BarrierResult>;
}
/** Actor is derived by the server, not from ownerBinding or the request body. */
export async function runReconciliation(ports:ReconciliationPorts,actor:AuthenticatedIdentity,command:Command):Promise<BarrierResult> {
  if(!ports.ready()||actor.mustChangePassword)throw new ReconciliationUnavailable();
  return ports.perform(actor,command);
}
