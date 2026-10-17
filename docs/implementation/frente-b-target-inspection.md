# Inventário nominal de inspeção do alvo

Este pacote observa HEADER+TOC de bytes em RAM. Não conecta, executa SQL ou processos, lê perfil/archive, autentica, declara vazio, compara A2, extrai COPY/B3, seleciona replay ou cria capacidade de restore. Foi preparado após Root relatar que a inspeção v3 encerrada recusou na categoria FUNCTION/app. A identidade da função real não foi inferida e nenhuma captura encerrada foi reaberta.

## Entradas e fronteiras

A API nova do planner é planManagedTargetInspection(tocText, binding), seguida de managedTargetInspectionRequirements(handle). O binding conserva o shape target fechado já existente: projectRef, databaseName=postgres, nativeDumpSha256 e nativeDumpBytes. Nomes/hashes/tamanhos são correlação; não provam produtor, projeto autorizado, autenticidade ou ausência de dados. Root mantém essas comprovações nativas e o prazo fora deste módulo.

O parser verbose é o mesmo, com seus headers, producer PG18, gramática limitada, IDs/OIDs, ordem/multiplicidade das dependências, veto a self-edge e a dependência ausente. Aplicam-se os tetos B4 de32MiB de texto,10.000 entradas e100.000 referências antes de expandir vetores. O conjunto continua nas24 classes já aceitas por B2. Classe desconhecida ou fora dessas24 recusa.

Diferentemente de qualificar um baseline, a observação não filtra namespace, app DDL, ACL, comentário ou customização. Todas as linhas originais entram no inventário exatamente uma vez, sem decidir quais seriam aceitas para importação. Até um inventário artificial que contenha app_private, metadados de outro namespace, dados ou omita histórias continua sendo somente observação. O vazio/snapshot/escopo real permanece gate separado de Root; o perfil operacional NativeSnapshot existente não foi modificado.

O handle público congelado contém somente version=1, inspectionOnly=true, baselineQualified=false e é registrado em targetInspections, um WeakMap diferente de Source, autorizações e B4. O getter privado devolve binding.side=target-inspection, records completos da listagem e os mesmos dois indicadores. Não há selected, preserved, segmentos ou seleção de importação. O getter rejeita clone, JSON, Proxy e handles dos outros tipos.

## Leitura binária reutilizada

extractCustomTargetInspectionToc(inspectionPlan, databaseBytes) obtém requisitos exclusivamente pelo getter nominal novo antes de olhar o database. Reutiliza extractToc privado, recebendo como destino somente a constante interna targetInspectionTocs. Não recebe modo, callback, mapa ou origem de caller. Nenhum handle intermediário aceito por Source/B4/B3 é criado ou exposto.

Mantêm-se o header CUSTOM1.16-0/int4/off8/GZIP, encoding UTF8 original, limites de dump64MiB/TOC32MiB/campo4MiB,24classes, tuple do produtor, seção/relkind/offsets, IDs/OIDs uint32, strings e todas as dependências. O cross-check cobre integralmente records da listagem; não usa lista de nomes candidatos, count esperado ou filtro por source. Todas as definições, owner/ACL, drop/copy, namespace/tag, tablespace/accessMethod e campos restantes ficam em bytes originais. NULL e vazio não se confundem. Não se normaliza SQL, CRLF, corpo, permissões ou grafo.

O handle binário público mantém inspectionOnly=true/baselineQualified=false. customTargetInspectionTocFacts retorna fatos privados com binding, format, header, encoding, tocEndOffset e TODOS os records, sem preserved/selected. ByteStrings são views de um store dedicado ao header/TOC; não apontam para o dump emprestado nem incluem DATA blocks. O digest do binding lê os bytes integrais do dump, mas os blocos DATA não são interpretados, descomprimidos, executados ou tratados como prova de vazio.

## Integridade e descarte

O mapa targetInspectionTocs não é aceito por customArchiveTocFacts, B3/migrationHistoryCopySelection, getter Source, B4, authorizer ou claim/mint. Os getters antigos não recebem flags de fallback. A lógica interna de getters/descarte é compartilhada, mas cada entrada escolhe seu próprio mapa constante.

Cada getter reconfere o store e seu digest. Alteração dos bytes invalida o handle e zera o store acessível. Buffer transferido/destacado recusa; não existe garantia de apagar uma cópia ou backing store transferido para fora pelo caller. Root não faz essa transferência. discardCustomTargetInspectionToc é total/idempotente, zera antes de invalidar e não apaga bytes do caller, stores irmãos ou handles Source/B4. O descarte de outro tipo não tem efeito.

Os novos erros nominais são RESTORE_MANAGED_TARGET_INSPECTION_REQUIRED/UNSUPPORTED e RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED. Demais recusas de binding, limites, formato, grafo, integridade e descarte conservam os códigos existentes. Nenhum erro retém nome, tag, SQL ou conteúdo do inventário. inspectionOnly e baselineQualified são documentação visível; apenas a identidade no WeakMap permite acessar o tipo nominal, não campos copiados.

## Próximo gate separado

A inspeção não modifica planManagedTargetBaseline nem sua recusa de app DDL. Source continua classificando entradas como antes. Para qualificar infraestrutura pública, Root ainda precisa comparar TODOS os DDL app do alvo a registros completos do source autenticado, incluindo owner/ACL, ByteStrings e fechamento das dependências; diferenças não podem ser apagadas para conseguir PASS. A estratégia de preservar/reproduzir esses objetos no plano exige decisão própria e não é criada por este inventário.

Root adaptará uma operação CLI própria e um preparo novo depois de revisão. Preparos target v1/v2/v3 e respectivas capturas permanecem encerrados. Não se reutiliza qualquer resultado anterior como aceite desta API e não se inicia operação real por import/help da biblioteca.


## Validação própria

Em Node 24.19.0, concurrency1 e processos seriais, passaram novo inventário15/15 (178ms), B2antigo13/13 (379ms) e B4baseline15/15 (214ms):43/43, zero skips/falhas. ESLint dos dois módulos e do QA novo passou com zero warnings. Root atualizou separadamente apenas as asserções de superfície do QA antigo para os8exports/12códigos aprovados.

A primeira rodada nova teve14/15 PASS: um vetor trocava o dumpId de uma função referenciada e B2 recusava corretamente a dependência ausente antes do cross-check de listagem. Ajustada somente essa fixture para trocar ID sem dependentes, o vetor original permaneceu com expectativa INVALID explícita. Nenhum módulo foi relaxado para fazer a QA passar. Os resultados são somente RAM/fonte pública, não execução nativa, inspeção de banco ou aceite hospedado.