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

## Candidato 7e5bad2 — checks próprios concluídos

O commit `7e5bad2f046d347044bd5b5d888119708c9f74b6`, árvore `143dd3876fc1075800536c3c1b70750d417bca7d`, encerrou os 16 runs originais com sucesso, sem rerun, cancelamento ou skip. Os dois gerais passaram Typecheck, lint, 212 arquivos/3.360 unidades em cada um dos dois fusos, 1.963 testes de scripts, 478 E2E, build, PWA e auditoria sem vulnerabilidades. Os quatro testes SQL antes falhos passaram nesta árvore; os resultados falhos anteriores permanecem registrados.

Os 14 envelopes nativos encerraram sem violações. A conferência das fontes vinculou 504 blobs Git próprios, sem drift, e 63 dependências observadas. Os gates de catálogo registraram 26 migrations/1.720 verificações. Os dois envelopes de Auth não oferecem manifesto por arquivo; seu vínculo é ao checkout e à mesma árvore, sem ampliar essa evidência.

As origens gerais são o run de PR `40051308256`, job `120744380872`, e o run de push `40051304175`, job `120744367892`, ambos attempt 1. A árvore do checkout sintético da PR foi conferida contra a árvore acima. A inspeção visual usará somente o artefato dessa origem de PR; sucesso do E2E não significa que as capturas já foram vistas.

O resultado qualifica os checks dessa árvore, não a concorrência terminal ainda em construção, upload de fotos, integração hospedada, restore ou ativação. Nenhum schema foi aplicado e merge/produção continuam bloqueados. Os Sources extraídos e demais WIPs posteriores precisam de CI próprio; não herdam os resultados de `7e5bad2`.

## Revisão das capturas próprias

O artefato `12544171441` da origem de PR acima teve seu ZIP de45.637.709 bytes conferido contra o digest `b851a2d92897e9e16915588b57fb93122ae3ac23afdbf12f54355c3941c919da`. Foram extraídas36 PNGs públicas, com assinatura, dimensões, limites e hashes conferidos; Root viu dez imagens, incluindo as quatro confirmações terminais mobile e amostras de editor, detalhe e cards.

**OBSERVADO:** as confirmações preservam textos e ações nos dois temas. Os títulos e o resumo compacto refletem o ajuste anterior. Em320px, a toolbar com valores ocultos comprime os rótulos dos botões ao lado do filtro. O novo delta acrescenta uma classe somente nessa toolbar e, abaixo de350px, reserva uma linha para o Field. Confirmações, handlers, ordem do DOM e alvos mínimos permanecem intactos. Há peer estático da aritmética; a próxima rodada deverá produzir a prova renderizada da correção. Não chamar esse novo delta de visualmente validado antes disso.
