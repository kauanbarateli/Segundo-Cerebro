# Onboarding inicial — Segundo Cérebro

Registro da extensão local e de sua simplificação em 17/10/2026. Entrada em [index.html](../../index.html), rota `#/onboarding`; implementação em [onboarding.js](../../onboarding.js) e [onboarding.css](../../onboarding.css). O escopo permanece em [PRODUCT.md](../../PRODUCT.md); a identidade global permanece em [DESIGN.md](../../DESIGN.md).

## Propósito

**Modo: Operate.** Preparar o ambiente com decisões pequenas, uma por tela. A pessoa pode configurar apenas o que precisa agora, retomar depois ou entrar diretamente no painel.

O pedido de simplificação reduz texto e informações simultâneas. Explicações, navegação de etapas e opções secundárias ficam sob demanda; as funcionalidades e relações entre os módulos permanecem disponíveis.

## Direction contract

Registro da direção implementada, sem estabelecer uma nova identidade.

**THESIS:** Uma decisão simples por vez, com configuração opcional e progresso discreto.

**OWN-WORLD:** Marca geométrica, Geist, neutros quentes do DS 2.1, acento monocromático e superfícies planas. Claro e escuro preservam os mesmos papéis.

**STORY:** Começar, preparar recursos em sete passos curtos, revisar as escolhas e acessar o painel.

**FIRST VIEWPORT:** Marca e tema no cabeçalho. Coluna de até 560 px com título de 36/32 px, uma frase de contexto, “Começar” e “Explorar por conta própria”. Uma linha informa que as etapas podem ser puladas.

**FORM:** Nove telas: boas-vindas, sete etapas opcionais e resumo. Cada etapa mostra título, uma frase, conteúdo essencial e próxima ação. Detalhes começam fechados.

**SIGNATURE:** O mesmo alinhamento conduz do campo principal à ação de continuar; o resumo usa linhas compactas contendo apenas as escolhas preparadas.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Identidade herdada

As cores vêm de [design-system/colors.css](../../design-system/colors.css), com os valores oficiais em [design-system/tokens.json](../../design-system/tokens.json). A marca utiliza o mesmo SVG compartilhado do painel; Geist permanece local. Não foram alterados `DESIGN.md`, tokens globais ou `.impeccable/design.json`.

A palavra-marca usa 20 px no desktop e 18 px no celular. Boas-vindas usa 36/32 px; títulos de etapas, 32/28 px; corpo, 14 px; texto introdutório e campos, 16 px; controles e detalhes, 13 px; metadados, 12 px. São papéis locais da superfície, preservando a hierarquia existente.

## Composição

Uma coluna de até 560 px ocupa o centro do canvas, sem cartão contêiner. Cabeçalho, campos, conteúdo e rodapé não competem com uma navegação lateral. A apresentação anterior de benefícios e projeto ilustrativo foi retirada para reduzir informação simultânea.

O topo das etapas mostra “Etapa n de 7”, progresso de 3 px e “Ver etapas”, inicialmente fechado. A lista de navegação abre como menu no desktop e ocupa espaço no fluxo em telas de até 600 px. O resumo final oferece apenas “Revisar escolhas” como acesso às etapas, evitando navegação repetida.

O campo principal aparece imediatamente. Foco do perfil, frequência, contexto, projeto, prazo e criação de nota usam detalhes nativos. Após adicionar hábito, projeto ou tarefa, a lista compacta substitui o formulário; “Adicionar outro” abre a próxima entrada.

Campos têm altura mínima de 52 px e texto de 16 px. Controles e resumos de detalhes têm alvo mínimo de 44 px. Campos preservam raio de 8 px e botões de 9 px; contas e menu de etapas usam raio local de 12 px; a barra de progresso usa 2 px. Essas medidas locais não redefinem tokens globais. Sombras aparecem no menu sobreposto, com `--elevation-float`.

Até 600 px, a coluna mantém margens de 16 px, campos secundários passam a uma coluna e o rodapé pode quebrar linha. Até 380 px, o cabeçalho organiza suas ações em outra linha. No resumo, linhas de pelo menos 48 px colocam título e detalhe lado a lado, com quebra natural para textos longos. Nada exige truncar nomes ou reduzir a fonte dos campos.

## Fluxo

| Tela | Conteúdo e ação |
|---|---|
| Boas-vindas | Frase breve sobre planos, rotina e ideias. “Começar” abre os passos; “Explorar por conta própria” abre o painel. |
| 1. Seu nome | Campo de nome; “Definir meu foco” revela quatro opções facultativas. |
| 2. Sua agenda | Duas contas Google fictícias; seleção com ícone e aviso de demonstração sem login. |
| 3. Um hábito | Nome da prática; frequência em “Ajustar detalhes”; até cinco itens por rodada. |
| 4. Um projeto | Nome do plano; contexto Pessoal, Trabalho ou Estudos nos detalhes; até cinco itens. |
| 5. Uma tarefa | Próxima ação; projeto e prazo nos detalhes; até cinco itens. |
| 6. Suas notas | Nome do caderno habilita sua preparação. “Adicionar uma primeira nota” abre título e texto; vínculo a projeto fica em outro detalhe. |
| 7. Outros espaços | Financeiro, Arquivos e Cofre em três detalhes separados, inicialmente fechados. “Concluir” abre o resumo. |
| Resumo | Apenas escolhas preparadas; “Revisar escolhas” revela os passos; “Acessar meu painel” aplica e conclui. |

“Pular” aparece quando não existem escolhas ou títulos em edição no passo. “Continuar” prepara o título digitado antes de avançar. “Voltar” e “Ver etapas” preservam o rascunho. “Fazer depois” pausa e abre o Início; o banner do painel e a ação de Configurações retomam a etapa guardada.

A criação é opcional. O formulário protege consistência quando a pessoa decide criar um item. Erros revelam o detalhe pertinente, identificam o campo e orientam a correção. Antes de abrir o resumo, títulos pendentes de todas as etapas são preparados e notas são validadas, inclusive ao acessar o resumo pelo menu.

## Persistência e integração

O primeiro acesso sem hash ou em `#/inicio` abre a configuração enquanto ela estiver ativa; links diretos de módulos continuam disponíveis. Depois da conclusão, o acesso normal abre o Início.

O rascunho salva campos e itens localmente enquanto a pessoa digita, quando o navegador permite. Troca de tema, recarga e retorno preservam as escolhas sem aplicá-las aos módulos. Falhas de armazenamento mantêm feedback visível; a confirmação de salvamento fica disponível a leitores de tela.

O estado usa versão 2. A migração de rascunhos anteriores preserva dados e IDs, remapeia o antigo resumo de 7 para 8 e remove o nome padrão de caderno quando ele não representava uma escolha. “Acessar meu painel” preserva exemplos e registros existentes, aplica preferências preenchidas e acrescenta os novos itens com IDs estáveis.

Títulos repetidos no rascunho são recusados. Uma nova nota não pode repetir o título de página existente, ignorando caixa; cadernos com nome idêntico são reutilizados. Isso não impõe unicidade global aos nomes de hábitos, projetos ou tarefas de rodadas distintas.

Tarefas e notas podem apontar para projetos preparados ou persistidos. Remover um projeto do rascunho desfaz seus vínculos pendentes. Novas tarefas de hoje e hábitos aparecem no Início sem apagar o conteúdo anterior.

“Rever configuração”, em Configurações, mostra a rodada concluída sem reaplicá-la nem sobrescrever alterações posteriores. “Configurar mais recursos” inicia outra rodada. O resumo não é um contador de todos os registros do ambiente.

Google permanece limitado a duas contas fictícias no total. Contas existentes são reconhecidas; pular não as remove. Não há OAuth, sincronização ou chamadas externas. Arquivos é conceitual, sem upload. O Cofre usa exemplos e não recebe segredos reais.

## Interação e movimento

- Navegação atual indicada por acento e `aria-current="step"`; passos visitados mostram check. O progresso tem rótulo acessível; Escape fecha o menu e devolve o foco.
- A mudança de etapa leva o foco ao título. Erros usam alerta e associação ao campo. Campos e controles mantêm foco visível e os papéis de seleção do projeto.
- Feedback usa 120 ms; entrada de etapa, 180 ms com deslocamento de 4 px e `cubic-bezier(.2,.75,.25,1)`. Não há animação em cascata de controles.
- `prefers-reduced-motion` remove a entrada e reduz durações para 0,001 ms. A navegação continua imediata.

## Registro da revisão

A documentação foi reconciliada com `onboarding.js` e `onboarding.css` finais. A revisão independente do fluxo simplificado indicou entrega sem achados materiais. Este registro não representa nova execução de testes ou de navegador; capturas, verificações e limitações pertencem a [VALIDACAO.md](../../VALIDACAO.md).

A simplificação mantém a aplicação de produção, o repositório e as issues do GitHub fora do escopo desta entrega local.
