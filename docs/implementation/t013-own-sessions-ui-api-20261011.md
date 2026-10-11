# T013 / issue 37 — sessões próprias: Core, API e interface

Implementação do requisito original «ver minhas sessões» de Configurações. A seção conectada apresenta a sessão atual primeiro, criação e última renovação, com datas desconhecidas preservadas como nulas. Renovação significa refresh registrado; não certifica último uso ou validade. Não há nomes de dispositivo, IP, user agent, UUID de sessão, tokens ou `not_after` no DTO da interface. A ação existente de trocar senha continua sendo a forma de encerrar as outras sessões; não foi criada revogação individual.

## Contrato e autenticação

`GET /api/settings/sessions` exige a URL exata, sem query/body, modo Supabase, Origin/Sec-Fetch-Site compatíveis e identidade verificada pelo gateway de Auth existente. A mesma instância de cookie jar gravável e headers privados atende à verificação de identidade e ao client publishable. A RPC tipada `my_sessions` não recebe argumentos. Sua assinatura provém do [export oficial de 55 RPCs da cadeia 019](t013-local-types-019-20261011.md); nenhum overlay de tipos ou client privilegiado foi introduzido.

O header `X-Expected-User-ID` é uma condição de consistência da página com a identidade já verificada. **Ele nunca seleciona o dono da consulta e não é passado como argumento para a RPC.** O filtro de dono e o SID ficam sob o contrato SQL e os claims autenticados; o Core recebe exclusivamente o SID verificado pelo gateway. A comparação do header impede uma resposta da conta atual de ser adotada por uma página ainda vinculada à conta anterior.

O gateway recusa identidade/acesso antes de inicializar o SDK da leitura e projeta somente `sessions[{isCurrent,createdAt,refreshedAt}]` e `hasMore`. Exige a corrente exatamente uma vez, em primeiro lugar, e vinculada ao SID verificado; aceita no máximo 100 linhas. `hasMore` informa truncamento, sem inventar total. A ausência ou mudança comprovada da corrente é `409 SESSION_CHANGED`; SQL `42501` é `403 FORBIDDEN`, sem atribuir causa de sessão. Os demais resultados fechados são 400/401/503, com mensagens fixas. Todas as respostas reaplicam cache privado/no-store, `Vary: Cookie` e `nosniff`, inclusive após refresh ou erro. Os cookies usam a política segura existente.

## Apresentação e leitura

`OwnSessionsSection` reutiliza Card, Collapsible, Button e Link do DS 2.1, numa lista plana com `ul/li/dl/time`. Há loading/status/busy, erro e tentativa explícita, mudança de sessão com entrada novamente, vazio defensivo, datas nulas e truncamento factual. A projeção autenticada real recusa uma lista sem a corrente; o estado vazio não simula uma sessão válida. O link único «Trocar senha» passou de Perfil para Sessões. A apresentação demo permanece separada.

O reader é estável por owner, usa um GET fixo com credenciais da mesma origem, no-store, redirect recusado, limite total de 20 segundos e JSON UTF-8 limitado a 64 KiB. Não abre corpos de erro, não guarda snapshot em storage/cache global, não faz polling ou retry automático. Abortos cancelam o reader de stream aberto; ao concluir, remove listeners/timer e aborta o sinal filho do transporte, inclusive em saída antecipada e sucesso já consumido. O sinal do caller permanece independente. O prazo também limita o resultado de transportes que ignorem abort, sem afirmar que um transporte arbitrário foi encerrado fisicamente. Na troca de conta, a seção oculta o snapshot antigo antes dos effects, aborta a leitura anterior e ignora callbacks tardios/unmount.

CSS **RECOMENDADO** usa os tokens vigentes, alvos de 44 px, foco visível e quebra das datas em uma coluna no mobile. Não foram alterados tokens, goldens ou thresholds. A revisão Impeccable local 4.4.0 e a checklist React foram aplicadas; contraste, teclado, composição visual e ausência de overflow desta seção ainda dependem da execução em navegador.

## Validação e limites

QA própria nesta entrega: **79 controles focados** em seis arquivos (Core 6, UI 11, gateway 7, runtime 3, rota 23 e reader 29), mais **49 regressões existentes** de Configurações: **128/128 PASS**. TypeScript global estrito, lint dos 14 arquivos TypeScript/TSX sem avisos, fronteiras de arquitetura (330 módulos/1334 dependências), diff e verificação de segredos também passaram. O sandbox recusou criar o cache temporário do Vitest; a repetição foi somente local, em memória.

Os testes de runtime usam o SDK SSR/Supabase instalado com HTTP em RAM, JWT/cookies sintéticos e getter de secret key recusado: verificam publishable, bearer de cookie, RPC sem argumentos, refresh no mesmo jar com cookies seguros e zero inicialização/refresh nos guards recusados. Rota e reader cobrem erros fechados, consistência de owner, cache, abortos, tamanho e UTF-8. Os testes da UI cobrem SSR dos primitivos e o seam de hooks de privacidade existente; **não são prova de navegador, teclado, visual, HTTPS hospedado ou autenticação pessoal**.

A aplicação da 019 e sua proveniência são registradas pela Root no documento de schema/evidência; esta entrega não executou DDL ou leitura de linhas Auth no projeto pessoal. Nenhum novo SQL ficou pendente neste pacote. A validação conectada da seção será coordenada no CI existente, depois da revisão independente e da atualização das closures pela Root, sem certificar produção por testes simulados.
