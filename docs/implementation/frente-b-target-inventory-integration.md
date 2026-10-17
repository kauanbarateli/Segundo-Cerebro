# Inventário completo do alvo, sem qualificação de baseline

## Escopo

A API `inspectManagedTargetInventory(env, dependencies)` e a CLI `inspect-target-inventory` acrescentam uma observação completa do alvo. O dispatcher `restore-inspect-target-inventory` recebe somente o perfil de alvo e o executável Node; um argumento `Archive` é recusado. Nenhum backup de origem, chave de backup, Storage HTTP, importação, replay, comparação A2 ou mint é solicitado por essa operação.

O objetivo é observar metadados que o perfil estreito B4 recusa, inclusive uma FUNCTION pública com assinatura completa, ACL e DEFAULT ACL. A nova operação não transfere essas entradas para uma categoria ignorada nem altera as regras de baseline. `inspectManagedTargetBaseline` e `inspect-target` continuam usando o perfil B4 original; o mesmo vetor de teste com os três metadados públicos permanece recusado nessa operação.

## Composição e autoridade

As duas APIs chamam um núcleo privado compartilhado, com uma escolha literal fixada por cada wrapper. Não existe escolha de modo pelo ambiente ou por `dependencies`. A configuração de alvo continua exigindo o projeto de ensaio isolado e o perfil PostgreSQL permitido. Os gates de sessão somente leitura, repeatable read, RLS, catálogo completo e ausência de dados fora das duas tabelas de histórico permanecem anteriores ao dump.

O inventário usa um único scope herdado de até 45 segundos, incluindo diretório privado, snapshot nativo, dump e listagem original. O dump é obtido de `readNativeTargetSnapshot`; a sessão exportadora, o COMMIT, o stdout original e o encerramento dos processos são conferidos pelo adapter existente. A listagem mantém `pg_restore --list --verbose`, stdin separado em RAM, stdout EOF e close zero originais, com o guard persistente de primeira falha.

Depois da listagem, a operação chama somente:

1. `planManagedTargetInspection(text, binding)`, com o hash e os bytes do dump original;
2. `managedTargetInspectionRequirements` no handle nominal de inspeção;
3. `extractCustomTargetInspectionToc` para cruzar todas as entradas da listagem com o TOC binário;
4. `customTargetInspectionTocFacts` no namespace exclusivo da inspeção;
5. `diagnosticInventory(text)` para uma projeção pública de contagens e enums.

Os stores de inspeção são distintos dos stores de Source/B4. Não há conjunto `preserved` ou `selected`, handle B3, capacidade de uso único ou resultado A2. Clones, handles de baseline usados como inspeção e handles de inspeção usados como baseline são recusados pelas APIs nominais. O descarte de um namespace não descarta ou aceita um handle do outro.

O inventário público só é retornado quando os headers são válidos, `unknownClassCount` e `malformedRowCount` são zero e a contagem da projeção corresponde ao conjunto binário completo. Classes ou formatos não suportados continuam recusados; o diagnóstico não alarga o parser.

## Saída e descarte

A saída contém `format`, `snapshot`, `transportMode`, `customToc` com `entries`, `encoding` e `tocBytes`, e `inventory` com a projeção fechada já existente. O snapshot contém contagens e flags permitidas; a projeção usa somente enums públicos de classe, categoria de escopo e forma da cauda. Não retorna nome, owner, assinatura, OID, token, path, credencial, SQL ou conteúdo das tabelas.

As flags são fixas: `inspectionOnly=true`, `baselineQualified=false`, `baselineCompared=false` e `restoreAccepted=false`. O envelope CLI informa `remoteMutation=false`. Portas artificiais permanecem `transportMode=synthetic` e `targetQueried=false`. `ok=true` indica somente que essa inspeção terminou; não é aceite de restore ou de aplicação.

As contagens de linhas das duas tabelas de histórico vêm do snapshot. Esta operação não extrai nem qualifica o conteúdo dos históricos e não publica `migrationHistory`. A ausência do B3 não pode ser usada como prova de igualdade dessas linhas.

Os handles nominais de inspeção, o receipt nativo e o guard da listagem permanecem vivos durante a remoção assíncrona do diretório exclusivo. São reconferidos depois do cleanup e antes da zeragem do dump/listagem em RAM. Os stores B2 são zerados pelo descarte específico de inspeção. A primeira recusa original tem prioridade; cleanup sem prova não publica agregados parciais. A remoção continua não recursiva e recusa arquivos inesperados ou mudança de identidade do diretório.

## Validação

Foram preparados controles novos em `tests/scripts/restore-target-inventory-inspect.test.mjs`, sem alterar os testes de baseline. Os vetores públicos usam somente diretórios exclusivos artificiais e processos simulados por EventEmitter/streams em RAM, com `fetch` proibido. Os controles incluem o vetor completo FUNCTION/ACL/DEFAULT ACL, namespaces nominais, descarte, assinatura binária trocada, gates anteriores ao dump, erros originais tardios, limpeza, prazo absoluto e argv sem archive.

O teste PowerShell do dispatcher foi ampliado para conferir o argumento único `inspect-target-inventory` e a recusa de `Archive`. Ele executa somente as expressões públicas de seleção e o probe local de argv; não carrega perfis nem conecta ao banco.

QA própria serial em Node 24: **15/15 PASS**, zero skips, `920,6007 ms`, na primeira rodada. A suíte de integração de baseline existente passou **15/15**, `797,8538 ms`; lint dos dois `.mjs` passou sem warnings. O controle PowerShell público do dispatcher passou **28** casos, com **14** chamadas sintéticas ao probe de argv, `profilesRead=false` e `remoteExecuted=false`. Foram executados um processo por vez, após liberação do semáforo de Root.

Não foi executada inspeção real, e nenhum resultado sintético constitui aceite nativo. Root deve revisar o delta e os pins finais antes de publicar e preparar qualquer nova operação real. Preparos e capturas anteriores permanecem preservados.

Na primeira conferência combinada de Root, houve **57/58 PASS** e uma falha `EEXIST` na fixture nova: duas invocações compartilhavam o mesmo diretório artificial e a segunda podia selecionar o diretório residual da primeira. A fixture passou a guardar o conjunto de diretórios anteriores à invocação e selecionar exatamente um novo diretório antes do `writeFile` exclusivo. Nenhum comportamento de cleanup de produção foi alterado ou relaxado.

Depois da correção, Root executou sete arquivos em série: **136/136 PASS**, zero skips, com o filtro excluindo somente o controle de ACL nativo separado. Esse controle excluído não foi validado nesta rodada. Lint dos seis arquivos passou e o dispatcher foi reconferido em **28** casos/**14** chamadas sintéticas, sem perfil ou execução remota. O peer independente aprovou a fonte e a correção da fixture. Essa evidência substitui a rodada isolada como referência final desta integração; os resultados anteriores ficam registrados para rastreabilidade.
