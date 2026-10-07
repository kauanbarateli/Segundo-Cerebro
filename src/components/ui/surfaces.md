# Superfícies compartilhadas

T-006 acrescenta superfícies sem dependência de feature. Os exemplos em `/design-system` não gravam dados. Todos os controles reutilizam Button e seus estados de hover, pressed, foco, disabled e loading.

| Componente | Contrato |
| --- | --- |
| `Dialog` | Controlado por `open` e `onClose`; `title` obrigatório; `description`, `children`, `footer`, `initialFocusRef`, `returnFocusRef`, `className`, `closeLabel`, `closeOnBackdrop` e `dismissible` opcionais. `variant`: dialog/drawer/sheet. |
| `Drawer`, `BottomSheet` | Mesma API do diálogo, com variante fixada. O drawer vira tela cheia abaixo de 768px conservando a mesma árvore e o conteúdo digitado. Sheet limita a altura por `dvh`, mantém rolagem interna e safe areas. |
| `ConfirmDialog` | `open`, `onClose`, `onConfirm`, `title`, `description`, `confirmLabel`, `cancelLabel`, `loading`, `destructive`, `error`, `returnFocusRef`. Foco inicial em Cancelar; backdrop não descarta. Loading desabilita confirmação e cancelamento; erro permanece no diálogo como alerta. O consumidor fecha após sucesso e conserva aberto após falha. |
| `ToastProvider`, `useToast` | Envolver a superfície consumidora no provider. `toast({ message, action?: { label, onClick }, duration?: number \| null })` retorna id; `dismiss(id)` dispensa. Mensagens sem ação duram 5s; mensagens com ação persistem por padrão. `null` é persistente, duração explícita usa milissegundos. Não enviar segredos do Cofre. |

## Foco e modalidade

`Dialog` usa `<dialog>.showModal()`: o navegador torna o fundo inerte. Todos os formatos e a confirmação usam a mesma implementação. A pilha fecha somente as bordas de Tab/Shift+Tab antes de o foco ir para a interface do navegador, consultando os controles atuais e respeitando grupos de radio e tabindex; o interior conserva a navegação nativa. Escape fecha apenas o topo, inclusive dentro de campo de busca preenchido; ajuda contextual pode consumir a primeira tecla antes do diálogo. Foco inicial vai à ref pedida ou ao título. A pilha compartilhada restaura a ref explícita ou o acionador conectado; se ele saiu, devolve ao título do diálogo anterior ou ao `main`.

A pilha também contabiliza a trava de rolagem do body/documento e preserva seus estilos anteriores. Fechar uma camada não libera a rolagem enquanto outra continua aberta. Backdrop só fecha se o gesto começar e terminar fora do painel; selecionar texto e soltar no fundo não fecha. A montagem condicional é suportada, mas manter o componente montado e controlar `open` conserva estado local dos filhos.

## Avisos e tempo

Toast usa anúncio educado (`status`/`aria-live=polite`), texto e botões separados. Nunca captura o foco ao aparecer. O tempo restante pausa com ponteiro, foco dentro do aviso e documento oculto; só retoma quando todas as causas terminam. A ação executa antes da dispensa. `dismiss` inicia `.toast-out` já definida nas utilidades de T-003; a remoção usa `animationend` e fallback calculado pela duração CSS. Movimento reduzido remove sem aguardar animação.

Avisos permanecem na camada da página. Enquanto um diálogo modal está aberto, a modalidade nativa protege seu foco e deixa os avisos externos inertes; prefira mostrar o resultado por toast depois de fechar a operação. Falhas que exigem ação durante a confirmação usam `error` no próprio diálogo. Os avisos persistentes não expiram nesse intervalo.

## Origem visual

- **OBSERVADO**, doc 14 §2: largura de diálogo 600px, folgas desktop/mobile de 64/32px, raio mobile 20px, base do toast 24px desktop/108px mobile, padding 12/16px e alvos 44px.
- **INFERIDO:** raio desktop de diálogo 28px e toast 12px usam os degraus nomeados vigentes; os valores isolados 24px/14px do HTML não criam tokens paralelos.
- **RECOMENDADO:** drawer 560px; sheet com raio nomeado 36px desktop/20px mobile; superfícies sólidas com uma sombra, sem borda adicional; backdrop mistura 40% de `surface-inverse` com transparente. O conteúdo mantém contraste sobre fundo opaco independentemente do backdrop.
- **RECOMENDADO:** confirmação protege Cancelar como foco inicial e não fecha pelo backdrop; duração explícita de aviso é responsabilidade de quem o dispara. Persistência com ação evita perder Desfazer.

Os E2E em `tests/e2e/surfaces.spec.ts` cobrem foco aninhado, Escape/restauração, trava, gesto de backdrop, confirmação, mesma árvore responsiva, limite de sheet, pausa do toast, persistência/ação/dispensa, movimento reduzido, alvos e contraste nos dois temas. Execução e evidências devem ser confirmadas no registro da entrega; existência dos testes não atesta execução.
