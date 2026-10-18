# Design — Segundo Cérebro

## Autoridade e escopo

O mundo visual está aprovado nas decisões D-012, D-013, D-025, D-030 e D-033. Para a composição das 12 telas prevalece o layout Codex do [doc 15](docs/planejamento/15-aplicacao-layout-codex/README.md), com as cores autorais DS 2.1 e as adaptações acessíveis explícitas; o doc 14 continua referência histórica e funcional onde não foi substituído, e o doc 04 rege cores, acessibilidade e motion. `PRODUCT.md` registra a verdade do produto. As superfícies atuais são a navegação demonstrativa das 13 áreas, a verificação `/design-system` e a apresentação comercial `/conheca`, com briefs em `.impeccable/surfaces/`.

T-002 substitui a paleta provisória de T-001 pela fonte única `design-system/tokens/tokens.json`. CSS e aliases Tailwind são gerados; o runtime não recebe novas cores literais. A única exceção é o favicon histórico, conferido por hash em `brand-manifest.json`. A documentação de origem, classificação OBSERVADO/INFERIDO/RECOMENDADO e contratos está em `design-system/README.md`.

## Marca e tipografia

- **OBSERVADO:** símbolo geométrico “2” com dois nós, portado do repositório anterior, sem alterar sua geometria. Marca inline tokenizada e texto real em Geist.
- **Confirmado em D-025:** Geist é a única família, servida localmente pelo pacote `geist`, com fallback Segoe UI/system.
- **OBSERVADO:** título operacional 28px/24px, subtítulo 20px, corpo 14px, dado 13px, legenda 12px; editor 16px com entrelinha 1.8. A escala efetiva do protótipo vigente prevalece sobre a proposta anterior.
- **RECOMENDADO no doc 04:** display, corpo forte, campo e micro; os respectivos valores e entrelinhas estão no JSON. Micro é reservado a eixos de gráficos, nunca texto essencial ou controle.
- **RECOMENDADO em 12/10/2026, com aprovação do mantenedor:** vitrine (título de apresentação, teto de 96px) e chamada (parágrafo de abertura); valores em `typography.scale` e aprovação em `meta.classification.persuasion` do JSON. Servem somente a `/conheca`; telas operacionais continuam em display/h2.
- Campos têm pelo menos 16px. Valores comparáveis usam números tabulares.
- **OBSERVADO no layout Codex (D-033):** título de página 32px/28px (peso 570, −0,03 em) e título de seção 18px como aliases locais (`--type-page-title`, `--type-section-title`), sem redefinir `h2`/`h3` globais. Controles usam 13px/550. A marca na lateral empilha o texto real de 21px ao lado do símbolo de 38px.

## Cor e material

Neutros quentes, acento monocromático, quatro fundos sólidos, tintas em três níveis e inversa com tintas próprias. Semânticas possuem um degrau decorativo e um degrau `-ink` para texto. Os oito tons financeiros são marcas gráficas com rótulos independentes de cor.

O validador verifica 164 pares: texto nos quatro fundos de ambos os temas, categorias, acento, inversas e vidro composto. Texto passa em 4.5:1; gráficos em 3:1. O mínimo textual atual é 4.5109:1 (`work-ink`/`fin-ink` sobre hover claro), calculado sem arredondar a aprovação. Isso não certifica pares arbitrários fora dos contratos.

Vidro é exclusivo da moldura futura; o único uso atual é o cabeçalho fixo de `/conheca`. Fallback opaco por padrão; blur exige desktop, suporte e preferência compatível. Sobre fundo arbitrário, somente a tinta principal foi validada no vidro. Cartões de dados usam superfícies sólidas.

## Composição

- **Layout Codex (D-033):** lateral de 232px ou 76px em `surface-muted`, agrupada em Meu dia, Meu contexto e Vida pessoal a partir das rotas visíveis, com utilitários e perfil no rodapé; a escolha de recolher é preferência de apresentação do navegador e, sem escolha, recolhe até 1050px. Topbar de 76px (64px no celular) com breadcrumb, estado, Tema, Atividade e Capturar. Até 600px a mesma lateral vira menu modal e a barra inferior reúne quatro módulos e Mais. Medidas são aliases locais em `src/components/ui/aliases.css`; o relatório de execução está em `docs/implementation/layout-codex-ds21/README.md`.
- **Telas no layout Codex:** cada módulo segue a composição final do doc 15 sobre os dados reais — Início com foco inverso e ritmo do dia, Calendário com barra de período, lateral interna, linha do tempo de 80 px/hora e Lista apenas na URL, Integrações compondo a mesma gestão Google, grades semanais e painéis planos nos módulos pessoais. Desvios acessíveis (alvos de 44 px, rolagem interna, J2 no celular) e capacidades preservadas estão no relatório de execução; os briefs por tela ficam em `.impeccable/surfaces/`.
- `/design-system` é uma página de leitura: introdução, índice de âncoras, superfícies, semânticas, escala tipográfica e raios. Os detalhes técnicos pertencem a essa página de verificação.
- Conteúdo operacional com largura máxima 1600px e respiro de 32/24/16px; páginas de leitura (`/design-system`, Auth) mantêm 1184px. Piso 320px, breakpoints por necessidade (1270/1120/1050/1000/780/760/680/600/360px), sem esconder transbordo global. Safe areas são respeitadas.
- Painéis planos de 16px; controles e navegação 9px; campos 8px; eventos 10px; agenda 14px; drawer 20px. A escala DS de raios continua 4/8/12/20/28/36/pílula para os demais usos.
- Elevação é uma decisão única: borda ou sombra. Sem cartões aninhados, gradientes ou animação de entrada; a única exceção é o movimento ligado à rolagem de `/conheca`, descrito na seção dela.

## Tema e interação

Claro, Escuro e Sistema usam um select nativo com nome acessível Tema; no cabeçalho do workspace ele é desenhado como alvo de 44px com ícone, e Configurações oferece os três modelos de tema com amostras fixas de cada paleta (`--theme-light-*`/`--theme-dark-*`, geradas do JSON). A preferência é local ao navegador; Sistema acompanha mudanças do SO. O script síncrono no head resolve o tema antes de React; CSS também atende ao SO sem JavaScript. Falhas de armazenamento não interrompem a página nem impedem a troca na sessão. Abas recebem mudanças da mesma preferência.

Links e controles têm alvo mínimo 44px, foco visível e feedback de interação. Skip link é o primeiro alvo do teclado; o conteúdo possui uma única h1. Motion só em CSS: 120ms para feedback e 180ms para superfícies (lateral, diálogos, drawer, troca de tema) com a curva oficial; navegação por teclado não espera transições e movimento reduzido usa o piso de 0,001ms. Fora o cabeçalho de `/conheca`, as superfícies atuais não usam vidro.

## Apresentação comercial /conheca

Superfície pública de persuasão que herda o mundo DS 2.1 sem criar identidade: mesma faixa de 1184px, alvos de pelo menos 44px e todas as cores vindas de `tokens.json`. A estrutura "Seis perguntas" e a coreografia dos capítulos estão no brief `.impeccable/surfaces/src-app-conheca-page-tsx.md`; decisões, telas e pendências, em `docs/implementation/conheca-apresentacao.md`. As regras abaixo valem só para esta rota.

- **Vitrine e chamada.** `vitrine` aparece apenas no título da abertura, no título do acesso e nos três verbos dos movimentos; `chamada`, apenas no parágrafo de abertura e no texto do acesso, em `ink-muted` (`inverse-muted` no bloco inverso). Títulos de seção e as seis perguntas usam `display`; respostas, títulos de regra e o índice de perguntas usam `h3`.
- **Material.** Neutros quentes, acento monocromático e dois blocos inversos (movimentos e acesso); a faixa de conexões usa `surface`. Linhas finas em `line` separam listas, capítulos, regras e princípios no lugar de cartões; no bloco inverso, o fio é a tinta corrente a 22%, sem cor nova. Telas de computador levam borda `line-strong` e raio `xl` (28px); telas de celular, a mesma borda e raio `2xl` (36px); o recorte do diálogo da busca, raio `xl` sem borda. Essa borda é a única elevação: não há sombra.
- **Nós da marca.** Os dois nós do símbolo viram o ornamento da página: anéis de traço 1.5px em `currentColor` marcam o índice de perguntas (preenchidos no hover), os fatos de cada capítulo e os três movimentos, que um fio liga.
- **Cabeçalho em vidro.** O cabeçalho fixo aplica `.glass-frame` só com a borda inferior (`glass-border`). Nasce opaco em `glass-fallback`; o vidro (`glass-surface`, `glass-blur`, `glass-saturate`) entra a partir de 768px, com suporte a `backdrop-filter` e sem preferência por transparência reduzida. Abaixo de 768px as seções viram um painel opaco em `surface`. Sobre o vidro vale o contrato do DS: só `ink` foi validada; tinta secundária exige superfície opaca própria, como o acento do botão de acesso.
- **Movimento ligado à rolagem.** É a exceção à regra de não animar a entrada. São três efeitos de escala presos à posição da rolagem, sem duração própria, opacidade ou deslocamento, e o conteúdo fica sempre visível: a tela do Início, na abertura, vai de 94% ao tamanho final nos primeiros 60vh de rolagem; a partir de 1024px de largura e 700px de altura, a tela de cada capítulo cresce durante a subida e chega ao tamanho final ao alcançar a pergunta parada; o fio dos três movimentos se desenha enquanto cada item atravessa a janela. Os efeitos só existem com `prefers-reduced-motion: no-preference` e suporte a `animation-timeline`; na falta de qualquer um, tudo fica no tamanho final e o fio, inteiro. A pergunta fixa e a tela que sobe são layout (`position: sticky`) e permanecem: só a rolagem move a tela. Âncoras rolam suavemente; movimento reduzido devolve o salto imediato.
- **Capturas.** Toda tela é captura real do app em modo demonstração, gerada por `scripts/landing/capturar-telas.mjs`, nunca maquete ou imagem conceitual. Cada cena existe nos temas claro e escuro (sufixo `-escuro`), e cada cena de computador (janela de 1440px) tem a versão de celular da mesma cena (390px, sufixo `-celular`), em WebP com densidade 2 no computador e 3 no celular. Os dados são os fictícios da demonstração; a captura troca apenas nomes de marcas, clientes e jargão interno por nomes neutros, e a foto de perfil sem origem documentada pelo ícone de conta sem foto. A origem fica no EXIF e no registro lateral `.webp.json`; o rodapé declara a demonstração. Na página, a tela segue o tema resolvido: sem tema escolhido, acompanha o aparelho; com Claro ou Escuro escolhido no rodapé, assume o quadro daquele tema, carregado só quando exibido. Abaixo de 768px entra a versão de celular. A imagem de compartilhamento é a primeira dobra real da página, no tema claro, com a origem registrada do mesmo modo.

## Verificação e próximas etapas

Typecheck, lint, contratos de arquitetura, testes de unidade, validador, build e E2E formam a verificação de T-002. Capturas nos dois temas a 320/390/768/1280px apoiam a inspeção visual. Evidências e limites estão em `docs/implementation/t002-validacao.md`.

T-003 entrega Button, Card, Badge/PillButton, Field, 47 ícones e marca portados. O [contrato das primitivas](src/components/ui/README.md) documenta variantes, estados, origem e composição sobre inversa; `/design-system` demonstra controles com ações locais identificadas como exemplos. Foco em duas camadas, loading embutido e erros associados são comuns aos próximos módulos. A borda dos campos usa `ink-subtle`, uma aplicação RECOMENDADA de cor existente para identificar o controle com contraste suficiente.

T-006 entrega superfícies e dados; T-004 entrega navegação operacional; T-005 entrega PWA e exige validação em aparelhos físicos. Autenticação, persistência e módulos funcionais continuam nos tickets posteriores.
