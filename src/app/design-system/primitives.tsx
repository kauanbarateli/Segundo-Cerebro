"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, PillButton } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Brand } from "@/components/ui/brand";
import "./primitives.css";

export function PrimitiveSamples() {
  const [loading, setLoading] = useState(false);
  const [sends, setSends] = useState(0);
  const [feedback, setFeedback] = useState("Selecione uma variante para experimentar.");
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  function validateExample(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Dê um nome à nota para continuar.");
      setFormStatus("");
      titleRef.current?.focus();
      return;
    }
    setError("");
    setFormStatus("Campos validados. Nenhum dado foi enviado.");
  }

  return (
    <section className="showcase-section" aria-labelledby="primitivos">
      <h2 id="primitivos">Primitivos</h2>
      <p className="section-description">Experimente os estados dos controles. As ações abaixo são demonstrações locais e não salvam dados.</p>
      <div className="primitive-workbench">
        <section aria-labelledby="botoes" className="primitive-demo">
          <h3 id="botoes">Botões</h3>
          <div className="primitive-row">
            {([['primary', 'Primário'], ['secondary', 'Secundário'], ['ghost', 'Fantasma'], ['danger', 'Perigo']] as const).map(([variant, label]) => (
              <Button key={variant} variant={variant} onClick={() => setFeedback(`Variante ${label.toLowerCase()} acionada.`)}>{label}</Button>
            ))}
          </div>
          <div className="primitive-row">
            <Button size="sm" onClick={() => setFeedback("Tamanho pequeno acionado.")}>Pequeno</Button>
            <Button size="md" onClick={() => setFeedback("Tamanho médio acionado.")}>Médio</Button>
            <Button size="lg" onClick={() => setFeedback("Tamanho grande acionado.")}>Grande</Button>
            <Button disabled>Desabilitado</Button>
          </div>
          <div className="primitive-row">
            <Button variant="primary" loading={loading} onClick={() => { setSends((count) => count + 1); setLoading(true); setFeedback("Aguardando a conclusão da simulação."); }}>Salvar exemplo</Button>
            {loading && <Button onClick={() => { setLoading(false); setFeedback("Exemplo salvo."); }}>Concluir simulação</Button>}
          </div>
          <p className="sample-caption tabular-nums">Envios iniciados: {sends}</p>
          <p role="status" className="demo-feedback">{feedback}</p>

          <h3>Pílulas e rótulos</h3>
          <div className="primitive-row">
            <Badge dot="success">Concluído</Badge><Badge dot="work">Trabalho</Badge><Badge dot="personal">Pessoal</Badge>
            <Badge tone="solid">Destaque</Badge><Badge tone="outline">Rótulo neutro</Badge>
          </div>
          <div className="primitive-row">
            <PillButton active={active} dot="work" onClick={() => setActive((value) => !value)}>Filtrar trabalho</PillButton>
            <PillButton disabled>Filtro indisponível</PillButton>
            <PillButton loading>Carregando filtro</PillButton>
          </div>
          <p className="sample-caption">Filtro de trabalho: {active ? "ativo" : "inativo"}.</p>
        </section>

        <section aria-labelledby="campos" className="primitive-demo">
          <h3 id="campos">Campos compartilhados</h3>
          <form className="sample-form" onSubmit={validateExample} noValidate>
            <Field label="Nome da nota" name="title" ref={titleRef} value={title} onChange={(event) => { setTitle(event.target.value); if (error) setError(""); }} hint="Use um nome que ajude a reencontrar a ideia." error={error} required />
            <Field as="textarea" label="Resumo" name="summary" rows={3} hint="Escreva o contexto com suas palavras." />
            <Field as="select" label="Destino" name="destination" defaultValue="capturar"><option value="capturar">Capturar</option><option value="conhecimento">Conhecimento</option></Field>
            <Button type="submit" variant="secondary">Validar exemplo</Button>
            <p role="status" className="demo-feedback">{formStatus}</p>
          </form>
          <div className="sample-form field-state-samples">
            <Field label="Campo desabilitado" defaultValue="Indisponível nesta demonstração" disabled />
            <Field label="Campo em carregamento" defaultValue="Conteúdo preservado" loading />
            <Field label="Somente leitura" defaultValue="Você pode selecionar e copiar este texto." readOnly />
          </div>
        </section>
      </div>

      <h3 className="primitive-subtitle">Cartões bento</h3>
      <div className="card-specimens">
        <Card variant="surface" radius="lg" elevation="border"><CardHeader><h4>Superfície clara</h4></CardHeader><CardBody><p>Um contorno discreto organiza o conteúdo. Raio de 20 px.</p></CardBody></Card>
        <Card variant="inverse" radius="xl" elevation="shadow"><CardHeader><h4>Superfície inversa</h4></CardHeader><CardBody><p>Ênfase com tintas próprias e contraste medido. Raio de 28 px.</p><div className="primitive-row"><Button variant="primary" onClick={() => setFeedback("Ação na superfície inversa acionada.")}>Ação em destaque</Button><Button variant="ghost" onClick={() => setFeedback("Detalhe da superfície inversa acionado.")}>Ver detalhe</Button></div><Field label="Nota em destaque" defaultValue="Exemplo de composição" hint="A ajuda acompanha o contraste do cartão." error="Exemplo de erro: revise o título." /></CardBody></Card>
        <Card variant="tinted" radius="xl" elevation="border"><CardHeader><h4>Superfície suave</h4></CardHeader><CardBody><p>Uma variação neutra da mesma família, sem depender de outra cor.</p></CardBody></Card>
      </div>

      <h3 className="primitive-subtitle">Marca e ícones</h3>
      <div className="brand-specimens"><Brand variant="horizontal" /><Brand variant="compact" /><Brand variant="symbol" /></div>
      <details className="icon-catalogue">
        <summary>Ver os 47 ícones do projeto</summary>
        <ul className="icon-specimens">
          {Object.entries(Icons).map(([name, Icon]) => <li key={name}><Icon /><span>{name}</span></li>)}
        </ul>
      </details>
    </section>
  );
}
