import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { frontBCapabilities } from "@/lib/access/front-b-capabilities-server";
import { FEEDBACK_PATH, readOptionalDestinations } from "@/lib/navigation/optional-destinations";
import { UpdatesBoard } from "@/components/features/atualizacoes/updates-board";
import "@/components/features/atualizacoes/updates.css";

export const metadata: Metadata = { title: "Atualizações · Segundo Cérebro" };
export const dynamic = "force-dynamic";

export default async function UpdatesPage() {
  await requireUser();
  return (
    <>
      <div className="shell-page-heading">
        <h1>Atualizações</h1>
        <p>Acompanhe o que está sendo preparado para o Segundo Cérebro.</p>
      </div>
      {(frontBCapabilities().schema || readOptionalDestinations().feedback) && <a className="updates-suggestion" href={FEEDBACK_PATH}>Enviar sugestão</a>}
      <UpdatesBoard />
    </>
  );
}
