"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { faturaFinanceira, type ContaFinanceira, type CategoriaFinanceira, type EtiquetaFinanceira, type LancamentoFinanceiro, type OrcamentoFinanceiro } from "@/core/financeiro";
import { formatBRL, formatCentsPlain, parseBRLToCents } from "@/core/dinheiro";
import type { DemoQueries } from "@/lib/demo/types";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { ACCOUNT_KINDS, FINANCE_COLORS, FINANCE_COLOR_LABELS, TRANSACTION_STATUS, FinanceFormError, accountDraft, accountFields, budgetDraft, budgetFields, categoryDraft, categoryFields, tagFields, sparseFinancePatch, transactionDraft, transactionFields, transactionPatch, transferDraft, transferFields, statementPaymentDraft, statementPaymentFields, seriesFields, requiredFinanceDay, type FinanceErrors } from "./finance-form";
import { financeMonthLabel, independentTransaction } from "./finance-model";

export type FinanceEditorTarget = { kind: "transaction"; row?: LancamentoFinanceiro } | { kind: "account"; row?: ContaFinanceira } | { kind: "category"; row?: CategoriaFinanceira } | { kind: "budget"; row?: OrcamentoFinanceiro }
  | { kind: "transfer"; row?: undefined } | { kind: "statement"; row: ContaFinanceira } | { kind: "close-account"; row: ContaFinanceira }
  | { kind: "duplicate"; row: LancamentoFinanceiro } | { kind: "stop-series"; row: LancamentoFinanceiro } | { kind: "statement-month"; row: LancamentoFinanceiro } | { kind: "tag"; row?: EtiquetaFinanceira };
interface EditorProps {
  target: FinanceEditorTarget;
  data: DemoQueries["finance"];
  today: string;
  month: string;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose(): void;
  onSaved(kind: FinanceEditorTarget["kind"], message: string, month?: string): void;
}

function useFinanceForm<T extends object>(initial: T, onClose: () => void) {
  const formId = useId(); const firstRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(initial), [errors, setErrors] = useState<FinanceErrors>({}), [failure, setFailure] = useState<string | null>(null), [pending, setPending] = useState(false);
  const busy = useRef(false), request = useRef<{ fingerprint: string; id: string } | null>(null);
  function change<K extends keyof T>(key: K, value: T[K]) { setDraft((before) => ({ ...before, [key]: value })); setErrors((before) => ({ ...before, [key]: undefined })); setFailure(null); }
  async function submit<P>(event: FormEvent<HTMLFormElement>, serialize: () => P, save: (payload: P, clientId: string) => Promise<void>) {
    event.preventDefault(); if (busy.current) return;
    setFailure(null); setErrors({});
    try {
      const payload = serialize(); const fingerprint = JSON.stringify(payload);
      if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      busy.current = true; setPending(true); await save(payload, request.current.id); onClose();
    } catch (error) {
      if (error instanceof FinanceFormError) { setErrors(error.fields); requestAnimationFrame(() => document.getElementById(formId)?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus()); }
      setFailure(error instanceof Error ? error.message : "Não foi possível salvar. Seus campos foram preservados; tente novamente.");
    } finally { busy.current = false; setPending(false); }
  }
  return { formId, firstRef, draft, errors, failure, pending, change, submit };
}
interface EditorFrameProps {
  title: string; formId: string; pending: boolean; failure: string | null; firstRef: RefObject<HTMLInputElement | null>; returnFocusRef: RefObject<HTMLElement | null>;
  onClose(): void; onSubmit(event: FormEvent<HTMLFormElement>): void; children: ReactNode; label: string;
}
function EditorFrame({ title, formId, pending, failure, firstRef, returnFocusRef, onClose, onSubmit, children, label }: EditorFrameProps) {
  return <Drawer open title={title} onClose={onClose} dismissible={!pending} closeOnBackdrop={false} initialFocusRef={firstRef} returnFocusRef={returnFocusRef}
    footer={<><Button onClick={onClose} disabled={pending}>Cancelar</Button><Button variant="primary" type="submit" form={formId} loading={pending}>{label}</Button></>}>
    <form id={formId} className="finance-form" onSubmit={onSubmit} noValidate>{failure && <p className="finance-error" role="alert">{failure}</p>}{children}</form>
  </Drawer>;
}
function ColorField({ value, onChange, disabled }: { value: string; onChange(value: string): void; disabled: boolean }) {
  return <Field as="select" label="Cor" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{FINANCE_COLORS.map((color, index) => <option key={color} value={color}>{FINANCE_COLOR_LABELS[index]}</option>)}</Field>;
}

function TransactionEditor(props: EditorProps & { target: Extract<FinanceEditorTarget, { kind: "transaction" }> }) {
  const { data, target, onClose, onSaved } = props; const row = target.row; const app = useDemoApplication(); const form = useFinanceForm(transactionDraft(props.today, row), onClose);
  const [series, setSeries] = useState<"single" | "parcelamento" | "recorrencia">("single"), [count, setCount] = useState("12");
  const { draft, change, pending, errors } = form;
  const account = data.accounts.find((item) => item.id === draft.account);
  const cardPurchase = account?.kind === "credit_card" && draft.kind === "expense";
  const probableDuplicate = data.transactions.some((item) => item.id !== row?.id && item.deleted_at === null && item.status !== "cancelled" && independentTransaction(item) && item.account_id === draft.account && item.kind === draft.kind && item.amount_cents === parseBRLToCents(draft.amount) && item.occurred_on === draft.occurred && item.description.trim().localeCompare(draft.description.trim(), "pt-BR", { sensitivity: "base" }) === 0);
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={onClose} title={row ? "Editar lançamento" : "Novo lançamento"} label={row ? "Salvar alterações" : "Criar lançamento"}
    onSubmit={(event) => { void form.submit(event, () => {
      if (row) return { operation: "update" as const, fields: transactionPatch(draft, data.accounts, row) };
      const fields = transactionFields(draft, data.accounts);
      return series === "single" ? { operation: "create" as const, fields } : { operation: "series" as const, ...seriesFields(fields, series, count) };
    }, async (payload, clientId) => {
      if (payload.operation === "series") {
        const saved = await app.commands.finance.series.create({ fields: payload.fields, serie_tipo: payload.serie_tipo, count: payload.count, client_id: clientId });
        const first = saved.transactions[0]; onSaved("transaction", "Série criada.", first?.statement_month ?? `${draft.occurred.slice(0, 7)}-01`); return;
      }
      if (payload.operation === "update" && Object.keys(payload.fields).length === 0) return;
      const saved = payload.operation === "update" && row ? await app.commands.finance.transactions.update({ id: row.id, client_id: clientId, patch: payload.fields }) : await app.commands.finance.transactions.create({ ...transactionFields(draft, data.accounts), client_id: clientId });
      onSaved("transaction", row ? "Lançamento atualizado." : "Lançamento criado.", saved.statement_month ?? `${saved.occurred_on.slice(0, 7)}-01`);
    }); }}>
    <Field ref={form.firstRef} label="Descrição" required maxLength={200} value={draft.description} error={errors.description} disabled={pending} onChange={(event) => change("description", event.target.value)} />
    <div className="finance-form-grid"><Field as="select" label="Tipo de lançamento" value={draft.kind} disabled={pending} onChange={(event) => { change("kind", event.target.value as typeof draft.kind); change("category", ""); }}><option value="expense">Saída</option><option value="income">Entrada ou estorno</option></Field>
      <Field label="Valor (R$)" inputMode="decimal" required value={draft.amount} error={errors.amount} disabled={pending} onChange={(event) => change("amount", event.target.value)} />
      <Field as="select" label="Conta" value={draft.account} error={errors.account} disabled={pending} onChange={(event) => { change("account", event.target.value); change("statement", ""); }}><option value="">Selecione a conta</option>{data.accounts.filter((item) => item.archived_at === null).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Field>
      <Field as="select" label="Categoria" value={draft.category} disabled={pending} onChange={(event) => change("category", event.target.value)}><option value="">Sem categoria</option>{data.categories.filter((item) => draft.kind === "income" || item.kind === "expense").map((item) => <option key={item.id} value={item.id}>{item.name}{draft.kind === "income" && item.kind === "expense" ? " · estorno" : ""}</option>)}</Field>
      <Field label="Data da movimentação" type="date" required value={draft.occurred} error={errors.occurred} disabled={pending} onChange={(event) => change("occurred", event.target.value)} />
      <Field as="select" label="Estado do lançamento" value={draft.status} disabled={pending} onChange={(event) => change("status", event.target.value as typeof draft.status)}>{Object.entries(TRANSACTION_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Field>
    </div>
    {!row && <><Field as="select" label="Frequência do lançamento" value={series} disabled={pending} onChange={(event) => { setSeries(event.target.value as typeof series); change("paid", "0,00"); }}><option value="single">Uma vez</option><option value="parcelamento">Parcelamento mensal</option><option value="recorrencia">Recorrência mensal finita</option></Field>{series !== "single" && <><Field label={series === "parcelamento" ? "Número de parcelas" : "Número de ocorrências"} type="number" min={2} max={120} step={1} value={count} error={errors.count} disabled={pending} onChange={(event) => setCount(event.target.value)} /><p className="finance-note">{series === "parcelamento" ? "O valor informado é o total da compra. O resto do rateio fica na última parcela." : "O valor se repete a cada mês. As próximas ocorrências começam como planejadas e a série pode ser encerrada."}</p></>}</>}
    {probableDuplicate && <p className="finance-note" role="status">Há um lançamento semelhante nesta conta e data. Confira os dados; você pode salvar mesmo assim.</p>}
    <p className="finance-note">Somente confirmados e conciliados compõem os valores realizados.</p>
    {cardPurchase ? <p className="finance-note">A compra já compõe a dívida do cartão. O pagamento da fatura é acompanhado separadamente.</p> : <Field label={draft.kind === "income" ? "Já recebido (R$)" : "Já pago (R$)"} inputMode="decimal" value={draft.paid} error={errors.paid} disabled={pending} onChange={(event) => change("paid", event.target.value)} hint="Valor que já movimentou esta conta." />}
    <details className="finance-details"><summary>Vencimento e detalhes</summary><div className="finance-form">
      <Field label="Vencimento" type="date" value={draft.due} error={errors.due} disabled={pending} onChange={(event) => change("due", event.target.value)} />
      {account?.kind === "credit_card" && <Field label="Competência da fatura" type="month" value={draft.statement} error={errors.statement} disabled={pending} onChange={(event) => change("statement", event.target.value)} hint="Em branco: calculada para uma nova compra ou troca de conta. Ao editar, a competência histórica é conservada." />}
      <Field label="Favorecido" maxLength={120} value={draft.payee} error={errors.payee} disabled={pending} onChange={(event) => change("payee", event.target.value)} />
      <Field as="textarea" label="Observações" rows={3} value={draft.notes} error={errors.notes} disabled={pending} onChange={(event) => change("notes", event.target.value)} />
      {Boolean(data.tags?.length) && <div className="finance-form" role="group" aria-label="Etiquetas do lançamento"><p className="finance-note">Etiquetas do lançamento</p><div className="finance-tag-options">{data.tags?.map((tag) => <Button key={tag.id} aria-pressed={draft.tags.includes(tag.id)} disabled={pending} onClick={() => change("tags", draft.tags.includes(tag.id) ? draft.tags.filter((id) => id !== tag.id) : [...draft.tags, tag.id])}>{tag.name}</Button>)}</div>{errors.tags && <p className="finance-error" role="alert">{errors.tags}</p>}</div>}
    </div></details>
  </EditorFrame>;
}
function AccountEditor(props: EditorProps & { target: Extract<FinanceEditorTarget, { kind: "account" }> }) {
  const row = props.target.row, app = useDemoApplication(), form = useFinanceForm(accountDraft(row), props.onClose); const { draft, change, errors, pending } = form;
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={props.onClose} title={row ? "Editar conta" : "Nova conta"} label={row ? "Salvar alterações" : "Criar conta"} onSubmit={(event) => { void form.submit(event, () => accountFields(draft), async (fields, clientId) => {
    if (row) { const patch = sparseFinancePatch(fields, row); if (!Object.keys(patch).length) return; await app.commands.finance.accounts.update({ id: row.id, client_id: clientId, patch }); }
    else await app.commands.finance.accounts.create({ ...fields, client_id: clientId }); props.onSaved("account", row ? "Conta atualizada." : "Conta criada.");
  }); }}>
    <Field ref={form.firstRef} label="Nome da conta" maxLength={120} required value={draft.name} error={errors.name} disabled={pending} onChange={(event) => change("name", event.target.value)} />
    <Field as="select" label="Tipo de conta" value={draft.kind} disabled={pending || Boolean(row)} hint={row ? "O tipo conserva o histórico desta conta." : undefined} onChange={(event) => change("kind", event.target.value as typeof draft.kind)}>{Object.entries(ACCOUNT_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Field>
    <Field label="Instituição" maxLength={120} value={draft.institution} error={errors.institution} disabled={pending} onChange={(event) => change("institution", event.target.value)} />
    <Field label="Saldo inicial (R$)" inputMode="decimal" value={draft.opening} error={errors.opening} disabled={pending} onChange={(event) => change("opening", event.target.value)} hint={draft.kind === "credit_card" ? "Saldo negativo representa dívida inicial; positivo representa crédito." : "Saldo antes dos lançamentos registrados."} />
    {draft.kind === "credit_card" && <><Field label="Limite do cartão (R$)" inputMode="decimal" value={draft.limit} error={errors.limit} disabled={pending} onChange={(event) => change("limit", event.target.value)} /><div className="finance-form-grid"><Field label="Dia de fechamento" type="number" min={1} max={31} step={1} value={draft.closing} error={errors.closing} disabled={pending} onChange={(event) => change("closing", event.target.value)} /><Field label="Dia de vencimento" type="number" min={1} max={31} step={1} value={draft.due} error={errors.due} disabled={pending} onChange={(event) => change("due", event.target.value)} /></div><p className="finance-note">Alterar o ciclo não muda a competência das compras já registradas.</p></>}
    <ColorField value={draft.color} disabled={pending} onChange={(value) => change("color", value)} />
  </EditorFrame>;
}
function CategoryEditor(props: EditorProps & { target: Extract<FinanceEditorTarget, { kind: "category" }> }) {
  const row = props.target.row, app = useDemoApplication(), form = useFinanceForm(categoryDraft(row), props.onClose); const { draft, change, errors, pending } = form;
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={props.onClose} title={row ? "Editar categoria financeira" : "Nova categoria financeira"} label={row ? "Salvar alterações" : "Criar categoria"} onSubmit={(event) => { void form.submit(event, () => categoryFields(draft), async (fields, clientId) => {
    if (row) { const patch = sparseFinancePatch(fields, row); if (!Object.keys(patch).length) return; await app.commands.finance.categories.update({ id: row.id, client_id: clientId, patch }); }
    else await app.commands.finance.categories.create({ ...fields, client_id: clientId }); props.onSaved("category", row ? "Categoria atualizada." : "Categoria criada.");
  }); }}>
    <Field ref={form.firstRef} label="Nome da categoria" maxLength={80} required value={draft.name} error={errors.name} disabled={pending} onChange={(event) => change("name", event.target.value)} />
    <Field as="select" label="Natureza da categoria" value={draft.kind} disabled={pending || Boolean(row)} hint={row ? "A natureza conserva o histórico da categoria." : undefined} onChange={(event) => change("kind", event.target.value as typeof draft.kind)}><option value="expense">Despesa</option><option value="income">Receita</option></Field>
    <ColorField value={draft.color} disabled={pending} onChange={(value) => change("color", value)} />
  </EditorFrame>;
}
function BudgetEditor(props: EditorProps & { target: Extract<FinanceEditorTarget, { kind: "budget" }> }) {
  const row = props.target.row, app = useDemoApplication(), form = useFinanceForm(budgetDraft(props.month, row), props.onClose); const { draft, change, errors, pending } = form;
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={props.onClose} title={row ? "Editar orçamento" : "Novo orçamento"} label="Salvar orçamento" onSubmit={(event) => { void form.submit(event, () => budgetFields(draft), async (fields, clientId) => {
    await app.commands.finance.budgets.save({ ...fields, client_id: clientId }); props.onSaved("budget", "Orçamento salvo.", fields.month);
  }); }}>
    <Field ref={form.firstRef} label="Limite do orçamento (R$)" inputMode="decimal" required value={draft.limit} error={errors.limit} disabled={pending} onChange={(event) => change("limit", event.target.value)} />
    <Field as="select" label="Categoria do orçamento" required value={draft.category} error={errors.category} disabled={pending || Boolean(row)} onChange={(event) => change("category", event.target.value)}><option value="">Selecione a categoria</option>{props.data.categories.filter((item) => item.kind === "expense").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Field>
    <Field label="Mês do orçamento" type="month" required value={draft.month} error={errors.month} disabled={pending || Boolean(row)} onChange={(event) => change("month", event.target.value)} />
    <p className="finance-note">O mesmo mês e categoria atualizam o limite existente. Estornos reduzem o consumo; planejados e pendentes não contam como usados.</p>
  </EditorFrame>;
}

function TransferEditor(props: EditorProps) {
  const app = useDemoApplication(), form = useFinanceForm(transferDraft(props.today), props.onClose), { draft, change, errors, pending } = form;
  const accounts = props.data.accounts.filter((row) => row.archived_at === null && row.kind !== "credit_card");
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={props.onClose} title="Transferir entre contas" label="Registrar transferência" onSubmit={(event) => { void form.submit(event, () => transferFields(draft, props.data.accounts), async (fields, clientId) => {
    await app.commands.finance.transfers.create({ ...fields, client_id: clientId }); props.onSaved("transfer", "Transferência registrada.", `${fields.occurred_on.slice(0, 7)}-01`);
  }); }}>
    <Field ref={form.firstRef} label="Descrição da transferência" required maxLength={200} value={draft.description} error={errors.description} disabled={pending} onChange={(event) => change("description", event.target.value)} />
    <div className="finance-form-grid">{(["from", "to"] as const).map((key) => <Field key={key} as="select" label={key === "from" ? "Conta de origem" : "Conta de destino"} required value={draft[key]} error={errors[key]} disabled={pending} onChange={(event) => change(key, event.target.value)}><option value="">Selecione a conta</option>{accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Field>)}
      <Field label="Valor da transferência (R$)" inputMode="decimal" required value={draft.amount} error={errors.amount} disabled={pending} onChange={(event) => change("amount", event.target.value)} />
      <Field label="Data da transferência" type="date" required value={draft.occurred} error={errors.occurred} disabled={pending} onChange={(event) => change("occurred", event.target.value)} />
    </div><p className="finance-note">As duas movimentações são registradas juntas. A transferência muda os saldos e não compõe receitas, despesas ou orçamento. Para um cartão, use Pagar fatura.</p>
    {accounts.length < 2 && <p className="finance-note">Cadastre duas contas ativas para transferir entre elas.</p>}
  </EditorFrame>;
}
function StatementEditor(props: EditorProps & { target: Extract<FinanceEditorTarget, { kind: "statement" }> }) {
  const app = useDemoApplication(), card = props.target.row, invoice = faturaFinanceira(props.data.transactions, card, props.month);
  const form = useFinanceForm(statementPaymentDraft(props.today, invoice.openCents), props.onClose), { draft, change, errors, pending } = form;
  const amount = parseBRLToCents(draft.amount);
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={props.onClose} title="Pagar fatura" label="Registrar pagamento" onSubmit={(event) => { void form.submit(event, () => statementPaymentFields(draft, props.data.accounts, card.id, props.month), async (fields, clientId) => {
    await app.commands.finance.statements.pay({ ...fields, client_id: clientId }); props.onSaved("statement", "Pagamento da fatura registrado.", fields.statement_month);
  }); }}>
    <p className="finance-note">{card.name} · Fatura de {financeMonthLabel(props.month)}. Em aberto: {formatBRL(invoice.openCents)}.</p>
    <Field ref={form.firstRef} label="Valor do pagamento (R$)" inputMode="decimal" required value={draft.amount} error={errors.amount} disabled={pending} onChange={(event) => change("amount", event.target.value)} hint="Informe o valor total ou um pagamento parcial." />
    <Button variant="ghost" disabled={pending || invoice.openCents <= 0} onClick={() => change("amount", formatCentsPlain(Math.max(0, invoice.openCents)))}>Usar valor total em aberto</Button>
    <Field as="select" label="Conta para pagar a fatura" value={draft.from} error={errors.from} required disabled={pending} onChange={(event) => change("from", event.target.value)}><option value="">Selecione a conta</option>{props.data.accounts.filter((row) => row.archived_at === null && row.kind !== "credit_card").map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Field>
    <Field label="Data do pagamento" type="date" required value={draft.occurred} error={errors.occurred} disabled={pending} onChange={(event) => change("occurred", event.target.value)} />
    {amount !== null && amount > invoice.openCents && <p className="finance-note">O valor acima da fatura fica como crédito no cartão.</p>}
    <details className="finance-details"><summary>Juros e IOF opcionais</summary><div className="finance-form"><Field label="Taxa mensal de juros (%)" inputMode="decimal" value={draft.rate} error={errors.rate} disabled={pending} onChange={(event) => change("rate", event.target.value)} hint="Aplicada ao saldo que permanecer após este pagamento." /><Field label="IOF (R$)" inputMode="decimal" value={draft.iof} error={errors.iof} disabled={pending} onChange={(event) => change("iof", event.target.value)} /><p className="finance-note">Os encargos entram na fatura seguinte, sem duplicar o principal. O saldo é conferido novamente ao registrar o pagamento.</p></div></details>
  </EditorFrame>;
}
function DuplicateEditor(props: EditorProps & { target: Extract<FinanceEditorTarget, { kind: "duplicate" }> }) {
  const app = useDemoApplication(), row = props.target.row, form = useFinanceForm({ occurred: props.today }, props.onClose);
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={props.onClose} title="Duplicar lançamento" label="Criar cópia" onSubmit={(event) => { void form.submit(event, () => requiredFinanceDay(form.draft.occurred), async (occurred_on, clientId) => {
    const saved = await app.commands.finance.transactions.duplicate({ id: row.id, occurred_on, client_id: clientId }); props.onSaved("duplicate", "Cópia do lançamento criada.", saved.statement_month ?? `${saved.occurred_on.slice(0, 7)}-01`);
  }); }}><p className="finance-note">Uma nova cópia de “{row.description}” será criada com os mesmos dados e valor. A competência do cartão será calculada para a nova data.</p><Field ref={form.firstRef} label="Data da cópia" type="date" required value={form.draft.occurred} error={form.errors.occurred} disabled={form.pending} onChange={(event) => form.change("occurred", event.target.value)} /></EditorFrame>;
}
function StopSeriesEditor(props: EditorProps & { target: Extract<FinanceEditorTarget, { kind: "stop-series" }> }) {
  const app = useDemoApplication(), row = props.target.row, form = useFinanceForm({ from: props.today }, props.onClose);
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={props.onClose} title="Encerrar recorrência" label="Encerrar ocorrências futuras" onSubmit={(event) => { void form.submit(event, () => requiredFinanceDay(form.draft.from, "from", props.today), async (from_on, clientId) => {
    if (!row.installment_group_id) throw new FinanceFormError({ from: "Este lançamento não pertence a uma recorrência." });
    await app.commands.finance.series.stop({ installment_group_id: row.installment_group_id, from_on, client_id: clientId }); props.onSaved("stop-series", "Recorrência encerrada para as ocorrências futuras elegíveis.");
  }); }}><p className="finance-note">Série “{row.description}”. As ocorrências a partir da data escolhida serão movidas para a lixeira se ainda não foram pagas. O histórico anterior e os pagamentos serão preservados.</p><Field ref={form.firstRef} label="Encerrar a partir de" type="date" min={props.today} required value={form.draft.from} error={form.errors.from} disabled={form.pending} onChange={(event) => form.change("from", event.target.value)} /><p className="finance-note">No cartão, somente ocorrências planejadas ou pendentes podem ser encerradas.</p></EditorFrame>;
}
function CloseAccountEditor(props: EditorProps & { target: Extract<FinanceEditorTarget, { kind: "close-account" }> }) {
  const app = useDemoApplication(), row = props.target.row, form = useFinanceForm({ name: row.name }, props.onClose);
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={props.onClose} title="Arquivar conta" label="Arquivar conta" onSubmit={(event) => { void form.submit(event, () => row.id, async (id, clientId) => {
    await app.commands.finance.accounts.close({ id, client_id: clientId }); props.onSaved("close-account", "Conta arquivada. O histórico foi preservado.");
  }); }}><Field ref={form.firstRef} label="Conta a arquivar" readOnly value={row.name} /><p className="finance-note">A conta deixa de aparecer entre as contas ativas e não aceita novos lançamentos. Seu histórico e as duas pernas das transferências serão preservados.</p></EditorFrame>;
}
function StatementMonthEditor(props: EditorProps & { target: Extract<FinanceEditorTarget, { kind: "statement-month" }> }) {
  const app = useDemoApplication(), row = props.target.row, form = useFinanceForm({ month: props.month.slice(0, 7) }, props.onClose);
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={props.onClose} title="Definir competência da fatura" label="Salvar competência" onSubmit={(event) => { void form.submit(event, () => requiredFinanceDay(`${form.draft.month}-01`, "month"), async (statement_month, clientId) => {
    await app.commands.finance.transactions.update({ id: row.id, patch: { statement_month }, client_id: clientId }); props.onSaved("statement-month", "Competência da fatura definida.", statement_month);
  }); }}><p className="finance-note">Escolha a fatura de “{row.description}”. Apenas este lançamento receberá a competência indicada.</p><Field ref={form.firstRef} label="Competência da fatura" type="month" required value={form.draft.month} error={form.errors.month} disabled={form.pending} onChange={(event) => form.change("month", event.target.value)} /></EditorFrame>;
}
function TagEditor(props: EditorProps & { target: Extract<FinanceEditorTarget, { kind: "tag" }> }) {
  const app = useDemoApplication(), row = props.target.row, form = useFinanceForm({ name: row?.name ?? "", color: row?.color_key ?? "fin-1" }, props.onClose);
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={props.onClose} title={row ? "Editar etiqueta financeira" : "Nova etiqueta financeira"} label={row ? "Salvar alterações" : "Criar etiqueta"} onSubmit={(event) => { void form.submit(event, () => tagFields(form.draft), async (fields, clientId) => {
    if (row) { const patch = sparseFinancePatch(fields, row); if (!Object.keys(patch).length) return; await app.commands.finance.tags.update({ id: row.id, client_id: clientId, patch }); }
    else await app.commands.finance.tags.create({ ...fields, client_id: clientId }); props.onSaved("tag", row ? "Etiqueta atualizada." : "Etiqueta criada.");
  }); }}><Field ref={form.firstRef} label="Nome da etiqueta" maxLength={80} required value={form.draft.name} error={form.errors.name} disabled={form.pending} onChange={(event) => form.change("name", event.target.value)} /><ColorField value={form.draft.color} disabled={form.pending} onChange={(value) => form.change("color", value)} /></EditorFrame>;
}
export function FinanceEditor(props: EditorProps) {
  switch (props.target.kind) {
    case "transaction": return <TransactionEditor {...props} target={props.target} />;
    case "account": return <AccountEditor {...props} target={props.target} />;
    case "category": return <CategoryEditor {...props} target={props.target} />;
    case "budget": return <BudgetEditor {...props} target={props.target} />;
    case "transfer": return <TransferEditor {...props} />;
    case "statement": return <StatementEditor {...props} target={props.target} />;
    case "duplicate": return <DuplicateEditor {...props} target={props.target} />;
    case "stop-series": return <StopSeriesEditor {...props} target={props.target} />;
    case "close-account": return <CloseAccountEditor {...props} target={props.target} />;
    case "statement-month": return <StatementMonthEditor {...props} target={props.target} />;
    case "tag": return <TagEditor {...props} target={props.target} />;
  }
}
