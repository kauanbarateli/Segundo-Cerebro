/**
 * Calculation projections, independent of a storage schema or SDK.
 * The historical names keep the original regression fixtures directly comparable.
 * New writes use the fused public contract in fused.ts; is_paid is never an input there.
 */
export type FinanceAccountKind = "checking" | "savings" | "credit_card" | "cash" | "investment" | "other";
export type FinanceCategoryKind = "income" | "expense";
/** `transfer` is tolerated only by the legacy calculation projection. */
export type FinanceTransactionKind = "income" | "expense" | "transfer";
export type SerieTipo = "recorrencia" | "parcelamento";

export interface FinanceAccount {
  id: string;
  user_id: string;
  name: string;
  kind: FinanceAccountKind;
  institution: string | null;
  currency: string;
  opening_balance_cents: number;
  color_key: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  credit_limit_cents: number | null;
  statement_closing_day: number | null;
  payment_due_day: number | null;
}

export interface FinanceAccountBalance {
  account_id: string;
  user_id: string;
  name: string;
  kind: FinanceAccountKind;
  currency: string;
  opening_balance_cents: number;
  balance_cents: number;
  is_credit: boolean;
  /** Positive means debt; negative means credit in the account holder's favor. */
  debt_cents: number;
  available_cents: number | null;
}

export interface FinanceCategory {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  kind: FinanceCategoryKind;
  parent_id: string | null;
  color_key: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceTag {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  color_key: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  kind: FinanceTransactionKind;
  amount_cents: number;
  description: string;
  payee: string | null;
  occurred_on: string;
  transfer_group_id: string | null;
  notes: string | null;
  /** Derived from paid_cents in the fused contract; projection only. */
  is_paid: boolean;
  paid_cents: number;
  created_at: string;
  updated_at: string;
  installment_group_id: string | null;
  installment_no: number | null;
  installment_total: number | null;
  /** Historical statement assignment. Never recalculate on closing-day changes. */
  statement_month: string | null;
  serie_tipo: SerieTipo | null;
}

export interface FinanceBudget {
  id: string;
  user_id: string;
  /** NULL is the single total plan for the owner/month; a string is an allocation. */
  category_id: string | null;
  month: string;
  limit_cents: number;
  created_at: string;
  updated_at: string;
}
