# Design — Segundo Cérebro

## Autoridade e escopo

O mundo visual está aprovado nas decisões D-012, D-013, D-025 e D-030. Prevalecem o doc 14, o protótipo DS 2.1 e depois o doc 04. `PRODUCT.md` registra a verdade do produto. As superfícies atuais são a navegação demonstrativa das 13 áreas, a verificação `/design-system` e a apresentação comercial `/conheca`, com briefs em `.impeccable/surfaces/`.

T-002 substitui a paleta provisória de T-001 pela fonte única `design-system/tokens/tokens.json`. CSS e aliases Tailwind são gerados; o runtime não recebe novas cores literais. A única exceção é o favicon histórico, conferido por hash em `brand-manifest.json`. A documentação de origem, classificação OBSERVADO/INFERIDO/RECOMENDADO e contratos está em `design-system/README.md`.

## Marca e tipografia

- **OBSERVADO:** símbolo geométrico “2” com dois nós, portado do repositório anterior, sem alterar sua geometria. Marca inline tokenizada e texto real em Geist.
- **Confirmado em D-025:** Geist é a única família, servida localmente pelo pacote `geist`, com fallback Segoe UI/system.
- **OBSERVADO:** título operacional 28px/24px, subtítulo 20px, corpo 14px, dado 13px, legenda 12px; editor 16px com entrelinha 1.8. A escala efetiva do protótipo vigente prevalece sobre a proposta anterior.
- **RECOMENDADO no doc 04:** display, corpo forte, campo e micro; os respectivos valores e entrelinhas estão no JSON. Micro é reservado a eixos de gráficos, nunca texto essencial ou controle.
- **RECOMENDADO em 12/10/2026, com aprovação do mantenedor:** vitrine (título de apresentação, teto de 96px) e chamada (parágrafo de abertura); valores em `typography.scale` e aprovação em `meta.classification.persuasion` do JSON. Servem somente a `/conheca`; telas operacionais continuam em display/h2.
- Campos têm pelo menos 16px. Valores comparáveis usam números tabulares. O título do início provisório também passa a consumir a escala nomeada 28px/24px.

## Cor e material

Neutros quentes, acento monocromático, quatro fundos sólidos, tintas em três níveis e inversa com tintas próprias. Semânticas possuem um degrau decorativo e um degrau `-ink` para texto. Os oito tons financeiros são marcas gráficas com rótulos independentes de cor.

O validador verifica 164 pares: texto nos quatro fundos de ambos os temas, categorias, acento, inversas e vidro composto. Texto passa em 4.5:1; gráficos em 3:1. O mínimo textual atual é 4.5109:1 (`work-ink`/`fin-ink` sobre hover claro), calculado sem arredondar a aprovação. Isso não certifica pares arbitrários fora dos contratos.

Vidro é exclusivo da moldura futura; o único uso atual é o cabeçalho fixo de `/conheca`. Fallback opaco por padrão; blur exige desktop, suporte e preferência compatível. Sobre fundo arbitrário, somente a tinta principal foi validada no vidro. Cartões de dados usam superfícies sólidas.

## Composição

- A moldura T-004 usa trilho de 228px ou 74px, devolvendo 162px ao conteúdo quando recolhido. Abaixo de 768px, a barra inferior reúne quatro destinos e Mais, com Ajuda e Sair alcançáveis. Estados vazios declaram o que ainda está em construção; o bento funcional pertence a T-008.
- `/design-system` é uma página de leitura: introdução, índice de âncoras, superfícies, semânticas, escala tipográfica e raios. Os detalhes técnicos pertencem a essa página de verificação.
- Largura máxima 1184px incluindo padding. Piso 320px, reorganização abaixo de 768px, sem esconder transbordo global. Safe areas são respeitadas.
- Painéis 28px no desktop e 20px no mobile preservam o bento aprovado. A escala completa de raios é 4/8/12/20/28/36/pílula.
- Elevação é uma decisão única: borda ou sombra. Sem cartões aninhados, gradientes ou animação de entrada; a única exceção é o movimento ligado à rolagem de `/conheca`, descrito na seção dela.

## Tema e interação

Claro, Escuro e Sistema usam um select nativo com nome acessível Tema. A preferência é local ao navegador; Sistema acompanha mudanças do SO. O script síncrono no head resolve o tema antes de React; CSS também atende ao SO sem JavaScript. Falhas de armazenamento não interrompem a página nem impedem a troca na sessão. Abas recebem mudanças da mesma preferência.

Links e controles têm alvo mínimo 44px, foco visível e feedback de interação. Skip link é o primeiro alvo do teclado; o conteúdo possui uma única h1. Movimento reduzido remove transições/animações. Fora o cabeçalho de `/conheca`, as superfícies atuais não usam vidro.

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
