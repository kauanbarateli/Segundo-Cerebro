"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Vista = "projetos" | "kanban";
const vistas = ["projetos", "kanban"] as const;

/** Recebe quadros do servidor; alternar a prévia não navega nem opera o app. */
export function ProjectPreview({ projetos, kanban }: { projetos: ReactNode; kanban: ReactNode }) {
  const [vista, setVista] = useState<Vista>("projetos");
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const selecionarPeloTeclado = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let destino: number;
    if (event.key === "ArrowRight") destino = (index + 1) % vistas.length;
    else if (event.key === "ArrowLeft") destino = (index + vistas.length - 1) % vistas.length;
    else if (event.key === "Home") destino = 0;
    else if (event.key === "End") destino = vistas.length - 1;
    else return;
    event.preventDefault();
    setVista(vistas[destino]!);
    botoes.current[destino]?.focus();
  };
  return <div className="conheca-capitulo__tela conheca-projetos-preview">
    <div className="conheca-preview-tabs" role="tablist" aria-label="Prévia de Projetos e Kanban">
      {vistas.map((item, index) => <button key={item} ref={element => { botoes.current[index] = element; }} type="button" role="tab"
        id={`conheca-preview-${item}-tab`} aria-controls={`conheca-preview-${item}-panel`} aria-selected={vista === item}
        tabIndex={vista === item ? 0 : -1} onClick={() => setVista(item)} onKeyDown={event => selecionarPeloTeclado(event, index)}>
        {item === "projetos" ? "Projetos" : "Kanban"}
      </button>)}
    </div>
    <div role="tabpanel" id="conheca-preview-projetos-panel" aria-labelledby="conheca-preview-projetos-tab" hidden={vista !== "projetos"} tabIndex={0}>{projetos}</div>
    <div role="tabpanel" id="conheca-preview-kanban-panel" aria-labelledby="conheca-preview-kanban-tab" hidden={vista !== "kanban"} tabIndex={0}>{kanban}</div>
  </div>;
}
