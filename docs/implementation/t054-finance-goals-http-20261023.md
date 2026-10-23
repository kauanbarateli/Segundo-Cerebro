# Metas #79 — canal HTTP preparado, rollout desligado

Refs #79, #71. Implementação isolada na base `044432e72448fc9e702377c3936042999bc86e01`, sem commit, instalação, ativação, merge ou deploy. O contrato puro `finance-goals-http-contract.ts` é autoria Root, SHA-256 `56b0a05ecbf2521a9756fb1e74904cb30778e123a0b1c2f5dcf37b1c091addec`, e não foi editado nesta fatia. A proposta aprovada fica em EV/review/finance-goals-http-plan-v1-20261023.md; a decisão posterior de Root fixou referência indisponível em400validation, substituindo a possibilidade404 daquele plano.

## Implementado

Quatro arquivos de rota: GET/POST `/api/finance/goals`, GET `/availability`, POST `/preview` e POST `/reconcile`. Helpers servidor concentram Auth/fence, gramática, respostas e a projeção readonly. Reutilizam Core, Store, Gateway, runtime e parsers existentes; nenhum SDK ou adapter é importado pelo navegador.

Todos os handlers verificam configuração/deployment, identidade/sessão real pelo guard existente, troca obrigatória de senha, Entitlement financeiro e `x-expected-user-id`. O dono do header é apenas um fence; contexto e owner vêm do actor. Todos os POSTs exigem origem exata, media type JSON/UTF8, ausência de query e corpo público GoalCommand, sem contexto/owner do chamador. Respostas são privadas/no-store, sem cache ou eco de erro SQL, request, segredo ou stack. Atualizações de cookie dos guards mantêm os headers também em falhas.

`FINANCE_GOALS_V1_ENABLED` ausente ou diferente do texto exato `true` mantém novas operações desligadas. Availability exige Auth/fence e informa a flag sem RPC Goals ou sondagem de schema. Flagtrue não faz fallback se faltar RPC/schema: a operação falha unavailable. Nenhum arquivo de ambiente foi alterado.

## Protocolo

GET usa view explícito page/detail/reservations/releases e rejeita parâmetros repetidos/desconhecidos. Page tem cursor UUID, limite1–50/default20 e archived active/archived/all/defaultactive. Detail usa id e devolve resultnull quando indisponível, após Auth. Históricos exigem id e o par cursor_at/cursor_id completo ou ausente; os microssegundos são preservados como texto validado. Query também respeita requestBytes64KiB antes de construir o readmodel. Não há intenção, saldo ou fingerprint em URL.

POST body e query ficam nos limites Root. O stream é medido em bytes reais até64KiB, sem confiar em Content-Length; UTF8 inválido e BOM são recusados. JSON.parse define a sintaxe e os valores. Uma caminhada limitada do texto já válido verifica somente keys decodificadas duplicadas, profundidade de containers até4 e até32 propriedades totais. Escapes equivalentes de keys contam como repetição; strings/valores não recebem trim, coerção ou interpretação alternativa. O decoder Core fecha o shape final. O servidor não recebe content-encoding comprimido nem charset alternativo.

A leitura do body tem prazo fixo de15s e respeita Request.signal. Mesmo JSON completo não é interpretado antes do EOF natural observado dentro desse prazo. Timeout, aborto, excesso de bytes e erro de stream encerram a leitura com tentativa de cancelamento e liberação do reader; falha ou espera ilimitada do cancelamento não amplia o prazo. Timeout/aborto produzem503unavailable com mensagem fechada antes de construir o gateway Goals. Nenhum tempo/env configurável foi adicionado.

GET retorna `{ok:true,result}`. Os três POSTs retornam `{ok:true,binding:{version:1,command,client_id},result}`; preview preserva intent exato. Binding não é autoridade de recibo; o canal browser ainda deve conferi-lo contra a intenção capturada e validar os resultados. DTO interno512KiB e wire1MiB são medidos sem truncar.

Só os seis códigos Root saem no wire: validation,conflict,forbidden,unavailable,uncertain,session-changed. Erro de entrada/referência vira400validation genérica; conflito409; troca de dono409session-changed; Auth401/403forbidden; limite429unavailable+Retry-After60; falhas operacionais503unavailable e confirmação desconhecida503uncertain. Não há busy do servidor, not_applied ou promessa de ausência de efeito.

## Leitura, revisão e tentativa incerta

Preview consulta uma snapshot limitada da intenção e verifica o recibo primeiro. Recibo próprio válido devolve o resultado original confirmado mesmo com revisão atual diferente ou referências agora ausentes. Sem recibo, revisões financeira/Meta/destaque precisam ser exatamente as solicitadas. Aporte usa AccountTotals completo do mesmo snapshot e a projeção Core de disponível, sem somar páginas ou usar a data manual como saldo histórico. Conta própria ativa BRL sem cartão, disponível suficiente, data até hoje, remanescente de liberação e referências de imagem seguem checagens fail-closed. A revisão é uma projeção, não autorização: a execução revalida integralmente no Core/Store/SQL.

POST base usa executeGoalCommand/createFinanceGoalsStore reais, clock/UUID de servidor e contexto web do actor. Mudanças, eventos e recibo conservam o commit atômico existente. Não foi acrescentado retry de escrita. A reconciliação readonly que o Store já realiza após CommitOutcomeUnknown permanece a do adapter existente.

**Decisão Root:** `/reconcile` ignora somente a flag enabled, para permitir resolver uma tentativa antiga após interromper novas operações. Mantém Auth, Entitlement, moderação/senha, origem, dono esperado e deployment. Só consulta gateway.snapshot da mesma intenção e valida seu recibo; não importa Store/executor, não chama commit e não cria UUID/fallback. Recibo ausente é uncertain; RPC ausente/erro não é prova de ausência nem lista vazia.

O controlador UI atual conserva hold após qualquer execute falso. As recusas HTTP conhecidas não desbloqueiam esse hold automaticamente, e mount/ack/consulta sem recibo não permitem outra intenção. Root está analisando uma disposição terminal sob lock em fatia separada Core/SQL/porta/UI; nenhum endpoint, tombstone ou contrato dessa ideia foi implementado aqui.

## Validação escrita e pendente

Cinco suítes preparadas: gramática/JSON/limites/headers; flag e guardas; GETviews e POST com Core+Store reais sobre gateway serial de fixture; preview e totais completos; reconcile flagoff com zero executor/commit. Negativos incluem keys escapadas equivalentes, strings legítimas com escapes, body real acima do header, owner/contexto injetado, ausência de identidade/feature, senha obrigatória, origem/charset errados, revisão alterada, saldo insuficiente/cartão/conta arquivada, recibo alheio/adulterado, RPC ausente e canary não exposto. Fetch inesperado é recusado nas fixtures. Esses controles usam Request/Response em memória, sem SQL/API hospedados.

Controles de timers falsos foram escritos para body válido sem EOF, fronteira14999/15000ms, aborto antes/durante a leitura, chunk tardio, erro de stream, cancelamento que falha ou nunca termina e body exato64KiB. O teste de rota exige zero construção de gateway, RPC, eventos e recibos após timeout/aborto. Estes testes ainda não foram executados nesta entrega.

**Não executado por esta entrega:** Node, lint, typecheck, unitários, build, SQL, PG, navegador, rede, conexão, commit ou push. Git/hash e revisão textual não substituem esses gates. Root fará peer e execução/CI próprios antes de incorporar; fixture serial não certifica GoTrue/RLS, concorrência SQL, durabilidade entre abas, mobile, mídia ou produção. Nenhum PASS desses gates é alegado.

Core, SQL/propostas/migrations, tipos gerados, UI/client/journal, env, build, workflows e gates de deploy permanecem fora desta autoria. Imagens continuam sem ativação; a regra de lookup próprio/finalizado não é contornada. Rollout requer schema/tipos/catálogo e aceites independentes; esta fatia não encerra #79 nem autoriza operação externa.
