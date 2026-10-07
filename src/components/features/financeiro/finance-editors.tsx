"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import type { ContaFinanceira, CategoriaFinanceira, LancamentoFinanceiro, OrcamentoFinanceiro } from "@/core/financeiro";
import type { DemoQueries } from "@/lib/demo/types";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { ACCOUNT_KINDS, FINANCE_COLORS, FINANCE_COLOR_LABELS, TRANSACTION_STATUS, FinanceFormError, accountDraft, accountFields, budgetDraft, budgetFields, categoryDraft, categoryFields, sparseFinancePatch, transactionDraft, transactionFields, transactionPatch, type FinanceErrors } from "./finance-form";

export type FinanceEditorTarget = { kind: "transaction"; row?: LancamentoFinanceiro } | { kind: "account"; row?: ContaFinanceira } | { kind: "category"; row?: CategoriaFinanceira } | { kind: "budget"; row?: OrcamentoFinanceiro };
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
  const { draft, change, pending, errors } = form;
  const account = data.accounts.find((item) => item.id === draft.account);
  const cardPurchase = account?.kind === "credit_card" && draft.kind === "expense";
  return <EditorFrame {...form} returnFocusRef={props.returnFocusRef} onClose={onClose} title={row ? "Editar lançamento" : "Novo lançamento"} label={row ? "Salvar alterações" : "Criar lançamento"}
    onSubmit={(event) => { void form.submit(event, () => row ? transactionPatch(draft, data.accounts, row) : transactionFields(draft, data.accounts), async (fields, clientId) => {
      if (row && Object.keys(fields).length === 0) return;
      const saved = row ? await app.commands.finance.transactions.update({ id: row.id, client_id: clientId, patch: fields }) : await app.commands.finance.transactions.create({ ...transactionFields(draft, data.accounts), client_id: clientId });
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
    <p className="finance-note">Somente confirmados e conciliados compõem os valores realizados.</p>
    {cardPurchase ? <p className="finance-note">A compra já compõe a dívida do cartão. O pagamento da fatura é acompanhado separadamente.</p> : <Field label={draft.kind === "income" ? "Já recebido (R$)" : "Já pago (R$)"} inputMode="decimal" value={draft.paid} error={errors.paid} disabled={pending} onChange={(event) => change("paid", event.target.value)} hint="Valor que já movimentou esta conta." />}
    <details className="finance-details"><summary>Vencimento e detalhes</summary><div className="finance-form">
      <Field label="Vencimento" type="date" value={draft.due} error={errors.due} disabled={pending} onChange={(event) => change("due", event.target.value)} />
      {account?.kind === "credit_card" && <Field label="Competência da fatura" type="month" value={draft.statement} error={errors.statement} disabled={pending} onChange={(event) => change("statement", event.target.value)} hint="Em branco: calculada para uma nova compra ou troca de conta. Ao editar, a competência histórica é conservada." />}
      <Field label="Favorecido" maxLength={120} value={draft.payee} error={errors.payee} disabled={pending} onChange={(event) => change("payee", event.target.value)} />
      <Field as="textarea" label="Observações" rows={3} value={draft.notes} error={errors.notes} disabled={pending} onChange={(event) => change("notes", event.target.value)} />
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
export function FinanceEditor(props: EditorProps) {
  switch (props.target.kind) {
    case "transaction": return <TransactionEditor {...props} target={props.target} />;
    case "account": return <AccountEditor {...props} target={props.target} />;
    case "category": return <CategoryEditor {...props} target={props.target} />;
    case "budget": return <BudgetEditor {...props} target={props.target} />;
  }
}
