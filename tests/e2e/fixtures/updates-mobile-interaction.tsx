import { createRoot } from "react-dom/client";
import { UpdatesBoard } from "../../../src/components/features/atualizacoes/updates-board";
import type { UpdateItem } from "../../../src/components/features/atualizacoes/content";

// Fixture editorial sintética; não representa conteúdo publicado ou autenticação.
const entries: readonly UpdateItem[] = [
  { id: "plan-later", title: "Planejamento posterior", summary: "Exemplo sintético.", state: "planned", updatedAt: "2026-10-31", order: 2 },
  { id: "plan-first", title: "Planejamento inicial", summary: "Exemplo sintético.", state: "planned", updatedAt: "2026-10-31", order: 1 },
  { id: "analysis", title: "Análise sintética", summary: "Exemplo sintético.", state: "analysis", updatedAt: "2026-10-31", order: 1 },
  { id: "progress", title: "Andamento sintético", summary: "Exemplo sintético.", state: "progress", updatedAt: "2026-10-31", order: 1 },
  { id: "released", title: "Entrega sintética", summary: "Exemplo sintético.", state: "released", updatedAt: "2026-10-31", order: 1, evidence: "/inicio" },
];

const root = document.getElementById("updates-mobile-test");
if (!root) throw new Error("Synthetic updates root unavailable.");
createRoot(root).render(<UpdatesBoard entries={entries} />);
