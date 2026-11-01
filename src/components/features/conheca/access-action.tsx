import Link from "next/link";
import type { DestinoDeAcesso } from "./content";

/** Ação final da apresentação: um link para o destino realmente disponível. */
export function AccessAction({ destino }: { destino: DestinoDeAcesso }) {
  return <Link className="conheca-botao conheca-botao--inverso" href={destino.href} prefetch={false}>{destino.rotulo}</Link>;
}
