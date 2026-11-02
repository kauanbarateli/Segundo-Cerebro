"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type State = "loading" | "active" | "absent" | "withdrawn" | "closed" | "error" | "uncertain";
function result(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if (Object.keys(envelope).sort().join(",") !== "ok,result" || envelope.ok !== true || !envelope.result || typeof envelope.result !== "object" || Array.isArray(envelope.result)) return null;
  return envelope.result as Record<string, unknown>;
}
function status(value: unknown): "active" | "absent" | null {
  const row = result(value);
  if (!row || Object.keys(row).sort().join(",") !== "expiresAt,status") return null;
  if (row.status === "absent" && row.expiresAt === null) return "absent";
  if (row.status === "active" && typeof row.expiresAt === "string" && Number.isFinite(Date.parse(row.expiresAt))) return "active";
  return null;
}

export function OriginWithdrawal({ userId }: { userId: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const writing = useRef(false);
  const recheckAfterWrite = useRef(false);
  const pendingKey = `sc-origin-withdrawal-pending:${userId}`;
  const load = useCallback(async () => {
    const id = ++generation.current;
    setState("loading"); setBusy(false);
    try {
      const response = await fetch("/api/signup-origin", { cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "x-expected-user-id": userId } });
      if ([401, 403, 409].includes(response.status)) { if (id === generation.current) setState("closed"); return; }
      const current = status(await response.json());
      if (!response.ok || !current) throw new Error("unavailable");
      let pending = true;
      try { pending = window.sessionStorage.getItem(pendingKey) === "1"; } catch { /* Fail closed without a durable marker. */ }
      if (id === generation.current) setState(pending ? "uncertain" : current);
    } catch { if (id === generation.current) setState("error"); }
  }, [userId, pendingKey]);
  useEffect(() => {
    const current = generation; void load();
    const recheck = () => {
      if (document.visibilityState !== "visible") return;
      if (writing.current) { recheckAfterWrite.current = true; setState("loading"); return; }
      void load();
    };
    window.addEventListener("focus", recheck); document.addEventListener("visibilitychange", recheck);
    return () => { current.current++; window.removeEventListener("focus", recheck); document.removeEventListener("visibilitychange", recheck); };
  }, [load]);
  async function withdraw() {
    if (writing.current || state !== "active") return;
    try {
      if (window.sessionStorage.getItem(pendingKey) === "1") { setState("uncertain"); return; }
      window.sessionStorage.setItem(pendingKey, "1");
      if (window.sessionStorage.getItem(pendingKey) !== "1") { setState("uncertain"); return; }
    } catch { setState("uncertain"); return; }
    const id = ++generation.current; writing.current = true; setBusy(true);
    try {
      const response = await fetch("/api/signup-origin", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", "x-expected-user-id": userId }, body: "{}" });
      if ([401, 403, 409].includes(response.status)) {
        // These statuses are emitted by the route before invoking the RPC.
        try { window.sessionStorage.removeItem(pendingKey); } catch { /* A stale marker only blocks a later attempt. */ }
        if (id === generation.current) setState("closed");
        return;
      }
      const row = result(await response.json());
      if (!response.ok || !row || Object.keys(row).join(",") !== "status" || !["withdrawn", "absent"].includes(String(row.status))) throw new Error("unavailable");
      try { window.sessionStorage.removeItem(pendingKey); } catch { /* A stale marker only blocks a later attempt. */ }
      if (id === generation.current) setState(row.status === "withdrawn" ? "withdrawn" : "absent");
    } catch { if (id === generation.current) setState("uncertain"); }
    finally {
      writing.current = false;
      if (id === generation.current) {
        setBusy(false);
        if (recheckAfterWrite.current) { recheckAfterWrite.current = false; void load(); }
      }
    }
  }
  return <div className="legal-origin-control">
    {state === "loading" ? <p role="status">Verificando sua escolha…</p> :
      state === "closed" ? <p role="alert">Não foi possível confirmar sua conta. Entre novamente e atualize esta página.</p> :
      state === "uncertain" ? <><p role="alert">Não foi possível confirmar a retirada. Não envie outra solicitação nesta aba; procure o suporte se precisar de ajuda.</p><Button onClick={() => void load()}>Verificar novamente</Button></> :
      state === "error" ? <><p role="alert">Não foi possível confirmar sua escolha. Verifique novamente antes de tentar retirar o consentimento.</p><Button onClick={() => void load()}>Verificar novamente</Button></> :
      state === "active" ? <><p>Você autorizou o uso da origem informada no cadastro.</p><Button onClick={() => void withdraw()} loading={busy}>Retirar consentimento</Button></> :
      <p role="status">{state === "withdrawn" ? "Consentimento retirado." : "Não há consentimento ativo para a origem de cadastro."}</p>}
  </div>;
}
