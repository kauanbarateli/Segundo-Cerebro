import { assinatura } from "../../../core/contracts/base";

/** One operation keeps its identity until acknowledged; unknown outcomes cannot change payload. */
export class CaptureRequests {
  private requests = new Map<string, { fingerprint: string; clientId: string; unknown: boolean }>();
  id(key: string, payload: unknown): string {
    const fingerprint = assinatura(payload), current = this.requests.get(key);
    if (current?.unknown && current.fingerprint !== fingerprint) throw new Error("Confirme o envio anterior antes de alterar a nota.");
    if (current?.fingerprint === fingerprint) return current.clientId;
    const clientId = crypto.randomUUID(); this.requests.set(key, { fingerprint, clientId, unknown: false }); return clientId;
  }
  unknown(key: string) { const request = this.requests.get(key); if (request) request.unknown = true; }
  has(key: string) { return this.requests.has(key); }
  matches(key: string, payload: unknown) { return this.requests.get(key)?.fingerprint === assinatura(payload); }
  complete(key: string) { this.requests.delete(key); }
}
