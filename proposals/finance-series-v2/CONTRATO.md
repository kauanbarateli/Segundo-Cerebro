# Séries Financeiro B2 — contrato da proposta SQL inerte

Referências congeladas: B1 V3 `db2080297ac6841db9f4f128c871b021e0ca848541805a2eb4d59afa144a86a6`, Core B2 V1 `f856ef4fe4c400d4658eaa6b32406b411838033e523ac7c6807c2caf9ad1e698`. Os19 paths foram conferidos byte a byte; nenhuma alteração de autoria do Core. Não é migration numerada; nenhum SQL foi executado. Root atribui numeração depois de026/onboarding e orçamento, revisa catálogo e aplica somente quando autorizado.

## RPCs fechados acordados

- `public.finance_series_snapshot(p_user uuid,p_session uuid,p_request jsonb)` recebe **a intenção** `{command,input}` validada, sem dono vindo do navegador. Retorna `{version:2,finance_revision,series:[],occurrences:[],transactions:[],accounts:[],categories:[],tags:[],receipt:null|ReciboIdempotente}`. No máximo1 série,120 mapas/lançamentos,122 contas/122 categorias/3660 tags. A união de referências é exata: histórico de cada linha, template atual e template solicitado. Ausência de referência solicitada não impede replay legítimo. Não há limite silencioso ou log de eventos/recibos.
- `public.finance_series_page(p_user uuid,p_session uuid,p_cursor uuid,p_limit integer)` recebe cursor nulo ou UUID e limite1…50, retorna o `FinanceSeriesPage` v2 com `finance_revision` textual e cursor; keyset por ID,51º só para decidir hasMore. Não materializa nada.
- `public.finance_series_detail(p_user uuid,p_session uuid,p_series_id uuid)` retorna null ou `{version:2,finance_revision,series,occurrences,transactions,accounts,categories,tags}`. Limites1/120/120/121/121/3630. Nenhum receipt/evento. Auth e feature precedem até null/404. Grupo sem metadata pode seguir UI legada; erro de Auth/transporte nunca vira fallback legado.
- `public.finance_series_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb)` recebe `{request:{command,input},expected_finance_revision,context,changes,events,receipt}`. O campo duplicado `expected_finance_revision` deve ser exatamente o de `request.input`; contexto é do servidor, SQL ainda valida owner/canal. Resposta `{status:'stale'}` ou `{status:'committed'|'replayed',result}`. Sem alterar comandos/recibos v1.

Snapshot/detail são readmodels de servidor, não são devolvidos integralmente ao navegador. Rota pública aplica DTO mínimo próprio. Limites de transporte propostos: intenção pública64KiB, resposta4MiB, commit interno8MiB. Quota estourada recusa, não trunca. Testar Unicode/tag unions máximos antes do aceite.

## Ordem e atomicidade

Auth parent SHARE → sessão SHARE → advisory exato `capture-task:<owner>` → require_actor/Entitlement → recibo → revisão financeira → série → mapas/linhas ordenados → referências e plano → efeitos/eventos/recibo. O guard Financeiro atual `read.finance` já implementa a ordem Auth/sessão/advisory e feature; não adicionar um segundo namespace de lock.

Autorização atual é obrigatória antes de todo retorno, inclusive receipt/replay/null. Receipt-first significa somente antes de CAS/referências atuais/efeitos. No snapshot e commit, receipt com mesmo command/clientId mas fingerprint diferente gera23505/CONFLICT. A string fingerprint é preservada; sua interpretação JSONB precisa ser exatamente `request.input`. Não confiar em hash, payload ou resultado vindo da UI.

Resultado incerto é reconciliado repetindo a **mesma** snapshot-intenção/clientId. O adapter não inventa UUID, altera fingerprint nem tenta CAS novamente em segundo plano. Readmodels trazem revisão atual mesmo quando o Core retorna o receipt original; isso não autoriza reinterpretar seu resultado.

## Validação SQL independente

O commit deve calcular o conjunto exato esperado de alterações para cada um dos8 comandos: âncora/ordinal/cursor/horizonte, rateio original, cartão por data ou atribuição explícita, regras de elegibilidade e efeitos completos. Comparar BEFORE real e AFTER esperado, IDs/criação imutáveis e exatamente um evento correspondente por alteração. Detectar omissão seletiva de ocorrências elegíveis, não só validar as linhas submetidas. Resultado/contagens precisam corresponder ao conjunto confirmado.

Metadados e mapas privados têm RLS, FKs compostas pelo dono, unicidade de grupo/ordinal e vínculo único de transação. Nenhuma tabela, função de permit ou função auxiliar é concedida a public/anon/authenticated/service_role. Somente wrappers de servidor recebem EXECUTE. Datas civis0001–9999, revisão texto bigint canônico,2…120 posições; consultas nunca criam efeitos.

O bump financeiro existente já observa eventos `finance_%`; v2 precisa aparecer no CAS global sem mudar a interpretação de recibos v1. A seleção de eventos do snapshot v1 passa por patch de fonte **pinado** para exatamente `finance_account`, `finance_category`, `finance_tag`, `finance_transaction`, `finance_budget`. Preservar toda a função e grants restantes; divergência aborta. Não ampliar `finance_command`.

## Proteção de v1 e gate B3

INSERT/UPDATE/DELETE de lançamento cujo grupo pertença à série gerida, ou cuja identidade já esteja mapeada, é negado em v1, inclusive batch forjado, duplicação e series.stop. Commit v2 tem permit privado single-use, vinculado a owner/série/row/BEFORE/AFTER/command/clientId/backend_pid/xact. A guarda consome por DELETE RETURNING **antes** de qualquer SET CONSTRAINTS ALL IMMEDIATE; segunda entrada recusa; trigger deferred exige zero residual. Erro posterior reverte consumo e todo o commit.

Não atualizar mapa depois de aceitar mutação v1. Exclusão v2 grava suppression=manual no mesmo commit. Bloquear mudança de kind de conta referenciada por mapa, preservando mudanças de nome/ciclo/arquivo permitidas. Pagamento v1 da fatura cria seus pares/encargos independentes e não ganha autorização para alterar uma compra mapeada. Grupos legados sem metadados não são convertidos por inferência.

DELETE em cascata da própria identidade precisa continuar possível no procedimento Auth autorizado: a guarda não pode impedir a remoção da conta/dados. Qualquer exceção de cascade deverá depender da ausência transacional do Auth parent daquele owner, nunca de GUC, flag HTTP, pg_trigger_depth ou papel controlável pelo cliente. Requer teste real de exclusão de fixture; não ativar uma exceção genérica para DELETE.

**Nenhuma guarda é ativada antes do endpoint e consumidor B3 funcionais** para realização parcial/total em conta comum, cancelamento/reconciliação, cartão/fatura separados, erro/incerto e acessibilidade. Todos os SQL deste pacote começam por aborto DRAFT e são propostas. O gate da UI não é resolvido por testes sintéticos de SQL.

## Gates previstos

Core real→Store/Gateway→SQL canônico descartável:8 comandos, conta comum/cartão,12 meses novos versus120 reativados, completo conjunto BEFORE/AFTER/eventos/recibo, rollback por linha/evento/recibo, same-ID replay após mudança de ciclo, CAS global/série, foreign-owner e namespaces v1. Testar fonte pinada divergente sem DDL residual, grants e schema fechado, permit consumido/segunda entrada negada/residual e cascade de fixture.

Duas sessões PostgreSQL reais depois do aceite serial: create/materialize duplos, pausar versus realizar, retomar versus cancelar manualmente, ciclo de cartão versus commit e revogação de acesso versus replay. Não apresentar Promise.all de PGlite como concorrência PostgreSQL. Nenhum desses gates foi executado nesta autoria.
