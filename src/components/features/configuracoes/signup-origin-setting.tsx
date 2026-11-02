"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import "./signup-origin-setting.css";

type OriginState = { status: "active"; expiresAt: string } | { status: "absent"; expiresAt: null };
function parse(value: unknown): OriginState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== "expiresAt,status") return null;
  if (row.status === "absent" && row.expiresAt === null) return { status: "absent", expiresAt: null };
  if (row.status === "active" && typeof row.expiresAt === "string" && Number.isFinite(Date.parse(row.expiresAt))) return { status: "active", expiresAt: row.expiresAt };
  return null;
}

/** Compose inside authenticated Settings with key={userId}. */
export function SignupOriginSetting({ userId }: { userId: string }) {
  const [origin, setOrigin] = useState<OriginState | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [owner, setOwner] = useState(userId);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++generation.current; setOwner(userId); setLoading(true); setError("");
    try {
      const response = await fetch("/api/signup-origin", { cache: "no-store", headers: { "x-expected-user-id": userId } });
      const body: unknown = await response.json();
      const next = body && typeof body === "object" && "result" in body ? parse(body.result) : null;
      if (!response.ok || !next) throw new Error("unavailable");
      if (requestId === generation.current) setOrigin(next);
    } catch { if (requestId === generation.current) { setOrigin(null); setError("Não foi possível carregar sua escolha."); } }
    finally { if (requestId === generation.current) setLoading(false); }
  }, [userId]);
  useEffect(() => { const current = generation; setOrigin(null); setBusy(false); void load(); return () => { current.current++; }; }, [load]);
  async function withdraw() {
    if (busy) return;
    const requestId = ++generation.current;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/signup-origin", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "x-expected-user-id": userId }, body: "{}" });
      const body: unknown = await response.json();
      if (!response.ok || !body || typeof body !== "object" || !("result" in body) || !body.result || typeof body.result !== "object" || !("status" in body.result) || !["withdrawn", "absent"].includes(String(body.result.status))) throw new Error("unavailable");
      if (requestId === generation.current) setOrigin({ status: "absent", expiresAt: null });
    } catch { if (requestId === generation.current) setError("Não foi possível confirmar a retirada. Atualize o estado e tente novamente."); }
    finally { if (requestId === generation.current) setBusy(false); }
  }
  return <section className="signup-origin-setting" aria-labelledby="signup-origin-title">
    <div><h3 id="signup-origin-title">Origem do cadastro</h3><p>Escolha se a origem informada no cadastro pode ser usada em métricas.</p></div>
    {loading || owner !== userId ? <p role="status">Carregando sua escolha…</p> : error ? <><p role="alert">{error}</p><Button onClick={() => void load()} disabled={busy}>Atualizar estado</Button></> : origin?.status === "active" ? <>
      <p>Permitido até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Fortaleza" }).format(new Date(origin.expiresAt))}.</p>
      <Button onClick={() => void withdraw()} disabled={busy}>{busy ? "Retirando…" : "Retirar consentimento"}</Button>
    </> : <p>Não há origem de cadastro ativa.</p>}
  </section>;
}
