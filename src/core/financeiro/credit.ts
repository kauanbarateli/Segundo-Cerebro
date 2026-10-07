/** Pure calculation port from segundo_cerebro@ffdf064; see t007-financeiro.md. */
import type {
  FinanceAccount,
  FinanceAccountBalance,
  FinanceTransaction,
} from "./types";
import { centavosSeguros, totalExato } from "./arithmetic";

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES_ISO = /^(\d{4})-(\d{2})(?:-\d{2})?$/;

function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  if (mes < 1 || mes > 12) throw new RangeError(`mês fora do intervalo 1-12: ${mes}`);
  if (mes === 2 && ehBissexto(ano)) return 29;
  return DIAS_POR_MES[mes - 1]!;
}

function padrao2(valor: number): string {
  return String(valor).padStart(2, "0");
}

function mesCanonico(ano: number, mes: number): string {
  const deslocamento = Math.floor((mes - 1) / 12);
  const mesNormalizado = mes - deslocamento * 12;
  return `${String(ano + deslocamento).padStart(4, "0")}-${padrao2(mesNormalizado)}-01`;
}

interface PartesDeData {
  ano: number;
  mes: number;
  dia: number;
}

function partesDeData(iso: string, rotulo: string): PartesDeData {
  const casou = DATA_ISO.exec(iso);
  if (!casou) throw new RangeError(`${rotulo} deve estar no formato YYYY-MM-DD: ${iso}`);

  const ano = Number(casou[1]);
  const mes = Number(casou[2]);
  const dia = Number(casou[3]);
  if (mes < 1 || mes > 12) throw new RangeError(`${rotulo} tem mês inválido: ${iso}`);
  if (dia < 1 || dia > ultimoDiaDoMes(ano, mes)) {
    throw new RangeError(`${rotulo} tem dia que não existe nesse mês: ${iso}`);
  }
  return { ano, mes, dia };
}

function partesDeMes(iso: string, rotulo: string): { ano: number; mes: number } {
  const casou = MES_ISO.exec(iso);
  if (!casou) throw new RangeError(`${rotulo} deve estar no formato YYYY-MM-01: ${iso}`);
  const ano = Number(casou[1]);
  const mes = Number(casou[2]);
  if (mes < 1 || mes > 12) throw new RangeError(`${rotulo} tem mês inválido: ${iso}`);
  return { ano, mes };
}

function normalizaMes(iso: string, rotulo: string): string {
  const { ano, mes } = partesDeMes(iso, rotulo);
  return mesCanonico(ano, mes);
}

function validaDiaDoMes(dia: number, rotulo: string): void {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    throw new RangeError(`${rotulo} deve ser inteiro entre 1 e 31: ${dia}`);
  }
}

function fechamentoEfetivo(ano: number, mes: number, diaFechamento: number): number {
  return Math.min(diaFechamento, ultimoDiaDoMes(ano, mes));
}

export function somaMeses(mesIso: string, meses: number): string {
  if (!Number.isInteger(meses)) throw new RangeError(`meses deve ser inteiro: ${meses}`);
  const { ano, mes } = partesDeMes(mesIso, "mesIso");
  return mesCanonico(ano, mes + meses);
}

export function somaMesesNaData(dataIso: string, meses: number): string {
  if (!Number.isInteger(meses)) throw new RangeError(`meses deve ser inteiro: ${meses}`);
  const { ano, mes, dia } = partesDeData(dataIso, "dataIso");
  const { ano: anoFinal, mes: mesFinal } = partesDeMes(mesCanonico(ano, mes + meses), "dataIso");
  return `${anoFinal}-${padrao2(mesFinal)}-${padrao2(Math.min(dia, ultimoDiaDoMes(anoFinal, mesFinal)))}`;
}

/** A purchase on the closing day belongs to the following statement. */
export function faturaDe(dataCompra: string, diaFechamento: number): string {
  validaDiaDoMes(diaFechamento, "diaFechamento");
  const { ano, mes, dia } = partesDeData(dataCompra, "dataCompra");
  return dia >= fechamentoEfetivo(ano, mes, diaFechamento)
    ? mesCanonico(ano, mes + 1)
    : mesCanonico(ano, mes);
}

export function fechamentoDaFatura(mesFatura: string, diaFechamento: number): string {
  validaDiaDoMes(diaFechamento, "diaFechamento");
  const { ano, mes } = partesDeMes(mesFatura, "mesFatura");
  const dia = fechamentoEfetivo(ano, mes, diaFechamento);
  return `${String(ano).padStart(4, "0")}-${padrao2(mes)}-${padrao2(dia)}`;
}

export function ultimoFechamentoAte(hoje: string, diaFechamento: number): string {
  validaDiaDoMes(diaFechamento, "diaFechamento");
  const { ano, mes } = partesDeData(hoje, "hoje");

  const fechamentoDesteMes = fechamentoDaFatura(mesCanonico(ano, mes), diaFechamento);
  return hoje >= fechamentoDesteMes
    ? fechamentoDesteMes
    : fechamentoDaFatura(mesCanonico(ano, mes - 1), diaFechamento);
}

export function vencimentoDaFatura(
  mesFatura: string,
  diaVencimento: number,
  diaFechamento?: number,
): string {
  validaDiaDoMes(diaVencimento, "diaVencimento");
  const { ano, mes } = partesDeMes(mesFatura, "mesFatura");

  let mesDoVencimento = mes;
  if (diaFechamento !== undefined) {
    validaDiaDoMes(diaFechamento, "diaFechamento");
    if (diaVencimento <= diaFechamento) mesDoVencimento += 1;
  }

  const { ano: anoFinal, mes: mesFinal } = partesDeMes(
    mesCanonico(ano, mesDoVencimento),
    "mesFatura",
  );
  const dia = Math.min(diaVencimento, ultimoDiaDoMes(anoFinal, mesFinal));
  return `${anoFinal}-${padrao2(mesFinal)}-${padrao2(dia)}`;
}

/** The last installment receives the integer-cent remainder. */
export function parcelas(totalCents: number, numeroDeParcelas: number): number[] {
  centavosSeguros(totalCents, "totalCents");
  if (!Number.isSafeInteger(numeroDeParcelas) || numeroDeParcelas <= 0) {
    throw new RangeError(`numeroDeParcelas deve ser inteiro maior que zero: ${numeroDeParcelas}`);
  }
  const total = BigInt(totalCents);
  const quantidade = BigInt(numeroDeParcelas);
  const base = total / quantidade;
  const lista = new Array<number>(numeroDeParcelas).fill(Number(base));
  lista[numeroDeParcelas - 1] = totalExato(base + total % quantidade, "Última parcela");
  return lista;
}

export interface PlanoDeParcelasArgs {
  totalCents: number;
  numeroDeParcelas: number;

  dataCompra: string;

  diaFechamento: number | null;
}

export interface ParcelaPlanejada {

  numero: number;

  total: number;
  amountCents: number;

  occurredOn: string;

  statementMonth: string | null;
}

export function planoDeParcelas({
  totalCents,
  numeroDeParcelas,
  dataCompra,
  diaFechamento,
}: PlanoDeParcelasArgs): ParcelaPlanejada[] {
  centavosSeguros(totalCents, "totalCents");
  if (totalCents <= 0 || numeroDeParcelas > totalCents) {
    throw new RangeError("O total deve ser positivo e permitir pelo menos um centavo por parcela.");
  }
  const valores = parcelas(totalCents, numeroDeParcelas);
  const primeiraFatura = diaFechamento === null ? null : faturaDe(dataCompra, diaFechamento);

  return valores.map((amountCents, indice) => ({
    numero: indice + 1,
    total: numeroDeParcelas,
    amountCents,
    occurredOn: somaMesesNaData(dataCompra, indice),
    statementMonth: primeiraFatura === null ? null : somaMeses(primeiraFatura, indice),
  }));
}

export interface PlanoDeRecorrenciaArgs {

  valorCents: number;
  ocorrencias: number;

  dataInicial: string;
}

export function planoDeRecorrencia({
  valorCents,
  ocorrencias,
  dataInicial,
}: PlanoDeRecorrenciaArgs): ParcelaPlanejada[] {
  if (!Number.isSafeInteger(valorCents) || valorCents <= 0) {
    throw new RangeError(`valorCents deve ser inteiro positivo em centavos: ${valorCents}`);
  }
  if (!Number.isSafeInteger(ocorrencias) || ocorrencias <= 0) {
    throw new RangeError(`ocorrencias deve ser inteiro maior que zero: ${ocorrencias}`);
  }

  return Array.from({ length: ocorrencias }, (_, indice) => ({
    numero: indice + 1,
    total: ocorrencias,
    amountCents: valorCents,
    occurredOn: somaMesesNaData(dataInicial, indice),
    statementMonth: null,
  }));
}

export interface LimiteDisponivelArgs {
  limiteCents: number;

  faturaAbertaCents: number;

  naoFaturadoCents: number;
}

export function limiteDisponivel({
  limiteCents,
  faturaAbertaCents,
  naoFaturadoCents,
}: LimiteDisponivelArgs): number {
  const limite = BigInt(centavosSeguros(limiteCents, "Limite"));
  const fatura = BigInt(centavosSeguros(faturaAbertaCents, "Fatura aberta"));
  const naoFaturado = BigInt(centavosSeguros(naoFaturadoCents, "Valor não faturado"));
  return totalExato(limite - fatura - naoFaturado, "Limite disponível");
}

export interface CartaoDeCredito {
  id: string;
  credit_limit_cents: number;
  statement_closing_day: number;
  payment_due_day: number;
}

export interface FaturaDoCartao {

  totalCents: number;

  paidCents: number;

  openCents: number;

  itens: FinanceTransaction[];
}

export type ResumoDeFatura = Omit<FaturaDoCartao, "itens">;

export function ehPagamentoDeFatura(
  tx: Pick<FinanceTransaction, "kind" | "transfer_group_id">,
): boolean {
  return tx.kind === "income" && tx.transfer_group_id !== null;
}

/** Recorded assignment wins; missing legacy assignments retain the original fallback. */
function faturaDaLinha(tx: FinanceTransaction, diaFechamento: number): string {
  if (tx.statement_month !== null) return normalizaMes(tx.statement_month, "statement_month");
  return faturaDe(tx.occurred_on, diaFechamento);
}

export function faturaDoCartao(
  transacoes: FinanceTransaction[],
  conta: Pick<CartaoDeCredito, "id" | "statement_closing_day">,
  mesFatura: string,
): FaturaDoCartao {
  const alvo = normalizaMes(mesFatura, "mesFatura");

  const itens: FinanceTransaction[] = [];
  let total = 0n;
  let paid = 0n;

  for (const tx of transacoes) {
    if (tx.account_id !== conta.id) continue;
    if (tx.kind === "transfer") continue;

    if (ehPagamentoDeFatura(tx)) {
      if (tx.statement_month !== null && normalizaMes(tx.statement_month, "statement_month") === alvo) {
        paid += BigInt(centavosSeguros(tx.amount_cents, "Pagamento da fatura"));
      }
      continue;
    }

    if (faturaDaLinha(tx, conta.statement_closing_day) !== alvo) continue;

    itens.push(tx);
    const amount = BigInt(centavosSeguros(tx.amount_cents, "Valor da fatura"));
    total += tx.kind === "expense" ? amount : -amount;
  }
  itens.sort((a, b) => (a.occurred_on < b.occurred_on ? -1 : a.occurred_on > b.occurred_on ? 1 : 0));

  return {
    totalCents: totalExato(total, "Total da fatura"),
    paidCents: totalExato(paid, "Pagamento da fatura"),
    openCents: totalExato(total - paid, "Saldo da fatura"),
    itens,
  };
}

export type CartaoTalvezIncompleto = Pick<CartaoDeCredito, "id"> & {
  statement_closing_day: number | null;
  payment_due_day: number | null;
};

export interface FaturaAVencer extends ResumoDeFatura {
  cardId: string;

  mesFatura: string;

  vence: string;
}

function diaUtil(dia: number | null): dia is number {
  return dia !== null && Number.isInteger(dia) && dia >= 1 && dia <= 31;
}

export function faturasQueVencemEm(
  transacoes: FinanceTransaction[],
  cartoes: CartaoTalvezIncompleto[],
  mes: string,
): FaturaAVencer[] {
  const alvo = normalizaMes(mes, "mes").slice(0, 7);
  const encontradas: FaturaAVencer[] = [];

  for (const cartao of cartoes) {
    if (!diaUtil(cartao.statement_closing_day) || !diaUtil(cartao.payment_due_day)) continue;

    for (const candidato of [somaMeses(normalizaMes(mes, "mes"), -1), normalizaMes(mes, "mes")]) {
      const vence = vencimentoDaFatura(
        candidato,
        cartao.payment_due_day,
        cartao.statement_closing_day,
      );
      if (vence.slice(0, 7) !== alvo) continue;

      const { totalCents, paidCents, openCents } = faturaDoCartao(
        transacoes,
        { id: cartao.id, statement_closing_day: cartao.statement_closing_day },
        candidato,
      );
      encontradas.push({
        cardId: cartao.id,
        mesFatura: candidato,
        vence,
        totalCents,
        paidCents,
        openCents,
      });
    }
  }

  return encontradas.sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0));
}

export function totalAPagarEm(faturas: FaturaAVencer[]): number {
  const total = faturas.reduce((soma, fatura) => {
    validarResumo(fatura);
    return soma + BigInt(Math.max(0, fatura.openCents));
  }, 0n);
  return totalExato(total, "Total a pagar");
}

function validarResumo(resumo: ResumoDeFatura): void {
  centavosSeguros(resumo.totalCents, "Total da fatura");
  centavosSeguros(resumo.paidCents, "Pagamento da fatura");
  centavosSeguros(resumo.openCents, "Saldo da fatura");
}

export type StatusDaFatura = "aberta" | "fechada" | "parcial" | "paga" | "vencida";

export interface StatusDaFaturaArgs {

  hoje: string;
  mesFatura: string;
  diaFechamento: number;
  diaVencimento: number;

  resumo: Pick<ResumoDeFatura, "totalCents" | "paidCents" | "openCents">;
}

/** Date-sensitive state is always derived, never persisted. */
export function statusDaFatura({
  hoje,
  mesFatura,
  diaFechamento,
  diaVencimento,
  resumo,
}: StatusDaFaturaArgs): StatusDaFatura {
  validarResumo(resumo);
  const fechamento = fechamentoDaFatura(mesFatura, diaFechamento);
  const vencimento = vencimentoDaFatura(mesFatura, diaVencimento, diaFechamento);


  if (resumo.totalCents === 0 && resumo.paidCents === 0) {
    return hoje < fechamento ? "aberta" : "paga";
  }

  if (resumo.openCents <= 0) return "paga";
  if (hoje > vencimento) return "vencida";
  if (hoje < fechamento) return "aberta";
  if (resumo.paidCents > 0) return "parcial";
  return "fechada";
}

export const ROTULO_DO_STATUS_DA_FATURA: Record<StatusDaFatura, string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  parcial: "Parcialmente paga",
  paga: "Paga",
  vencida: "Vencida",
};

export interface EncargosArgs {

  saldoRemanescenteCents: number;

  taxaMensalPercent: number;

  iofCents?: number;
}

export interface Encargos {
  jurosCents: number;
  iofCents: number;

  totalCents: number;
}

/** Use the caller's decimal rate, including scientific notation, without float multiplication. */
function taxaDecimal(taxa: number): { numerador: bigint; denominador: bigint } {
  const [mantissa, expoente = "0"] = taxa.toString().split("e");
  const [inteiro, fracao = ""] = mantissa!.split(".");
  const casas = fracao.length - Number(expoente);
  return {
    numerador: BigInt(`${inteiro}${fracao}`) * 10n ** BigInt(Math.max(0, -casas)),
    denominador: 100n * 10n ** BigInt(Math.max(0, casas)),
  };
}

export function calcularEncargos({
  saldoRemanescenteCents,
  taxaMensalPercent,
  iofCents = 0,
}: EncargosArgs): Encargos {
  centavosSeguros(saldoRemanescenteCents, "Saldo remanescente");
  if (!Number.isFinite(taxaMensalPercent) || taxaMensalPercent < 0) {
    throw new RangeError(`taxaMensalPercent deve ser um número >= 0: ${taxaMensalPercent}`);
  }
  if (!Number.isSafeInteger(iofCents) || iofCents < 0) {
    throw new RangeError(`iofCents deve ser inteiro >= 0: ${iofCents}`);
  }
  const base = BigInt(Math.max(0, saldoRemanescenteCents));
  const { numerador, denominador } = taxaDecimal(taxaMensalPercent);
  // Positive half-cent ties round upward exactly once, as in the original rule.
  const juros = (2n * base * numerador + denominador) / (2n * denominador);
  return {
    jurosCents: totalExato(juros, "Juros"),
    iofCents,
    totalCents: totalExato(juros + BigInt(iofCents), "Total dos encargos"),
  };
}

export function faturaDoEncargo(
  mesFaturaPaga: string,
  dataDoPagamento: string,
  diaFechamento: number,
): string {
  const proxima = somaMeses(normalizaMes(mesFaturaPaga, "mesFaturaPaga"), 1);
  const pelaData = faturaDe(dataDoPagamento, diaFechamento);
  return pelaData > proxima ? pelaData : proxima;
}

export interface PatrimonioEDivida {

  patrimonioCents: number;

  dividaCents: number;
}

export function patrimonioEDivida(
  balances: Pick<FinanceAccountBalance, "account_id" | "balance_cents">[],
  accounts: Pick<FinanceAccount, "id" | "kind">[],
): PatrimonioEDivida {
  const kindPorId = new Map(accounts.map((a) => [a.id, a.kind]));

  let patrimonioCents = 0;
  let dividaCents = 0;

  for (const saldo of balances) {
    const kind = kindPorId.get(saldo.account_id);
    if (kind === undefined) continue;
    if (kind === "credit_card") dividaCents += -saldo.balance_cents;
    else patrimonioCents += saldo.balance_cents;
  }

  return { patrimonioCents, dividaCents };
}
