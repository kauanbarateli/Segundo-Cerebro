"use client";

import { useId, useState } from "react";
import type { DestinoDeAcesso } from "./content";

/** Ação final da apresentação; o destino comercial é configurado em content.ts. */
export function AccessAction({ destino }: { destino: DestinoDeAcesso }) {
  const [aberto, setAberto] = useState(false);
  const aviso = useId();

  if (destino.tipo === "link") {
    return <a className="conheca-botao conheca-botao--inverso" href={destino.href}>{destino.rotulo}</a>;
  }

  return (
    <div className="conheca-acesso__acao">
      <button
        type="button"
        className="conheca-botao conheca-botao--inverso"
        aria-expanded={aberto}
        aria-controls={aviso}
        onClick={() => setAberto((valor) => !valor)}
      >
        {destino.rotulo}
      </button>
      <p id={aviso} className="conheca-acesso__aviso" role="status" data-aberto={aberto || undefined}>
        {aberto ? destino.mensagem : ""}
      </p>
    </div>
  );
}
