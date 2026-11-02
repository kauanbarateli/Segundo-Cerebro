"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type State = "loading" | "active" | "absent" | "withdrawn" | "closed" | "error" | "uncertain" | "stale";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function result(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if (Object.keys(envelope).sort().join(",") !== "ok,result" || envelope.ok !== true || !envelope.result || typeof envelope.result !== "object" || Array.isArray(envelope.result)) return null;
  return envelope.result as Record<string, unknown>;
}

export function OriginWithdrawalV2({ userId }: { userId: string }) {
  const [state, setState] = useState<State>("loading"), [busy, setBusy] = useState(false);
  const revision = useRef<string | null>(null), generation = useRef(0), writing = useRef(false), recheck = useRef(false);
  const load = useCallback(async () => {
    const id = ++generation.current; revision.current = null; setState("loading");
    try {
      const response = await fetch("/api/signup-origin-v2", { cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "x-expected-user-id": userId } });
      if ([401, 403, 409].includes(response.status)) { if (id === generation.current) setState("closed"); return; }
      const value = result(await response.json());
      if (!response.ok || !value || Object.keys(value).sort().join(",") !== "revision,status") throw new Error("unavailable");
      if (value.status === "active" && typeof value.revision === "string" && UUID.test(value.revision)) {
        if (id === generation.current) { revision.current = value.revision; setState("active"); }
      } else if (value.status === "absent" && value.revision === null) {
        if (id === generation.current) setState("absent");
      } else throw new Error("unavailable");
    } catch { if (id === generation.current) setState("error"); }
  }, [userId]);
  useEffect(() => {
    const current = generation; void load();
    const verify = () => {
      if (document.visibilityState !== "visible") return;
      if (writing.current) { recheck.current = true; setState("loading"); } else void load();
    };
    window.addEventListener("focus", verify); document.addEventListener("visibilitychange", verify);
    return () => { current.current++; window.removeEventListener("focus", verify); document.removeEventListener("visibilitychange", verify); };
  }, [load]);
  async function withdraw() {
    const expected = revision.current;
    if (writing.current || !expected || !["active", "uncertain"].includes(state)) return;
    const id = ++generation.current; writing.current = true; setBusy(true);
    try {
      const response = await fetch("/api/signup-origin-v2", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", "x-expected-user-id": userId }, body: JSON.stringify({ revision: expected }) });
      if ([401, 403, 409].includes(response.status)) { if (id === generation.current) { revision.current = null; setState("closed"); } return; }
      const value = result(await response.json());
      if (!response.ok || !value || Object.keys(value).join(",") !== "status" || !["withdrawn", "absent", "stale"].includes(String(value.status))) throw new Error("unavailable");
      if (id === generation.current) { revision.current = null; setState(value.status as "withdrawn" | "absent" | "stale"); }
    } catch { if (id === generation.current) setState("uncertain"); }
    finally {
      writing.current = false;
      if (id === generation.current) { setBusy(false); if (recheck.current) { recheck.current = false; void load(); } }
    }
  }
  return <div className="legal-origin-control">
    {state === "loading" ? <p role="status">Verificando sua escolha…</p> :
      state === "closed" ? <p role="alert">Não foi possível confirmar sua conta. Entre novamente e atualize esta página.</p> :
      state === "error" ? <><p role="alert">Não foi possível verificar sua escolha.</p><Button onClick={() => void load()}>Verificar novamente</Button></> :
      state === "stale" ? <><p role="alert">Sua escolha mudou. Revise o consentimento atual antes de retirá-lo.</p><Button onClick={() => void load()}>Revisar escolha</Button></> :
      state === "uncertain" ? <><p role="alert">Não foi possível confirmar a retirada. Você pode tentar novamente a mesma solicitação.</p><Button onClick={() => void withdraw()} loading={busy}>Tentar novamente</Button></> :
      state === "active" ? <><p>Você autorizou o uso da origem informada no cadastro.</p><Button onClick={() => void withdraw()} loading={busy}>Retirar consentimento</Button></> :
      <p role="status">{state === "withdrawn" ? "Consentimento retirado." : "Não há consentimento ativo para a origem de cadastro."}</p>}
  </div>;
}
