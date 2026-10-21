# #75 — contratos puros de documento em CI isolado

Refs #75. Part of #71. Esta integração reúne a extração compatível `01b836a35f5dc316763a1c14eb53dadce3494b6a` e sua filha `ea2f2dac9f00ef8d268bbf63b7700a0bd29ecf4f`, a partir do planejamento `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`. Base de CI `eab708f35dfc8ef47962a904b09b602c51b2373c`. Os dois commits fonte são ancestrais, seus nove blobs são preservados e os hashes brutos dos dois manifestos foram conferidos. Nenhuma fatia financeira ou de hábitos acompanha esta branch.

## Recorte e revisão

A extração move tipos e funções literalmente para `core/contracts/rich-document.ts`, preservando exports de Conhecimento. Não muda a validação histórica, limites ou resolução de referências. A filha introduz somente `lerConteudoDocumentalDaCaptura`: entrada fechada discriminada entre legado literal/revisão0 e documento clonado com revisão positiva segura; texto rico é derivado, limitado a30.000 unidades UTF-16 antes do trim. Legado não é convertido, truncado ou reinterpretado. JSON conserva512KiB/32níveis/10.000nós. Wiki-link de Página é recusado no ramo Captura; nenhum nó novo ou alinhamento é admitido.

Root e revisores independentes conferiram os limites, cópia iterativa, ciclos/aliases, descriptors, protótipos, namespaces e testes preparados. A revisão encontrou um P2 no catch que preservava erros de domínio lançados por reflexão de Proxy. O commit fonte final corrige o ponto: catch sem binding, sem ler ou repropagar a exceção, produzindo código e mensagem estáticos de VALIDATION. Os negativos incluem erros comuns/de domínio privados, valores primitivos, Proxy lançado e Proxy revogado. A reflexão ainda pode disparar traps de introspecção; não se promete ausência de qualquer efeito arbitrário de Proxy.

Nenhum tipo persistido, CRUD, CAS, alocação/incremento de revisão, consumidor, editor, draft, promoção, evento, adapter, SQL ou migration é ativado. As partes restantes da #75 e os aceites de #71/#81 continuam pendentes.

## Integração de gates

Os barrels existentes alcançam dois novos módulos: `src/core/contracts/rich-document.ts` e `src/core/capturas/rich-content.ts`. A partir desta base, declaram-se Admin381/61 (antes379/61), Recovery211/60 (antes209/60) e coletor legado244/50 (antes242/50). O Actions deve derivar e confirmar os conjuntos reais, não apenas aceitar os números. Todos os controles exigem ambos os caminhos; Admin e legado testam sua omissão individual, e Recovery testa identidade Git incorreta individual. Os verificadores uniformes e os negativos anteriores permanecem. Dependências, seeds e demais controles permanecem; o coletor legado não reativa a entrega Drive ou seu workflow manual.

São reutilizados somente os ajustes estreitos de orçamento global de CI, relógio contextual de um teste sintético e diagnóstico de saída Node/Admin. Nenhum timeout interno, terminal, cleanup, acesso, origem ou oracle é relaxado. A branch recebe `git.deploymentEnabled:false` antes do primeiro push; inspeção no provedor é evidência distinta. Não houve alteração de plano nem deploy.

## Evidência e validação pendente

Validados por leitura: nove hashes, conjuntos de cinco/quatro paths de cada entrega, ancestralidade, diff-check e revisão independente, com P2 corrigido. Nenhum Node, teste, TypeScript, lint, build, navegador ou serviço foi executado localmente, conforme a limitação de RAM. Testes preparados não são PASS. A rodada própria no GitHub deve executar UTC/São Paulo, scripts, camadas, scanner, DS, detector, build, fronteira cliente e cenários descartáveis de Auth/Admin/Recovery/Storage/PostgreSQL. Resultados de outras PRs não certificam este SHA.

O histórico compartilhado de falhas permanece: #70/b67 possui17/17 próprios; #86/bdf terminou16/17 com Admin push39562263016 recusando quiescência de uma request após actor-intact/after-blank, sem terminais/cleanup certificados. O relatório bruto existe no ZIP, apesar do truncamento de visualização do CLI. A investigação segue na #43; esta extração não é correção desse protocolo.

Sem merge, deploy, credenciais de produção, Supabase hospedado, Asaas ou SQL remoto. Migrations001–019 permanecem preservadas. A publicação e os resultados do HEAD serão registrados na PR e na #75.

## Reconciliação do carregador nativo de Capturas

A rodada completa de a4 terminou11/17 success e6 failures, todos17 completed/attempt1, sem rerun ou cancelamento: Auth, Captura/Storage e CI geral falharam nos dois eventos. Os outros onze runs passaram em seus SHAs próprios. O CI geral push39571172291 passou Typecheck/lint/unidade, mas o lote de scripts terminou1681/1742; build/E2E seguintes não executaram. Nenhum resultado é reclassificado retrospectivamente como PASS.

Na primeira rodada de `a4ae26c63de9dff7588bc800a53d3515c6b37b95`, Auth e Captura/Storage recusaram controles sem serviço com GRAPH_REFUSED. No PR, checkout `03c4735a2b65a9ff85dfccf8475ded6a5c6138a3`, Storage run39571178664/job119125455026 teve52/91 controles aprovados; Auth run39571178710/job119125455757 passou guardas70/70 e408/408 antes de CaptureTask1/23. As etapas Auth real e prova Storage ficaram sem execução nesses runs. O catch fecha a causa interna, mas há um caminho estrutural concreto: o barrel Capturas agora importa rich-content→rich-document, e moduleParsed recusa esses dois paths ausentes do inventário do carregador. Isso ainda não prova ausência de outras causas; o novo CI deve confirmar.

A correção adiciona somente os dois módulos em CAPTURE_NATIVE_MODULES e REQUIRED_MODULES e na tuple TypeScript correspondente. O conjunto declarado passa de20 para22; há negativos de omissão individual dos dois paths. Mantêm-se os oito exports reais do entry, react-server/server-only, recusa de external/dynamic/symlink, chunk único sem imports e teto262.144bytes. O processador de imagem isolado permanece com9 módulos; sua união com o núcleo passa de27 para29, sem alterar os27 requests esperados do protocolo. O inventário de fontes do produtor Storage herda os paths e cresce de59 para61, dentro dos limites existentes sem ampliar o validator.

Nenhuma regra de domínio, fonte da entrega, chamada, contador de protocolo, oracle de bytes/EXIF/SQL, deadline, transporte ou cleanup muda. Não se troca o carregador real por stub. Revisão e diff-check são estáticos; compilação, resolução Rolldown, controles e serviços descartáveis só terão aceite após os runs próprios do novo commit. A rodada anterior e todos os seus resultados permanecerão registrados.
