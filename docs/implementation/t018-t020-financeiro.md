# T-018/T-019/T-020 — Financeiro fundido e canal preparado

Implementação local de 09/10/2026. **A migration financeira está versionada e não foi aplicada. Não houve conexão Supabase, execução SQL, build, servidor ou navegador nesta frente.** BlackSheep e Sistema VOE ficam fora do escopo. O responsável aplicará os arquivos manualmente depois de revisar o destino e as dependências; CI/build/deploy não aplicam schema.

## Comportamento entregue

Ports financeiros estreitos preservam o Núcleo independente de framework/SDK. Memória, fachada demonstrativa e canal conectado usam os mesmos casos de uso. O adapter de servidor prepara um snapshot completo e uma transação CAS com mudanças, eventos exatos e um recibo. Reenvio consulta o recibo antes do CAS; resultado de escrita desconhecido conserva a identidade e reconcilia o mesmo comando.

Contas/cartões, categorias, etiquetas, lançamentos e orçamentos compõem a consulta financeira. `tag_ids` é opcional para conservar fixtures/contratos históricos; novas escritas validam referências do mesmo Usuário. O canal HTTP autentica, confere sessão esperada e Entitlement financeiro, valida allowlist, bloqueia dono/`is_paid`/grupos injetados e devolve erros sanitizados sem cache. Credenciais ficam no servidor. O contrato `PlannedFinanceDatabase` é escrito para a migration pendente, sem alegar geração de schema remoto.

Transferências confirmam duas pernas e eventos/recibo juntos. Pagamento de fatura usa o saldo relido na transação, registra saída da conta e entrada no ciclo escolhido. Juros/IOF são uma despesa sem grupo de transferência, atribuída por `faturaDoEncargo`; o principal em aberto não é duplicado. Pagamento a maior conserva crédito, e quitação não gera encargo novo. Arquivar conta preserva os registros e as pernas da conta sobrevivente.

Séries finitas têm 2–120 ocorrências. Parcelamento rateia centavos e o pagamento parcial total apenas uma vez; recorrência repete valor e deixa futuras ocorrências planejadas. Competência escolhida explicitamente é preservada e incrementada. Encerramento aceita data atual/futura, preserva passado/pagamentos e considera a exceção de cartão para ocorrências planejadas/pendentes. Ver [ADR-0006](../adr/0006-financeiro-series-finitas.md).

A interface amplia os Drawers existentes com Transferir, pagamento parcial/total e juros/IOF, duplicação, série, encerramento, etiquetas e arquivamento/histórico. Órfãos independentes oferecem correção de competência. Registros vinculados conservam proteção de edição/exclusão isolada. Busca/filtros/ordenação/página permanecem na URL; resumo usa o conjunto antes da paginação. Provável duplicidade avisa sem impedir a gravação e sem exibir valor mascarado. Desfazer tem duração explícita de 8.000 ms; a lixeira permanece restaurável após esse intervalo. Textos distinguem sessão demonstrativa e modo conectado.

## Migration e asserções manuais

`supabase/migrations/20261009144343_financial_transactions.sql` foi reservada pela CLI local e preenchida sem aplicação. Inclui relações financeiras, FKs compostas de dono, índices, RLS, projeção de saldos com `security_invoker`, `is_paid` gerada, uma implementação de gatilho de cartão, revisão por Usuário e quatro wrappers transacionais nomeados. Helpers privilegiados ficam em `app_private`, com `search_path` vazio; funções públicas são invoker e apenas o servidor as executa. Auth e revogação seguem o lock por Usuário existente. Eventos financeiros ampliam a lista fechada sem retirar os tipos anteriores. O limite de escritas usa o bucket existente do canal de domínio.

`supabase/tests/finance-catalog.sql` e `finance-behavior.sql` foram **preparados neste checkpoint individual** e depois passaram na cadeia PGlite integrada, conforme complemento final. Terminam em rollback. Cobrem RLS/grants, geração de `is_paid`, gatilho único, projeção respeitando RLS, compra em cartão, falha injetada na segunda perna, ausência de resíduos/alteração de revisão, replay, pagamento parcial, saldos à mão, sessão estrangeira e preservação da contraparte ao arquivar. Instalação e asserções continuam separadas.

## Massa integrada e validação local

`tests/fixtures/finance-regression.ts` contém **20 lançamentos sintéticos de autoria explícita**, com expectativas calculadas à mão. Não alega ser o arquivo histórico v2, indisponível no checkout legado consultado. Receita 104.000, despesa 38.000 e resultado 66.000 centavos; conta corrente 175.000, reserva 207.000, patrimônio 382.000 e dívida 27.001; consumo líquido da categoria 31.000. Previsto/pendente/cancelado/lixeira, estornos, transferência, pagamento parcial e parcela futura participam da mesma massa.

O fallback histórico de fatura para órfão foi preservado: os 4.000 centavos sem `statement_month` são sinalizados/excluídos dos totais de competência e entram na leitura histórica da fatura pela data/fechamento. Essa diferença está explícita na fixture: fatura 22.000, paga 5.000, aberta 17.000. Novas escritas de cartão recebem competência; a interface permite corrigir órfãos independentes.

**136 testes focados aprovados** em sete arquivos: núcleo fundido/comandos/transações, store/gateway financeiros e formulário/rota financeira. O transporte injetado cobre concorrência CAS, replay divergente, falha no meio do batch, resposta perdida/reconciliação, expiração dos ports e revogação. Typecheck completo com `--incremental false` passou na rodada local. Os testes usam TMP/TEMP dentro de `work`; não dependem de credenciais nem rede.

Quatro novos E2E estão preparados para pagamento/encargos/quitação, transferência/arquivamento, parcelas/encerramento e privacidade/Desfazer. **Não foram executados nesta frente.** A inspeção visual das interações novas, banco real, grants efetivos, asserções SQL e concorrência PostgreSQL permanecem pendentes. Os testes injetados não comprovam esses critérios operacionais. A revisão integrada e o CI pertencem à raiz; nenhum encerramento remoto de issue foi realizado por esta entrega.
## Integração final da raiz — 09/10/2026

Os resultados e restrições de execução descritos acima pertencem ao checkpoint individual do agente deste módulo. A raiz estava autorizada a compilar e testar e concluiu a integração: 1.427 testes em UTC e São Paulo, 57 testes Node, 14 migrations e 29 asserções em PostgreSQL descartável, catálogo1242 e **168 E2E Chromium**. O portão Impeccable passou com zero registros. Detalhes, auditoria visual e limites estão na [validação final](t028-validacao-final.md).

Asserções de comportamento/fixtures são somente para **base dedicada vazia**, com rollback e verificação de resíduos; não executar sobre contas reais. No projeto pessoal, a revisão estrutural usa o catálogo readonly. Nenhuma migration nova foi aplicada remotamente. Banco/Storage/Google/SMTP, concorrência real, aparelhos e backup/restore seguem na [entrega e pendências](entrega-mvp-pendencias.md). Teste de demonstração não comprova o módulo conectado.
