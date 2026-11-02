import type { UpdateItem } from "../../../src/components/features/atualizacoes/content";
export const entries: readonly UpdateItem[] = [
  { id:"p", title:"Planejado sintético", summary:"Exemplo.", state:"planned", updatedAt:"2026-10-31", order:1 },
  { id:"a", title:"Análise sintética", summary:"Exemplo.", state:"analysis", updatedAt:"2026-10-31", order:1 },
  { id:"w", title:"Andamento sintético", summary:"Exemplo.", state:"progress", updatedAt:"2026-10-31", order:1 },
  { id:"t", title:"Teste sintético", summary:"Exemplo.", state:"testing", updatedAt:"2026-10-31", order:1 },
  { id:"r", title:"Entrega sintética", summary:"Exemplo.", state:"released", updatedAt:"2026-10-31", order:1, evidence:"/inicio" },
];
