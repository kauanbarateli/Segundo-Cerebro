# Design — Segundo Cérebro

## Autoridade e escopo

O mundo visual está aprovado nas decisões D-012, D-013, D-025 e D-030. Prevalecem o doc 14, o protótipo DS 2.1 e depois o doc 04. `PRODUCT.md` registra a verdade do produto. As superfícies atuais são a navegação demonstrativa das 13 áreas e a verificação `/design-system`, com briefs em `.impeccable/surfaces/`.

T-002 substitui a paleta provisória de T-001 pela fonte única `design-system/tokens/tokens.json`. CSS e aliases Tailwind são gerados; o runtime não recebe novas cores literais. A única exceção é o favicon histórico, conferido por hash em `brand-manifest.json`. A documentação de origem, classificação OBSERVADO/INFERIDO/RECOMENDADO e contratos está em `design-system/README.md`.

## Marca e tipografia

- **OBSERVADO:** símbolo geométrico “2” com dois nós, portado do repositório anterior, sem alterar sua geometria. Marca inline tokenizada e texto real em Geist.
- **Confirmado em D-025:** Geist é a única família, servida localmente pelo pacote `geist`, com fallback Segoe UI/system.
- **OBSERVADO:** título operacional 28px/24px, subtítulo 20px, corpo 14px, dado 13px, legenda 12px; editor 16px com entrelinha 1.8. A escala efetiva do protótipo vigente prevalece sobre a proposta anterior.
- **RECOMENDADO no doc 04:** display, corpo forte, campo e micro; os respectivos valores e entrelinhas estão no JSON. Micro é reservado a eixos de gráficos, nunca texto essencial ou controle.
- Campos têm pelo menos 16px. Valores comparáveis usam números tabulares. O título do início provisório também passa a consumir a escala nomeada 28px/24px.

## Cor e material

Neutros quentes, acento monocromático, quatro fundos sólidos, tintas em três níveis e inversa com tintas próprias. Semânticas possuem um degrau decorativo e um degrau `-ink` para texto. Os oito tons financeiros são marcas gráficas com rótulos independentes de cor.

O validador verifica 164 pares: texto nos quatro fundos de ambos os temas, categorias, acento, inversas e vidro composto. Texto passa em 4.5:1; gráficos em 3:1. O mínimo textual atual é 4.5109:1 (`work-ink`/`fin-ink` sobre hover claro), calculado sem arredondar a aprovação. Isso não certifica pares arbitrários fora dos contratos.

Vidro é exclusivo da moldura futura. Fallback opaco por padrão; blur exige desktop, suporte e preferência compatível. Sobre fundo arbitrário, somente a tinta principal foi validada no vidro. Cartões de dados usam superfícies sólidas.

## Composição

- A moldura T-004 usa trilho de 228px ou 74px, devolvendo 162px ao conteúdo quando recolhido. Abaixo de 768px, a barra inferior reúne quatro destinos e Mais, com Ajuda e Sair alcançáveis. Estados vazios declaram o que ainda está em construção; o bento funcional pertence a T-008.
- `/design-system` é uma página de leitura: introdução, índice de âncoras, superfícies, semânticas, escala tipográfica e raios. Os detalhes técnicos pertencem a essa página de verificação.
- Largura máxima 1184px incluindo padding. Piso 320px, reorganização abaixo de 768px, sem esconder transbordo global. Safe areas são respeitadas.
- Painéis 28px no desktop e 20px no mobile preservam o bento aprovado. A escala completa de raios é 4/8/12/20/28/36/pílula.
- Elevação é uma decisão única: borda ou sombra. Sem cartões aninhados, gradientes ou animação de entrada.

## Tema e interação

Claro, Escuro e Sistema usam um select nativo com nome acessível Tema. A preferência é local ao navegador; Sistema acompanha mudanças do SO. O script síncrono no head resolve o tema antes de React; CSS também atende ao SO sem JavaScript. Falhas de armazenamento não interrompem a página nem impedem a troca na sessão. Abas recebem mudanças da mesma preferência.

Links e controles têm alvo mínimo 44px, foco visível e feedback de interação. Skip link é o primeiro alvo do teclado; o conteúdo possui uma única h1. Movimento reduzido remove transições/animações. As superfícies atuais não usam vidro.

## Verificação e próximas etapas

Typecheck, lint, contratos de arquitetura, testes de unidade, validador, build e E2E formam a verificação de T-002. Capturas nos dois temas a 320/390/768/1280px apoiam a inspeção visual. Evidências e limites estão em `docs/implementation/t002-validacao.md`.

T-003 entrega Button, Card, Badge/PillButton, Field, 47 ícones e marca portados. O [contrato das primitivas](src/components/ui/README.md) documenta variantes, estados, origem e composição sobre inversa; `/design-system` demonstra controles com ações locais identificadas como exemplos. Foco em duas camadas, loading embutido e erros associados são comuns aos próximos módulos. A borda dos campos usa `ink-subtle`, uma aplicação RECOMENDADA de cor existente para identificar o controle com contraste suficiente.

T-006 entrega superfícies e dados; T-004 entrega navegação operacional; T-005 entrega PWA e exige validação em aparelhos físicos. Autenticação, persistência e módulos funcionais continuam nos tickets posteriores.
