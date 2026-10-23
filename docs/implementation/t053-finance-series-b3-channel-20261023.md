# T053/#78 — canal financeiro v2, anterior ao rollout

Data: 23/10/2026. Autores das frentes: Core/canal (`escopo_entrega_20261023`) e SQL (`restore_20261023`); revisão e publicação cabem a Root. O adapter e a rota foram materializados nesta fatia; a persistência SQL, o consumidor visual e o rollout permanecem pendentes. Nenhuma API ou SQL foi executada na autoria. Base: B1 V3 + B2 Core V1, preservando A V2 e todos os freezes anteriores.

## Port e fronteiras

O canal `/api/finance/series` usa `decodeFinanceSeriesCommand` e `executeFinanceSeriesCommand`, com UoW próprio. Não ampliar `FINANCE_COMMANDS`, snapshot, recibos, entidades ou resultado do contrato financeiro v1. SDK somente no runtime do adapter. Nenhum owner, sessão, contexto, changes ou eventos vem do navegador.

O contexto é derivado da sessão validada no servidor: `user_id`, `canal:'web'`; autenticação, sessão ativa, moderação, senha obrigatória e Entitlement financeiro são reconferidos nos RPCs, inclusive leitura e replay. Escritas exigem Origin exata, application/json e X-Expected-User-ID igual ao dono autenticado. GET também exige o header de dono esperado. Falhas fechadas sem SQL, headers, credenciais ou payload privado em respostas/logs.

## RPCs acordados entre Core e SQL

1. `public.finance_series_snapshot(p_user uuid,p_session uuid,p_request jsonb)`: `p_request` é exatamente a intenção pública `{command,input}` v2, usada para selecionar o agregado finito, sem escrita. Retorno fechado:

```text
{version:2,finance_revision:string,series:[],occurrences:[],transactions:[],accounts:[],categories:[],tags:[],receipt:null|ReciboIdempotente}
```

Os máximos, respectivamente, são 1 série /120 mapas /120 lançamentos /122 contas /122 categorias /3660 etiquetas. É a união exata de referências usadas nas120 linhas, template atual e template solicitado: edições futuras podem ter categorias/etiquetas diferentes das antigas. Não truncar um agregado maior: recusar. Retorna só a série própria solicitada e referências próprias efetivamente vinculadas; jamais o ledger completo, log de eventos ou lista de recibos. Uma referência solicitada ausente é representada por ausência, não impede retornar o recibo exato de replay. Uma referência histórica de linha persistida, por outro lado, deve existir e pertencer ao dono. Conta arquivada também não impede replay de uma intenção já confirmada. Sem recibo, o Core recusa referências indisponíveis antes de efeitos.

2. `public.finance_series_page(p_user uuid,p_session uuid,p_cursor uuid|null,p_limit int)`: limite1..50 e cursor por UUID. Retorna `FinanceSeriesPage` fechado `{version:2,finance_revision:string,items:ManagedFinanceSeries[],next_cursor:string|null}`. Revisões são texto canônico bigint, nunca Number. Ordenação/keyset por UUID, sem offset e sem eventos/recibos.

3. `public.finance_series_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb)`: `p_operation` deve ser o comando exato da intenção; envelope fechado:

```text
{request:{command,input},expected_finance_revision,context,changes,events,receipt}
```

Resposta `{status:'stale'}` ou `{status:'committed'|'replayed',result:FinanceSeriesResult}`. `expected_finance_revision` do envelope é idêntica à da intenção; contexto/recibo pertencem ao dono e comando, fingerprint é o do input público exato. BEFORE/AFTER, chaves, regras e conjuntos elegíveis são validados no SQL; não confiar somente no planejamento do servidor.

4. `public.finance_series_detail(p_user uuid,p_session uuid,p_series_id uuid)`: retorno `null` quando não houver série própria gerida, depois de Auth/acesso (HTTP404, sem converter grupo legado em gerido) ou `{version:2,finance_revision,series:ManagedFinanceSeries,occurrences,transactions,accounts,categories,tags}`. Máximos1 série /120 mapas /120 lançamentos /121 contas /121 categorias /3630 etiquetas, sem eventos/recibos. Inclui a união exata de referências do template atual e de todas as linhas; nenhuma referência sem uso. É necessário para a UI conhecer o `occurrence_id` real antes de registrar pagamento/exclusão e para preparar retomada. O ledger v1 só conhece grupo/ordinal, não o ID do mapa; não fingir uma intenção de escrita/UUID descartável para descobrir esse dado. GET `?series_id=UUID` usa allowlist fechada; não aceita paginação e detalhe simultâneos. Erros de Auth/rede/contrato não viram fallback legado.

## Uma transação, sem retry automático

O store obtém o snapshot pelo comando imutável, mantém a cópia em memória e executa o callback Core uma vez. O Core consulta o recibo exato antes de CAS: replay do mesmo corpo retorna o resultado original, mesmo depois de outra mudança financeira. Sem recibo, comparar revisão financeira e da série sob o lock do dono antes de qualquer mutação. Após mudanças de conta, fechamento, categoria ou ledger, falhar por conflito e pedir nova prévia; não recalcular silenciosamente.

O adapter coleta mudanças e eventos e exige relação exata1:1, mesmo owner, IDs/criação preservados e um recibo cujo resultado coincida com o callback. Nenhum remove físico. Fecha o port depois do callback para impedir escrita tardia. Antes de enviar, validar tamanho/limites e envelope fechado.

Em `stale`, retornar conflito, sem repetir o callback, criar UUIDs novos ou reenviar o commit automaticamente. Em timeout/transporte/resposta inválida após commit, o desfecho é incerto. Reconciliação somente leitura repete `finance_series_snapshot` com a MESMA intenção/clientId, valida o recibo exato/fingerprint/resultado e só resolve se ele existir. Ausência, recusa, corpo inválido ou nova falha mantêm COMMIT_UNKNOWN. Não tentar outro commit ou inferir rollback pela ausência momentânea. O cliente precisa preservar corpo/UUID na incerteza até reconciliação ou decisão explícita.

Duas execuções iguais podem ler ausência de recibo e gerar IDs locais diferentes. No retorno `committed`, o resultado deve coincidir com o planejado. No retorno `replayed` e na reconciliação, o resultado é o original do recibo do vencedor, validado e vinculado ao mesmo fingerprint, mesmo que seus IDs sejam diferentes dos gerados pelo perdedor. Isso não autoriza aceitar outro corpo/clientId ou reenviar o batch após conflito.

## Gate funcional e publicação

Guardas v1 para linha/grupo mapeados não podem ser ativadas antes do endpoint v2 e do consumidor B3 no detalhe dos Lançamentos: registrar realização/pagamento parcial/total explicitamente, exclusão manual, falhas/uncertain e replay. Quitar conta comum exige `paid_cents` integral daquela ocorrência; não inferir pelo template/ordinal. Cartão continua com pagamento de fatura separado.

Permissão privada single-use é consumida no BEFORE e vinculada a dono/série/linha/BEFORE/AFTER/xact/pid; nenhuma exceção genérica. Legacy v1 sem mapa mantém seus fluxos. Account.kind não muda enquanto houver referência de mapa v2, mas ciclo/nome/final/sugestão/arquivo mantêm contratos. SQL permanece proposta inerte até revisão, asserções e gates reais supervisionados. Nada de Asaas, Cron automático, Drive, autoconversão de legado ou pagamento presumido.

## Pacote previsto do canal (novos paths)

```text
src/adapters/db/finance-series-protocol.ts
src/adapters/db/finance-series-gateway.ts
src/adapters/db/finance-series-store.ts
src/adapters/db/finance-series-runtime.ts
src/app/api/finance/series/route.ts
tests/adapters/finance-series-{protocol,gateway,store}.test.ts
tests/adapters/finance-series-route.test.ts
tests/fixtures/finance-series-channel.ts
```

Os testes prepararão port fechado, owner/sessão/entitlement, before/evento/recibo exatos, late-write, CAS sem rerun, replay, timeout+recibo, timeout+ausência e erros após incerteza. São evidência sintética, não validação PostgreSQL/RLS/browser. Execução pesada somente no GitHub após peer; nenhum runtime local nesta frente.

## Estado da entrega

Implementado: os cinco paths de produção acima; decoder fechado para snapshot/page/detail/result/recibo, união exata de referências próprias (incluindo histórico), UoW com evento1:1 e ports encerrados, transporte PostgREST dedicado sem simular tipos oficiais do banco, rota autenticada com DTO público/CSRF/dono esperado. A entrada pública é limitada64KiB; leitura4MiB; commit interno8MiB; timeout15s e redirects proibidos. Nenhum dado privado bruto é enviado a logs ou respostas de erro.

Preparado, **não executado**: quatro suítes de adapter/rota e fixture de gateway descartável. Incluem união máxima de122contas/122categorias/3660etiquetas com Unicode, referência histórica ausente, referência extra/estrangeira, page fechada, destino indevido, escrita incerta, resultado de concorrente com IDs distintos, erro após incerteza, CAS sem repetir callback, escrita tardia, owner/entitlement/CSRF, limite e ausência de detalhes do provedor. O gateway sintético não prova durabilidade, transação SQL ou RLS.

Pendente: peer independente, compilador/lint/camadas/segredos e execução dos testes no CI combinado; SQL/asserts/gates da outra frente; consumidor B3 de séries e pagamento explícito de ocorrência, journal/uncertain/fences e seus testes; duas sessões reais e ensaios de ciclo/recibo/rollback; inventário/catalog/restore; promoção supervisionada. **Não fechar #78 nem ativar guardas pela presença desta rota.**

```text
npx vitest run tests/adapters/finance-series-protocol.test.ts tests/adapters/finance-series-gateway.test.ts tests/adapters/finance-series-store.test.ts tests/adapters/finance-series-route.test.ts
```

Base de autoria313f1c6a57798e794aa80e1208f3d26a6b74edb3, sobre B1 V3 e B2 Core V1. A-V2/B1/B2 e seus freezes permanecem preservados. Nenhum SDK no Core, alteração de v1, aplicação de banco, leitura de segredo, runtime local, commit, push ou deploy foi executado nesta frente.

## Revisão de incorporação por Root

Os onze arquivos do freeze V1 foram conferidos por tamanho e SHA-256 antes da cópia. Root leu protocolo, gateway, store, transporte e rota, além dos cenários negativos; outro agente revisou estaticamente as cinco unidades de produção. O lint passou nos dez TypeScript, incluindo a fixture com `--no-ignore`. O verificador de segredos passou em 2.132 arquivos versionáveis. Nenhum desses checks atesta execução das quatro suítes, da RPC real ou da concorrência SQL; esses gates continuam pendentes no CI e na homologação.

A UI precisa obter referências financeiras e revisão no mesmo snapshot antes de confirmar. A disponibilidade será explicitamente desligada por padrão no servidor até completar SQL, tipos, interface de pagamento/realização e validações; o canal v1 continuará disponível para grupos legados. Nenhuma flag foi habilitada, migration promovida ou operação remota executada nesta incorporação.