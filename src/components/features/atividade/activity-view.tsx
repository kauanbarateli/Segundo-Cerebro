"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ACTIVITY_FEATURES, type ActivityItem, type ActivityType } from "@/core/activity";
import { resolveAccess } from "@/core/access/resolve-access";
import { FUSO_DO_APP } from "@/core/tempo";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { DEMO_LOGOUT_EVENT, useDemoApplication } from "@/lib/demo/demo-provider";
import { createActivityReader, INITIAL_ACTIVITY, type ActivityState } from "./activity-reader";
import { WORKSPACE_ROUTES } from "@/lib/navigation/routes";
import "./activity.css";

const actions: Record<ActivityItem["action"], string> = { created: "criada", updated: "editada", deleted: "movida para a lixeira", restored: "restaurada", status_changed: "com estado alterado" };
const fields: Record<string, string> = {
  title: "título", content: "texto", type: "tipo", status: "estado", category_id: "categoria", project_id: "projeto", converted_task_id: "tarefa vinculada",
  organized_at: "organização", archived_at: "arquivamento", deleted_at: "lixeira", linked_capture_ids: "vínculos", attachments: "anexos",
  description: "descrição", priority: "prioridade", due_at: "prazo", scheduled_start_at: "início planejado", scheduled_end_at: "término planejado",
  all_day: "dia inteiro", estimated_minutes: "estimativa", board_position: "ordem no quadro", origin_capture_id: "captura de origem", completed_at: "conclusão",
  name: "nome", kind: "tipo", institution: "instituição", amount_cents: "valor", paid_cents: "pagamento", opening_balance_cents: "saldo inicial", month: "mês", limit_cents: "limite", tag_ids: "etiquetas", statement_month: "competência",
  color_key: "cor", notebook_id: "caderno", document: "documento", parent_id: "item superior", version: "versão", from_type: "origem", from_id: "origem", to_type: "destino", to_id: "destino",
  schedule_kind: "frequência", weekdays: "dias da semana", weekly_target: "meta semanal", started_on: "início", habit_id: "hábito", done_on: "dia registrado", starts_on: "início da pausa", ends_on: "fim da pausa", reason: "motivo", folder_id: "pasta", starred: "favorito",
  display_name: "nome de perfil", avatar_file_id: "foto", theme: "tema", default_calendar_view: "visão inicial", values_hidden: "privacidade dos valores", meeting_reminders_enabled: "lembretes", meeting_reminder_minutes: "antecedência", module_key: "módulo", visible: "visibilidade", sort_order: "ordem",
  must_change_password: "troca de senha", role: "papel", feature_key: "funcionalidade", allowed: "permissão", operation: "operação", selected: "seleção", starts_at: "início", ends_at: "fim", linked_capture_id: "captura vinculada", calendar_count: "calendários processados", event_count: "eventos processados",
};
const channels = { web: "Aplicativo", api: "API", cron: "Rotina" };
const types: Record<ActivityType, string> = { capture: "Captura", task: "Tarefa", finance_account: "Conta financeira", finance_category: "Categoria financeira", finance_tag: "Etiqueta", finance_transaction: "Lançamento", finance_budget: "Orçamento", knowledge_notebook: "Caderno", knowledge_page: "Página", knowledge_link: "Vínculo", project: "Projeto", project_container: "Item de projeto", habit: "Hábito", habit_entry: "Dia registrado", habit_pause: "Pausa", drive_folder: "Pasta", drive_file: "Arquivo", profile: "Perfil", preference: "Preferência", module_preference: "Módulo", moderation: "Acesso à conta", role: "Papel da conta", entitlement: "Permissão", vault_metadata: "Cofre", calendar_account: "Conta Google", calendar_source: "Calendário", calendar_event: "Evento de calendário", calendar_sync: "Sincronização" };
function activityDestination(item: ActivityItem) {
  const direct: Partial<Record<ActivityType, string>> = { capture: "/capturar?capture=", task: "/tarefas?task=", knowledge_page: "/conhecimento?note=", knowledge_notebook: "/conhecimento?notebook=", finance_transaction: "/financeiro?transaction=", project: "/projetos?project=", habit: "/habitos?habit=", drive_file: "/drive?file=", drive_folder: "/drive?folder=", calendar_event: "/calendario?event=" };
  return direct[item.entity_type] ? direct[item.entity_type] + item.entity_id : WORKSPACE_ROUTES.find(route => route.feature === ACTIVITY_FEATURES[item.entity_type])?.href ?? "/";
}
const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function ActivityPanel({ state, refresh, retry, next, previous }: {
  state: ActivityState; refresh(): void; retry(): void; next(): void; previous(): void;
}) {
  const loading = state.status === "idle" || state.status === "loading";
  const rows = state.data?.items;
  return <section className="activity-view" aria-label="Histórico de atividade">
    <div className="activity-toolbar"><p>Alterações da sua conta, organizadas da mais recente para a mais antiga.</p>
      <Button variant="ghost" onClick={refresh} disabled={loading || state.closed}><Icons.Refresh />Atualizar atividade</Button></div>
    {state.error && <div className="activity-error" role="alert"><p>{state.error}</p>
      {state.recovery === "login" ? <Link className="activity-link" href="/entrar">Entrar novamente</Link> : state.recovery === "reload" ? <Button onClick={() => window.location.reload()}>Recarregar página</Button> : <Button onClick={retry}>Tentar novamente</Button>}</div>}
    {loading && !rows && <div className="activity-loading" role="status"><p>Carregando atividade…</p><div /><div /><div /></div>}
    {rows && rows.length > 0 && <ol className="activity-list" aria-label="Registros de atividade" aria-busy={loading}>
      {rows.map(item => <li key={item.id}>
        <div className="activity-entry"><p className="activity-action">{types[item.entity_type]} · {actions[item.action]}</p>
          <p className="activity-title">{item.title || types[item.entity_type]}</p>
          {item.changed_fields.some(field => fields[field]) && <p className="activity-changes">Campos alterados: {item.changed_fields.filter(field => fields[field]).map(field => fields[field]).join(", ")}.</p>}
          <p className="activity-meta"><time dateTime={item.occurred_at}>{formatDate(item.occurred_at)}</time><span>{channels[item.canal]}</span></p>
        </div>
        {item.action !== "deleted" && <Link className="activity-link" href={activityDestination(item)}>
          {item.entity_type === "capture" ? "Abrir captura" : item.entity_type === "task" ? "Abrir tarefa" : "Abrir área"}<Icons.ChevronRight /></Link>}
      </li>)}
    </ol>}
    {state.status === "ready" && rows?.length === 0 && <div className="activity-empty"><h2>Nenhum registro por aqui</h2><p>Ao criar ou alterar um registro, a mudança aparece nesta lista.</p><Link className="activity-link" href="/">Voltar ao Início<Icons.ChevronRight /></Link></div>}
    <div className="activity-pagination"><p role="status" aria-live="polite">{loading ? "Carregando registros…" : state.data ? `Página ${state.page} · ${rows?.length ?? 0} ${(rows?.length ?? 0) === 1 ? "registro" : "registros"}` : ""}</p>
      {state.data && <nav aria-label="Paginação da atividade"><Button variant="ghost" onClick={previous} disabled={loading || !state.canGoBack || state.closed}><Icons.ChevronRight className="activity-back-icon" />Registros mais recentes</Button>
        <Button variant="ghost" onClick={next} disabled={state.status !== "ready" || !state.data.next_cursor || state.closed}>Registros anteriores<Icons.ChevronRight /></Button></nav>}
    </div>
  </section>;
}
function ConnectedActivity({ userId }: { userId: string }) {
  const [reader] = useState(() => createActivityReader(userId));
  const state = useSyncExternalStore(reader.subscribe, reader.getSnapshot, () => INITIAL_ACTIVITY);
  useEffect(() => {
    void reader.refresh();
    const logout = (event: Event) => {
      const exiting = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (!exiting || exiting === userId) reader.close();
    };
    window.addEventListener(DEMO_LOGOUT_EVENT, logout);
    return () => { reader.cancel(); window.removeEventListener(DEMO_LOGOUT_EVENT, logout); };
  }, [reader, userId]);
  return <ActivityPanel state={state} refresh={() => void reader.refresh()} retry={() => void reader.retry()} next={() => void reader.next()} previous={() => void reader.previous()} />;
}
export function ActivityView() {
  const app = useDemoApplication();
  const { policy, ready } = useDemoAccess();
  if (!ready) return <p role="status">Preparando atividade…</p>;
  if (!resolveAccess("inicio", policy).allowed) return <p role="alert">A atividade não está disponível para esta conta.</p>;
  if (app.mode !== "connected") return <section className="activity-empty"><h2>A atividade real aparece na sua conta</h2><p>Esta é uma demonstração. Nenhum registro de produção é consultado aqui.</p><Link className="activity-link" href="/">Voltar ao Início<Icons.ChevronRight /></Link></section>;
  return <ConnectedActivity key={app.userId} userId={app.userId} />;
}
