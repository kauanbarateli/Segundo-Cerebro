# Decisões, adaptações e lacunas

Este registro separa instrução aprovada, evidência e recomendação. O escopo somente documental da auditoria é histórico; D-084 autorizou a implementação e validação do doc18 em26/10. As decisões D-080–083 permanecem preservadas; merge e produção continuam bloqueados.

## Confirmado

| ID local | Decisão / fonte | Consequência |
|---|---|---|
| A1 | Mantenedor: protótipo como objetivo visual principal; D-080 | Doc17snapshot de 303 arquivos é a referência exata de D:. Documentos antigos orientam contratos, não substituem composição atual. |
| A2 | D077 | MVP operacional, redesign, onboarding e landing; checkout/billing/abertura comercial posteriores. Não copiar preço/CTA de venda do demo agora. |
| A3 | D032 | Entrega Drive excluída. Analisar presença residual e planejar retirada de exposição; infraestrutura de imagens/legado preservada. |
| A4 | D078 | Restore pós-lançamento, sem aceite falso ou remoção de checks. Retenção onboarding continua no MVP. |
| A5 | D079 / auditoria de25–26/10 | A autorização somente documental e a pausa de execução eram o estado histórico; D084 superou essa pausa no recorte doc18. Não constitui autorização de corte. |
| A6 | Contratos atuais / thread protótipo | Reservas de Metas não viram despesas nem reduzem saldo; frequência de hábito não reescreve passado; vínculo não copia conteúdo. |
| A7 | D084 / retomada de26/10 | Implementação e validação autorizadas; preservar o protótipo e os contratos. Merge e produção aguardam revisão e aceites próprios. |

## Adaptações necessárias e recomendadas

- **Acessibilidade:** campos de 16 px e alvos de 44 px, foco, teclado e contraste nos fundos reais. O mock contém controles menores. Reproduzir hierarquia com hit area/reflow adequados; registrar qualquer mudança de proporção.
- **Mini calendário:** código usa seleção por linha semanal + data exata para acomodar 44 px; preservar ou apresentar alternativa igualmente acessível, nunca reduzir silenciosamente.
- **Privacidade:** iniciais de participantes sem foto externa arbitrária; Cofre só com fixtures em evidência; erros sem payload pessoal; PWA sem cache privado.
- **Dados extras reais:** manter filtros/categorias/análises/sessões/legais acessíveis em área secundária. Esta localização secundária é recomendação de encaixe, não elemento desenhado no demo.
- **Financeiro:** primeira fatia do Planejamento pode reutilizar comandos separados com resumo unificado. Submit de limite+várias categorias exigiria atomicidade/CAS/falhas parciais próprios, não autorizados por CSS.
- **Tarefas sem prazo:** não atribuir data artificial; D082 exclui sem prazo da aba Hoje. A ordem de itens sem prazo em outras vistas deve continuar explícita. Prioridade tem rank objetivo independente disso.
- **Galeria:** render real com massa sintética e metadados; não gerar imagens conceituais para provar produto.
- **Links/arquitetura:** manter rotas Next, associações explícitas e stores reais. Não copiar localStorage demo, window.App ou project_id fictício em Página.

## Escolhas respondidas pelo mantenedor

As três perguntas abaixo foram respondidas durante a auditoria e registradas como D-081–083. Sua redação preserva a escolha de produto; a implementação posterior segue D-084 e os saldos do [mapa de execução](03-execucao.md). As escolhas técnicas adotadas são registradas separadamente, sem atribuí-las a uma aprovação humana adicional.

| Tema | Recomendação | Alternativa / impacto | Trabalho independente |
|---|---|---|---|
| Status/prazo do Projeto — D081 | **Aprovado: manter apenas progresso das tarefas**, sem novos campos | Desvio do protótipo explicitamente aceito; não tratar progresso como status próprio | Ações adicionar/concluir tarefa, capa/contexto e layout existentes. |
| Aba Hoje — D082 | **Aprovado: abertas e concluídas com vencimento hoje**; atalhos do Início preservam intenção de abertas por filtro explícito | Definir compatibilidade de URL e negativos para arquivo/lixeira/sem prazo | Rank de prioridade, barra/tabs e compartilhamento Lista/Kanban. |
| Reveal no Cofre — D083 | **Aprovado planejar ação no detalhe**: client-only, máscara inicial, reocultar em lock/blur/visibility/seleção, sem logs | UI de detalhe e testes de máscara/ocultação implementados sob D084; revisão de segurança e aceite específico continuam em [#126](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126) | Geometria e estados sem conteúdo sensível; demais módulos. |

## Escolhas técnicas adotadas na implementação

| Tema | Comportamento preservado / fonte | Validação e limite |
|---|---|---|
| Paginação Tarefas | Lista conserva paginação de5itens via DataTable; Kanban usa o conjunto filtrado/ordenado compartilhado. [Workspace](../../../src/components/features/tarefas/tasks-workspace.tsx) e [DataTable](../../../src/components/ui/data-table.tsx). Não foi criada política de array ilimitado nem novo tamanho de página. | Preservar filtros, seleção/ordem e deep links na requalificação do candidato; diferenças de volume devem ser demonstradas antes de alterar a política existente. |
| Limpar formatação | A ação remove somente negrito, itálico, sublinhado, tachado e código da seleção, pelo [editor existente](../../../src/components/editor/document-editor.tsx). Conserva links, referências, imagens, blocos e undo, sem reset integral do documento. | Preview3a confirmou Limpar removendo negrito sem perder o HTTPS e Desfazer restaurando o negrito; [prova restrita](../../implementation/evidence/doc18-editor-fixes-3a-20261026.json). Esse recorte não certifica isoladamente todos os controles/marcas ou todas as combinações de documento. |

Os comportamentos acima já foram adotados; não são perguntas de implementação ainda em aberto. Alterações posteriores exigem registrar a divergência e seu impacto antes de mudar a política existente. Não criar novas políticas econômicas, classificação de dados antigos, escopos Google ou mudanças de criptografia para aproximar uma imagem.
