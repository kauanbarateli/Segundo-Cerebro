# Entry: navegação única para o estado público de nova captura

A captura Entry usa uma navegação de documento ao target.route canônico. Para Capturar, esse destino é /capturar?capture=new. Não clica em Nova nota depois de carregar o mesmo estado e não faz uma navegação SPA adicional.

O produto já suporta esse deep link: CaptureView usa o parâmetro capture para requestedId e para inicializar/atualizar mobileEditor; os E2Es captures.spec.ts e issue22-capture-persistence-sql.spec.ts também abrem essa rota. Isso define somente a orquestração da fotografia. O comportamento do botão Nova nota continua com seus testes funcionais próprios.

O CI push40355061282 do Source d6e6a2c616ed0992676d3c850a6852e14cbc4a50 registrou requestfailed ABORTED/ALLOWED_GET/CAPTURE_PATH/RSCYES/routerPrefetchNO/purposePrefetchNO, faseREADINESS. Esse diagnóstico fechado não mostra a query, o iniciador ou a ordem completa; não se afirma causa absoluta. O código anterior aguardava URL/editor visível após um router.push, sem provar o fim da RSC. A proposta retira essa transição extra conhecida, mantendo o estado público desejado, em vez de suprimir aborts ou simular produto para a foto.

Não se usa networkidle isolado como prova do fim da RSC específica, nem retry, sleep novo, ledger global, permissão de API ou filtro de requestfailed. readyEntry, contrato de rota, frame/recorte, formulário real, nomes neutros, GET-only, Source/pins, leitura de imagens, limites, ausência de save/seed e recusa fatal de saúde permanecem intactos. O initializer de OG não é alterado: seu risco será decidido pela primeira captura real própria.

O contrato puro exercita a função de orquestração real em sua fixture sintética já existente, verifica um goto canônico e recusa a reintrodução de click/goto/SPAnav duplicados. Falhas de documento/readiness/editor/saúde e URL final incorreta continuam recusadas sem repetição. Isso não é uma captura browser ou aceite visual.

A qualificação permanece dependente do próximo CI push e do artifact próprio com Source/run/attempt/17membros, seguida da revisão de pixels. A prova Entrada76 mantém sua identidade histórica; não deve ser reescrita para o Source deste ajuste. Não houve mudança de produto, banco, fixture persistida, permissões ou critérios de aceite.
