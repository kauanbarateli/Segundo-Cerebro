import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { updates, updateStates } from "@/components/features/atualizacoes/content";
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
      <div className="updates-board" aria-label="Etapas das atualizações">
        {updateStates.map((state) => {
          const items = updates.filter((item) => item.state === state.id).sort((a, b) => a.order - b.order);
          return (
            <section className="updates-column" key={state.id} aria-labelledby={`updates-${state.id}`}>
              <div className="updates-column__heading">
                <h2 id={`updates-${state.id}`}>{state.label}</h2>
                <span aria-label={`${items.length} atualizações`}>{items.length}</span>
              </div>
              {items.length === 0 ? <p className="updates-empty">Nenhuma atualização nesta etapa.</p> : (
                <ul className="updates-list">{items.map((item) => <li key={item.id}>
                  <article className="updates-item"><h3>{item.title}</h3><p>{item.summary}</p><time dateTime={item.updatedAt}>Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${item.updatedAt}T12:00:00Z`))}</time></article>
                </li>)}</ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
