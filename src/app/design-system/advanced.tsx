"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Dialog, Drawer, BottomSheet, ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { ChartCard, ProgressBar, Collapsible, PageNavigation } from "@/components/ui/data-display";
import "./advanced.css";

type SampleRow = { id: string; title: string; status: string; order: number };
const sampleRows: SampleRow[] = ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"].map((title, index) => ({
  id: String.fromCharCode(97 + index), title, status: index % 2 ? "Concluída" : "Pendente", order: index + 1,
}));
const sampleColumns: DataTableColumn<SampleRow>[] = [
  { id: "title", header: "Título", accessor: (row) => row.title },
  { id: "status", header: "Estado", accessor: (row) => row.status },
  { id: "order", header: "Ordem", accessor: (row) => row.order },
];

export function AdvancedSamples() {
  const [surface, setSurface] = useState<"dialog" | "drawer" | "sheet" | "confirm" | null>(null);
  const [nested, setNested] = useState(false);
  const [status, setStatus] = useState("");
  const [showCompleted, setShowCompleted] = useState(true);
  const [tableState, setTableState] = useState("ready");
  const [title, setTitle] = useState("Uma ideia para organizar");
  const titleRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const close = () => setSurface(null);

  return <>
    <section className="showcase-section" aria-labelledby="superficies-interativas">
      <h2 id="superficies-interativas">Superfícies interativas</h2>
      <p className="section-description">Diálogos, painéis e avisos compartilham os mesmos controles. Os exemplos são locais e não alteram dados pessoais.</p>
      <div className="advanced-actions">
        <Button variant="primary" onClick={() => setSurface("dialog")}>Abrir diálogo</Button>
        <Button onClick={() => setSurface("drawer")}>Abrir drawer</Button>
        <Button onClick={() => setSurface("sheet")}>Abrir painel inferior</Button>
        <Button variant="danger" onClick={() => setSurface("confirm")}>Confirmar remoção</Button>
      </div>
      <div className="advanced-actions advanced-actions--secondary">
        <Button onClick={() => toast({ message: "Alteração de exemplo registrada.", duration: 1000 })}>Mostrar aviso temporário</Button>
        <Button onClick={() => toast({ message: "Exemplo arquivado.", action: { label: "Desfazer", onClick: () => setStatus("Arquivamento desfeito.") } })}>Mostrar aviso com Desfazer</Button>
      </div>
      <p className="advanced-status" role="status">{status}</p>

      <Dialog open={surface === "dialog"} onClose={close} title="Editar exemplo" description="Uma edição local para experimentar o comportamento do diálogo." initialFocusRef={titleRef}
        footer={<Button variant="primary" onClick={() => { setStatus("Exemplo atualizado."); close(); }}>Salvar exemplo do diálogo</Button>}>
        <Field ref={titleRef} label="Título do exemplo" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Tooltip content="Ajuda sobre este exemplo"><Button variant="ghost">Ajuda no diálogo</Button></Tooltip>
        <Button onClick={() => setNested(true)}>Abrir confirmação aninhada</Button>
        <ConfirmDialog open={nested} onClose={() => setNested(false)} onConfirm={() => { setNested(false); setTitle("Uma ideia para organizar"); }} title="Descartar alterações?" description="O título volta ao exemplo inicial." confirmLabel="Descartar" />
      </Dialog>
      <Drawer open={surface === "drawer"} onClose={close} title="Detalhes do exemplo" description="O mesmo conteúdo se adapta à largura disponível." footer={<Button onClick={close}>Concluir leitura</Button>}>
        <Field as="textarea" label="Descrição do exemplo" defaultValue="Um painel lateral no computador e uma tela dedicada no celular." />
        <p>Este espaço recebe formulários e detalhes que precisam de atenção, mantendo a página de origem acessível ao voltar.</p>
      </Drawer>
      <BottomSheet open={surface === "sheet"} onClose={close} title="Ações do exemplo" description="Escolha uma ação ou feche para continuar na página.">
        <Button variant="primary" onClick={() => { setStatus("Exemplo marcado para depois."); close(); }}>Guardar para depois</Button>
        <Button onClick={close}>Voltar à página</Button>
      </BottomSheet>
      <ConfirmDialog open={surface === "confirm"} onClose={close} onConfirm={() => { setStatus("Exemplo removido."); close(); }} title="Remover exemplo?" description="Esta confirmação altera apenas o estado desta demonstração." confirmLabel="Remover" />
    </section>

    <section className="showcase-section" aria-labelledby="dados-interativos">
      <h2 id="dados-interativos">Dados e controles</h2>
      <p className="section-description">A tabela e os cartões do celular mostram o mesmo recorte. Experimente filtrar, ordenar e trocar de página.</p>
      <div className="advanced-data-controls">
        <Switch label="Mostrar tarefas concluídas" checked={showCompleted} onCheckedChange={setShowCompleted} />
        <Tooltip content="Exemplo de ajuda contextual"><Button variant="ghost">Ajuda sobre os dados</Button></Tooltip>
      </div>
      <Field as="select" label="Estado da demonstração de dados" value={tableState} onChange={(event) => setTableState(event.target.value)}>
        <option value="ready">Dados disponíveis</option><option value="loading">Carregando</option><option value="empty">Sem registros</option><option value="error">Falha na leitura</option>
      </Field>
      <DataTable label="Tarefas de exemplo" rows={tableState === "empty" ? [] : sampleRows.filter((row) => showCompleted || row.status !== "Concluída")} columns={sampleColumns} getRowId={(row) => row.id} pageSize={3} searchLabel="Filtrar exemplos" loading={tableState === "loading"} error={tableState === "error" ? "Não foi possível carregar os exemplos. Tente novamente." : undefined} onRetry={() => setTableState("ready")} />
      <div className="advanced-switch-states">
        <Switch label="Opção indisponível" checked={false} onCheckedChange={() => undefined} disabled hint="Disponível em uma etapa posterior." />
        <Switch label="Salvando preferência de exemplo" checked onCheckedChange={() => undefined} loading />
      </div>
      <div className="advanced-data-summary">
        <ChartCard title="Atividade de exemplo" resumoAcessivel="A amostra tem seis tarefas: três pendentes e três concluídas.">
          <dl className="advanced-chart-values"><div><dt>Pendentes</dt><dd>3</dd></div><div><dt>Concluídas</dt><dd>3</dd></div></dl>
        </ChartCard>
        <div className="advanced-progress"><ProgressBar label="Organização de exemplo" value={3} max={5} valueText="3 de 5 exemplos organizados" /></div>
      </div>
      <Collapsible title="Detalhes da amostra"><p>Seis registros ilustrativos permitem conferir ordenação, filtros e paginação. Nenhum deles é persistido.</p></Collapsible>
      <PageNavigation label="Navegação da demonstração" currentHref="#dados-interativos" items={[{ href: "#superficies-interativas", label: "Superfícies interativas" }, { href: "#dados-interativos", label: "Dados e controles" }, { href: "#tipografia", label: "Tipografia" }]} />
    </section>
  </>;
}
