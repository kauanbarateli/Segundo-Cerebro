# Retomada do doc18 — 26/10/2026

Base conferida localmente e no GitHub: `6cd4442de901ae66e525715c4a90b32fea5f0de1`, PR #120 em rascunho, branch `codex/mvp-goals-terminal-20261023`. D-084 autoriza implementação e validação; merge e deploy continuam bloqueados. O [doc18](../planejamento/18-convergencia-prototipo-20261025/README.md) e o protótipo do doc17 orientam o resultado. Os pacotes congelados da pausa são preservados.

## Frentes e propriedade de arquivos

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
