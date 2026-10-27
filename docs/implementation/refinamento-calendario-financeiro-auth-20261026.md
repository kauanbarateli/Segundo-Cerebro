# Calendário, Financeiro e acesso — refinamento de 26/10/2026

Pedido do mantenedor: reproduzir o layout do protótipo no Calendário/Financeiro e melhorar composição, tema e acesso às políticas no login. Referência: [doc17](../planejamento/17-evolucao-prototipo/prototipo/) e [doc18](../planejamento/18-convergencia-prototipo-20261025/README.md). Base desta rodada: `abb453bc5a6cd4385f254eebf57bfaef8120ad39`, que concluiu 23/23 workflows; esses resultados não certificam o novo lote.

| Superfície | Correção | Contratos preservados |
|---|---|---|
| Calendário | Lateral de Lista mais ampla, cartões com data/fonte separadas, Dia linear expansível e seletores mobile de semana/mês. | OAuth de leitura, duas contas, fontes, fuso, cache parcial, notas, Drawer, URLs e Entitlements. |
| Financeiro | Compactação das faixas de controle, resumo e tabela; filtros agrupados e explicações secundárias recolhíveis, conforme o protótipo. | Valores/competência, máscara, ordenação, paginação, séries, faturas, limites, reservas e imagens de Metas. |
| Acesso | Moldura ampla no desktop e coluna única no celular; três opções diretas de tema; links de políticas e suporte. | Autofill, revelação de senha, disponibilidade, foco/erros, loading, retorno seguro e recuperação/troca de senha. |

## Ciência das políticas

O mantenedor confirmou pelo questionário a leitura obrigatória no formulário de login. A checkbox inicia desmarcada, tem alvo de 44 px, preserva seu estado após rejeição e só aparece no sign-in disponível. Links separados abrem [Termos](../../src/app/termos-de-servico/page.tsx) e [Privacidade](../../src/app/privacidade/page.tsx) em nova aba, sem descartar campos. O rodapé também mantém esses destinos e o suporte informado pelo mantenedor.

Essa confirmação é uma validação da interface. Não cria recibo legal versionado no banco, não representa consentimento genérico para tratamento de dados e não autoriza marketing. O servidor conserva o contrato de credenciais; o registro jurídico persistido do futuro cadastro continua no escopo comercial próprio. Recuperar/definir/trocar senha não ganham nova exigência.

## Diferenças justificadas do protótipo

- O DTO de Calendário não fornece descrição nem texto da nota; esses parágrafos não serão inventados. Participantes conservam as iniciais permitidas, sem nova coleta de fotos.
- A lateral de 330 px só aparece quando comporta os sete alvos de 44 px. Em larguras menores, filtros recolhíveis e seletores locais preservam acesso sem overflow da página.
- Em 320 px, setas → Hoje usam ordem visual igual ao DOM; nenhuma correção por tabindex positivo.
- Conteúdo financeiro e imagens de Metas continuam derivados dos registros disponíveis. A referência visual não autoriza fabricar valores, metas ou uploads.

## Validação por etapa

**Revisado localmente:** Auth, Calendário e Financeiro por autoria, Root e peer independente. O lote agregado de 11 arquivos/204 testes passou em Node 24, com heap de 256 MB e um worker: contratos SSR do formulário, Calendário e cálculos/modelos financeiros. Os 22 contratos estáticos adicionais do Calendário também passaram na entrega da frente. As verificações locais usam a instalação Vitest 4.1.11; o CI fará a instalação canônica do lockfile. Nenhum build, browser de testes, PostgreSQL ou Docker foi iniciado localmente.

**Preparado para CI:** layouts em 320/390/768/1280/1440 px conforme a superfície, claro/escuro, teclado, radios, checkbox negativa sem envio, rejeição com campos preservados, datas sem mudar vista, expansão/Drawer, overflow e fontes/estado parcial. Os helpers nativos de login passam a marcar a ciência, preservando seus oráculos de sessão e efeitos. Testes pesados permanecem no GitHub.

**Revisão financeira:** a tabela de Lançamentos mantém as seis colunas visíveis do protótipo atual; o mosaico de inspiração não substitui a captura e o código do doc17. O painel de categoria/ordenação conserva abertura e foco ao limpar o último filtro. Os oito arquivos da entrega coincidem após normalização LF; o Git removeu somente um CR final em cada um dos dois CSS. Nenhum conteúdo foi substituído para atender hashes de transporte.

**Portões locais:** lint dos 31 arquivos TS/TSX/MJS alterados aprovado sem warnings; detector Impeccable sem achados nos alvos das três superfícies; scanner de segredos aprovado em 2.774 arquivos versionáveis, sem imprimir valores; whitespace aprovado. Três contratos de inventário de fontes Auth/Admin e oito mocks de login positivo/negativo passaram, sem iniciar serviços. O fechamento derivado inclui o novo seletor de tema: Admin 543 fontes/61 dependências; recuperação 269/60, sem adicionar o fixture de interface às entradas nativas.

**Ainda pendente nesta redação:** Typecheck/CI próprios e comparação visual da candidata integrada. A existência dos testes não equivale a execução aprovada. Registrar os próximos resultados por SHA e deployment; não atualizar goldens para esconder diferenças.

## Primeira inspeção conectada — e50d606

Source `e50d6060f5ac49fc0f19ed09d718c51f94ed386a`, Preview `dpl_9PGrZX7dM8sv344sJgyZpn9bTMYa`, branch exclusiva de homologação, build READY. Conferência no navegador em 1280 × 720, com sessão comum de QA já existente:

- Login: três radios, checkbox obrigatória inicialmente desmarcada, campos de 16 px, controles de 44 px CSS e ausência de overflow horizontal. Claro/escuro e navegação com setas entre os radios conferidos, restaurando Claro. Os seis pares de texto/fundo medidos tiveram contraste mínimo de 5,60:1 no [claro](evidence/auth-layout-e50d606-20261026/auth-light-measurements-e50d606.json) e 7,85:1 no [escuro](evidence/auth-layout-e50d606-20261026/auth-dark-measurements-e50d606.json). Links separados preservam `_blank` e `noopener noreferrer`. Não houve preenchimento de credenciais, envio de login ou aceite das políticas pelo agente.
- Calendário: Lista com a lateral/cartão previstos; troca para Dia, escolha de outra data conservando Dia, expansão de compromisso existente e abertura do Drawer somente leitura conferidas. Sem conectar/revogar contas, sincronizar ou criar/vincular notas.
- Financeiro: composição real, Lançamentos e filtros conferidos. Escolher categoria e voltar a todas manteve o painel aberto, foco na categoria e Tab para ordenação, sem alterar dados financeiros. A inspeção revelou moeda e status quebrando dentro da célula desktop; essa correção integra a rodada seguinte.

O CI desta Source não foi aprovado: Typecheck recusou uma tupla de teste sem tipo fechado; os contratos puros de Auth/recuperação encontraram doubles anteriores à checkbox e um fixture de cardinalidade anterior ao novo import. Build READY não substitui esses portões. As correções devem preservar os oráculos, negativas e limites. Mobile, autenticação positiva real desta candidata e aceite integral permanecem pendentes.

**Correção dos testes:** a tupla passa a ser literal; a preparação da UI acompanha a checkbox também na tentativa nativa com senha antiga; doubles aceitam somente o controle nominal e recusam um check falho antes de qualquer POST; o fixture final usa a cardinalidade 269 já derivada por AST e mantém seus negativos. Revisão independente aprovada. Os 409 contratos de suporte completos e 11 casos de recuperação selecionados passaram localmente. Um caso adicional parou em `SOURCE_REFUSED`, pela instalação local Next 15.5.27 frente ao pin 15.5.28; nenhuma guarda foi contornada. A instalação canônica e esse aceite continuam no GitHub.

**Correção da tabela:** regras locais a partir de 768 px preservam a unidade do valor em BRL e do estado. Descrição e conta continuam quebrando linhas; cards mobile e o scrollport existente da tabela permanecem. O novo teste em 768/1440 px mede uma linha de texto contida na célula e ausência de overflow global. Lint focado e detector do CSS corrigido passaram; execução do E2E e confirmação hospedada pertencem à candidata seguinte.

## Conferência a1e1ea9 e saldo final do lote

Source `a1e1ea97f828ff2f29443d2f44ce2b33b95c3ef6`, Preview `dpl_CzsXwbEhPuWDCQZxgrSdeoBiwzGH` READY. Root confirmou no navegador que moeda e estado cabem nas células em 1280 px, com `nowrap`, rolagem local `auto` e ausência de overflow global. Typecheck remoto, diagnóstico de interface, Recovery e Admin passaram nessa Source. O CI completo encontrou duas causas adicionais na preparação dos testes: o login Identity ainda não marcava a ciência, e o inventário legado de arquivos compartilhados precisava incluir o seletor de tema.

- O login Identity agora marca a checkbox antes do estado de resultado incerto e da submissão. O suporte puro completo passou 413/413, incluindo os sete pontos de login ativos, recusa do check sem POST e perda de resposta mantendo incerteza.
- A clausura legada foi rederivada por getter/AST e blobs Git: 291 → 292, somente `auth-theme-switcher.tsx`, nenhuma remoção e 50 definições de dependências preservadas. Contrato/declaration e fixtures acompanham esse número; quatro contratos puros de caminhos/relatórios passaram. O Drive continua inerte, com `DRIVE_NOT_PROVEN` antes da infraestrutura; nenhum collector de SDK divergente, browser ou Drive foi executado para esse ajuste.
- Dois PNGs públicos do diagnóstico a1 (run `40436803288`, attempt 1, artifact `12703949174`) foram conferidos contra o doc17 em 1440/390 px. A comparação mobile revelou espaçamento excessivo em Recentes e corte inicial de Planejamento. A correção restringe o padding desktop ao seu breakpoint; até 600 px, Recentes mostra título/categoria, valor e ação de 44 px, como a referência. Data e conta permanecem no detalhe existente. As abas conservam fonte e alvos, com menos espaçamento horizontal; scroll e foco continuam disponíveis em 320 px.

Essas últimas correções exigem CI e capturas próprios da próxima Source. Os casos existentes de 320/390 px ganham verificação de geometria, quatro abas visíveis em 390, conteúdo do detalhe e retorno de foco, sem remover os oráculos anteriores. Nenhuma falha histórica foi convertida em aprovação e nenhum workflow/deadline foi alterado.

## Regressão completa 425a76a

Preview `dpl_Aa7QF73nY1gNsvMF9YYdXd2GK9qE` READY na Source `425a76a63a7269a94fc09ad92be87b0d9cc7c85b`. Auth, Admin, Recovery, Typecheck e contratos passaram; o diagnóstico próprio e seu PNG 390 px (run `40440169569`, artifact `12705463683`) confirmaram as quatro abas e Recentes compacto. Os dois CIs completos tiveram o mesmo resultado: 600 E2Es aprovados e cinco falhas, sem perda de browser ou cascata de infraestrutura.

- **Auth:** a confirmação estava marcada antes do envio, mas o reset nativo após a Action recusada a devolvia ao default inicial. O evento `reset` agora sincroniza somente o default da checkbox do próprio login disponível com a escolha local. Não cancela o reset nem preserva a senha. O E2E conserva a retenção exigida e acrescenta senha limpa, desmarcar e impedir nova Action até nova confirmação.
- **Calendário:** o teste avançava para uma semana vazia e então esperava os três eventos do dia anterior. Agora retorna explicitamente ao dia com dados antes de provar quantidade, teclado e Drawer; scroll e Hoje continuam cobertos. Nos dois testes mobile, a URL é aguardada com o `expect.poll` já usado no arquivo, preservando a navegação assíncrona e o prazo anterior. Nenhum código de Calendário precisou mudar.
- **Contrato visual:** uma anotação redundante de Auth em `DESIGN.md` quebrava o hash do contrato global. Somente essa adição desta rodada foi retirada; o blob voltou ao baseline qualificado, sem alterar o portão ou seus pins. A descrição completa do refinamento continua no brief de Auth e neste documento, sem mudança de tokens ou identidade.
- **Retorno mais rápido:** o workflow de diagnóstico mantém seus 22 specs e acrescenta Auth e quatro specs de Calendário. Não remove a suíte completa, não altera permissões, instalações, workers, retries ou deadlines. Assim as superfícies deste pedido são verificadas também na lane rápida.

Revisão Root/peer e lint focado aprovados; os 14 contratos SSR de Auth foram reconferidos localmente. A primeira tentativa foi recusada por EPERM no cache temporário do sandbox; a repetição usou TEMP/TMP privados dentro do workspace, restaurados ao fim, e passou sem mudar assertions. O novo E2E real e a regressão completa ficam para o próximo SHA no GitHub. Nenhuma aprovação é herdada de 425.

## Observação causal após 4071b0c

O diagnóstico próprio de `4071b0ce4c058048701d6d0e410f5b7f63167486` (run `40444241946`, attempt 1) aprovou 407 cenários e recusou somente a retenção da checkbox após a Action sintética. Os três casos corrigidos de Calendário passaram. A tentativa de sincronizar `defaultChecked` no reset não demonstrou resolver o problema; não promover essa direção a aceite funcional. Os fluxos nativos de Auth/Admin/Recovery e os contratos dessa Source passaram, mas não substituem esse caso de interface.

A próxima publicação de investigação não altera produto: acrescenta observação DOM limitada a 32 registros booleanos de checked/defaultChecked/defaultPrevented e fase, sem valores, FormData, hooks internos, storage ou credenciais. Uma edição legítima do e-mail força outro render antes do envio; todos os oráculos e a exigência pós-recusa continuam. O relatório é emitido em finally, sem mascarar a falha original.

Um workflow complementar executa somente os formulários Auth, no mesmo ambiente demo público, com branch/ref e paths fechados, um worker e job de 15 minutos. Ele não substitui os CIs completos, não altera seus deadlines e não oferece acesso hospedado. A QA pode permanecer em 4071 durante essa investigação de testes, pois o produto não muda. O traço deve determinar a próxima correção; nenhuma hipótese adicional será tratada como validada sem execução.

Merge e deploy de produção continuam bloqueados. Somente homologação isolada está autorizada. Sem migration, alteração de credenciais, contratação, checkout Asaas, novo Drive ou retomada do restore.
