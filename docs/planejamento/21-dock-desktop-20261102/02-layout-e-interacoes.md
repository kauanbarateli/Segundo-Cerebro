# Layout de Configurações e dock

Modo Impeccable: **Operate**. A tarefa é escolher uma navegação e alcançar módulos com clareza, sem redesenhar o restante do aplicativo.

## Configurações → Aparência

**RECOMENDADO para execução:** preservar painel, tipografia e tokens existentes; acrescentar subgrupo abaixo dos controles de tema, com respiro de 24 px. Não criar aba principal nova nem mover preferências de módulos.

```text
Aparência
  Tema da conta
  [Claro] [Escuro] [Sistema]       controles atuais preservados

  Navegação no computador
  Escolha como acessar suas áreas.
  Esta preferência fica salva somente neste navegador.

  ┌ Menu lateral · Padrão ┐  ┌ Dock inferior            ┐
  │ miniatura com trilho  │  │ miniatura com dock      │
  │ (●) Menu lateral     │  │ ( ) Dock inferior       │
  │ Módulos à esquerda.  │  │ Ícones na parte inferior│
  └──────────────────────┘  └─────────────────────────┘
  [Aplicar navegação]       Navegação atualizada neste navegador.
```

- Usar fieldset/legend e radios nativos encapsulados pelo componente de campo permitido pelo projeto. Duas opções exclusivas; nunca dois switches que podem deixar tudo desligado.
- Duas miniaturas lado a lado em área útil suficiente; largura mínima sugerida de cada opção 200 px, gap 16 px, padding 16 px, raio 12–16 px. Usar auto-fit/container, não forçar duas colunas em painel estreito.
- Miniaturas **decorativas** com área ilustrativa de 96–112 px, feitas de HTML/CSS ou SVG geométrico: mesma janela, uma com trilho esquerdo, outra com dock inferior. Sem dados pessoais, textos minúsculos ou outra biblioteca.
- Títulos “Menu lateral” / “Dock inferior”; descrição lateral “Módulos organizados à esquerda.”; descrição dock “Ícones na parte inferior. Passe o mouse ou use o teclado para ver os nomes.”
- Badge textual “Padrão” apenas na sidebar. Radio + traço/estado selecionado + nome, sem depender somente de cor.
- Alvos ≥44×44 px, texto dos campos ≥16 px, foco visível, contraste medido claro/escuro. Card inteiro é label, sem controles interativos aninhados.
- Botão separado de “Salvar aparência” do tema. Não mudar comportamento de tema já integrado por outras frentes. Disabled quando nada mudou; depois de aplicar, anúncio `role=status` sem roubar foco.
- Falha em localStorage: “Aplicado nesta visita. O navegador não permitiu salvar a preferência.”; conservar modo na memória. Não usar erro de servidor para uma operação local.
- Corrigir texto geral para “Ajuste sua conta e a aparência deste navegador.”; distinguir claramente tema da conta da navegação local.
- Acrescentar âncora interna `#navegacao-no-computador` ao fieldset/container para documentação; continuar sob Aparência. Não criar item redundante no índice da página.
- Em celular/touch-only/tela compacta: manter Aparência atual e mostrar apenas nota de disponibilidade desktop, sem radios/botão editável. Preferência dock já salva não altera UI mobile.

Este layout é especificação nova, ainda não captura de tela implementada. O protótipo empacotado comprova somente a dock no Início, não o formulário acima.

## Dock desktop — transportar o acabamento observado

Capturas: [claro](referencia/desktop.png) e [escuro](referencia/desktop-dark.png). Valores **OBSERVADOS no protótipo refinado**, a mapear para tokens sem copiar globais:

| Elemento | Referência |
|---|---|
| Posição | centralizada no rodapé, margem inferior 24 px; fixed |
| Corpo | 76 px de altura, raio 24 px, padding 10/14/16 px; gap 8 px |
| Material | glass-surface do DS; blur 20 px e saturação 125%; fallback surface opaco |
| Elevação | sombra deslocada suave; adaptar token existente e medir em ambos temas |
| Ícone | tile 44×44 px, raio 14 px, ícone base 22 px, mesma família/stroke |
| Hover | tile até 64 px, ícone até 30 px; vizinhos respondem por distância até 110 px |
| Mola | mass 0.16, stiffness 220, damping 20 no experimento Motion |
| Ativo | fundo accent, ícone accent-ink e marcador inferior, aria-current=page |
| Tooltip | fundo inverso, texto 12/18 px, padding 7×11, raio 8 px, seta pequena; acima do ícone |
| Grupos | separador discreto 1 px, sem mudar ordem customizada |
| Fonte | Geist; DS 2.1, claro/escuro acompanhando tema atual |

Não importar a CSS inteira que usa `main !important` ou oculta sidebar globalmente: ela serve só à simulação. Na aplicação, aplicar escopo por variante e media query.

### Movimento, tooltip e desempenho

- Preservar crescimento do ícone apontado e vizinhos; animação não pode deslocar toda a página. Não usar estado React a cada pointermove. Medir layout em lote/ResizeObserver, evitar getBoundingClientRect por ícone a cada frame quando for possível.
- Motion 12.43.0 foi usado no protótipo, mas **não é dependência da main observada**. Na execução, avaliar instalação/pin e lockfile com auditoria; preferir import restrito e chunk apenas quando necessário. Nunca copiar bundle compilado ou node_modules.
- Se optar motor sem Motion, provar equivalência visual ao passar entre ícones, não substituir por simples zoom independente de CSS sem revisão.
- Redução de movimento desliga magnificação e deslocamento, não só transition CSS; foco e nome continuam visíveis. Sem hover persistente após touch ou pointerleave.
- Tooltip acessível por hover e foco, não só title. Esc fecha; pode receber hover sem desaparecer ao atravessar o intervalo (WCAG 1.4.13); não obstrui ação. Não precisa focar tooltip.
- Ícone SVG decorativo aria-hidden; controle tem nome acessível único. Tab/Shift+Tab e Enter funcionam; setas opcionais não substituem Tab. Clique na página atual não remonta módulo.

### Quantidade de ícones e falta de espaço

A aplicação pode ter mais itens que as 11 opções da referência (Admin/Métricas) e ordem personalizada. **RECOMENDADO:** preservar ordem do catálogo e usar overflow explícito:
- Reservar faixa máxima `100vw - 32px`; considerar larguras máximas de magnificação, controles fixos e separadores ao calcular capacidade.
- Sem espaço, manter prefixo ordenado visível, Configurações ao alcance e botão **Mais áreas** ≥44 px com popup de links restantes, na mesma ordem. Preservar item atual acessível e indicar no botão Mais quando a rota ativa está nele.
- Não reduzir alvo abaixo de 44 px, cortar último item, criar duas linhas de dock nem produzir scroll horizontal na página.
- Popup é lista de links com teclado, Escape e retorno ao gatilho; não declarar role=menu sem implementar suas teclas. Configurações pode ser fixada como utilitário sem duplicação; registrar essa adaptação da ordem apenas na apresentação.
- Se grupos foram intercalados pelo usuário, omitir separadores de seção que impliquem agrupamento falso. Separadores não ficam órfãos.
- Somente renderizar entradas autorizadas; overflow não é atalho para contornar Entitlements.

### Área de conteúdo e overlays

No modo dock, remover coluna lateral do grid, manter limites de leitura e layouts de cada módulo; não esticar formulários ilimitadamente. Reservar rodapé para corpo da dock, margem e safe-area; `scroll-padding-bottom`/foco devem permitir ver a última ação acima dela. Verificar tooltips sem cortar, toast/CommandFeedback, Captura rápida, diálogos, drawers, Cofre e editor de Metas. Modal deve ficar acima da dock, e a dock não recebe foco enquanto fundo estiver inert. Sidebar continua inerte/oculta só onde necessário, sem perder drawer mobile.
