"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDemoQuery } from "@/lib/demo/demo-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import "./vault.css";

const SAMPLE = "Exemplo-maquete-2026";
export function VaultSkeleton() {
  return <div className="vault-skeleton" role="status" aria-label="Carregando demonstração do Cofre"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div>;
}
export function VaultWorkspace() {
  const query = useDemoQuery("vault");
  const [stage, setStage] = useState<"create" | "locked" | "preview" | null>(null);
  const [filled, setFilled] = useState(false), [understood, setUnderstood] = useState(false), [error, setError] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (stage) titleRef.current?.focus(); }, [stage]);
  const view = stage ?? (query.data?.configured ? "locked" : "create");
  function change(next: "create" | "locked" | "preview") { setStage(next); setFilled(false); setUnderstood(false); setError(""); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!filled) { setError("Preencha a senha de exemplo pelo botão abaixo."); return; }
    if (view === "create" && !understood) { setError("Confirme que este fluxo é apenas uma demonstração."); return; }
    change(view === "create" ? "locked" : "preview");
  }
  if (query.status === "error") return <Card className="vault-message" data-access="allowed"><h2>Não foi possível abrir esta demonstração</h2><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo</Button></Card>;
  if (!query.data) return <VaultSkeleton />;
  return <div className="vault-workspace" data-access="allowed">
    <p className="vault-notice">Maquete de fluxo · sem criptografia. Não guarde segredos reais aqui.</p>
    {view === "preview" ? <Card className="vault-preview">
      <div className="vault-preview-heading"><h2 ref={titleRef} tabIndex={-1}>Prévia do Cofre</h2><Button onClick={() => change("locked")}><Icons.Lock />Bloquear prévia</Button></div>
      <p>Estes itens têm apenas nomes ilustrativos. Não há senhas, chaves ou notas secretas armazenadas.</p>
      {query.data.items.length ? <ul>{query.data.items.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.kind === "login" ? "Login de exemplo" : "Nota de exemplo"}</span></li>)}</ul> : <p>Nenhum item de exemplo disponível.</p>}
    </Card> : <Card className="vault-form-card">
      <Icons.Lock width={32} height={32} />
      <h2 ref={titleRef} tabIndex={-1}>{view === "create" ? "Criar cofre de exemplo" : "Cofre de exemplo bloqueado"}</h2>
      <p>Use os dados ilustrativos para conhecer o caminho. Estes campos não aceitam uma senha pessoal.</p>
      <form onSubmit={submit} className="vault-form">
        <Field type="password" label="Senha de demonstração" readOnly value={filled ? SAMPLE : ""} autoComplete="off" hint="A senha ilustrativa é preenchida pelo botão abaixo e descartada ao mudar de etapa." />
        {view === "create" && <Field type="password" label="Confirmar senha de demonstração" readOnly value={filled ? SAMPLE : ""} autoComplete="off" />}
        <Button type="button" onClick={() => { setFilled(true); setError(""); }}>Preencher senha de exemplo</Button>
        {view === "create" && <Button variant="ghost" className="vault-consent" role="checkbox" aria-checked={understood} onClick={() => setUnderstood(!understood)}><span className="vault-checkbox" aria-hidden="true">{understood && <Icons.Check />}</span>Entendi que esta é uma demonstração, sem proteção para guardar segredos.</Button>}
        {error && <p className="vault-error" role="alert">{error}</p>}
        <Button type="submit" variant="primary">{view === "create" ? "Criar demonstração" : "Simular desbloqueio"}</Button>
      </form>
      {view === "locked" && <Button variant="ghost" onClick={() => change("create")}>Recomeçar maquete</Button>}
    </Card>}
    <Card className="vault-context"><h2>Proteção e recuperação</h2><p>Senha mestra, criptografia e kit de recuperação pertencem à implementação futura. Esta maquete não gera um kit nem oferece armazenamento protegido.</p></Card>
  </div>;
}
