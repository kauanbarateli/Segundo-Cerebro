# G0 — admissão explícita sem nova foto, A retida

24/10/2026. Autoria local isolada sobre Root `0d933d98ca8fcd6def222d184d9b9462370d98eb` / árvore `b6c018609cac8267f9c58def3385911f6dcd8eb2`, conforme adendo técnico de SHA `a90550d42a780a53bb7a037aaee2afb60378c7d1f575e3a1a0978ad51fceb3d2`. Implementado somente no coordenador, suíte nova e este documento. Sem montagem de Editor/Workspace, schema, Core, HTTP, port, factory, J2, flags ou serviços alterados.

## Contrato público local

Exports em src/lib/files/goal-image-upload.ts: GoalImageNoNewImageChoice, GoalImageNoNewImageBasis e GoalImageNoNewImageProof nominal. Basis contém scope atual da instância, financeRevision textual canônica, fields fechados {name,target_cents,deadline} e escolha create-null/update-omit/update-remove. Usa GoalFields do Core e seus validadores primitivos de centavos/dia/revisão; o nome conserva a regra limitada a160 caracteres e não vazio do Core. Nenhum GoalCommand/UUID financeiro é fabricado para validar a autorização.

- authorizeNoNewImage(basis): Promise<GoalImageNoNewImageProof>.
- claimNoNewImage(proof,basis): Promise<void>.

Create-null exige alvo sem Meta e significa image_file_id:null na intenção futura. Update-omit exige Meta existente e não muda a foto atual. Update-remove exige Meta existente e autoriza somente a escolha futura explícita de null; não apaga arquivo, não altera A nem prova unlink. A confirmação financeira e seu CAS/evento/recibo continuam em outro gesto/canal.

A captura fechada ocorre antes do primeiro await. Getters não são lidos como valores; dados são clonados/validados antes da assinatura local. A basis e sua escolha são reconferidas nas filas, antes/depois das admissões e antes de retornar. O alvo precisa continuar o scope atual da instância e de currentScope; nunca se rebaseia o scope imutável de A.

## Capacidade e locks

A capability é um objeto congelado com Symbol privado; sua autoridade fica em WeakMap, ligada à MESMA instância viva, basis completa, snapshot canônico integral de A e fence de sessão do journal. JSON/clone/Proxy/dto não produzem autoridade; Ready/Linked não recebem essa marca. A é exigida como metadata própria completa em active ou retirement-review, em qualquer phase válida; revisão, seleção/hash, uploadClientId/uploadId, scope, phase e estado são retidos. Não se exige File nem positivo finalize para esta ação, e não se aceita ausência/corrupção como vazio.

Tanto emissão quanto claim adquirem upload lease e depois a lease financeira breve através da barreira do MESMO client e controller. A barreira revalida journal financeiro físico e hold do controller, inclusive pending lógico com corpo físico null, reconfirmação e estado ausente. Não chama acknowledgeReview. Nenhum HTTP ocorre sob essas leases.

Claim só reconhece proof da própria instância e o remove do WeakMap ANTES de qualquer await/retorno; falha também o queima, exigindo novo gesto/positivo local para tentar novamente. Um receiver estrangeiro não queima proof de outra instância. Revalida snapshot A inteiro, target, fields/revisões/choice e fences. Dispose redige somente as capabilities G0 da própria instância; o restante do lifecycle continua igual.

O proof não afirma revisão atual no servidor. A proteção financeira real continua no preview/commit com revisão esperada. Depois de claim positivo e fence da sessão Editor, o consumidor pode criar UM clientId financeiro, congelar o corpo null/omit/remove e chamar prepare. Esse fluxo pertence à fatia de UI, não foi montado aqui. Um resultado posterior incerto continua no protocolo financeiro original, sem novo corpo/UUID por ausência.

A admissão G0 não mantém lock durante HTTP nem impede outro ator legítimo depois do claim. Ela garante que esta ação não altera A e que o contexto era exato no ponto de admissão. O caminho selected normal continua independente, sem fallback automático. Não modifica hash/upload/resume/Ready/Linked/retire/replace nem seus guards; acrescenta somente a redação das novas capabilities ao dispose.

## Testes escritos; sem resultado de execução

Nova suíte tests/lib/goal-image-upload-no-new-image.test.ts usa FinanceGoalsBrowserClient, createGoalsController, FinanceGoalsJournal, GoalImageUploadJournal e a barreira concreta. Disponibilidade sintética é permitida apenas no setup; contadores são limpos antes de G0. Positivos não usam controller fake, File, SDK ou proof finalizado. Overrides de estado de controller ficam exclusivamente em negativos de recusa, sem issuer nominal falso.

Matriz escrita: sete phases active × três escolhas e retirement-review ready-unbound × três escolhas; storage com SET/DELETE recusados, bytes A/journals iguais, ordem upload→finance e zero reserve/PUT/observe/finalize/hash/novo upload UUID/HTTP. Demais jornadas: uso único, instância/owner/epoch, clones/Proxy sem hooks, recusa nos receivers Ready/Linked, basis alterada e claim queimada, outra aba avançando A, pending físico e hold/reconfirm lógico, alvo stale, campos mudados em await, troca de controller/logout, fila upload150s e finance30s drenada após timeout tanto em authorize quanto claim, busy, revogação explícita, journal ausente/corrupto/legacy/read-refused e selected sem fallback.

Os testes são sintéticos, ainda não executados; não provam Web Locks do navegador, Auth/Storage hospedados, bytes/quotas remotas, SQL ou montagem. Erros continuam no enum existente; refusas da barreira podem passar pelo safe mapping UNAVAILABLE. Todo falso/erro mantém a UI conservadora e não equivale a resultado não aplicado.

## Validação e limites

Autoria/revisão textual somente. Nenhum Vitest, TypeScript, lint, Node, build, PostgreSQL, CLI de serviços, browser, conexão, rede, serviço, commit ou push executado nesta fatia. O checkout novo não tem node_modules; não houve instalação ou fallback. Git foi usado somente para leitura de HEAD/árvore/status, sem optional locks, refresh de índice ou configuração. Root deve revisar o pacote, derivar o grafo/dependências real e executar checks próprios da união de forma serial/GitHub.

Os WIPs/freezes anteriores no checkout servidor permanecem intocados. 001–026, propostas/SQL, API, Core, port, J2/barreira/factory e políticas não foram editados. Produção, merge, montagem, promoção de schema e restore permanecem bloqueados conforme seus gates próprios.

## Revisão V2 — URL do setup da fixture, sem mudança de produto

O peer independente de SHA195d0accacaa823b1c7320db0bb24ee2d5e05c8ca65232fbe92362a7a46663f8 encontrou o único P2 estático do V1 no setup: o client concreto envia o path relativo /api/finance/goals/availability ao fetcher; origin serve para conferir response.url. O fake exigia input absoluto e impediria controller.open antes de exercitar G0.

A V2 aceita somente aquele path relativo exato e fornece response.url normalizado por new URL(path, origin fixa https://g0.invalid). Não aceita URL absoluta, outro path ou fallback. O contador setup é limpo antes das ações, que continuam exigindo zero HTTP/IO/write. Só esses dois substrings do teste e esta nota mudam; o coordenador, a API nominal e os oracles dos casos permanecem byteiguais ao V1. O freeze anterior não foi alterado. Nenhum teste, Node, lint, TypeScript, browser, SQL ou serviço foi executado; peer e checks próprios do candidato continuam pendentes.
