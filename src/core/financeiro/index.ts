/** Public fused domain API. Legacy calculation projections remain in their modules. */
export * from "./fused";
export * from "./use-cases";
export * from "./ports";
export { cartoesDe, mesDeCompetencia, isTransfer } from "./finance";
export {
  faturaDe, fechamentoDaFatura, ultimoFechamentoAte, vencimentoDaFatura,
  parcelas, planoDeParcelas, planoDeRecorrencia, somaMeses, somaMesesNaData,
  limiteDisponivel, statusDaFatura, ROTULO_DO_STATUS_DA_FATURA,
  calcularEncargos, faturaDoEncargo, totalAPagarEm,
  type CartaoDeCredito, type FaturaDoCartao, type StatusDaFatura,
  type PlanoDeParcelasArgs, type ParcelaPlanejada, type PlanoDeRecorrenciaArgs,
} from "./credit";
