# T-053 / #78 — executor v2 das séries, anterior à persistência

Complementa [B1](t053-finance-series-b1-20261023.md), V3 com cursor conservado no corte `ends_on` e CAS financeiro explícito. Base de autoria `313f1c6a57798e794aa80e1208f3d26a6b74edb3`. A fatia A V2 e os freezes B1 V1/V2 são preservados; a referência de integração é B1 V3. Este delta contém somente executor/previsão puros, duas suítes de teste e UoW descartável de teste; não contém SDK, rota, UI, schema ou implantação.

## Decisões técnicas aprovadas em 23/10

- Retomar restaura **todas** as ocorrências futuras elegíveis suprimidas pela própria série, até o limite finito de 120 já existentes, preservando IDs e datas. O horizonte escolhido, de no máximo doze meses, limita somente **novas** criações. A prévia deve discriminar quantidade/data final das reexibidas e das novas. Não reativa passado, pagamento parcial/realizado, exclusão manual ou encerramento. Conta arquivada que precisaria ser reexibida causa recusa antes de efeitos, permitindo revisar a conta da previsão.
- Em parcelamento, `template.amount_cents` é o **total original** imutável; mudar o total exige nova série explícita. Editar futuras pode alterar a apresentação/referências/término preservando rateio e o resto na última parcela original. Em recorrência, o valor repetido pode mudar somente nas futuras elegíveis. A natureza financeira permanece imutável nesta operação; não transformar receita em despesa por uma edição silenciosa.
- Um corte de geração que ainda não materializou ordinais conserva o primeiro ordinal futuro. Estender/remover esse corte permite preparar esses índices, sem renumerar existentes. Se um término menor suprimiu ocorrências **já materializadas**, seus mapas continuam `ended`; uma extensão de data não os restaura implicitamente. Exclusão manual também permanece. Alteração que removeria uma ocorrência paga/parcial/realizada é recusada integralmente.

## Entrada do Core

Importar `executeFinanceSeriesCommand` diretamente de `src/core/financeiro/series/series-use-cases.ts`; B1 continua com seu índice congelado. A função recebe o port `FinanceSeriesUnitOfWork`, dependências de relógio/UUID e contexto autenticado. Revalida o DTO fechado de B1 e clona a intenção antes do primeiro await. O adapter precisa conferir acesso atual **antes de executar a transação, inclusive em replay**.

O recibo é buscado dentro da transação por comando/UUID. Mesmo fingerprint retorna o resultado v2 original sem novos eventos; corpo diferente conflita. O resultado conservado é conferido quanto a dono, versão, formato da série e contagens fechadas. **Depois do recibo**, o Core compara `expected_finance_revision` com `tx.financeRevision`; depois confere a revisão da série, antes de mutações. O adapter deve fornecer/reconferir essas revisões sob o lock compartilhado com o financeiro v1. Fechamento, conta, categoria ou ledger alterados desde a prévia geram conflito e exigem reconferência; não recalcular silenciosamente. Replay do mesmo corpo após outra mudança ainda retorna o recibo original. Revisões trafegam como texto canônico bigint, sem `Number`; falha/incerteza não cria um UUID novo.

Comandos contemplados: criar, materializar, pausar, retomar, editar futuras, encerrar, excluir ocorrência e registrar realização explícita. Criação/materialização usam o plano puro B1 e nunca inventam pagamento. Séries/ocorrências/lançamentos são persistidos somente pelo port, cada mutação com evento correspondente, e um recibo fecha a intenção. Todos os efeitos devem confirmar ou reverter juntos.

Antes de modificar uma série existente, o executor confere o mapa completo finito: dono, grupo, ordinal, conta, data ancorada e ligação ao lançamento. O máximo de datas do mapa deve corresponder ao horizonte persistido; todos os índices materializados precedem o cursor; uma configuração de ocorrência não pode ultrapassar a revisão da série. Inconsistência não vira reparo silencioso. O relógio e o dia civil são dependências do servidor, sem deslocar datas pelo horário do navegador.

Editar futuras conserva competência já atribuída quando a conta não mudou, mesmo após alterar o fechamento global do cartão. Mudança para outro cartão precisa atribuição por data/fechamento declarado ou escolha explícita de cada competência. Uma atribuição a item protegido/inexistente ou fora da edição recusa a operação. A função não altera valores de fatura, pares de transferência ou registros realizados.

## Prévia de retomada

`previewSeriesResume`, em `series-previews.ts`, é pura e usa as mesmas políticas/planejamento consumidos pelo commit. O retorno interno contém os vínculos necessários ao executor. O canal público deve serializar **somente `summary`**, acompanhado das revisões conferidas pelo adapter, nunca o agregado interno completo ou eventos/recibos. Não expor o método diretamente como autorização de escrita.

A prévia não reserva dados nem garante que a próxima escrita será aceita. O commit reconfere estado, revisões, contas e acesso atual; uma alteração concorrente precisa preservar o rascunho e pedir reconferência. Não misturar “12 reexibições existentes até setembro” com “zero novas neste horizonte” numa mensagem única de doze criações.

## Contrato para a frente de persistência

Este documento não substitui a validação SQL. O próximo adapter/SQL precisa:

1. Usar o mesmo lock por Usuário do financeiro atual e ordem Auth/sessão → lock → acesso atual. Serializar o conjunto de série/mapas/ledger/revisão e preservar esse acesso em replay/recibo/consulta.
2. Validar envelope, intenção e resultado v2 fechados, CAS financeiro e da série, BEFORE exato e slots imutáveis; não confiar só em AFTER. Recalcular/validar âncora/ordinal, quantidade, valor, grupo e competência nas criações. Não aceitar batch genérico, mover grupo/índice ou omitir seletivamente efeitos elegíveis do conjunto.
3. Manter `unique(user_id,series_id,index)` e vínculo único/composto com transação, além das FKs ao dono. Supressão e `deleted_at` precisam permanecer coerentes. Não permitir que uma operação v1 contorne o mapa ou realize uma mutação v2 sem o respectivo evento/recibo.
4. Confirmar metadados, mapa, lançamento, todos os eventos e recibo na mesma transação, com rollback depois de qualquer linha/evento/recibo. Preservar IDs/criação e revogar funções/tabelas internas de anon/authenticated/service_role; liberar somente wrappers necessários ao servidor.
5. Separar snapshot/eventos/recibos v1 dos novos tipos. O snapshot v1 atual seleciona eventos por `finance_%`, mas seu decoder só aceita as cinco espécies legadas: o filtro precisa ficar explícito antes de gravar metadados novos. `finance_command` e resultados de recibo v1 não passam a aceitar o protocolo novo. Triggers de revisão devem observar v2 sem expor payloads novos aos leitores antigos.
6. Preservar a definição atual de constraints/funções por pins e acréscimos, incluindo mudanças do onboarding e da fatia A; não copiar uma lista histórica que elimine tipos novos. Expandir inventário, catálogo, backup/restore e leitores globais pertinentes antes da aplicação supervisionada. Migrations históricas, produção e Ensaio_restore permanecem intocados nesta autoria.

### Compatibilidade funcional obrigatória antes do guard SQL

`finance.recurring.occurrence.update` recebe `{client_id,expected_finance_revision,series_id,expected_revision,occurrence_id,patch:{status,paid_cents}}`. Para uma conta comum, o usuário poderá escolher no detalhe da ocorrência **Registrar pagamento/realização**, informar o valor pago até agora (parcial ou total) e o estado, e confirmar. Quitar exige enviar explicitamente o valor integral daquela linha; o template/ordinal nunca define que ela foi paga. O Core atualiza o lançamento real, evento, revisão da série e recibo juntos. Conta arquivada deve ser revisada antes dessa realização. No cartão, realizar compra não paga a fatura: o fluxo `pay_statement` permanece independente.

**B3 precisa entregar o endpoint v2 e esse consumidor no detalhe dos Lançamentos antes de ativar o guard**, com testes parcial/total/replay/recusa/incerto e máscara/teclado/mobile. Não basta negar operações antigas com 42501 e deixar a pessoa sem um caminho funcional. A proposta SQL continuará inerte até esse gate.

O SQL deve negar operações v1 em grupo/linha mapeados v2, incluindo criação/encerramento de série, alteração/exclusão/restauração/duplicação. A exceção para o commit v2 precisa ser privada, vinculada a dono/série/linha/BEFORE/AFTER/transação/pid e de uso único, consumida antes de qualquer `SET CONSTRAINTS ALL IMMEDIATE` histórico. Não sincronizar `suppression` depois de aceitar um batch v1: isso legitimaria um bypass. Exclusão explícita v2 grava `manual` no mesmo commit. Grupos legados sem metadados/mapa preservam os comandos antigos.

Pagamento de fatura v1 continua criando pares/encargos independentes e não muda compra/ocorrência ou seu motivo de supressão. Não é uma exceção genérica para alterar um lançamento mapeado. A Root também aprovou negar mudança de `kind` de Conta referenciada por mapa v2, para não reinterpretar pagamento derivado de cartão como pagamento de caixa; alterações de nome/ciclo/final/sugestão e arquivo conservam seus contratos.

## Validação preparada

```text
npx vitest run tests/core/finance-series-use-cases.test.ts tests/core/finance-series-previews.test.ts
```

As suítes exercitam transação de criação com eventos exatos, replay/corpo conflitante, corrida de revisão, falha tardia em linha/evento/recibo/commit, pausa preservando parcial/manual, retomada além do horizonte de novas e após meses pausados, edição futura, total original imutável/rateio, extensão do corte sem duplicação, término protegido e competência histórica do cartão. O negativo de CAS prepara a intenção do cartão, muda fechamento/revisão financeira e exige recusa sem evento/recibo; uma nova prévia explícita permite concluir, e replay original após outra mudança não regrava. O port em memória confere evento por mutação e unicidade, mas **não prova SQL, RLS, sessão, durabilidade ou concorrência PostgreSQL**.

Validado na autoria: revisão estática e, no freeze, diff-check e hashes nativos. Pendente: peer independente, compilador/lint/camadas/segredos e testes no CI combinado; adapter/rotas/SQL em outra frente; duas sessões reais para CAS/pausa/retomada/exclusão/pagamento; catálogo/restore e UI/aceites reais. Nenhum runtime local, banco, API de produto, commit, push ou deploy foi executado por esta frente. Não fechar #78 por este pacote.

## Recebimento para revisão de Root

Os 13 arquivos B1-V3 e os seis arquivos B2 foram copiados para um checkout de revisão próprio, com bytes e SHA-256 conferidos. Root e a frente de persistência revisaram os contratos, calendário, proteção do histórico, prévia/commit, recibos e eventos. A revisão não identificou bloqueador estático; não atesta execução funcional ou persistência.

O lint dos 17 arquivos TypeScript passou. Dois fixtures são ignorados pela configuração geral e foram verificados em uma segunda chamada com `--no-ignore`, mantendo `--max-warnings=0`; nenhuma regra foi desativada. O scanner de segredos, as fronteiras, o compilador e as seis suítes de unidade permanecem portões do candidato publicado. A branch de revisão também conserva o deploy automático desabilitado. O canal, SQL e interface B3 ainda são entregas separadas e não estão habilitados por este código do Núcleo.
