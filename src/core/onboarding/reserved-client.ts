import { ErroDeDominio } from "../contracts/base";

/** Ordinary HTTP entry points cannot submit the coordinator's reserved IDs.
 * The SQL transaction permit remains the authority, including for direct RPCs. */
export function assertOrdinaryClientId(value:unknown):void {
  if(typeof value==="string"&&value.startsWith("onb:"))throw new ErroDeDominio("VALIDATION","Identificação de envio reservada.");
}
