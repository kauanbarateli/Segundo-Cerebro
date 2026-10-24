# T-054 — canal servidor terminal M2-S

Implementado em candidato isolado sobre `01ae6a7c62b8d2dbe9e295b7702d329f64ec5313`. Segue a decisão Root do contrato M2 e o peer de desenho `88f99b8a…`. Não ativa Metas, não muda schema/flags e não altera M1, reconcile financeiro V1, journal, controller ou interface. Merge e produção permanecem bloqueados; a autorização atual cobre somente preparo local/homologação supervisionada.

## Contrato

- POST `/api/finance/goals/attempt/status`: somente `finance_goal_attempt_status`; sem escrita de domínio, consumo de quota, settle/commit ou fallback. Uma consulta pode manter `kind:uncertain`.
- POST `/api/finance/goals/attempt/settle`: somente `finance_goal_attempt_settle`, por ação explícita do consumidor. O SQL M1 base decide receipt-first e o fence sob lock comum e aplica a quota existente 30/min apenas para novo encerramento. O transporte não repete nem reconcilia automaticamente.
- Ambos recebem o `GoalCommand` original, fechado, até 64 KiB. Nunca aceitam owner/session/canonical_input/digest do navegador. Sem querystring. Sessão atual em modo Supabase, troca obrigatória de senha concluída, Entitlement financeiro, Origin, JSON UTF-8/encoding e `x-expected-user-id` permanecem obrigatórios. A flag de novas Metas não impede recuperar uma tentativa anterior; destino e deployment continuam conferidos.
- Sucesso é exatamente `{ok:true,result:GoalTerminalReply}`. O protocolo terminal é 2; a canonicalização é 1; o resultado financeiro `confirmed.result` continua 1. Não há binding1 HTTP redundante. Erros usam os seis códigos HTTP existentes; nenhum corpo/SQL/credencial é refletido.

## Fronteiras e transporte

`finance-goals-terminal-contract.ts` contém somente DTOs, constantes e `decodeGoalTerminalOutcome(expected,original,value)`. O decoder puro verifica descritores, allowlists, owner, comando, UUID, versão, digest e resultado financeiro original. Não calcula o hash, não autentica origem e não substitui captura nominal. O adapter `finance-goals-terminal-canonical.ts` conserva `server-only`, Node Crypto, assinatura original e WeakMap privado; o wrapper `decodeGoalTerminalReply` delega apenas a verificação fechada. Os exports antigos continuam disponíveis.

`finance-goals-json.ts` usa JSON.parse como dono da sintaxe e examina as chaves no texto bruto, comparando nomes após o decode de escapes. Rejeita duplicatas equivalentes, profundidade/propriedades excessivas e não retorna diagnósticos com o conteúdo. O wrapper HTTP financeiro V1 mantém 4/32. Respostas terminais usam 6/64, também disponíveis à frente browser; ela deve usar sua própria expectativa capturada antes de awaits.

O runtime captura actor, sessão, origem e segredo exclusivamente servidor. Só os dois nomes RPC fixos são alcançáveis; o payload inclui o envelope nominal e os UUIDs fixos. O limite do envelope M1 é preservado, acrescido de no máximo 256 bytes para os argumentos RPC. `redirect:error`, URL final exata, cache no-store, Content-Type JSON, UTF-8 fatal, recusa de BOM e resposta interna até 512 KiB são exigidos. O envelope HTTP final continua limitado a 1 MiB pelo helper existente.

Uma única deadline de 15 segundos cobre fetch e leitura até EOF natural. Request.signal, deadline ou estouro cancelam a leitura sem esperar cancelamento hostil; lock do reader é liberado quando a leitura pendente termina. Um fetch que ignora abort tem o corpo tardio cancelado e nunca gera outro envio. Uma resposta parcial que já contém JSON válido não é aceita sem EOF. Resposta/codec inválido ou RPC ausente vira indisponibilidade na consulta e resultado incerto no settle, nunca erro400 atribuído ao usuário. Somente códigos SQL fechados permitem Auth/limite/conflito; texto SQL não atravessa a fronteira.

## Evidências e gates

**Implementado:** DTO/decoder puro, scanner puro, preservação da captura nominal, transporte servidor, duas rotas finas, testes escritos de vínculo, JSON, controles Auth/origem, deadline/EOF/abort, bytes, saneamento e distinção status/settle. As fixtures são sintéticas, sem e-mail enviado, conta Master, banco ou credencial real. Os testes existentes de M1 e HTTP V1 são preservados.

**Validado nesta autoria:** somente leitura estática, diff/whitespace, inventário e hashes. Não foram executados Node, Typecheck, lint, testes, SQL, navegador, rede ou serviços. Nenhum teste escrito significa PASS.

**Pendente:** peer cruzado M2-S/M2-B, Typecheck/dependências/lint/testes no CI do SHA combinado, journal/controller/UI terminais e seus negativos, corridas nativas entre commit/settle/executor antigo, Auth e aceites conectados supervisionados, recuperação que preserve fences ou rejeite geração antiga. Sem esses gates, não expor ou ativar o canal para uso de produção. O encerramento não desfaz aporte, não devolve dinheiro e não substitui revisão humana atual antes de outro UUID.
