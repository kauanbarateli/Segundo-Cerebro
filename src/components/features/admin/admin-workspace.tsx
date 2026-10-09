"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AdminAction, AdminCommand, AdminOperation, AdminPhase, AdminSnapshot, AdminUserMetadata } from "@/core/admin";
import { decodeAdminCommand } from "@/core/admin";
import { DEMO_LOGOUT_EVENT, useDemoApplication } from "@/lib/demo/demo-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import "./admin.css";
import { CalendarAdminRuns } from "./calendar-admin-runs";

const actionLabels: Record<AdminAction, string> = { "admin.user.create": "Criar conta", "admin.user.block": "Bloquear conta", "admin.user.unblock": "Desbloquear conta", "admin.user.force_password": "Exigir troca de senha", "admin.user.role": "Alterar papel", "admin.user.entitlement": "Alterar acesso" };
const phaseLabels: Record<AdminPhase, string> = { reserved: "Reservada", auth_applied: "Auth confirmado", revoked: "Sessões encerradas", complete: "Concluída", needs_reconciliation: "Precisa de retomada" };
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sem acesso registrado";
function snapshot(value: unknown): value is AdminSnapshot { return !!value && typeof value === "object" && "users" in value && Array.isArray(value.users) && "audit" in value && Array.isArray(value.audit) && "operations" in value && Array.isArray(value.operations); }
function replyMessage(value: unknown, fallback: string) { return value && typeof value === "object" && "message" in value && typeof value.message === "string" ? value.message : fallback; }
type Confirmation = { request: Exclude<AdminCommand, { command: "admin.user.create" } | { command: "admin.operation.reconcile" }>; title: string; description: string; destructive: boolean };

export function AdminWorkspace() {
 const app = useDemoApplication();
 if (app.mode !== "connected") return <section className="admin-unavailable" data-access="allowed"><h2>Admin precisa de uma conta conectada</h2><p>A demonstração não consulta usuários nem executa ações administrativas.</p><Link href="/configuracoes">Rever opções da demonstração</Link></section>;
 return <ConnectedAdmin key={app.userId} userId={app.userId} />;
}

function ConnectedAdmin({ userId }: { userId: string }) {
 const [data, setData] = useState<AdminSnapshot | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
 const [error, setError] = useState(""), [message, setMessage] = useState(""), [confirmation, setConfirmation] = useState<Confirmation | null>(null);
 const [creating, setCreating] = useState(false), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [attempted, setAttempted] = useState(false);
 const createClientId = useRef<string | null>(null), submitting = useRef(false), lifetime = useRef<AbortController | null>(null), createButton = useRef<HTMLButtonElement>(null);
 const load = useCallback(async (signal?: AbortSignal) => {
  setLoading(true);
  try {
   const response = await fetch("/api/admin", { credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "X-Expected-User-ID": userId }, signal });
   const value: unknown = await response.json();
   if (!response.ok || !snapshot(value)) throw new Error(replyMessage(value, "Não foi possível carregar o Admin. Tente novamente."));
   if (!signal?.aborted) setData(value);
  } catch (failure) { if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível carregar o Admin."); }
  finally { if (!signal?.aborted) setLoading(false); }
 }, [userId]);
 useEffect(() => {
  const controller = new AbortController(); lifetime.current = controller;
  const exit = () => { controller.abort(); setPassword(""); setEmail(""); setData(null); setCreating(false); setConfirmation(null); };
  window.addEventListener(DEMO_LOGOUT_EVENT, exit);
  void load(controller.signal);
  return () => { controller.abort(); window.removeEventListener(DEMO_LOGOUT_EVENT, exit); };
 }, [load]);
 async function send(request: AdminCommand): Promise<boolean> {
  if (submitting.current || lifetime.current?.signal.aborted) return false;
  submitting.current = true; setBusy(true); setError(""); setMessage("");
  try {
   decodeAdminCommand(request);
   const response = await fetch("/api/admin", { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json", "X-Expected-User-ID": userId }, body: JSON.stringify(request), signal: lifetime.current?.signal });
   const value: unknown = await response.json();
   if (!response.ok || !value || typeof value !== "object" || !("result" in value) || !value.result || typeof value.result !== "object" || !("phase" in value.result) || value.result.phase !== "complete") throw new Error(replyMessage(value, "O resultado não foi confirmado. Atualize o estado antes de tentar novamente."));
   if (lifetime.current?.signal.aborted) return false;
   setMessage("Ação administrativa concluída."); await load(lifetime.current?.signal); return true;
  } catch (failure) {
   if (!lifetime.current?.signal.aborted) { setError(failure instanceof Error ? failure.message : "O resultado não foi confirmado. Confira as operações pendentes."); await load(lifetime.current?.signal); }
   return false;
  } finally { submitting.current = false; if (!lifetime.current?.signal.aborted) setBusy(false); }
 }
 function openCreation(operation?: AdminOperation) {
  createClientId.current = operation?.client_id ?? crypto.randomUUID(); setEmail(""); setPassword(""); setAttempted(false); setError(""); setCreating(true);
 }
 function closeCreation() { if (busy) return; setCreating(false); setEmail(""); setPassword(""); setAttempted(false); createClientId.current = null; }
 function confirm(user: AdminUserMetadata, command: Confirmation["request"]["command"], extra: { role?: "user" | "master"; allowed?: boolean } = {}) {
  const input = { client_id: crypto.randomUUID(), target_user_id: user.user_id, ...extra, ...(command === "admin.user.entitlement" ? { feature_key: "admin" as const } : {}) };
  const description = command === "admin.user.block" ? "O acesso será bloqueado e todas as sessões da conta serão encerradas. Uma falha mantém a conta protegida até a retomada."
   : command === "admin.user.unblock" ? "O bloqueio será removido depois da confirmação no Auth e do encerramento das sessões anteriores. A troca de senha obrigatória permanece, quando houver."
    : command === "admin.user.force_password" ? "Todas as sessões serão encerradas. No próximo acesso, a pessoa precisará trocar a senha antes de abrir qualquer módulo."
     : command === "admin.user.role" ? `O papel da conta passará para ${extra.role === "master" ? "master" : "usuário"}. Vetos individuais continuam valendo.`
      : `O acesso ao Admin será ${extra.allowed ? "permitido" : "vetado"} para esta conta. O papel de master continua necessário.`;
  setError(""); setConfirmation({ request: { command, input } as Confirmation["request"], title: `${actionLabels[command]}: ${user.email ?? user.user_id}`, description, destructive: command === "admin.user.block" || command === "admin.user.force_password" || extra.role === "user" || extra.allowed === false });
 }
 const name = (id: string) => data?.users.find(user => user.user_id === id)?.email ?? id;
 const columns: DataTableColumn<AdminUserMetadata>[] = [
  { id: "account", header: "Conta", accessor: user => `${user.email ?? ""} ${user.user_id}`, render: user => <div className="admin-account"><strong>{user.email ?? "Sem e-mail"}</strong><small>{user.user_id}</small><small>Criada em {formatDate(user.created_at)}</small></div> },
  { id: "role", header: "Papel", accessor: user => user.role, render: user => <div className="admin-status"><Badge>{user.role === "master" ? "Master" : "Usuário"}</Badge>{!user.admin_allowed && <span>Admin vetado</span>}</div> },
  { id: "access", header: "Acesso", accessor: user => user.status, render: user => <div className="admin-status"><Badge dot={user.status === "blocked" ? "danger" : "success"}>{user.status === "blocked" ? "Bloqueado" : "Ativo"}</Badge>{user.must_change_password && <span>Troca de senha obrigatória</span>}{user.pending_operation && <span>Operação pendente</span>}</div> },
  { id: "last_access", header: "Último acesso", accessor: user => user.last_sign_in_at, render: user => formatDate(user.last_sign_in_at) },
  { id: "sessions", header: "Sessões", accessor: user => user.active_sessions },
  { id: "actions", header: "Ações", accessor: () => "", sortable: false, searchable: false, render: user => {
   const disabled = busy || loading || !!user.pending_operation || user.user_id === userId;
   return <div className="admin-actions"><Button size="sm" disabled={disabled} onClick={() => confirm(user, user.status === "blocked" ? "admin.user.unblock" : "admin.user.block")}>{user.status === "blocked" ? "Desbloquear" : "Bloquear"}</Button><Button size="sm" disabled={disabled || user.status !== "active"} onClick={() => confirm(user, "admin.user.force_password")}>Exigir troca de senha</Button><Button size="sm" disabled={disabled} onClick={() => confirm(user, "admin.user.role", { role: user.role === "master" ? "user" : "master" })}>{user.role === "master" ? "Tornar usuário" : "Tornar master"}</Button>{user.role === "master" && <Button size="sm" disabled={disabled} onClick={() => confirm(user, "admin.user.entitlement", { allowed: !user.admin_allowed })}>{user.admin_allowed ? "Vetar Admin" : "Permitir Admin"}</Button>}{user.user_id === userId && <span>Sua conta · use Configurações para trocar sua senha</span>}</div>;
  } },
 ];
 return <div className="admin-workspace" data-access="allowed">
  <nav className="admin-navigation" aria-label="Nesta página"><a href="#usuarios">Usuários</a><a href="#pendencias">Operações pendentes</a><a href="#auditoria">Auditoria</a><a href="#sincronizacoes">Sincronizações</a></nav>
  <div className="admin-toolbar"><p>Administre contas e acompanhe ações administrativas. Os conteúdos pessoais dos módulos permanecem privados.</p><div><Button disabled={busy || loading} onClick={() => { setError(""); void load(lifetime.current?.signal); }}>Atualizar</Button><Button ref={createButton} variant="primary" disabled={busy || loading || !data} onClick={() => openCreation()}>Criar usuário</Button></div></div>
  {error && <p className="admin-feedback" role="alert">{error}</p>}<p className="admin-feedback" role="status">{message}</p>
  <section id="usuarios" className="admin-section" aria-labelledby="admin-users-title"><h2 id="admin-users-title">Usuários</h2><DataTable label="Usuários" rows={data?.users ?? []} columns={columns} getRowId={user => user.user_id} pageSize={10} searchLabel="Buscar por e-mail ou identificação" emptyMessage="Nenhuma conta disponível." loading={loading && !data} error={!data && !loading ? error || "Não foi possível carregar os usuários." : undefined} onRetry={() => void load(lifetime.current?.signal)} /></section>
  <section id="pendencias" className="admin-section" aria-labelledby="admin-pending-title"><h2 id="admin-pending-title">Operações pendentes</h2><p>Uma etapa não confirmada mantém a conta protegida. Retome somente depois de confirmar o término da execução anterior. Uma resposta incerta do Auth exige revisão operacional.</p>
   {!data ? <p>{loading ? "Carregando operações…" : "Atualize o estado para consultar as operações."}</p> : data.operations.length === 0 ? <p>Nenhuma operação pendente.</p> : <ul className="admin-pending-list">{data.operations.map(operation => <li key={operation.operation_id}><div><strong>{actionLabels[operation.command]}</strong><span>{name(operation.target_user_id)}</span><span>{phaseLabels[operation.phase]} · {formatDate(operation.updated_at)}</span><small>Identificação: {operation.operation_id}</small></div><div className="admin-actions"><Button disabled={busy || loading} onClick={() => void send({ command: "admin.operation.reconcile", input: { client_id: crypto.randomUUID(), operation_id: operation.operation_id } })}>Retomar operação</Button>{operation.command === "admin.user.create" && operation.actor_user_id === userId && <Button disabled={busy || loading} onClick={() => openCreation(operation)}>Reenviar criação</Button>}</div>{operation.command === "admin.user.create" && <p>Se o Auth ainda não criou a conta, o master que iniciou a operação deve reenviar o e-mail e a senha provisória originais. Esses dados não ficam guardados no histórico.</p>}</li>)}</ul>}
  </section>
  <section id="auditoria" className="admin-section" aria-labelledby="admin-audit-title"><h2 id="admin-audit-title">Auditoria</h2><p>As 200 etapas administrativas mais recentes, com autor, alvo e momento. Senhas e conteúdos pessoais não aparecem aqui.</p><DataTable label="Auditoria administrativa" rows={data?.audit ?? []} getRowId={entry => entry.id} pageSize={10} loading={loading && !data} emptyMessage="Nenhuma ação administrativa registrada." columns={[
   { id: "time", header: "Momento", accessor: entry => entry.occurred_at, render: entry => formatDate(entry.occurred_at) },
   { id: "action", header: "Ação", accessor: entry => actionLabels[entry.action] },
   { id: "actor", header: "Autor", accessor: entry => name(entry.actor_user_id) },
   { id: "target", header: "Alvo", accessor: entry => name(entry.target_user_id) },
   { id: "phase", header: "Etapa", accessor: entry => phaseLabels[entry.phase] },
  ]} /></section>
  <div id="sincronizacoes"><CalendarAdminRuns /></div>
  {confirmation && <ConfirmDialog open title={confirmation.title} description={confirmation.description} onClose={() => { if (!busy) setConfirmation(null); }} onConfirm={() => void send(confirmation.request).then(ok => { if (ok) setConfirmation(null); })} confirmLabel="Confirmar ação" destructive={confirmation.destructive} loading={busy} error={error || undefined} />}
  {creating && <Dialog open title="Criar usuário" description="A conta recebe o papel de usuário e precisa trocar a senha provisória no primeiro acesso, antes de abrir os módulos." onClose={closeCreation} returnFocusRef={createButton} dismissible={!busy} closeOnBackdrop={false}>
   <form className="admin-create-form" onSubmit={event => { event.preventDefault(); if (!createClientId.current) return; const request: AdminCommand = { command: "admin.user.create", input: { client_id: createClientId.current, email, temporary_password: password } }; try { decodeAdminCommand(request); } catch (failure) { setError(failure instanceof Error ? failure.message : "Confira e-mail e senha."); return; } setAttempted(true); void send(request).then(ok => { if (ok) closeCreation(); }); }}>
    <Field label="E-mail" type="email" autoComplete="off" required maxLength={254} value={email} disabled={busy || attempted} onChange={event => setEmail(event.target.value)} />
    <Field label="Senha provisória" type="password" autoComplete="new-password" required minLength={12} value={password} disabled={busy || attempted} onChange={event => setPassword(event.target.value)} hint="Use pelo menos 12 caracteres, até 72 bytes. Entregue a senha à pessoa por um canal privado." />
    {error && <p role="alert">{error}</p>}{attempted && error && <p>Os dados deste envio permanecem nesta janela para tentar novamente com a mesma identificação. Fechar a janela limpa a senha; uma eventual pendência continua protegida.</p>}
    <div className="admin-form-actions"><Button disabled={busy} onClick={closeCreation}>Cancelar</Button><Button variant="primary" type="submit" loading={busy}>{attempted ? "Reenviar criação" : "Criar usuário"}</Button></div>
   </form>
  </Dialog>}
 </div>;
}
