"use client";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { updates, updateEvidenceHref, updateStates, validateUpdateEntries, type UpdateItem } from "./content";

export function UpdatesBoard({ entries = updates }: { entries?: readonly UpdateItem[] }) {
  const validatedEntries = validateUpdateEntries(entries);
  const [selected, setSelected] = useState<(typeof updateStates)[number]["id"]>("planned");
  return <>
    <Field as="select" wrapperClassName="updates-filter" label="Etapa" id="updates-stage" value={selected} onChange={(event) => setSelected(event.target.value as typeof selected)}>
        {updateStates.map((state) => <option key={state.id} value={state.id}>{state.label}</option>)}
    </Field>
    <div className="updates-board" aria-label="Etapas das atualizações">
      {updateStates.map((state) => {
        const items = validatedEntries.filter((item) => item.state === state.id).sort((a, b) => a.order - b.order);
        return <section className="updates-column" data-active={selected === state.id} key={state.id} aria-labelledby={`updates-${state.id}`}>
          <div className="updates-column__heading">
            <h2 id={`updates-${state.id}`}>{state.label}</h2>
            <span aria-label={`${items.length} atualizações`}>{items.length}</span>
          </div>
          {items.length === 0 ? <p className="updates-empty">Nenhuma atualização nesta etapa.</p> : (
            <ul className="updates-list">{items.map((item) => {
              const evidence = item.state === "released" ? updateEvidenceHref(item.evidence) : null;
              return <li key={item.id}>
                <article className="updates-item"><h3>{item.title}</h3><p>{item.summary}</p><time dateTime={item.updatedAt}>Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${item.updatedAt}T12:00:00Z`))}</time>{evidence && <a href={evidence} aria-label={`Ver entrega: ${item.title}`}>Ver entrega</a>}</article>
              </li>;
            })}</ul>
          )}
        </section>;
      })}
    </div>
  </>;
}
