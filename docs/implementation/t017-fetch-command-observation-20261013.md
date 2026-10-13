# Admin e Recovery: resultado observado do comando Fetch

O código instalado do Playwright 1.63.0 confirma uma lacuna de diagnóstico: `RouteImpl.continue` e `RouteImpl.abort` usam `catchDisallowedErrors`, que pode absorver a rejeição de `CRSession.send`. Uma chamada de rota resolvida não demonstra que `Fetch.continueRequest` ou `Fetch.failRequest` resolveu, nem constitui término do request. A reprodução local extrai esses métodos do bundle instalado e confirma um ACK de rota após uma rejeição sintética do comando, com o request ainda registrado.

Isso é uma possibilidade comprovada pelo código e pelos mocks. Não identifica a causa dos runs nativos que falharam e não declara correção de quiescência, limpeza ou aceite de Auth/Admin/Sessões próprias.

## Observação opcional

As duas specs ativam `createBrowserProtocolObserver({fetchCommands:true})`. O padrão continua com os seis campos anteriores. O contrato aceita exatamente quatro, seis ou oito campos; o novo par só existe junto com membership e é obrigatório por inteiro.

| Campo | Valores permitidos |
| --- | --- |
| `fetchCommand` | `continue`, `abort`, `unobserved`, `unavailable`, `mixed` |
| `fetchOutcome` | `pending`, `resolved`, `rejected`, `unobserved`, `unavailable`, `mixed` |

A correlação exige o mesmo ServerRequest, entrada do gerenciador, CRSession registrada, `Fetch.requestPaused.networkId` e o interception ID exato da rota original. Identificadores permanecem em RAM. Outra sessão, entrada substituída/ausente, accessor, comando repetido ou identidade incompatível produz informação indisponível. Não há correlação por URL, método ou proximidade temporal.

O observador envolve apenas `send` das CRSessions já enumeradas. Encaminha a chamada original uma vez, com o mesmo `this` e os argumentos originais; devolve o mesmo Promise. Uma reação separada registra apenas resolução ou rejeição, sem ler resultado ou erro, e não substitui a rejeição entregue ao consumidor. Também conserva o valor exato de uma exceção síncrona. O descarte restaura o descritor anterior se ainda for o wrapper deste observador e preserva qualquer alteração posterior de outro responsável.

Há limites de 4.096 interception IDs por sessão e 8.192 tentativas no observador. A ultrapassagem torna o diagnóstico indisponível e continua encaminhando todas as chamadas originais. URLs, parâmetros de autenticação, headers, corpos e mensagens de erro não são lidos pelo diagnóstico nem publicados.

## Critérios preservados

Nenhum resultado de comando altera as Maps de requests, emite evento terminal ou autoriza limpeza. `requestfinished`/`requestfailed` reais continuam responsáveis pela remoção pública. O prazo absoluto de 15 segundos do encerramento, a primeira falha, a incerteza de escrita e o veto de limpeza conservam seus critérios anteriores. Um terminal tardio não transforma uma falha em aprovação. Os wrappers de CI e o produto permanecem sem alteração nesta observação.

O ajuste funcional separado F1 impede que a expiração do prazo total do caso Admin sobrescreva sua primeira falha. Uma execução sem falha anterior continua recusada no limite exato; isso não estende o prazo nem libera limpeza.

## Validação e limites

Os mocks cobrem a implementação original de `RouteImpl`, Promise/argumentos/`this`/rejeição preservados, resultado resolvido sem EOF, sessão estrangeira/removida, getters, comandos repetidos, limites, restauração dos descritores, contratos históricos e primeira fotografia de falha imutável. Não iniciam navegador, Next, Supabase ou conexão SQL. A próxima execução nativa própria deve observar os novos enums antes de qualquer proposta de correção causal.
