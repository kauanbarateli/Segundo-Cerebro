# Financeiro — revisão independente

## disposition

**Aprovado para entrega do protótipo local após as correções verificadas.** Não restam achados materiais desta revisão. A superfície mantém o modo Operate, a identidade do Segundo Cérebro e a composição solicitada. Esta é a revisão independente de design, acessibilidade e fluxos; a validação extensa de cálculos e persistência é responsabilidade do conjunto de testes do agente principal.

## material findings

Os quatro achados reproduzidos foram corrigidos durante a revisão:

1. **P1 — recorrências preenchidas expandiam a página no celular.** Após criar uma recorrência, a largura global chegava a 604/608 px em telas de 320/390 px. A primeira correção conteve a grade, mas um rótulo `.life-sr` absoluto do cabeçalho da tabela ainda escapava de sua região de rolagem, produzindo 555/557 px. `minmax(0,1fr)`, `min-width:0` e `position:relative` no contêiner resolveram as duas causas. Nova execução: largura do documento igual à viewport em 320, 390, 768, 1024 e 1440 px, com a recorrência criada.
2. **P2 — troca de conteúdo em diálogo aberto perdia o foco.** Meta → Editar meta e Fatura → Registrar pagamento deixavam `activeElement` no body. O helper financeiro agora preserva a origem externa e foca o primeiro campo apropriado. Revalidado: `#fg-title` e `#fc-pay-amount` recebem foco; Escape retorna ao controle da meta. Alternar uma recorrência e fechar o seletor de período também preservam o foco.
3. **P2 — recuperação de erro citava opção inexistente.** Uma data futura confirmada instruía escolher “Em aberto”, mas o campo contém “Pendente”. A mensagem agora corresponde ao controle e foi revalidada pelo formulário.
4. **P2 — bordas de campos rápidos tinham contraste insuficiente.** `line-strong` produzia aproximadamente 1,5:1. Os campos agora usam `control-line` do DS: 6,21:1 no claro e 6,74:1 no escuro contra a respectiva superfície. Nenhuma nova cor foi necessária.

Os problemas iniciais de margem padrão de `dl`, tamanho do gráfico móvel e grade vazia em 320 px já estavam sob correção do agente principal; não são apresentados novamente como bloqueios.

## fidelity

A referência de nove telas foi preservada em seus elementos centrais: resumo horizontal, entrada rápida, fluxo acumulado com limite mensal, lançamentos recentes, meta com fotografia, cartões e recorrências. Os detalhes de lançamento, cartão/fatura, recorrência, aporte, limite e período estão reconhecíveis e acessíveis por controles explícitos.

O protótipo traduz a composição para o DS 2.1: Geist, neutros quentes, ação principal monocromática e verde semântico. Não há identidade nova. O gráfico usa os registros existentes, por isso tem um salto no salário, e a lista começa com um cartão; essas diferenças são coerentes com a veracidade do modelo, sem inventar saldos para reproduzir a imagem. A meta permite escolher, trocar e remover uma imagem opcional através do componente de mídia compartilhado.

A versão móvel organiza os blocos em uma coluna, mantém os saldos legíveis e oferece rolagem local nas tabelas densas. As abas também permitem rolagem local em 320 px. A fotografia permanece subordinada à meta, com texto fora da imagem. A tela é mais espaçosa que a referência, mas mantém sua hierarquia operacional.

## craft-floor

- **Contraste:** texto secundário medido em 6,50:1 no claro e 8,43:1 no escuro; verde de sucesso em 5,68:1 e 6,74:1. Placeholder e bordas dos controles seguem `control-line`; estados selecionados usam tokens de tinta/acento. O cinza intermediário das primeiras capturas escuras era transição de tema: estado computado e lote final usam canvas `#0d0d0c` e superfície `#161615`.
- **Composição e tipo:** hierarquia de página, painel, valor e metadado consistente; números tabulares; gráfico móvel próprio com texto efetivo de aproximadamente 13 px em 320 px. Sem overflow global nos cinco tamanhos revalidados. Tabelas maiores mantêm região de rolagem identificada e focável.
- **Interação e estados:** controles nomeados, labels associados, erro com `role=alert`, retorno de foco e Escape, tabela alternativa ao gráfico, estado vazio de recorrências e resumo de aporte antes de salvar. Formulários de imagem explicitam que o arquivo permanece no navegador. Ícones seguem o sistema SVG existente.
- **Movimento e superfícies:** animações discretas com redução de movimento; foco visível; nenhuma sombra decorativa, tipografia ornamental ou cor externa ao DS introduzida no módulo. A estrutura de cartões é justificada pela referência e pela separação das tarefas financeiras.
- **Detector:** consultei o resultado único produzido pelo agente principal somente após minha avaliação visual e funcional. Zero achados primários e sete avisos no momento da execução. Os valores de popover, gráfico e título numérico apontados foram ajustados; pequenos raios locais restantes não mudam a identidade nem bloqueiam o fluxo. Não executei detector adicional.

## evidence

- Fontes: `direction.md`, `DESIGN.md` e `PRODUCT.md` (arquivos na raiz do protótipo), `references/finance-nine-screens.png`, `finance.js/css`, `finance-model.js`, `finance-cards.js/css`, `finance-goals.js/css`, `index.html` e integração em `life.js`.
- Inspeção visual: capturas fornecidas dos lotes 1 e 2, incluindo visão geral desktop claro/escuro, celular 390/320, lançamento, fatura, editor de meta e recorrência móvel. O lote 2 confirma o tema estável e a tipografia móvel; ajustes finais de borda e contenção foram revalidados numericamente.
- Execução independente: `review-check.cjs`, Edge headless isolado, contexto offline e arquivo local. Não houve alteração da implementação nem acesso à sessão pessoal do navegador. A primeira tentativa foi impedida pelo sandbox do processo; a execução aprovada subsequente completou normalmente.
- Registro reproduzível: `review-evidence.json`. Zero erros JavaScript. Documento/viewport: 320/320, 390/390, 768/768, 1024/1024 e 1440/1440 após adicionar e pausar recorrência. A prova anterior por estilo temporário identificou o containing block do rótulo acessível; na execução final, a largura já era correta antes desse estilo de diagnóstico.
- Artefato do detector: `detector.json`, emitido pelo agente principal. Nenhuma captura nova foi criada por esta revisão. Nenhum servidor de desenvolvimento foi iniciado; o navegador isolado foi encerrado.

Questions skipped: revisão delegada de uma implementação já autorizada; não há decisão pendente do usuário.
