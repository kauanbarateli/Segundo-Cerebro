# Retomada do doc18 — 26/10/2026

Base conferida localmente e no GitHub: `6cd4442de901ae66e525715c4a90b32fea5f0de1`, PR #120 em rascunho, branch `codex/mvp-goals-terminal-20261023`. D-084 autoriza implementação e validação; merge e deploy continuam bloqueados. O [doc18](../planejamento/18-convergencia-prototipo-20261025/README.md) e o protótipo do doc17 orientam o resultado. Os pacotes congelados da pausa são preservados.

## Frentes e propriedade de arquivos

### Checkpoint atual — Source 5862 e saldo da landing

**OBSERVADO em 26/10, às 11h34 UTC:** os 23 runs originais de `5862ab6cae76d33b5d5c35a40f22a0de9536e973` (árvore `1c519ce5c46a2fd0846d83306b74c3bdc1de64a7`) terminaram com sucesso. Incluem CI geral de PR, Admin e diagnóstico. O [CI de push, tentativa 2](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40308675236/attempts/2) passou após uma única repetição: a tentativa 1 parou no download de pacote do espelho Ubuntu por timeout, antes dos E2Es. Não se alteraram testes, workflows ou tolerâncias para repetir. O [diagnóstico](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40308674833) entregou 264 PNGs; os 14 novos estados da landing/Tarefas 390 foram inspecionados por Root e revisores, sem defeito material nesses recortes. Não certificam a primeira dobra/header ou hospedagem.

**OBSERVADO:** a ref de homologação avançou por fast-forward de 3403 para 5862, sem force e sem alterar main. O Preview `dpl_9Sx5hjEJVZNyrrn7MeG2c9gNccZr` chegou a READY; repositório, branch e SHA conferem, e o prebuild declarou `ready:true,errors:[]`. [Abrir a homologação](https://segundo-cerebro-of-git-codex-homo-efc4bb-kauanbarateli-projects.vercel.app/conheca). As 16 variáveis foram reconferidas por nomes/escopo, sem decifrar valores: todas são Preview da ref correta. A conexão dedicada confirmou o URL TWry e histórico 001–027; o diff 3403→5862 não acrescenta migration. Nenhum schema foi reaplicado.

**PENDENTE:** o navegador de automação não anexou a aba nesta sessão. READY não é aceite conectado, login do aplicativo ou nova prova de persistência. O pacote Main HTTP regenerado permanece inerte, sem janela/deployment/provas aprovados. Os próximos candidatos de captura terão Source/CI próprios; não herdam o PASS de 5862.

**OBSERVADO — drift real da #80:** os oito quadros históricos de Início/Capturar mostram composição/navegação anteriores; Projetos mobile conserva a ordem antiga da barra inferior; a OG de 13/10 ainda mostra a landing com seis capítulos. Isso é diferença de pixels e conteúdo, não apenas data antiga. A Gallery17 de Agenda/Kanban já qualificada permanece preservada.

**EM IMPLEMENTAÇÃO:** modo finito `entrada` captura oito variantes reais de Início/Capturar, com oito sidecars e recibo, em diretório efêmero separado do checkout. Reutiliza supervisão, GET local, Source, geometria/EXIF, ownership, fechamento e liberação de porta de Project/Gallery. Capturar usa Nova nota, formulário e vínculo reais; não se desenha mockup nem se altera UI para a fotografia. O upload só admite o diretório fechado de17membros. O modo OG prepara três membros separados, mas sua execução supervisionada continua pendente: só ocorrerá depois de incorporar os novos rasters e construir esse candidato. [Contrato e ordem da OG](landing-og-capture-20261026.md).

Verificações focadas desta preparação: 14 testes de Entrada e 20 de policy passaram; os 17 contratos Gallery e cinco do novo supervisor passaram após adaptar a asserção de inventário à seleção fechada de membros. Os 36 testes puros de OG passaram. O qualificador offline executou 56 casos: 53 aprovados e três controles nativos de links preservados como SKIP no Windows; o runner Linux deve executá-los. A primeira tentativa de lint de OG com heap de 64 MB atingiu o teto antes de diagnósticos; Root posteriormente aprovou lint focado com teto de 256 MB, sem warnings. Nenhum navegador/build/servidor de captura foi iniciado localmente. Os novos rasters ainda não foram gerados ou incorporados.

As 19 imagens existentes de Calendário/Hábitos do CI de PR foram extraídas seletivamente e inspecionadas, sem novo defeito material nos estados. Root confirmou quatro originais da revisão. O log oficial demonstra checkout `42d781883c211362d16a4b19b2564d4c509d4a38` de merge da PR, cuja árvore é idêntica à Source 5862. São nove imagens de Calendário e dez de Hábitos; 15 labels de Hábitos compartilham dez arquivos porque System coincide com Dark. [Vínculo, hashes e limites](evidence/doc18-calendar-habits-visual-20261026.json). O Calendário usa HTTP sintético e Hábitos usa PGlite descartável; não constituem sessão Google, SQL/RLS nativo ou aparelho físico.

Estado e limites publicados na [issue81](https://github.com/kauanbarateli/Segundo-Cerebro/issues/81#issuecomment-6416448593). Merge/produção seguem bloqueados; restore pós-lançamento, checkout Asaas e nova lógica de Drive continuam fora do recorte. Os checkpoints históricos abaixo são preservados.

| Frente | Escopo inicial | Paths reservados |
|---|---|---|
| Root — integração | #81: Typecheck, foco Metas, revisão, CI; depois contratos #62–65 e Gallery | `tests/core/onboarding-frequency.test.ts`, `financeiro/goals/goal-editor.tsx`, teste/fixture de upload de Metas, documentação de execução |
| Conteúdo/Tarefas | #122 antes de #123 | `features/capturar`, `features/conhecimento`, `features/tarefas`, editor compartilhado em `components/editor` e testes correspondentes |
| Financeiro | #124: navegação, hierarquia e apresentação | workspace, panels, CSS financeiro, `finance-route.ts` e seus testes; não altera o editor/upload de Metas |
| Jornada/Moldura | #125: Início, Configurações, Projetos, navegação e Ajuda | shell/navigation, Home, Settings, Projects; apresentação contextual da rota Drive, sem apagar dados/infraestrutura |

Checkout de execução compartilhado por propriedade de arquivos; somente Root realiza stage/commit/push depois da revisão. O checkout humano com WIPs continua preservado. Um processo local pesado por vez; suites completas, SQL e builds ficam no GitHub. Novos paths compartilhados exigem coordenação antes de editar.

## Primeiro delta — Typecheck e foco de Metas

**Typecheck:** `it.each` recebia arrays de dias como tuplas de argumentos, causando TS2345 e testando elementos isolados em lugar da lista. A tabela agora contém objetos `{ weekdays }`, preservando seis casos negativos, inclusive duplicação `[1, 1]`, tipo string e boolean. Nenhuma regra do domínio foi relaxada.

**Foco:** reprodução local real de navegador confirmou a falha da preparação em `finance-goals-image-upload.spec.ts:137`: o alerta era renderizado, mas permanecia inativo. O cenário de falha na finalização passou na mesma rodada. O editor agendava foco em `requestAnimationFrame`, sem garantir que React já tivesse montado o alerta. O foco agora ocorre em `useLayoutEffect` depois do commit, condicionado a alerta visível e ausência de revisão ativa; as verificações existentes de tentativa/sessão/formulário continuam antes de publicar erros.

Regressão acrescentada aos dois cenários: interromper novos callbacks de frame antes da submissão não impede o foco do alerta. O teste também conserva a consulta sem reenvio e a ausência de conteúdo pessoal no diagnóstico.

### Evidência local e limites

- Node `v24.19.0`.
- Frequência do onboarding: 40 testes passaram em um worker.
- Foco de Metas: quatro testes passaram, incluindo finalização, preparação e duas negativas de resposta tardia após edição/ocultação.
- A reprodução usa transporte sintético e Chromium headless já instalado, sem Supabase/Vercel ou leitura de dados reais. Não é aceite conectado.
- A primeira tentativa de Vitest falhou no diretório temporário do sandbox; TMP/TEMP próprios da execução resolveram o transporte. A primeira tentativa de navegador não encontrou seu runtime no perfil do sandbox; foi usado o cache pessoal já instalado, sem download.
- `node_modules` local apresenta Vitest 4.1.11, anterior ao 4.1.12 fixado no manifesto. O runner fará `npm ci` para validar a instalação exata; os resultados locais são focados, sem promoção a aceite hospedado.
- Na base 6cd4442, a consulta de CI encontrou os dois runs gerais falhos em Typecheck (40264888892 e 40264885434). Os resultados do novo SHA devem ser acompanhados separadamente.

## Validação pendente

CI do SHA corrigido, suites completas de navegador/contratos, revisão das entregas visuais, comparação equivalente com o protótipo e qualificação de homologação. Deltas em desenvolvimento não são critérios concluídos. Não liberar merge ou deploy a partir de testes focados ou checks de uma fonte anterior.

## Segunda fatia — detalhe do Cofre (#126)

A senha e a nota agora possuem ações explícitas de revelar/ocultar no detalhe, com máscara inicial. O componente usa o valor já decifrado no cliente e mantém somente um booleano efêmero de apresentação; não adiciona endpoint, persistência, cópia, auditoria de conteúdo ou renovação de sessão. A atividade normal de clique/tecla continua sob o timer existente.

O detalhe é reiniciado por usuário/item/versão. O guard verifica a sessão corrente e a autorização no render e no clique. Troca de item, bloqueio, mudança de identidade, aba oculta, blur e abertura de operações descartam ou impedem a revelação; retornar não revela automaticamente. Os valores mascarados não permanecem em nós escondidos do DOM. A limpeza do clipboard permanece sob o contrato anterior.

Validação local: cinco testes reais de Chromium do componente (exemplos públicos) passaram para teclado, ausência de cópia/persistência, troca de item/identidade, revogação de apresentação, blur e ocultação/retorno. Essa revogação sintética não substitui o teste de Auth real. Lint dos cinco arquivos TS/TSX passou. O E2E existente do Cofre foi ampliado para revelar/ocultar senha/nota, mascarar antes da exclusão e preservar a máscara após recuperação; sua execução completa permanece no GitHub, com trace desligado.

Revisão independente da frente Financeiro não encontrou bloqueador no delta do Cofre. Aceite de temas/mobile, integração com a sessão real e comparação renderizada permanecem pendentes; #126 continua aberta.

## Progresso da primeira rodada hospedada

Em `08f38f5516ad0e3ba7f109c951f156cb447708f8`, os dois runs gerais [push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40265953079) e [PR](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40265957629) passaram no Typecheck e nos gates anteriores ao E2E. A consulta de 26/10 às 04h02 UTC registrou 20 dos 22 runs concluídos com sucesso e dois ainda em navegador. Isso não qualifica os deltas visuais locais nem conclui o pipeline.

O run de push terminou depois com **545 E2Es aprovados e uma falha**: `VISUAL_STABLE_SOURCE_CHANGED:PRODUCT.md`. Os dois cenários de falha de upload/preparação de Metas passaram no runner. A falha restante foi a qualificação de origem do comparador histórico, cuja lista ainda apontava o texto anterior à auditoria. Não houve novo problema de Typecheck nem relaxamento das regressões de foco.

## Conteúdo e Tarefas (#122/#123)

Capturar passa a trilho/documento e alternância lista/editor no mobile, com Entrada/Organizadas/Todas e Arquivo secundário. Conhecimento apresenta leitura validada antes da ação explícita de editar ou retomar um rascunho. O Reader não instancia Tiptap ou canais de escrita; imagens continuam sob seu contrato separado. A toolbar agrupa ações, oferece estilo de bloco e limpa somente cinco marcas visuais da seleção, conservando links, referências, blocos e undo.

Tarefas compartilha seleção/ordem entre Lista e Kanban, apresenta seis abas e rank numérico de prioridade pesquisável por rótulo. Hoje segue D-082 e os atalhos do Início usam `status=open`. Criação contextual só aceita projeto presente no conjunto autorizado. DataTable acrescenta controles opcionais e um slot de filtros sem dependência de feature; seu comportamento padrão é preservado.

Revisão independente encontrou e corrigiu Voltar nativo para a lista de Capturar e ausência de restauração de rolagem/foco. Há E2Es novos em 320/390 px para os dois retornos e rascunho retido. O Typecheck agregado encontrou um `aria-current` inalcançável em Conhecimento (`selected` já era ausente no ramo da lista); o atributo foi removido, sem cast ou relaxamento de tipos. Depois, o Typecheck agregado passou localmente.

Validação da frente: 42 testes focados e lint passaram; sem execução local de suites SQL/navegador ou build. A revisão preserva fixtures, invariantes e fontes históricas B/P. Comparação renderizada do novo Source e aceites permanecem pendentes.

### Qualificação restrita de origem do comparador

O helper de comparação agora admite somente quatro hashes explícitos novos em **C**: PRODUCT, DESIGN e CSS de Capturar/Tarefas revisados neste recorte. O chamador continua calculando o SHA-256 do blob Git exato; não lê um hash informado pelo manifest como autoridade. B/P, seus blobs/locks, tokens, tolerâncias e comparações ficam intactos. Não há fallback para qualquer fonte atual.

Essa lista declara proveniência e diferenças autorizadas pelo doc18/D-084, sem converter divergência bruta em aceite visual. Novos negativos recusam hashes alterados, troca de path e uso em B/P. Os 34 testes do contrato passaram localmente e a revisão independente não encontrou enfraquecimento da fronteira; os hashes serão conferidos contra os blobs staged antes do commit.

## Financeiro (#124)

Quatro abas principais (Visão geral/Lançamentos/Cartões/Planejamento), URL própria de Cartões e acessos secundários preservam as rotas de gestão anteriores. A composição principal/apoio segue o protótipo, com gráfico e limite numa superfície, análises adicionais recolhidas e reflow até 960 px. Lançamentos tem seis colunas acessíveis, categoria/tipo no subtítulo e filtros junto à busca; os accessors legados de busca/ordenação permanecem.

O formulário de cartão contextualiza nome/final/ciclo/limite, mantém campos gerais em opções e não coleta PAN/CVV. A prévia acompanha a cor. Planejamento agrupa limite e distribuição, conservando os comandos separados. Séries passam a tabela, com “Próxima a preparar” derivada pelo motor; essa posição não é apresentada como vencimento nem pagamento. Regras econômicas, reservas, CAS e confirmação continuam no motor existente.

A revisão independente identificou fundo transparente no detalhe sem classe de cor. O fallback agora fica dentro de `var(--finance-color, var(--surface-inverse))`, e os novos E2Es verificam fundo opaco e contraste real do drawer nos dois temas. O [cálculo de contraste](doc18-finance-card-contrast-20261026.json) fixa CSS/método/18 pares; mínimo matemático 5,142019:1, sem substituição do aceite renderizado.

Validação local da frente: 142 testes em quatro arquivos, lint de dez arquivos, diff e detector Impeccable passaram. E2E financeiro/SQL, máscara, URLs e comparação de imagens do novo Source continuam pendentes no runner. A revisão independente não encontrou outro bloqueador funcional depois do fallback.

## Jornada e moldura (#125)

Início consulta páginas reais de Conhecimento e apresenta caderno/data/destino, sem substituir a Caixa de entrada de Capturar. O leitor filtra dono, caderno acessível e itens ativos; vazio/loading/erro são próprios da seção. A navegação mobile segue Início/Tarefas/Capturar/Agenda, com Capturar central e personalização preservada no menu. Drive deixa de ser oferecido na navegação, busca, preferências e atalhos; catálogo, Entitlements, dados e infraestrutura de imagens continuam preservados. Imagens vinculadas sem origem explícita são informação com ação de desvincular, sem inventar destino.

Configurações reutiliza os modelos de tema controlados, com gravação na conta, painéis principais visíveis e imagem do Início separada. Sessões, dados e páginas legais continuam acessíveis. Projetos adiciona/conclui/reabre tarefas pelos comandos reais e conserva somente progresso derivado, conforme D-081. Ajuda diferencia o modo conectado da demonstração e os limites offline reais.

A revisão cruzada encontrou duas regressões e ambas foram corrigidas antes da publicação: a primeira recusa definitiva de uma tarefa não pode prender a intenção no projeto; salvar Aparência não pode apagar o rascunho de Preferências (nem o inverso). O helper de recusa usa o erro próprio do canal, preservando tentativas com resultado incerto. A reconciliação por campo adota o retorno confirmado e conserva propostas não enviadas ou editadas durante a requisição.

Validação local da frente: 38 testes de navegação/projeções e 14 testes das correções passaram; estes últimos usam cliente conectado e journal reais com transporte sintético, incluindo primeira recusa 400/403/404 e perda seguida de 404. Lint, diff e detector passaram. E2E SQL conserva eventos/RLS e acrescenta saves nas duas ordens e primeira recusa sem mudança no banco; execução e aceite visual aguardam CI.

## Onboarding: apresentação da cadência (#80)

Os sete dias usam chips com nomes curtos visíveis, nomes completos acessíveis e sinal adicional ao uso de cor. São sete colunas acima de 380 px e quatro até 380 px, com alvos mínimos de 44 px, conforme o protótipo. A revisão encontrou e corrigiu o breakpoint inicial de 600 px, que divergia da referência de 390 px. JSON v2, legado, normalização, resumo e foco permanecem no contrato existente. Lint, diff e detector passaram; o E2E ampliado cobre geometria e cadências nos dois temas, mas ainda aguarda execução no runner. A landing depende dos 17 membros Gallery do novo Source qualificado e não foi aplicada com imports ausentes.

## Segunda candidata e diagnóstico independente

Em `9b3b320601d83d8d7acaf8fd2c2f8476a8369d13` (árvore `ed168232e87b8c0fbcf1d2f7873eeff6f5be0c3a`), a consulta de 26/10 às 04h33 UTC encontrou **18 runs aprovados e quatro falhos**, todos terminados. Os dois runs gerais passaram no Typecheck, mas pararam em unitários: 3.695 aprovados e uma falha no exemplo de mídia de `logout-sensitive-surfaces`. A retirada da navegação Drive faz o componente recusar arquivos sem finalidade; a fixture anterior dependia justamente dessa ausência. Ela passa a declarar `capture_image`, conserva rename/delete/resposta tardia/logout e verifica ausência de link Drive. Um negativo adicional mantém a recusa de arquivos legados ou sem finalidade. Os sete testes focados passaram localmente; a suíte exata ainda depende do novo CI.

Os dois runs de Admin falharam nos controles puros de origem: a closure real passou de 542 para **541 paths**, resultado fechado de cinco UIs de Drive que deixaram de ser alcançáveis e quatro imports novos do doc18. O getter original e um walker independente de blobs Git concordaram; os 18 extras declarados, as 61 dependências, a rota contextual, o backend, a migration compartilhada e o controle binário permanecem. O contrato fixa 541, sem intervalo ou fallback. Dois controles locais de inventário passaram; a suíte completa local ficou em 93/98 por cinco recusas de qualificação do runtime/canonical no Windows, preservadas para conferência no Linux. Isso não é aceite do Admin hospedado.

Uma lane adicional `doc18-ui-diagnostics.yml` executa somente os 16 specs de interface alterada, em modo demo e com transportes sintéticos, sem serviços externos, credenciais, migrations ou deploy. Ela mantém o CI completo intacto: serve para feedback visual enquanto outros gates rodam. Branch, runtime e imagem de navegador são fixados; o artefato é limitado a PNGs de exemplos, com três dias de retenção. A revisão acrescentou os hosts isolados de Metas, ausentes do painel demo, e persistência explícita dos screenshots antes enviados somente em memória. Revisão estática independente passou; o primeiro run ainda está pendente.

### Qualificação offline da Gallery

`scripts/landing/qualify-downloaded-gallery.mjs` recebe um lote já baixado e metadados que Root deve obter e revisar separadamente na API/log do GitHub. Confere Source pelos blobs Git, versão dos validadores, recibo ancorado no relatório independente do supervisor, os 17 membros exatos, hashes, EXIF, dimensões, schemas e janela temporal. O lote não pode se autorizar apenas recalculando seus próprios hashes. Não há rede, extração, captura, escrita ou execução de conteúdo do lote. A revisão independente identificou uma janela de troca do diretório pai no writer opcional; o writer e `--report` foram removidos integralmente, em vez de introduzir novo transporte de escrita. A CLI emite resumo sanitizado; a API retorna o relatório em memória.

Validação final local: 44 testes aprovados, três testes de links impedidos pelo sandbox do Windows e lint aprovado. A prova desses três casos permanece para o Linux. O primeiro TEMP não permitia criar o Git da fixture; outro sob o checkout excedeu o caminho aceito pelo Git para Windows. Um TEMP curto dentro do workspace permitido resolveu a infraestrutura, sem mudar ACLs ou configuração global. A ferramenta não autentica sozinha o JSON de metadados fornecido e declara `githubMetadataFetched:false` e `visualValidated:false`; a origem desse JSON é responsabilidade de Root. Nenhum lote real foi admitido nem incorporado nesta etapa. A conferência dos pixels e os aceites conectados continuam separados da qualificação mecânica.

### Roteiro das capturas desta candidata

O artefato `doc18-ui-images-<SHA>-<RUN>-<ATTEMPT>` contém somente PNGs de exemplos/superfícies isoladas. Comparar os nomes abaixo com as referências equivalentes do [doc17](../planejamento/17-evolucao-prototipo/capturas/README.md); sucesso do teste não aprova automaticamente os pixels.

| Superfície | Evidências a conferir | Limites |
|---|---|---|
| Financeiro | `financeiro-e6-*` em 320/390/768/1024/1440, período, lançamentos, cartões e planejamento | Metas reais não aparecem no painel demo; usar os hosts isolados abaixo. |
| Metas | `goals-*`, `goals-image-*`, `goals-no-new-image-retained-a-320-dark.png` | RAM/transporte sintético; não certifica banco, Storage ou Auth hospedados. Negativos finalize/prepare têm asserts de foco, sem PNG próprio. |
| Cartão | `financeiro-cartao-detalhe-sem-cor-{light,dark}-390.png` | Contraste medido pelo teste; inspeção humana ainda necessária. |
| Onboarding | `onboarding-weekdays-*`, `onboarding-weekly-target-*`, resumo existente | 320/390/1440 e dois temas; as demais etapas têm asserts, mas nem todas têm PNG dedicado. OAuth real não é simulado como aceite. |
| Moldura e jornada | `doc18-demo-*`, `home-spec08-*`, matriz de Configurações | Contexto demo/HTTP interceptado, sem prova de persistência real. |

Zoom de 200%, dispositivos físicos, estados de dados reais, aceite das nove telas conectadas e comparação final da landing permanecem gates próprios. A lane não inclui a landing nem transforma navegação smoke de Calendário/Hábitos em aceite integral dessas superfícies.

## Resultado remoto de 0e053eb e correções responsivas

Fonte `0e053eb8253287e4d0cf9746f0023f0a06d275ad`, árvore `2a53b34880f51a8dbe4d56c6f60714729e732949`:

- Ambos os runs de Admin passaram: [push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40271386990) e [PR](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40271391687). O inventário de 541 fontes foi exercitado pelo pipeline próprio, sem herdar o PASS local.
- O CI geral de [push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40271386956) passou Typecheck, lint e unitários; parou nos scripts com **2.368/2.371 aprovados**, zero skips. As três falhas estão na closure do harness legado Drive, que ainda esperava a UI alcançável pela rota anterior. Não houve falha do novo qualificador Gallery: seus 47 casos passaram no Linux, inclusive os três negativos de links indisponíveis no Windows. O pipeline inteiro permanece falho.
- O [diagnóstico de interface](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40271387480) terminou com **276 aprovados e 13 falhos**. Nove eram overflow de Financeiro, dois eram overflow de Tarefas e dois eram posicionamento do editor de Capturar. Não foram ampliados retries nem tolerâncias para obter aprovação.
- Root baixou o artefato `12628623116`, conferindo run/Source/branch/digest SHA-256 e os nomes/tipos/tamanhos do ZIP antes da extração para diretório novo. São 150 PNGs sintéticos, cerca de 15,2 MB; o resultado falho do run permanece explícito. Esse lote serve para diagnóstico e não é Gallery17 nem aceite hospedado.

### Causas e correções em revisão

**Tarefas e Financeiro:** o track implícito `auto` dos grids recebia a largura mínima das faixas de abas, expandindo a página antes de permitir a rolagem interna. A correção limita o track com `minmax(0, 1fr)` e remove o mínimo intrínseco da toolbar. Os controles e a rolagem localizada continuam disponíveis; não se oculta o overflow do `body`. Negativos adicionais exigem foco e alvos de 44 px em todas as abas, última aba visível e página contida em 320/390. A validação real da correção depende do próximo Source no runner.

**Capturar:** a topbar estática podia já estar acima do viewport. Seu `bottom` negativo era usado como limite de alinhamento e visibilidade, levando o editor além da tela. Produto e teste passam a usar somente a obstrução visível `max(0, bottom)`. A faixa de alinhamento de 24 px e as provas de rolagem, foco, histórico, filtro e rascunho são mantidas. Não se transforma o cabeçalho em sticky para contornar o teste.

O notebook apresentou aproximadamente 793 MB livres durante esta etapa; não foi iniciado build ou browser adicional. Reprodução integrada e comparação dos pixels corrigidos continuam no GitHub. A inspeção de Financeiro desktop, drawer escuro e cadência de 390 px foi cruzada com capturas do doc17; ela confirmou a nova composição e expôs o corte na barra mobile. Diferenças de dados demo, avisos financeiros e acesso real às Metas não são tratadas como aprovação geral de fidelidade.

O novo pin C de Tarefas foi conferido por Root contra o blob exato no index ([recibo do delta](doc18-convergencia-css-mobile-20261026.json)), com revisão independente: somente esse CSS foi substituído na allowlist; o hash anterior é recusado explicitamente. Os 34 contratos focados passaram. B/P, tokens e tolerâncias permanecem iguais. Os PNGs adicionais de Capturar, Conhecimento e Tarefas são apenas estados já exercitados, sem alteração de fixtures ou asserts.

Uma tentativa de Typecheck agregado local com heap limitado a 512 MB terminou por falta de heap, sem resultado de tipos. Não foi repetida com limite maior no notebook; a prova do novo Source deve vir do runner. O Typecheck aprovado de 0e053eb não é reaproveitado como aceite dessas novas alterações. Lint dos deltas passou; build/browser continuam pendentes.

A entrada rápida financeira usa rótulos visíveis curtos (Descrição/Valor/Conta/Revisar) com os nomes acessíveis anteriores e moeda explícita. Revisão, validação, dados e confirmação permanecem intactos; labels e aviso não foram escondidos para imitar os 60 px do mock. A comparação identificou cerca de 164 px no estado anterior; a altura corrigida ainda precisa ser medida no novo screenshot. Essa diferença funcional deve ser declarada, sem prometer igualdade de pixels.

### Harness histórico do Drive

A investigação das três falhas restantes confirmou a retirada de 15 paths da closure do harness manual, sem exclusão dos arquivos nem perda de APIs/Storage. O [registro específico](drive-harness-retirado-doc18-20261026.md) fixa a derivação Git/AST de 306 para 291 fontes e mantém 50 dependências. A declaração TypeScript acompanha o literal novo. CLI e entrada direta agora recusam a jornada retirada antes de infraestrutura, sem novo bypass; o corpo histórico e todos os controles de Storage/Files permanecem para rastreabilidade. Nenhum workflow foi eliminado ou passou por skip.

Seis contratos focados e lint passaram localmente; a suíte integral não foi aprovada nesse ambiente porque os controles existentes recusam a junction externa de `node_modules`. Eles não foram relaxados. A instalação exata no runner deverá comprovar o coletor completo, binário e SDK. A revisão independente não encontrou bloqueador no delta; merge/produção seguem bloqueados até o CI e os aceites do Source novo.

## Rodada ampla de 02310cb

Fonte `02310cb67b1f9fe801e9b41a871cb47b63aa48a6`, árvore `d936328a9dc5d3a4590ba3b63d401196688ee22e`. Typecheck, lint, unitários, scripts completos, camadas, DS, build e os dois runs de Admin passaram. O [diagnóstico](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40273560524) teve **290 aprovados e quatro falhos**; os 13 problemas anteriores foram superados, mas os negativos mais fortes detectaram abas focadas parcialmente recortadas. A [suíte ampla](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40273560457) chegou ao E2E e registrou **556 aprovados e 22 falhos**, além da corrida de URL observada no cenário de conversão de Capturar. Resultado geral falho, sem Gallery17 qualificada.

Os 22 casos se dividem em quatro falhas de foco, duas de geometria durante autosave e 16 expectativas/fixtures que ainda representavam o fluxo anterior: vazio de Capturar, seleção no portão histórico, três recortes Home/Settings, quatro percursos de Projeto, dois de Busca, um demo de Projeto e quatro de planejamento financeiro. As correções não removem cenários nem relaxam os limites:

- **Foco:** handlers reais movem somente a faixa horizontal, com arredondamento para fora; anel de 2 px fica dentro do alvo. Financeiro tem 1 px de respiro nas extremidades para acomodar `scrollWidth` inteiro com caixas fracionárias da Geist. A reprodução estática passou nos 80 casos financeiros e nos seis alvos de Tarefas em 320/390, dois temas, preservando scroll global. Não é aceite React/Next ou hospedado. RTL foi exploratório e não é uma capacidade aprovada do produto atual.
- **Autosave:** o feedback curto e o longo alternavam a linha flex em 390 px e deslocavam a ação 18 px entre pointerdown e pointerup. A linha própria até 600 px mantém o alvo estável. Root reproduziu o deslocamento com CSS/Geist reais e conferiu estabilidade nos dez casos posteriores (cinco larguras/dois temas). O E2E conserva igualdade exata dos retângulos e os dois vínculos/IDs no SQL.
- **Identidade e seleção:** Capturar espera UUID persistido antes de registrar a URL; `capture=new` já não passa no wait. O portão histórico seleciona explicitamente em C antes de exigir `aria-current`, sem alterar o percurso B/P. O vazio exige a mensagem atual de Entrada e zero notas; os ledgers permanecem.
- **Fixtures:** módulos fora dos recortes Home ficam explicitamente ocultos, com zero requests e recusa de qualquer leitura indevida; Settings admite somente o hash novo. A distribuição mensal usa seu contêiner atual, com orçamento conhecido obrigatório antes da comparação integral. Conhecimento isolado carrega aliases reais após os tokens, como o aplicativo; PNGs anteriores sem esses aliases não qualificam sua tipografia/componentes.
- **Drive legado:** Busca mantém os sete tipos no oracle/SDK/SQL e exibe seis na paleta, cinco sob veto de Conhecimento, com ausência explícita de links Drive. Projeto mantém nove operações (seis pela UI e três pelo Core), recibos, eventos, before/after e negativas de dono; Store/DTO e SQL continuam conferindo pastas/arquivos após delete/restore, sem ofertar a UI retirada. Caderno seleciona o UUID real e entra em edição somente por ação explícita.

Os pins de Capturar/Tarefas em C foram reconferidos no index e possuem [recibo próprio](doc18-convergencia-css-foco-20261026.json); versões anteriores são recusadas nos negativos. Revisões cruzadas não encontraram bloqueador nos deltas. Lint/diff e contratos focados passaram; a nova candidata ainda exige execução integrada no GitHub. A lane rápida inclui três specs adicionais sem banco externo (preferências Home, Projeto/Hábitos e plano mensal), totalizando 19, mantendo o CI amplo intacto.

## Meta de execução atual

### Landing V2 incorporada à candidata — 26/10, 07h de Fortaleza

`c028190a2dbd1c2e215db080156aeb11dd593446` concluiu os 23 runs com aprovação, incluindo CI amplo, Admin e diagnóstico. O artefato Gallery `12633758276` agora contém **17 membros planos**, 911.520 bytes expandidos. Root conferiu API/run/tentativa/Source/árvore e digest do ZIP. A CLI retornou `UNKNOWN STEP`; o relatório independente foi recuperado do arquivo oficial do único job da tentativa 1, vinculado pela API à janela do step, ao grupo Run, aos comandos de contrato/captura real e ao evento de upload seguinte. O recibo `e37edb567a00bb9a7c2d28cdb2684b371b685bf44b1cdf3847fa976603c6e437` foi conferido pelo qualificador, com todos os hashes/EXIF/geometrias e Source. Nenhum dado veio do lote 9cf incompleto.

Root inspecionou os oito WebPs originais nos dois temas e formatos e incorporou os 17 membros sem editar os pixels. O [registro de qualificação](evidence/doc18-landing-gallery-qualification-20261026.json) distingue admissão dos assets de aceite final da composição/hospedagem. A UI V2 congelada foi aplicada uma única vez, sem o delta V1→V2; DESIGN recebeu reconciliação manual preservando D-080/D-084 e piso de 600px. Três capítulos e tabs Projetos/Kanban mantêm escopo fechado e legibilidade sem JavaScript. O complemento revisado acrescenta dois casos e 12 PNGs nos percursos existentes, incluindo Kanban 1024×600 e Projetos sem JS. A lane rápida inclui Landing, totalizando 21 specs. Tarefas 390px ganha somente dois PNGs nos casos de teclado já existentes.

Lint e diff passaram; revisões independentes conferiram a integração e o novo pin C de DESIGN. A proveniência está em [recibo específico](doc18-convergencia-landing-20261026.json), com rejeição explícita do pin anterior; B/P, tokens e tolerâncias permanecem. O novo Source da composição precisa dos seus próprios CI, PNGs e revisão renderizada. A meta das 08h não antecipa esse aceite. Nenhuma migration, integração externa, merge ou deploy foi executado nesta rodada.

### CI verde de 9cf1324; artefato Gallery recusado

Às 06h55 UTC os **23 runs de 9cf1324 terminaram aprovados**, incluindo os dois CI amplos e Admin. Isso qualifica os testes dessa fonte, mas não a entrega do artefato: o ZIP Gallery `12632722187`, digest `c4aa2f873f2e9208b82373a5988504cfd799a996048b1c9ffb47bdc3af373ba3`, contém apenas `__w/_temp/landing-gallery-9cf13246432818b4331b609cd238e7802f204937-126881a6c452ddbc13ecec5680750c51c88c1d88/calendario-lista.webp`. Root recusou a extração/incorporação, preservando a exigência de 17 membros planos. O relatório final do capturador, obtido somente do job/step Gallery da tentativa 1, declara 17 saídas e recibo `4af8852efddde994237c0e586a627779440a195dc621d593bd89b502d50020b1`; isso não substitui os arquivos ausentes no ZIP.

O log do upload confirma “1 file uploaded” e ancestral comum `/`. A lista multiline de 17 paths absolutos usa `runner.temp` do host num job container; o primeiro arquivo aparece sob `__w/_temp`, enquanto as demais entradas do input usam o prefixo do host. A correção usa **um único path do diretório Source-derived**, já fechado pelo supervisor aos 17 arquivos regulares, hashes e Source. Não amplia a pasta para temp/workspace inteiro, não altera o capturador e não relaxa a qualificação posterior. O contrato impede voltar ao input multiline e exige o inventário fechado do supervisor. Seus 17 testes puros passaram localmente; só o próximo upload remoto poderá comprovar o ZIP completo. Landing permanece pendente, mesmo com o CI anterior verde.

A revisão independente confirmou a tradução única do valor inteiro de INPUT_PATH no código oficial do [StepHost](https://github.com/actions/runner/blob/main/src/Runner.Worker/Handlers/StepHost.cs) e de [ContainerInfo](https://github.com/actions/runner/blob/main/src/Runner.Worker/Container/ContainerInfo.cs), além do cálculo do ancestral comum no [uploader v7](https://github.com/actions/upload-artifact/blob/v7/src/shared/search.ts). Essas fontes explicam a divergência observada; o próximo ZIP continua sendo a prova operacional exigida.

### Segunda comparação visual e ajustes de acabamento

A [lane de interface de 9cf1324](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40280117117) terminou aprovada. Root conferiu Source/run/branch/digest e extraiu 249 PNGs de exemplos para diretório novo. Foram comparadas as 36 cenas de onboarding com doc17, além de Financeiro, Tarefas, Capturar, Início e Configurações; isso não é aceite hospedado. Os dois CI amplos ainda estavam em execução no momento desse diagnóstico.

- **Tarefas:** o primeiro cartão em 320 px estava aproximadamente em 734 px, contra 491 px na captura de referência. A compactação mantém busca, projeto, direção, filtros adicionais, contagens e informação da sessão; ações ficam na mesma linha, e direção acompanha a ordenação. O trilho volta a ser segmentado. **Adaptação de acessibilidade:** o protótipo troca a ordem dos grupos entre desktop e mobile; produto conserva abas→ações no DOM e visual nas duas larguras, evitando ordem de teclado inversa sem duplicar controles ou introduzir JS de viewport. Não há meta de igualar alturas removendo informação real. Os E2Es conservam foco integral/scroll local e acrescentam geometria/44 px/acionamento da direção.
- **Capturar:** tipo/data vêm visualmente acima do título; estado e conexões continuam abaixo. O título permanece primeiro no nome acessível. Seleção, rascunho, origem e transporte não mudam.
- **Configurações:** “Escolher foto” usa botão do DS e o mesmo picker nativo PNG/JPEG. Nome selecionado, limite de 8 MB e erro permanecem legíveis; filename fica somente em RAM no componente, desmontado por troca de usuário/logout. Remover foto só apaga a seleção depois do comando confirmado. O negativo de teclado/arquivo vazio exige zero upload e conserva os controles de sessão.
- **Financeiro:** tabs do detalhe do cartão passam ao sublinhado do protótipo, com 44 px e foco interno. O painel compacto aprovado no diagnóstico conserva limite não definido sem barra fictícia. Os três saldos têm semântica econômica própria; explicações, confirmação e funções reais não são removidas para reproduzir dados do mock.
- **Onboarding:** a nova comparação confirmou o alinhamento de Adicionar nas três coleções, mas revelou “Continuar” quebrado em 320 px por seletores antigos que não atingiam os botões do DS. Paddings passam às classes reais, com assert de uma linha sem tolerância; a cadência recebe os 24 px de separação da referência. Validade fica em disclosure nativo, com cópia factual integral. Live status, falhas, pendências e aviso OAuth continuam visíveis; abrir/fechar detalhes não altera dados/comandos.

As revisões cruzadas não encontraram bloqueadores nos deltas. Root reconferiu os dois blobs CSS no index e fixou [proveniência C da composição](doc18-convergencia-composicao-20261026.json); negativos recusam os dois hashes anteriores. B/P, tokens, goldens e tolerâncias continuam intactos. Lint/diff e análise estática passaram; os novos asserts e PNGs ainda exigem CI no próximo Source. Landing V2 permanece aguardando a Gallery17 do run amplo aprovado, sem import ausente ou imagem substituída.

### Conferência de d9e57fa e próximo lote

Em `d9e57fa08b8312749ecef64c48d7a6317c009259` (árvore `ec235dd4838270bb757b892d6c055c2c7d2e4338`), os 23 runs terminaram: 20 aprovados e três falhos. Ambos os Admin passaram. O [CI amplo de push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40277185825) aprovou Typecheck e os gates anteriores ao E2E; este terminou com **578 aprovados e uma falha**, sem Gallery17. O [diagnóstico](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40277185818) registrou **307 aprovados e a mesma falha**. O único cenário falho esperava que uma recarga preservasse entidades do provider demo em RAM. A correção verifica navegação e volta na mesma sessão, depois aguarda explicitamente o estado “Projeto não encontrado” após recarga. A prova de persistência conectada permanece na jornada SQL da #30; não se introduz armazenamento demo para satisfazer uma expectativa incorreta.

O lote seguinte também compacta a apresentação de “Plano do mês”, preservando valores, máscara, região acessível, distribuição e comandos. O caso sem limite não inventa progresso. Acrescenta sete cenários positivos/negativos do Início com leitor e cliente reais sob HTTP sintético fechado, inclusive isolamento, preferências, datas de São Paulo, vazio, erro e retry. Não constitui aceite hospedado ou de RLS. As nove etapas existentes do onboarding passam a salvar 36 capturas comparáveis (320/390, claro/escuro, altura 844), sem alterar sua lógica. A lane rápida inclui esse spec, totalizando 20. Revisões cruzadas não encontraram bloqueador; execução e inspeção dos novos pixels permanecem pendentes no Source seguinte.

A comparação de onboarding encontrou o botão de adicionar 20 px abaixo do campo no mobile: a regra genérica de margem tinha especificidade maior que a regra da linha. O seletor foi restrito ao campo filho da linha e tornou a margem zero efetiva, sem alterar alvos, avisos ou fluxo. O E2E passa a exigir igualdade exata entre as bases dos controles, incluindo as três coleções e seis variantes de frequência. Lint e revisão do delta passaram; o alinhamento renderizado deve ser comprovado pelo próximo run.

Em 26/10 o mantenedor priorizou terminar os ajustes visuais até **08h00 de Fortaleza (11h00 UTC)** e autorizou enviar testes pequenos e pesados ao GitHub. É uma meta de execução, não um aceite antecipado. Mantêm-se quatro frentes simultâneas e um único browser leve local quando necessário; build, SQL e suites completas ficam no runner. Ordem: fechar regressões amplas → qualificar Gallery e landing V2 → comparar superfícies com doc17 e registrar saldo dos aceites. Merge e deploy continuam bloqueados; restauração e checkout não foram reincorporados ao recorte.
