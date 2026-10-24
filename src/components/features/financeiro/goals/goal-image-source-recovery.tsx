"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EntityImagePicker } from "@/components/layout/entity-image-picker";
import { nomeSeguroArquivo } from "@/core/drive/rules";
import type { GoalImageSourceCapability, GoalImageSourceHandle, GoalImageSourceView } from "./goal-image-host-binding";

/** Original-source recovery only. No GoalCommand, prepare/select/financial UUID,
 * ready proof, local clear or replacement authority enters this surface. */
export function GoalImageSourceRecovery({ source, hidden, newImagesEnabled, current, onActive, onReturn }: {
  source: GoalImageSourceCapability; hidden: boolean; newImagesEnabled: boolean;
  current(): boolean; onActive(): void; onReturn(): Promise<void>;
}) {
  const [view, setView] = useState<GoalImageSourceView | null>(() => { try { return source.describe(); } catch { return null; } });
  const [status, setStatus] = useState<"idle" | "ready" | "need-file" | "held">("idle"), [working, setWorking] = useState(false), [error, setError] = useState<string | null>(null);
  const handle = useRef<GoalImageSourceHandle | null>(null), active = useRef(false), running = useRef(false), generation = useRef(0), errorRef = useRef<HTMLParagraphElement>(null), id = useId();
  const latest = useRef({ source, hidden, current }); latest.current = { source, hidden, current };
  const closeSource = useCallback(() => {
    active.current = false; generation.current++; running.current = false;
    const own = handle.current; handle.current = null; own?.dispose();
  }, []);
  useLayoutEffect(() => {
    active.current = !hidden;
    setStatus("idle"); setError(null); setWorking(false);
    if (!hidden) { try { setView(source.describe()); } catch { setView(null); } }
    return closeSource;
  }, [source, hidden, closeSource]);
  function live(token: number, original: GoalImageSourceCapability) { return active.current && generation.current === token && latest.current.source === original && !latest.current.hidden && latest.current.current(); }
  async function action(work: (guard: () => void) => Promise<void>) {
    if (running.current || hidden || !current()) return;
    const token = generation.current, original = source, guard = () => { if (!live(token, original)) throw Error("SOURCE_SESSION_CHANGED"); };
    running.current = true; setWorking(true); setError(null);
    try { guard(); await work(guard); guard(); }
    catch { if (live(token, original)) { setError("O envio original continua protegido. Confira a sessão e escolha o mesmo arquivo para retomar; esta etapa não salva nem desfaz uma meta."); requestAnimationFrame(() => { if (live(token, original)) errorRef.current?.focus(); }); } }
    finally { if (live(token, original)) { running.current = false; setWorking(false); } }
  }
  async function open() {
    await action(async guard => {
      if (handle.current) { const own = handle.current; guard(); setView(own.view()); return; }
      onActive(); guard(); const own = await source.open();
      try { guard(); handle.current = own; setView(own.view()); }
      catch (failure) { own.dispose(); throw failure; }
    });
  }
  async function reselect(file: File | null) {
    if (!file || !view || !handle.current) return;
    try { if (nomeSeguroArquivo(file.name) !== view.name || file.size !== view.bytes || file.type !== view.mime) throw Error("SOURCE_FILE_DIFFERS"); }
    catch { setError("Escolha o arquivo original com o mesmo nome, tamanho e formato. O envio protegido não foi substituído."); return; }
    const own = handle.current;
    await action(async guard => { await own.reselect(file); guard(); if (handle.current !== own || !own.current()) throw Error("SOURCE_CHANGED"); setView(own.view()); setStatus("idle"); });
  }
  async function resume() {
    const own = handle.current; if (!own) return;
    await action(async guard => { const result = await own.resume(); guard(); if (handle.current !== own || !own.current()) throw Error("SOURCE_CHANGED"); setView(own.view()); if (result === "stale") throw Error("SOURCE_CHANGED"); setStatus(result); });
  }
  if (hidden) return null;
  return <section className="fg-notice" aria-label="Recuperar envio original" aria-describedby={`${id}-help`}>
    <p><strong>Há um envio de foto de outra edição.</strong></p>
    <p id={`${id}-help`}>Você pode concluir somente aquele envio e depois voltar à meta atual. Nenhuma foto será vinculada aqui; a troca e a revisão financeira exigem ações separadas.</p>
    {view && <p className="fg-edit-hint">Arquivo original: {view.name}. Escolher outro arquivo não substitui esse envio.</p>}
    {!newImagesEnabled && <p className="fg-edit-hint">Novos envios estão desativados nesta sessão. A finalização original continua disponível quando essa etapa já foi alcançada; as demais fases permanecem protegidas.</p>}
    {error && <p className="fg-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
    <p role="status">{status === "ready" ? "O envio original foi concluído. A meta atual ainda não foi alterada. Volte e reconfira a recuperação antes de trocar a foto." : status === "need-file" ? "Escolha novamente o arquivo original para continuar." : status === "held" ? "Ainda não foi possível confirmar o envio original. Nenhuma outra foto foi admitida." : "O envio será consultado somente por sua ação."}</p>
    <div className="fg-actions"><Button disabled={working || !view} loading={working} onClick={() => void open()}>Consultar fonte original</Button>
      <Button disabled={working || !handle.current} onClick={() => void resume()}>Retomar envio original</Button>
      <Button disabled={working} onClick={() => void action(async guard => { await onReturn(); guard(); })}>Voltar à edição atual</Button></div>
    {handle.current && <EntityImagePicker label="Arquivo original do envio" hint="Escolha o mesmo arquivo. O conteúdo e o hash serão conferidos antes de retomar; nenhum novo UUID de foto é criado." disabled={working || status === "ready"} onChange={event => { const file = event.target.files?.[0] ?? null; event.target.value = ""; void reselect(file); }} />}
  </section>;
}
