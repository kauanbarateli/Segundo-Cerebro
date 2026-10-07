import { somarDias } from "../../core/habitos";
import { diaCivilDe, instanteDe } from "../../core/tempo";
import type { AgendaEvent, DemoReadOnlyData } from "./types";

export function emptyModuleFixture(): DemoReadOnlyData {
  return { notebooks: [], memberships: [], calendars: [], drive: { folders: [], files: [], capacity_bytes: 1024 ** 3 }, vault: { configured: false, items: [] }, settings: { profile: null } };
}
/** Read-only metadata for the M1 shells. No file bytes, credentials or secrets. */
export function createModuleFixture(now: string): DemoReadOnlyData {
  return {
    notebooks: [
      { id: "notebook-sc-v2", name: "Segundo Cérebro V2", parent_id: null, project_id: "project-sc-v2", position: 0 },
      { id: "notebook-maestri", name: "Maestri", parent_id: null, project_id: null, position: 1 },
      { id: "notebook-pessoal", name: "Pessoal", parent_id: null, project_id: null, position: 2 },
    ],
    memberships: ["architecture", "vision", "journal", "finance"].map((capture_id, position) => ({ capture_id, position, notebook_id: "notebook-sc-v2" })),
    calendars: [{ id: "calendar-work", name: "Trabalho de exemplo", color_key: "work" }, { id: "calendar-personal", name: "Pessoal de exemplo", color_key: "personal" }],
    drive: { capacity_bytes: 1024 ** 3,
      folders: [
        { id: "documents", name: "Documentos", parent_id: null, project_id: null, deleted_at: null },
        { id: "projects", name: "Projetos", parent_id: null, project_id: null, deleted_at: null },
        { id: "sc-v2", name: "SC V2", parent_id: "projects", project_id: "project-sc-v2", deleted_at: null },
        { id: "images", name: "Imagens", parent_id: null, project_id: null, deleted_at: null },
      ],
      files: [
        { id: "file-contract", folder_id: "documents", name: "contrato-central-t15.pdf", mime: "application/pdf", bytes: 1258291, starred: true, modified_at: now, deleted_at: null },
        { id: "file-logo", folder_id: "sc-v2", name: "logo-segundo-cerebro.svg", mime: "image/svg+xml", bytes: 8192, starred: true, modified_at: now, deleted_at: null },
        { id: "file-receipt", folder_id: "images", name: "foto-recibo-mercado.jpg", mime: "image/jpeg", bytes: 911360, starred: false, modified_at: now, deleted_at: null },
        { id: "file-backup", folder_id: "sc-v2", name: "backup-plano.md", mime: "text/markdown", bytes: 4096, starred: false, modified_at: now, deleted_at: null },
        { id: "file-old-draft", folder_id: "documents", name: "rascunho-antigo.txt", mime: "text/plain", bytes: 2048, starred: false, modified_at: now, deleted_at: now },
      ],
    },
    vault: { configured: false, items: [{ id: "vault-login", title: "Login de exemplo", kind: "login" }, { id: "vault-note", title: "Nota de exemplo", kind: "note" }] },
    settings: { profile: { display_name: "Pessoa de exemplo", email_label: "pessoa@exemplo.invalid" } },
  };
}
export function additionalAgendaFixture(now: string): AgendaEvent[] {
  const today = diaCivilDe(now);
  const event = (id: string, title: string, offset: number, start: string, end: string, calendar_id: string, linked_capture_id: string | null = null): AgendaEvent => ({ id, title,
    starts_at: instanteDe(`${somarDias(today, offset)}T${start}`)!, ends_at: instanteDe(`${somarDias(today, offset)}T${end}`)!, calendar_id, linked_capture_id, habit_id: null, location: null, all_day: false });
  return [event("event-dentist", "Dentista", 1, "10:00", "11:00", "calendar-personal"), event("event-review", "Review plano V2", 2, "16:00", "17:00", "calendar-work", "architecture"), event("event-fair", "Feira", 3, "09:00", "10:00", "calendar-personal"),
    { id: "event-sprint", title: "Sprint M0", starts_at: instanteDe(somarDias(today, 1))!, ends_at: instanteDe(somarDias(today, 4))!, calendar_id: "calendar-work", linked_capture_id: null, habit_id: null, location: null, all_day: true },
  ];
}
