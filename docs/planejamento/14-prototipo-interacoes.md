# N — Protótipo: escrita, conexões e busca

**Especificação vigente em 29/09/2026 — D-030.** Fonte de verdade desta revisão: [protótipo HTML](../../prototipo/prototipo-segundo-cerebro.html). Esta especificação registra o comportamento demonstrado, incluindo seus limites. Complementa os docs 04–08 e os tickets do doc 13. As medidas abaixo são **OBSERVADAS no CSS**, não resultados de testes de tela. Evidências de execução estão registradas no §11.

## 1. Escopo e continuidade

O protótipo permanece um HTML independente, com CSS, ícones SVG e JavaScript embutidos. Capturar passa a combinar entrada rápida e escrita de notas conectadas. O cabeçalho oferece busca compacta e foto de perfil ilustrativa. O Início conserva seus módulos e hierarquia de tarefas, agenda, hábitos e financeiro; os dados de organização de notas passam a vir da mesma coleção de Capturar.

Não há backend, autenticação real, upload, sincronização entre aparelhos, integração externa ou edição TipTap nesta entrega. A rede só é usada pela folha de fontes do Google Fonts já existente; a foto está embutida no HTML. A formatação em blocos de Conhecimento permanece referência visual; seu texto, título e backlinks são sincronizados com a nota de arquitetura salva. A seção **Notas conectadas** de Conhecimento abre a mesma nota no editor de Capturar, sem cópia.

A demonstração visual antecipa a experiência de grafo. **D-027 continua valendo para produção:** wiki-links/backlinks/Relacionado no MVP, grafo de vizinhança na fase 2 e grafo global na fase 3. O checkbox “Todas as notas” representa apenas a coleção local de exemplo, não a solução futura de escala, filtros e consulta global.

## 2. Direção visual e anatomia

Preservar Geist, marca “2”, neutros quentes, preto como acento, temas Sistema/Claro/Escuro e navegação lateral/inferior. O modo desta superfície é **Operate**: escrever, conectar, organizar e reencontrar. Referências e escolhas estão em [referencias-visuais.md](referencias/referencias-visuais.md).

### 2.1 Medidas observadas

| Elemento | Desktop / regra base | Adaptação |
|---|---|---|
| Conteúdo principal | `max-width:1512px`; padding `24px 40px 72px`; margem esquerda herdada `268px` | 768–1119: margem `106px`, padding `20px 24px 72px`; até 767: margem zero, padding `12px 16px 132px` |
| Trilho | fixo, `228px`, a `18px` das bordas; raio `28px` | até 1119: `74px`, ícones com nome acessível; até 767: oculto e substituído pela barra inferior |
| Cabeçalho | altura `60px`; raio `20px`; padding `8px 12px`; gap `12px`; margem inferior `24px`; sticky com safe-area | até 767: padding `8px`, gap `8px`, fundo sólido e sem blur |
| Busca no cabeçalho | base flex `300px`, pode encolher; altura `44px`; padding horizontal `16px`; fundo `surface-2`, hover `surface-3` | até 767: botão compacto, mínimo `44px`, texto oculto; até 380: marca textual some e rótulo da busca volta, sem `kbd` |
| Perfil | botão `44px`; foto `36px`, circular, grayscale e `object-fit:cover` | mantém posição superior direita; popover `264px`, máximo viewport menos `32px` |
| Título de página | `28px/1.2`, peso 600, tracking `-.025em`; subtítulo `14px` | até 767: título `24px`, subtítulo `13px` |
| Alternância Escrever/Grafo | botões com altura mínima `48px`, gap `4px`, borda inferior de seleção `2px`; margem inferior `24px` | até 767: margem `20px`; indicação de demonstração desta linha fica oculta |
| Editor + biblioteca | `minmax(0,1fr) 280px`, gap `24px` | 1001–1119: sidebar `240px`, gap `20px`; até 1000: coluna única, editor primeiro |
| Superfície de escrita | raio `24px`; padding `28px 32px`; borda `line`; sem sombra | 768–1119: padding `24px`; até 767: raio/padding `20px`; até 380: padding `16px` |
| Título da nota | `24px/1.4`, peso 500; sem caixa de formulário, padding vertical `8px` | até 767: `22px`; até 380: `20px` |
| Corpo da nota | mínimo `340px`; fonte `16px`, entrelinha `1.8`; padding vertical `8px`; resize vertical | até 767: mínimo `300px` |
| Rodapé Salvar | sticky a `16px` da base; padding vertical `12px`, fundo `surface`, borda superior, `z-index:2` | até 767: base `96px` para respeitar a navegação inferior |
| Chips de vínculo/anexo | altura mínima `44px`, raio `12px`, padding `6px 12px`; título clicável ocupa o espaço livre | botão Remover `44×44px`; título longo pode quebrar |
| Biblioteca | linhas mínimas `76px`, padding `14px 12px`, raio `12px`; título `14px`, metadado `12px`; lista com máximo `520px` e rolagem interna | até 1000: duas colunas e máximo `340px`; até 767: uma coluna |
| Grafo + detalhe | mesma grade do editor; SVG `viewBox="0 0 760 480"`, altura `480px`; superfície com raio `24px` | até 1000: detalhe abaixo; até 767: inicia em lista, SVG alternativo `360px` com `viewBox="190 60 380 360"`, vizinhos em uma coluna |
| Diálogos de busca/vínculo | largura `min(600px,100vw - 32px)`; máximo `100dvh - 64px`; raio `24px`; resultados com máximo `440px` e rolagem | até 767: raio `20px`, máximo `100dvh - 32px` |
| Resultado de busca/vínculo | mínimo `64px`; padding/gap/raio `12px`; título `14px`, contexto `12px` | texto longo quebra; ícones não encolhem |
| Toast | posição fixa, base `24px`, raio `14px`, padding `12px 16px`, máximo viewport menos `32px` | até 767: base `108px`, acima da navegação |

Tokens adicionais: `--fs-editor:16px`, `--fs-title:28px`, `--space-section:24px`, `--space-group:12px`, `--target:44px`. O token `--subtle` passa a `#62615b` no claro e `#a09e94` no escuro para reforçar legibilidade; os demais tokens de cor, tipografia de dados, raios, sombras e tempos permanecem. Botões principais, chips e navegação têm mínimo de 44px. A animação de entrada de `.screen` foi removida; os estados de hover/foco conservam as transições e o suporte herdado a movimento reduzido. O hover do botão fantasma no cartão inverso conserva fundo/texto da dupla inversa. O popover de perfil usa sombra sem borda.

### 2.2 Ordem das áreas

Capturar apresenta: título/“Nova nota” → alternância Escrever/Grafo → editor → biblioteca. No editor: localização/estado → título → Vincular nota/Anexar exemplo/contagem → corpo → ajuda curta e sugestões → vínculos/anexo → detalhes recolhidos de organização → salvar → backlinks → ações do item salvo. A organização não interrompe o espaço de escrita; as ações de conexão aparecem antes do corpo para serem descobertas sem rolagem.

No cabeçalho desktop, o contexto da seção ocupa o espaço livre à esquerda; busca, tema e foto ficam alinhados à direita. No mobile o contexto dá lugar à marca compacta. Rótulos de seção deixam de usar caixa alta e tracking amplo. Na Home, títulos de linhas podem ocupar duas linhas; badges podem quebrar, reduzindo truncamento precoce.

## 3. Dados de exemplo e estado inicial

Na primeira abertura sem armazenamento anterior, há sete notas salvas e um editor de nova nota vazio. Os quatro tipos continuam disponíveis; o novo editor começa em **Nota / Pessoal / Nenhum / Caixa de entrada**.

| ID estável | Título | Tipo / categoria / projeto | Destino inicial | Wiki-links de saída |
|---|---|---|---|---|
| `architecture` | Decisões de arquitetura | Nota / Trabalho / Segundo Cérebro V2 | Conhecimento | Visão do produto; Financeiro fundido |
| `vision` | Visão do produto | Nota / Trabalho / Segundo Cérebro V2 | Conhecimento | Decisões de arquitetura; Atalho de captura pelo relógio? |
| `journal` | Diário de bordo | Nota / Trabalho / Segundo Cérebro V2 | Conhecimento | Decisões de arquitetura |
| `finance` | Financeiro fundido | Nota / Pessoal / Segundo Cérebro V2 | Conhecimento | Decisões de arquitetura |
| `watch` | Atalho de captura pelo relógio? | Ideia / Pessoal / Nenhum | Caixa de entrada | Visão do produto |
| `accountant` | Ligar pro contador até sexta | Tarefa / Pessoal / Nenhum | Caixa de entrada | nenhum |
| `book` | Livro: A Philosophy of Software Design | Nota / Estudos / Nenhum | Caixa de entrada | Decisões de arquitetura |

A nota `book` inclui o anexo nominal de exemplo. A nota `accountant` começa sem conexões e permite explorar o estado vazio do grafo. “Tipo Tarefa” não significa tarefa já convertida: só a ação **Virar tarefa** cria essa representação na seção de Tarefas.

Dados de tarefas, projetos, agenda, hábitos e financeiro que já pertenciam ao protótipo continuam fixtures, com a conclusão da tarefa em foco e o total de tarefas abertas ligados ao estado local (§9). O dia exibido na Home é **Quarta-feira, 23 de setembro · dia de exemplo**, não o relógio atual. Os demais números são exemplos, sem consulta ao relógio ou a um sistema real.

### 3.1 Corpos iniciais exatos

Preservar as quebras de linha abaixo. Todos os registros começam com `links:[]`; as ligações iniciais vêm do corpo. `archived`, `task` e `updated` não estão definidos no seed; apenas `book` começa com `attachment:true`.

**Decisões de arquitetura** (`architecture`)

```text
O Núcleo concentra as regras; as telas cuidam da experiência. A direção está em [[Visão do produto]].

Três decisões para levar adiante:
• Dinheiro em centavos inteiros.
• Fatura derivada na leitura.
• Toda escrita registra sua origem.

O modelo de valores está em [[Financeiro fundido]].
```

**Visão do produto** (`vision`)

```text
Um sistema integrado de informações pessoais. Capturar, conectar e reencontrar o que importa.

As regras estão em [[Decisões de arquitetura]]. Uma ideia pequena pode começar no [[Atalho de captura pelo relógio?]].
```

**Diário de bordo** (`journal`)

```text
Hoje fechei as [[Decisões de arquitetura]] e revisei as etapas do projeto.

Próximo passo: experimentar a captura no celular com o mínimo de interrupções.
```

**Financeiro fundido** (`finance`)

```text
Unir plano do mês, pagamentos parciais e visão de dívida. A fatura continua derivada.

Contexto: [[Decisões de arquitetura]].
```

**Atalho de captura pelo relógio?** (`watch`)

```text
Registrar uma ideia sem tirar o celular do bolso. Começar pelo fluxo de captura rápida da [[Visão do produto]].
```

**Ligar pro contador até sexta** (`accountant`)

```text
Confirmar documentos e alinhar a próxima entrega.
```

**Livro: A Philosophy of Software Design** (`book`)

```text
Boas interfaces escondem complexidade e tornam a intenção clara.

Aplicar essa ideia às [[Decisões de arquitetura]] do Segundo Cérebro.
```

## 4. Criar, revisar e organizar

1. **Nova nota** abre o editor, mantém eventual rascunho novo anterior e foca o título. Abrir uma linha da biblioteca, uma nota na Home, um backlink ou um resultado da busca usa o mesmo editor e recupera o rascunho daquele ID.
2. Título: máximo HTML de **120 caracteres**, obrigatório ao salvar. Corpo: máximo HTML de **30.000 caracteres**, opcional. A contagem de palavras usa termos separados por espaço em branco no corpo.
3. **Salvar nota / Salvar alterações** e `Ctrl/Cmd+Enter` validam, persistem e atualizam biblioteca, Home, Conhecimento e tarefas derivadas. O atalho só atua em Capturar/Escrever e sem diálogo aberto. Uma nota nova recebe ID `note-` + timestamp em base 36 e entra no começo da coleção.
4. Título vazio ou igual ao de outra nota, após remover acentos, diferenças de caixa e espaços das extremidades, impede salvar. Títulos de notas arquivadas também participam da verificação de duplicidade. O erro aparece junto ao campo, com `role="alert"`, `aria-invalid` e foco no título; volta a ser ocultado ao editar qualquer campo do formulário, e a próxima tentativa de salvar revalida.
5. **Organizar e definir tipo** é um `<details>` inicialmente fechado. Oferece Nota/Ideia/Tarefa/Lembrete; Pessoal/Trabalho/Estudos; Nenhum/Segundo Cérebro V2/Central VOE. Lembrete é classificação demonstrativa: não agenda aviso ou data.
6. **Anexar exemplo** liga um marcador único `referencia-de-leitura.jpg · exemplo`. A ação pode ser repetida sem duplicar o marcador; “Remover anexo de exemplo” o desliga. Não abre seletor, lê bytes, cria imagem ou envia arquivo.
7. A biblioteca busca por **título, corpo ou tipo**, sem acento/caixa. Filtros: Todas = não arquivadas; Caixa de entrada = não arquivadas com `inbox`; Arquivo = arquivadas. A contagem do cabeçalho informa todas as não arquivadas, não apenas o recorte filtrado. Cada linha mostra conexões de saída e marcador de rascunho quando presente.
8. Em nota salva na entrada: **Guardar em Conhecimento** muda `inbox` para falso, mantendo ID, corpo e vínculos. **Virar tarefa** também sai da entrada e marca `task:true`, idempotente por nota na simulação. A seção “Criadas a partir de capturas” de Tarefas exibe o título e **Abrir origem**.
9. **Arquivar** preserva a nota e suas referências, retira a nota de listas ativas, busca global e grafo. O filtro Arquivo permite abri-la e **Restaurar nota**. Não há exclusão definitiva.
10. Guardar/converter/arquivar/restaurar salvam primeiro o editor e podem ser revertidos por **Desfazer** no toast. O toast permanece até fechar, desfazer ou ser substituído por outro; não existe temporizador. O desfazer corresponde à última ação de ciclo de vida mostrada.

## 5. Rascunho e persistência simulada

`localStorage["sb-proto-connected-v1"]` contém `{notes,drafts,active,homeDone}`. `drafts` é um mapa por ID, inclusive `new`; `homeDone` registra a conclusão da tarefa em foco na Home. Após input, o estado indica “Salvando rascunho…”; o rascunho é gravado após **350ms**. Trocar de nota, criar outra, abrir o grafo, esconder a página ou sair da página também guarda o rascunho. Reabrir uma nota recupera seu rascunho; salvar remove a entrada de rascunho daquele ID.

**Rascunho não é nota salva.** Contagem e vínculos na área de escrita refletem o texto em edição; grafo, pesquisa global e backlinks de outras notas usam a coleção salva. É preciso salvar para publicar a alteração nessa coleção local. Ao guardar snapshot idêntico ao registro salvo, o protótipo remove o rascunho em vez de criar um marcador sem mudanças. Um editor novo sem título, corpo, links ou anexo não gera rascunho apenas pela navegação.

Se o navegador recusar armazenamento, as operações continuam na memória da sessão e a interface informa “Sem armazenamento · sessão atual”. Não há IndexedDB/outbox, serviço de sincronização ou isolamento por usuário autenticado. Dados são locais à origem/navegador, inclusive sob variações do tratamento de `file:`. A tela Login/Sair é demonstrativa; não equivale a encerramento seguro de conta. O requisito de limpar rascunhos por usuário no logout real permanece em T-009, não é comprovado por este HTML.

O tema usa separadamente a chave herdada `sb-proto-theme`. Nenhum rascunho ou termo de busca é enviado a backend.

## 6. Regras das conexões

### 6.1 Duas formas de vincular

- **Vincular nota:** abre diálogo com busca por título, sem acento/caixa. Lista notas existentes, não arquivadas, diferentes da atual. Notas já ligadas ficam desabilitadas. Selecionar adiciona ID em `links`, fecha o diálogo e informa que o grafo mudará ao salvar. Não insere texto no corpo.
- **Wiki-link:** digitar `[[` seguido de trecho do título mostra até **quatro sugestões** logo abaixo da ajuda. Selecionar uma insere `[[Título completo]]` na posição do cursor e devolve foco ao corpo. Não há autocomplete com setas: sugestões são botões navegáveis por Tab.

A resolução de `[[Título]]` normaliza acentos/caixa e espaços das extremidades. Não interpreta aliases `[[título|apelido]]`, Markdown avançado, embeds ou links para módulos distintos. Se a nota não existe, preserva o texto e apresenta aviso; a ligação passa a existir quando uma nota salva com esse título for criada. **Não cria destino ao clicar/confirmar** nesta simulação — essa evolução segue no ticket T-021 de produção.

### 6.2 Integridade e leitura

Conexões de saída = união, sem duplicatas, de IDs explícitos e wiki-links resolvidos. Autorreferência não cria conexão. Remover um chip apaga o ID explícito e converte as ocorrências wiki desse destino em texto comum, preservando as palavras no corpo. Salvar confirma a remoção.

Renomear nota preserva seu ID e reescreve wiki-links que citam o título anterior em notas salvas e rascunhos, segundo a mesma normalização. Não há alias persistente separado. **Quem menciona esta nota** lista notas salvas com ligação de entrada; inclui arquivadas com sufixo “arquivada”. Chips de saída também identificam destinos arquivados. Arquivar não destrói arestas.

Nos chips da área de escrita, clicar no título abre o destino e o botão × remove o vínculo; abrir destinos também é possível pela biblioteca, backlinks, busca e detalhe do grafo. A lista da biblioteca conta **saídas**; o grafo e seu detalhe contam **vizinhos nos dois sentidos**. Esses números podem diferir legitimamente.

## 7. Grafo interativo

**Entradas:** aba Grafo de notas, ação Ver conexões da nota salva ou Explorar grafo em Conhecimento. A seleção inicial é `architecture`; Ver conexões escolhe a nota de origem. Abrir a aba Grafo seleciona a nota atual se já salva; se for uma nova nota, conserva a seleção anterior. Ao carregar a página em largura até 767px, o modo inicial do grafo é **lista**; em desktop, SVG. A escolha posterior é mantida na sessão, não automaticamente alternada ao redimensionar a janela.

| Controle/estado | Comportamento |
|---|---|
| Padrão | nó selecionado + vizinhos diretos de entrada/saída, apenas notas não arquivadas |
| Todas as notas | alterna toda a coleção local não arquivada; inclui notas isoladas |
| Nó / item da lista / vizinho | seleciona e atualiza detalhe/vizinhança; pan volta a zero, zoom é mantido |
| Abrir nota | sai do grafo para o editor de Capturar daquela nota |
| − / + | zoom de **0,6 a 1,8**, passos **0,2**; botão no limite desabilitado |
| Percentual / Centralizar grafo | zoom volta a **1**, pan a zero |
| Arrastar fundo | pan com pointer events e escala calculada pelo viewBox e dimensões do SVG; não arrasta nós individualmente |
| Ver lista / Ver grafo | alterna SVG e lista HTML com os mesmos nós do recorte; detalhe permanece; lista é a apresentação inicial no mobile |
| Teclado SVG | Tab foca nós; Enter/Espaço selecionam; foco é recuperado no nó após reconstrução |
| Estado sem conexões | nó isolado + orientação para abrir a nota e Vincular nota |
| Sem notas ativas | mensagem para criar a primeira nota; não há objeto real a consultar |

As arestas visuais são **não direcionadas**, deduplicadas por par de IDs. Referências nos dois sentidos resultam em uma linha. O detalhe verbaliza “Esta nota aponta para ela” ou “Menciona esta nota”; a vizinhança é bidirecional na leitura. O resumo informa quantidade de nós e arestas do recorte atual, sem incluir rascunhos ou arquivados.

Posicionamento determinístico, sem simulação física: nó selecionado em `(380,235)`; demais numa elipse de raios `250×166`; transformações de zoom/pan centradas em `(380,240)`. Raio do nó selecionado `26`, demais `22`, com área transparente de interação `64×84` unidades SVG. Texto dos nós: `15px` desktop/`18px` mobile. Rótulos acima de 27 caracteres são abreviados para 25 + reticências no SVG, mantendo nome integral no `<title>`, nome acessível, lista e detalhe. Corpo do detalhe exibe os primeiros 190 caracteres sem os delimitadores wiki. No SVG mobile, o enquadramento aproxima o centro; arrastar permite alcançar vizinhos fora da área visível, e a lista mantém todos acessíveis sem gesto.

Não há pinch-to-zoom, zoom por roda, drag de nó, seleção múltipla, força física, profundidade configurável ou filtros por projeto. A lista fornece a alternativa para operação sem gestos. Essas limitações não substituem os requisitos futuros do doc 06/08.

## 8. Busca e perfil

**Buscar** no cabeçalho e `Ctrl/Cmd+K` abrem um `<dialog>` modal e focam o campo. A busca não abre na tela Login. Se o diálogo de vínculos estiver aberto, o atalho o fecha antes de abrir a busca.

- Campo vazio: quatro primeiras notas ativas em “Para retomar” e três primeiros atalhos (Início, Capturar, Tarefas).
- Consulta não vazia: correspondência por inclusão em título + descrição + corpo, normalizada sem acento/caixa. Ordem estável da coleção, sem ranking de relevância ou debounce de rede.
- Grupos implementados: **Notas**, **Tarefas**, **Projetos**, **Atalhos**. Notas incluem corpo salvo; tarefas incluem três fixtures nomeadas e notas convertidas ativas; projetos são Segundo Cérebro V2 e Central VOE; atalhos levam a Início, Capturar, Tarefas, Calendário, Conhecimento, Drive, Projetos, Hábitos, Financeiro e Configurações.
- Setas ↑/↓ percorrem resultados com retorno circular; Enter abre o ativo; clique abre o resultado. O campo usa `aria-activedescendant`, resultados usam `aria-selected`, contagem usa `role="status"`.
- Esc, botão Fechar ou clique no backdrop fecham. Escape é interceptado antes do comportamento nativo do campo search para fechar na primeira tecla, inclusive com consulta preenchida. `<dialog>` fornece modalidade; abrir bloqueia rolagem do corpo e fechar devolve o foco ao acionador conectado ao DOM.
- Sem resultados: “Nada por aqui ainda” e sugestão de outro título/assunto/módulo. Notas arquivadas ficam fora da busca global, mas são encontradas na biblioteca/Arquivo.
- Abrir nota chega ao item no editor. Abrir tarefa navega a Tarefas e foca linha da tabela quando localizada; tarefas fora dessa tabela geram toast de demonstração. Projetos navegam ao detalhe do V2 ou à lista para Central VOE.

**Limite de cobertura:** os sete tipos de entidade de T-026 de produção continuam um requisito futuro. Este protótipo não pesquisa conteúdo de lançamentos, arquivos, hábitos ou Cofre; os atalhos apenas navegam às suas telas quando disponíveis.

O botão de foto abre popover nativo com nome, indicação “Perfil de demonstração · foto ilustrativa”, Configurações e Sair da demonstração. Clique externo/Esc seguem o comportamento nativo; navegar por um item fecha o popover. A foto não identifica o Kauan: é um retrato ilustrativo em JPEG embutido, fonte [Unsplash](https://images.unsplash.com/photo-1500648767791-00dcc994a43e). Não há upload de avatar nesta revisão.

## 9. Home e continuidade dos outros módulos

A caixa de entrada da Home mostra até três notas ativas em entrada e abre a nota escolhida. Botão “Organizar N capturas”, subtítulo e estatística de capturas refletem a coleção local. O antigo círculo percentual fixo dá lugar a **N de T notas organizadas** e barra `organizadas / total ativo`: no seed, **4 de 7**. Arquivadas ficam fora do numerador/denominador. A caixa vazia orienta capturar a próxima ideia.

Guardar em Conhecimento/converter muda essa proporção; arquivar/restaurar recalcula o total. **Abrir tarefa** no cartão em foco navega para Tarefas e foca sua linha. **Concluir agora / Reabrir tarefa** alterna `homeDone`, persiste localmente e atualiza o indicador da tarefa “Revisar plano de milestones do V2” na Home e na tabela de Tarefas. O total de tarefas abertas segue **7 + quantidade de notas com `task:true` − (homeDone ? 1 : 0)**; tarefas já convertidas continuam contando mesmo se sua nota de origem for arquivada. As concluídas na semana seguem **12 + (homeDone ? 1 : 0)**; a Home e o subtítulo de Tarefas atualizam juntos. Os três compromissos e os demais hábitos/dados financeiros continuam fixtures. O bloco financeiro e suas regras permanecem intactos.

Conhecimento ganha a faixa de notas organizadas e acesso ao grafo; Tarefas ganha a seção de capturas convertidas. O leitor de Conhecimento usa a nota de ID `architecture`: título, breadcrumb, corpo, projeto, contagem de palavras e backlinks acompanham a coleção salva; os rótulos correspondentes na árvore acompanham renomeações. Wiki-links com título literal correspondente no corpo são botões que abrem o destino em Capturar. Os controles da barra de formatação abrem a nota em Capturar e informam que a formatação em blocos é referência visual. Não há editor TipTap funcional, seleção de página para editar naquele leitor nem CRUD real de cadernos.

Correções gerais complementares: títulos das colunas Kanban passam de h3 para h2; células do mapa de hábitos usam `minmax(0,1fr)`; perfil de Configurações e linhas de auditoria Admin quebram a 480px ou menos; `.twrap` contém labels visualmente ocultos da tabela Admin; texto de metadados pode quebrar. São ajustes de leitura/estrutura/responsividade, sem mudança nas regras dos módulos.

Drawers e sheet legados ganham retenção de foco por Tab/Shift+Tab, devolução ao botão acionador e bloqueio de rolagem enquanto o véu está aberto. O shell preserva skip-link, nomes das rotas, tema, barras e safe-area. A base HTML inclui doctype, `lang="pt-BR"`, UTF-8 e viewport com `viewport-fit=cover`.

## 10. Limites e recriação fiel

Para recriar o protótipo, usar os tokens/medidas do §2, os sete registros e ligações do §3 e os contratos dos §§4–9. Não substituir dados locais por números desconectados em cada componente. Renderizar texto de notas com escape de HTML; títulos digitados não devem se transformar em marcação executável.

Fontes: Geist 400/500/600 via Google Fonts com `display=swap`; fallback `system-ui, -apple-system, Segoe UI, sans-serif`. O carregamento remoto pode falhar e mudar a métrica tipográfica; o app de produção continua planejado com `next/font` self-hosted. A foto embutida pode ser exibida sem solicitação remota. O protótipo não tem empacotamento, service worker, garantias PWA ou controles de segurança de produção.

Requisitos de produção não demonstrados permanecem nos documentos correspondentes: isolamento por usuário; validação/transação no Núcleo; RLS; idempotência de rede; criação de página por referência pendente; upload/re-encode; conteúdo TipTap; conflitos; busca full-text e ranking; escala de grafo; pinch; IndexedDB/outbox e sincronização.

## 11. Validação e evidências

**Executada em 29/09/2026**, no navegador integrado do Codex, servindo o HTML por localhost. As verificações foram feitas por ações na interface, observações do DOM e inspeção de capturas. A cópia entregue mantém o seed original; as notas criadas no teste ficaram no armazenamento da origem usada na validação.

| Verificação executada | Resultado observado |
|---|---|
| 14 telas × 320, 768 e 1440px | **42/42 sem transbordamento horizontal da página**, após corrigir heatmap, perfil, auditoria e labels da tabela Admin. Registro em [validacao-responsiva.json](evidencias/2026-09-29/validacao-responsiva.json). Tabelas/listas mantêm a rolagem interna prevista. |
| Criar, salvar e recarregar | Nota nova encontrada na biblioteca/busca. Corpo com **3.727 caracteres** recuperado após reload; rascunho também recuperado no fluxo de edição. |
| Validação do título | Vazio e duplicado impediram salvar e focaram o campo. Escape de texto conferido na implementação; marcação literal no corpo foi preservada no textarea. Não foi executada bateria de segurança. |
| Wiki-link e ligação explícita | Sugestão de “[[Visão” completou o título. Uma nota salva com wiki-link e vínculo explícito mostrou duas conexões. Remover o wiki-link preservou suas palavras no corpo; após salvar, o grafo mostrou **2 notas / 1 conexão** restante. Deduplicação foi conferida no código. |
| Destino pendente e renomeação | Texto pendente foi preservado e avisado; criar “Nota ainda ausente” resolveu a referência e exibiu o backlink de “Teste de vínculo pendente”. Renomear arquitetura reescreveu a referência em Visão do produto. |
| Grafo | Seed de arquitetura: **5 nós / 4 arestas**; todas as notas: **7 / 5**. Seleção por clique, Enter e Espaço atualizou detalhe. Arraste alterou o transform; limites **60%/180%** desabilitaram o controle correspondente, e Centralizar voltou a 100%. Lista/SVG alternaram corretamente; carregamento em 390px iniciou em lista. |
| Arquivar e desfazer | Item saiu da coleção ativa; Arquivo/Restaurar e Desfazer o recuperaram. Guardar em Conhecimento e converter em tarefa mantiveram acesso à origem. |
| Home e Conhecimento | Organização/counts acompanharam a coleção. Abrir tarefa chegou a Tarefas; concluir/reabrir alternou abertas e concluídas na semana (**7/12 → 6/13 → 7/12**, seed). Nota convertida acrescentou uma tarefa. Leitor e referências de arquitetura acompanharam renomeação. |
| Busca | Ctrl+K, consulta sem acento, vazio, sem resultado, nota nova, setas/Enter, Escape com consulta e clique no backdrop conferidos. Escape/backdrop devolveram foco ao botão de busca. Cmd+K está implementado; não foi exercitado em macOS. |
| Perfil e temas | Popover exibiu a foto ilustrativa; Configurações navegou à tela e fechou o menu. Claro/escuro e busca em 390px foram inspecionados. |
| Execução JavaScript | Scripts inline analisados pelo parser JavaScript após o build final. Nenhum erro de console capturado na sessão final. |

### 11.1 IMPECCABLE e contraste

A revisão aplicou as lentes Distill, Operate, Layout, Craft Floor e Polish, com avaliação visual independente e uma passada de correção. A leitura inicial e a única execução do detector usaram a cópia disponível **4.3.1**; a **4.4.0** foi depois instalada da origem oficial no projeto e no perfil local, conforme D-031. O novo catálogo de skills será descoberto nas próximas sessões; nesta revisão as instruções foram lidas diretamente.

O detector retornou **11 achados antes das correções**: dois de contraste, cinco de padding, um consultivo de borda+sombra, um de fonte, um de texto repetido e um de salto de heading. Corrigidos os dois pares de contraste, o heading do Kanban e a dupla borda+sombra do novo popover. Geist foi mantida pela decisão D-025; a repetição em contexto/título/vínculos foi mantida por função. Os cinco alertas de padding foram revisados junto ao layout (incluem divisores herdados e containers cujo espaçamento está nos filhos). **Não se declara detector zerado nem auditoria WCAG completa.**

Medição matemática dos pares neutros efetivamente definidos: ink/muted/subtle contra canvas, surface, surface-2, surface-3 e chip de cada tema, mais o hover inverso. Os **32 pares medidos superam 4,5:1**. O menor contraste do subtle é **5.02:1 no claro** e **5.86:1 no escuro**. Valores em [validacao-contraste.json](evidencias/2026-09-29/validacao-contraste.json); transparências, ícones, todos os estados e cores semânticas legadas não estão cobertos por essa medição.

### 11.2 Capturas

| Tela | Viewport configurado | Arquivo |
|---|---|---|
| Home | 1440 × 1000 | [01-home-desktop.png](evidencias/2026-09-29/01-home-desktop.png) |
| Editor com nota e vínculos | 1440 × 1000 | [02-capturar-desktop.png](evidencias/2026-09-29/02-capturar-desktop.png) |
| Grafo de vizinhança | 1440 × 960 | [03-grafo-desktop.png](evidencias/2026-09-29/03-grafo-desktop.png) |
| Busca por “produto” | 1440 × 960 | [04-busca-desktop.png](evidencias/2026-09-29/04-busca-desktop.png) |
| Grafo em lista | 390 × 844 | [05-grafo-mobile.png](evidencias/2026-09-29/05-grafo-mobile.png) |
| Editor mobile | 390 × 844 | [06-capturar-mobile.png](evidencias/2026-09-29/06-capturar-mobile.png) |
| Busca mobile | 390 × 844 | [07-busca-mobile.png](evidencias/2026-09-29/07-busca-mobile.png) |
| Editor escuro | 390 × 844 | [08-capturar-escuro-mobile.png](evidencias/2026-09-29/08-capturar-escuro-mobile.png) |

**Limites da validação:** não foram usados aparelho real, Safari, leitor de tela, ambiente sem localStorage, macOS ou emulação de movimento reduzido. O suporte herdado a movimento reduzido foi conferido no CSS. Não há validação de backend, autenticação, upload, sincronização ou persistência de produção. Os controles legados que permanecem apenas visuais não são apresentados como fluxos implementados.
