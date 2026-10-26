# Decisões, adaptações e lacunas

Este registro separa instrução aprovada, evidência e recomendação. Não autoriza implementação nesta etapa.

## Confirmado

| ID local | Decisão / fonte | Consequência |
|---|---|---|
| A1 | Mantenedor: protótipo como objetivo visual principal; D-080 | Doc17snapshot de 303 arquivos é a referência exata de D:. Documentos antigos orientam contratos, não substituem composição atual. |
| A2 | D077 | MVP operacional, redesign, onboarding e landing; checkout/billing/abertura comercial posteriores. Não copiar preço/CTA de venda do demo agora. |
| A3 | D032 | Entrega Drive excluída. Analisar presença residual e planejar retirada de exposição; infraestrutura de imagens/legado preservada. |
| A4 | D078 | Restore pós-lançamento, sem aceite falso ou remoção de checks. Retenção onboarding continua no MVP. |
| A5 | D079 + pedido atual | Nova autorização somente para investigação, documentos e issues; execução pausada, sem migrations/merge/deploy. |
| A6 | Contratos atuais / thread protótipo | Reservas de Metas não viram despesas nem reduzem saldo; frequência de hábito não reescreve passado; vínculo não copia conteúdo. |

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

As três primeiras perguntas foram respondidas durante a auditoria e registradas como D-081–083. As escolhas técnicas restantes não bloqueiam as correções independentes.

| Tema | Recomendação | Alternativa / impacto | Trabalho independente |
|---|---|---|---|
| Status/prazo do Projeto — D081 | **Aprovado: manter apenas progresso das tarefas**, sem novos campos | Desvio do protótipo explicitamente aceito; não tratar progresso como status próprio | Ações adicionar/concluir tarefa, capa/contexto e layout existentes. |
| Aba Hoje — D082 | **Aprovado: abertas e concluídas com vencimento hoje**; atalhos do Início preservam intenção de abertas por filtro explícito | Definir compatibilidade de URL e negativos para arquivo/lixeira/sem prazo | Rank de prioridade, barra/tabs e compartilhamento Lista/Kanban. |
| Reveal no Cofre — D083 | **Aprovado planejar ação no detalhe**: client-only, máscara inicial, reocultar em lock/blur/visibility/seleção, sem logs | Não dispensa revisão de segurança; implementação futura em [#126](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126) | Geometria e estados sem conteúdo sensível; demais módulos. |
| Paginação Tarefas | Preservar paginação atual inicialmente; decidir tamanho/mais itens ao comparar massa equivalente | Remover paginação prejudica volume; não copiar array ilimitado do demo | Filtros/rank e layout. |
| Limpar formatação | Especificar marcas/blocos afetados, conservando links/imagens/referências/metadados e undo | Reset integral destruiria conteúdo; não aceitável por inferência | Agrupamento/ícones/estilo de bloco e leitura. |

Paginação e limpeza de formatação são escolhas técnicas que a frente deve registrar antes de alterar comportamento. Não criar novas políticas econômicas, classificação de dados antigos, escopos Google ou mudanças de criptografia para aproximar uma imagem.
