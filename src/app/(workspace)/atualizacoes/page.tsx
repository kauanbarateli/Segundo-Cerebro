import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
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
      <UpdatesBoard />
    </>
  );
}
