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

Os sete dias usam chips com nomes curtos visíveis, nomes completos acessíveis e sinal adicional ao uso de cor. Desktop apresenta sete colunas; até 600 px, quatro colunas, com alvos mínimos de 44 px. JSON v2, legado, normalização, resumo e foco permanecem no contrato existente. Lint, diff e detector passaram; o E2E ampliado cobre geometria e cadências, mas ainda aguarda execução no runner. A landing depende dos 17 membros Gallery do novo Source qualificado e não foi aplicada com imports ausentes.
