import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { readAuthConfiguration } from "@/lib/auth/config";
import { frontBCapabilities } from "@/lib/access/front-b-capabilities-server";
import { FEEDBACK_PATH, readOptionalDestinations } from "@/lib/navigation/optional-destinations";
import { UpdatesBoard } from "@/components/features/atualizacoes/updates-board";
import "@/components/features/atualizacoes/updates.css";

export const metadata: Metadata = { title: "Atualizações · Segundo Cérebro" };
export const dynamic = "force-dynamic";

export default async function UpdatesPage() {
  await requireUser();
  const feedbackAvailable = readAuthConfiguration().mode === "supabase" ? frontBCapabilities().schema : readOptionalDestinations().feedback;
  return (
    <>
      <div className="shell-page-heading">
        <h1>Atualizações</h1>
        <p>Acompanhe o que está sendo preparado para o Segundo Cérebro.</p>
      </div>
      {feedbackAvailable && <a className="updates-suggestion" href={FEEDBACK_PATH}>Enviar sugestão</a>}
      <UpdatesBoard />
    </>
  );
}
