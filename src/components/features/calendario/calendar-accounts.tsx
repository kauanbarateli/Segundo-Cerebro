"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { paraCampoLocal } from "@/core/tempo";
import type { CalendarWindow, GoogleAccountMetadata } from "@/core/calendario/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import type { DemoCalendar, DemoQueries } from "@/lib/demo/types";
import type { SourceTone } from "./calendar-projections";
import type { CalendarCommands } from "./use-calendar-commands";

const STATUS: Record<GoogleAccountMetadata["status"], { label: string; dot: "success" | "warning" | "danger" }> = {
  connected: { label: "Conectada", dot: "success" },
  reauthorize: { label: "Reconexão necessária", dot: "warning" },
  revocation_pending: { label: "Revogação pendente", dot: "danger" },
};
export const accountStatusLabel = (status: GoogleAccountMetadata["status"]) => STATUS[status].label;
export const syncedText = (iso: string) => "Sincronizada em " + paraCampoLocal(iso, "datetime").replace("T", " às ");

/** A source is a checkbox: name first, color only as an auxiliary cue. */
export function CalendarSourceToggle({ source, tone, checked, disabled, count, onToggle, describedBy }: {
  source: DemoCalendar; tone: SourceTone | undefined; checked: boolean; disabled?: boolean; count?: number; onToggle(): void; describedBy?: string;
}) {
  return <button type="button" role="checkbox" aria-checked={checked} className="calendar-source" data-tone={tone} disabled={disabled} onClick={onToggle}
    aria-describedby={describedBy}>
    <span className="calendar-source-check" aria-hidden="true">{checked && <Icons.Check width={14} height={14} />}</span>
    <span className="calendar-source-name">{source.name}</span>
    {count !== undefined && <span className="calendar-source-count"><span aria-hidden="true">{count}</span><span className="calendar-sr-only">{count === 1 ? "1 compromisso no período" : count + " compromissos no período"}</span></span>}
  </button>;
}

/** Google accounts managed through the existing calendar commands. The same
 * component composes Calendário and Integrações; both read one `agenda` query. */
export function CalendarAccounts({ agenda, commands, tones, layout, sync, intro }: {
  agenda: DemoQueries["agenda"]; commands: CalendarCommands; tones: ReadonlyMap<string, SourceTone>;
  layout: "calendar" | "integrations";
  /** Integrações syncs the stored window per account; the Calendar syncs its visible period elsewhere. */
  sync?: { window: CalendarWindow; caption: string };
  intro?: ReactNode;
}) {
  const { busy, send, connect } = commands;
  const accounts = agenda.accounts ?? [], calendars = agenda.calendars ?? [];
  const integrations = layout === "integrations";
  const heading = integrations ? <div className="calendar-google-heading">
    <span className="calendar-google-mark" aria-hidden="true"><Icons.Google /></span>
    <div><h2 id="calendar-accounts-title">Google Calendar</h2><p>{accounts.length} de 2 contas conectadas</p></div>
  </div> : <div><h2 id="calendar-accounts-title">Contas Google</h2><p>Conecte até duas contas. Os calendários selecionados também aparecem no Início e nos lembretes.</p></div>;
  return <section id="calendar-accounts" className={"calendar-connections calendar-connections--" + layout} aria-labelledby="calendar-accounts-title" tabIndex={-1}>
    <div className="calendar-connections-heading">
      {heading}
      <div className="calendar-connections-actions">
        <Button disabled={busy || accounts.length >= 2} onClick={() => void connect()}>Conectar Google</Button>
        <Link className="calendar-inline-link" href="/configuracoes#lembretes">Preferências da agenda</Link>
      </div>
    </div>
    {intro}
    {accounts.length > 0 ? <div className="calendar-accounts">{accounts.map(account => {
      const sources = calendars.filter(source => source.account_id === account.id);
      const selected = sources.some(source => source.selected);
      return <div className="calendar-account" key={account.id}>
        <div className="calendar-account-heading">
          <strong>{account.email}</strong>
          <Badge dot={STATUS[account.status].dot}>{STATUS[account.status].label}</Badge>
          {account.last_synced_at && <small>{syncedText(account.last_synced_at)}</small>}
        </div>
        {integrations && (sources.length ? <div className="calendar-account-sources" role="group" aria-label={"Calendários de " + account.email}>
          {sources.map(source => <CalendarSourceToggle key={source.id} source={source} tone={tones.get(source.id)} checked={source.selected ?? false}
            disabled={busy || account.status !== "connected"} onToggle={() => void send("calendar.select", { calendar_id: source.id, selected: !source.selected })} />)}
        </div> : <p className="calendar-account-note">{account.status === "connected" ? "Nenhum calendário disponível nesta conta." : "Os calendários voltam a aparecer depois da reconexão."}</p>)}
        <div className="calendar-account-actions">
          {sync && <Button disabled={busy || account.status !== "connected" || !selected} onClick={() => void send("calendar.sync", { account_id: account.id, start_day: sync.window.start_day, end_day: sync.window.end_day })}><Icons.Refresh width={16} height={16} />Sincronizar</Button>}
          <Button disabled={busy || account.status === "revocation_pending"} onClick={() => void connect(account.id)}>Reconectar</Button>
          <Button variant="ghost" className="calendar-disconnect" disabled={busy} onClick={() => void send("calendar.disconnect", { account_id: account.id }, account.status === "revocation_pending")}>{account.status === "revocation_pending" ? "Retomar desconexão" : "Desconectar"}</Button>
        </div>
      </div>;
    })}</div> : <p className="calendar-accounts-empty">Nenhuma conta Google conectada. Conecte uma conta para escolher os calendários.</p>}
    {sync && accounts.length > 0 && <p className="calendar-account-note">{sync.caption}</p>}
  </section>;
}
