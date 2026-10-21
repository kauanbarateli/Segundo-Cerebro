import Link from "next/link";
import "./legal-links.css";

/** Static public destinations: available without a profile or a connected service. */
export function LegalLinks() {
  return <ul className="legal-links">
    <li><Link href="/privacidade" prefetch={false}>Política de privacidade</Link></li>
    <li><Link href="/termos-de-servico" prefetch={false}>Termos de serviço</Link></li>
  </ul>;
}
