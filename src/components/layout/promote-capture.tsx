"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess } from "@/core/access/resolve-access";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

export function PromoteCapture({ captureId, disabled }: { captureId: string; disabled?: boolean }) {
  const app = useDemoApplication(), { policy } = useDemoAccess(), router = useRouter();
  const [open, setOpen] = useState(false), [books, setBooks] = useState<{ id: string; name: string }[]>([]), [book, setBook] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  if (app.mode !== "connected" || !resolveAccess("conhecimento", policy).allowed) return null;
  async function choose() {
    setOpen(true); setBusy(true); setError("");
    try { const reply = await fetch("/api/knowledge", { headers: { "X-Expected-User-ID": app.userId }, credentials: "same-origin", cache: "no-store", redirect: "error" }); const value = await reply.json() as { notebooks?: { id: string; name: string; user_id: string; deleted_at: string | null }[] };
      if (!reply.ok || !Array.isArray(value.notebooks) || value.notebooks.some(row => row.user_id !== app.userId)) throw new Error("Não foi possível carregar seus cadernos. Tente novamente.");
      const available = value.notebooks.filter(row => !row.deleted_at); setBooks(available); setBook(available[0]?.id ?? "");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível carregar."); } finally { setBusy(false); }
  }
  async function promote() {
    setBusy(true); setError("");
    try { const result = await app.executeDomainCommand("knowledge.page.promote-capture", { client_id: crypto.randomUUID(), capture_id: captureId, notebook_id: book }) as { page: { id: string } }; setOpen(false); router.push(`/conhecimento?note=${encodeURIComponent(result.page.id)}`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível confirmar. Use o envio protegido para tentar novamente."); } finally { setBusy(false); }
  }
  return <><Button variant="ghost" disabled={disabled || busy} onClick={() => void choose()}>Guardar em Conhecimento</Button>
    {open && <Dialog open onClose={() => { if (!busy) setOpen(false); }} title="Guardar em Conhecimento" description="A captura será arquivada e seu conteúdo passará a ser editado nesta página.">
      {error && <p role="alert">{error}</p>}{busy && !books.length ? <p role="status">Carregando cadernos…</p> : books.length ? <form onSubmit={event => { event.preventDefault(); void promote(); }}><Field as="select" label="Caderno de destino" value={book} onChange={event => setBook(event.target.value)} disabled={busy}>{books.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Field><Button type="submit" loading={busy} disabled={!book}>Guardar página</Button></form> : <p>Crie um caderno em Conhecimento antes de guardar esta captura.</p>}
    </Dialog>}
  </>;
}
