# T-054 — validação dos candidatos de recuperação terminal

As evidências abaixo pertencem aos SHAs indicados. Merge, produção, aplicação de schema e ativação permanecem bloqueados. Este documento não substitui o resultado próprio de um candidato posterior.

## Candidato 01ae6a7

O primeiro original da PR #120 encerrou 16 runs: 14 PASS e dois Typecheck FAIL pelo TS2339 em `goal-image-picker-model.test.ts`. Os gerais pararam antes de unidades, build e E2E. Os 14 envelopes nativos encerraram sem violações, com 504 blobs próprios sem drift, 63 dependências observadas e catálogo 26/1.720. Auth mantém a ressalva de não fornecer manifesto por arquivo.

A correção capturou `candidate` depois do guard discriminado, antes do callback que tenta mutá-lo. O objeto, a tentativa de mutação e a asserção de erro foram preservados. Nenhum cast ou relaxamento de teste.

## Candidato a560bd1

União de M2-S, M2-B, M2-U, correção de Typecheck e onze casos de tela. Os dois gerais passaram Typecheck e executaram o primeiro fuso de unidades: 210 arquivos/3.356 testes aprovados, dois arquivos/quatro testes falhos. A falha comum é `syntax error at end of input` durante os casos de instalação/composição terminal. Segundo fuso, scripts, build, E2E e capturas não foram alcançados nesses gerais.

Os logs não informam posição, query ou fase pública suficiente para identificar isoladamente uma linha. Portanto, não atribuir a instalação completa a um PASS de catálogo de outro gate nem declarar a causa reproduzida localmente.

## Correção restrita de sintaxe para novo candidato

A verificação inicial da proposta SQL contém duas expressões CASE sem agrupamento dentro de IF. A leitura da [gramática PostgreSQL 17](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/pl/plpgsql/src/pl_gram.y#L2558-L2575) e da [gramática PostgreSQL 18](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/pl/plpgsql/src/pl_gram.y#L2630-L2647) mostra que a condição termina em THEN no nível zero de parênteses. O THEN interno do CASE não agrupado é compatível com o corte observado. A correção acrescenta apenas quatro caracteres, agrupando os dois CASE; mantém comparações, branches, valores, hashes de pré-requisitos e critérios de recusa.

Uma reversão textual desses quatro caracteres reproduz integralmente o SHA anterior `d1bcb2213d69ad4135fb6cce171868b5a70f6447027b5548511c5cf26c7b5f1b`. A proposta corrigida tem SHA `7fb8c48baf6a308e46ae5c7eef537670d6008009668a7b90e0a57cfc11d3843c`; o helper recebe somente esse novo pin dos bytes públicos revisados. Não é um pin derivado de banco nem remoção de guarda.

O lint focal e o diff check passaram. Os quatro testes e suas asserções permanecem; serão a regressão efetiva do novo candidato no GitHub. A inspeção de fonte não equivale a testes SQL aprovados. Nenhuma migration histórica, banco ou configuração foi alterada por esta correção.

## Continuação independente

A escolha de foto ainda precisa de upload durável e vínculo financeiro. A prova de concorrência nativa commit/settle e a preservação do fence na recuperação continuam entregas próprias. Essas frentes seguem em worktrees separados enquanto o CI é diagnosticado; não promovem a interface nem alteram o projeto hospedado.
