# Leitor do catálogo binário e inspeção explícita — 16/10/2026

O recorte B2 original lê os campos do HEADER e do TOC CUSTOM 1.16-0/4/8/GZIP, usando o mesmo database associado ao plano genuíno. Não interpreta DATA, descompacta, executa SQL, compara o alvo ou emite capacidade. A observação nativa do SHA `e542389` abrange exclusivamente archive. A evolução [B4](frente-b-target-baseline.md) acrescenta planner e entrada nominal target separados, sem afrouxar os gates do source; `inspect-toc` continua exclusivamente archive.

O parser conserva todos os campos, bytes, NULL/vazio, ordem das entradas e multiplicidade das dependências. Depois de qualificar o ENCODING ASCII original, valida UTF8 de todos os spans. Cruza toda a enumeração contra os IDs, ambos os OIDs, classes, namespace, tag, owner e vetores completos de dependências da listagem nativa. Esse cruzamento não compara definições SQL com a listagem, pois ela não as contém.

A matriz explícita de PG18.4 recusa combinações conhecidas impossíveis de classe/seção/relkind/dumper. FUNCTION admite PRE/POST; TABLE admite p/r; VIEW exige v; INDEX e SEQUENCE têm relkind zero no produtor aceito. Os estados e offsets seguem o custom writer pinado, com posição conhecida somente depois do TOC e dentro do archive. Fontes oficiais e hashes estão no módulo, incluindo pg_dump_sort.c.

## Propriedade e limites

O handle nominal é privado e opaco. Um único store dedicado retém apenas HEADER+TOC, sem aliases do database original. Cada getter revalida seu digest; alteração/transferência invalida o handle, e descarte zera somente o store que ainda possui. Não promete apagar clones ou stores transferidos externamente.

Tetos: database 64 MiB, TOC 32 MiB, campo 4 MiB, 10.000 entradas e 100.000 dependências. B2 original usa dez códigos fechados; B4 acrescenta `RESTORE_CUSTOM_TOC_TARGET_REQUIRED`, totalizando 11 sem alterar os anteriores. Nenhum SQL, nome privado, owner, ID ou header original integra a saída de diagnóstico.

## Ligação ao inspector

O novo comando explícito `inspect-toc`, pelo dispatcher `restore-inspect-toc`, exige primeiro autenticação completa de todos os registros/footer/manifest/EOF, reconferência do ciphertext, EOF+close0 da listagem nativa e planejamento. Só então extrai o catálogo e retorna contagens/formato/encoding/tamanho. O finally descarta o handle e apaga os buffers; uma falha de limpeza veta o retorno sem substituir uma primeira falha.

`inspect`, `inspect-format` e help conservam seus caminhos e schemas. Não há mint, entrada de importação, consulta ao alvo ou mudança de migrations neste recorte. Histórias e comparador A2 continuam separados; extrair não qualifica o baseline.

## Validação própria

O autor passou 13/13 grupos de contratos e lint2 no B2 final. A primeira rodada anterior teve 10/11: a fixture alterava um ID referenciado e atingia antes o veto de aresta ausente; foi corrigida para exercitar realmente o cross-check. O lint anterior encontrou somente uma regra no probe de wipe sintético; o código de produção não foi relaxado para satisfazê-la.

Root passou **48/48** na combinação header/B2/inspector, em Node 24.19.0, `--test-concurrency=1`, e lint4. O teste ACL nativo preexistente foi explicitamente excluído dessa execução; não se atribui aceite a ele. O dispatcher passou **22/22** controles, com 11 chamadas Node de argv sintético, sem carregar perfis. Um peer independente revisou a ligação e os gates sem bloqueador. Esses resultados são locais e não certificam restore ou a próxima inspeção real.

No ponto de preparação acima, a primeira operação nativa deste modo ainda dependia de commit/pins, revisão do roteiro e execução única pelo perfil autorizado. A observação posterior tem seu registro próprio abaixo. Nenhuma importação ou consulta ao alvo foi realizada por este recorte.

## Observação nativa posterior

A [observação confirmada de 16/10 às 22:05:01 UTC](evidence/restore-custom-toc-native-20261016.json), fonte `e542389617f9881c6b131e8c70974f43bb9ee2b6`, aprovou o cruzamento do HEADER+TOC binário com a listagem nativa: 1.332 entradas, 350 preservadas, UTF8 e 876.752 bytes de HEADER+TOC. O plano conservou 982 selecionadas e cinco segmentos. Backup integralmente autenticado, sem query ao destino, DATA/histórias, mint ou importação.

O preparo operacional v3 passou 14 controles puros e seis controles públicos de processo tanto pelo autor quanto por Root, além de peer de fonte. As recusas anteriores e o resultado indeterminado da v2 permanecem registrados na evidência; o sucesso não lhes é atribuído. B4 altera posteriormente os pins de planner/B2: os preparos antigos são históricos e não devem ser reutilizados sem nova revisão.
