# Diagnóstico local público do PostgreSQL18 — 23/10/2026

Refs #35. Pacote incremental sobre a PR #103, fonte `0259d0cd78acc6286cf2c452c6d4cec7b330b05d`. Não foi incorporado à homologação de UI: essa árvore não contém os três módulos públicos necessários ao controlador.

## Implementado

Launcher PowerShell com preflight antes de Node,34 leases de leitura e conferência dos30 arquivos pinados da instalação local permitida. Wrapper chama diretamente o controlador público original, sem importar restore, perfis, chaves ou archives. Mantém dois inputs sintéticos,45s por caso/90s por lote, terminais e primeira falha. Não fabrica metadados GitHub, binding de ZIP ou autoridade de restore. O cleanup é não recursivo; filho inconclusivo impede sua declaração de sucesso.

Os quatro paths da proposta foram conferidos por manifesto/patch e peer independente. Pins, protocolo privado, controlador original e workflow EDB permanecem intactos. Um step adicional no CI geral faz lint explícito dos novos módulos, pois fixtures são ignoradas pelo lint geral. Os testes em tests/scripts entram na descoberta normal; nenhum teste existente foi removido.

## Validado

Root executou inicialmente33 testes puros pelo caminho padrão de Node, com heap96MiB. A consulta posterior de versão demonstrou que esse executável é25.9.0: **o registro inicial que o identificava como Node24 estava incorreto**. Esse PASS não é prova em Node24. Em seguida, o Node24.19.0 retornado pelo runtime do Codex foi conferido por tamanho/hash exatos já pinados; nele passaram **34 testes, zero falhas, cancelamentos ou skips** (18 novos e16 originais importados), incluindo seleção explícita do caminho e recusa de outro runtime. Não houve execução PostgreSQL, leitura privada ou rede nesses testes. AST do launcher e apply/check passaram. Isso não comprova carregamento de DLLs ou cleanup nativo Windows.

O primeiro acionamento local recusou no preflight, antes de Node/PG, com zero pins abertos: a comparação case-sensitive de SystemRoot recusava a grafia equivalente do Windows desta máquina. A correção usa OrdinalIgnoreCase para o mesmo caminho absoluto C:\Windows; não aceita outra unidade/pasta nem altera CI, Node options, pins ou PATH global. O segundo acionamento também não iniciou Node/PG: o caminho padrão contém Node25 e o pin recusou corretamente. A seleção explícita de um caminho Node24 permite usar os mesmos bytes previamente aprovados; não troca a versão/hash permitidos nem fabrica identidade de runner. Os resultados iniciais permanecem preservados, sem promovê-los a testes nativos executados. O lint local inicial usou Node25; o CI próprio e a conferência posterior em Node24 são provas separadas.

## Controle nativo local observado

Com os mesmos pins de Node24.19.0 e PostgreSQL18.4, o launcher abriu/fechou34 leases e o controlador original concluiu **dois casos públicos reais**, ambos exit/close0, sem sinal, timeout, cota excedida ou filho inconclusivo. O cwd próprio foi removido e sua ausência confirmada. O caso83B terminou normalmente. O caso83B+8MiB registrou **EOF** no callback/stdin, conservado literalmente no recibo, e depois os terminais naturais0; o controlador o classificou OBSERVED. Isso demonstra o comportamento desse controle público, sem converter EOF em EPIPE nem autorizar operações privadas.

A primeira execução que chegou ao Node retornou envelope0, mas o arquivo detalhado ficou no TEMP efêmero do sandbox e não pôde ser recuperado após seu término. Os mesmos dois casos sintéticos foram executados novamente com captura do recibo dentro da mesma chamada; esse segundo recibo foi preservado. Não foi uma repetição de restore nem uma tentativa sobre dados privados. [Recibo público](evidence/restore-public-windows-20261023.json):4.372B, SHA256 `f15fd61b33cd01941eb1a5482565a91555679923fc0cd4fa87c20cf17022e33f`.

O lint explícito final também passou em Node24.19.0 (heap128MiB), com dependências locais do checkout principal; não substitui o lint do lockfile e SHA publicados no CI. Os três módulos originais e seus pins permaneceram intactos.

## Próximos gates

CI próprio do novo delta, incluindo o lint explícito; revisão de como o transporte privado trata EOF, mantendo autenticação do archive, snapshot, qualificação de origem/alvo e terminais. A2/A1, inspeção privada, stream, Storage e aceites Auth/Cofre/dados continuam separados. As duas falhas Windows da fonte0259, anteriores aos casos nativos, permanecem registradas: a instalação local não equivale ao ZIP EDB recusado.

Nenhum restore será executado por um PASS sintético. `restoreAccepted=false` continua obrigatório no diagnóstico público. Produção e merge/deploy de produção permanecem bloqueados; sem reaplicar migrations ou usar bancos legados/VOE/BlackSheep.
