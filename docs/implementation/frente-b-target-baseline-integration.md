# Frente B — integração diagnóstica do baseline alvo

Recorte de Root em 16/10/2026: `inspectManagedTargetBaseline(env, dependencies)` no inspector existente e comando `inspect-target`, acessível pelo dispatcher como `restore-inspect-target`. Este documento e a QA dedicada são arquivos novos; não alteram os testes anteriores, protocolos, adapters ou runtime do inspector.

## Caminho integrado

A operação é exclusiva do alvo isolado autorizado. Valida a configuração de restore, prepara um diretório temporário exclusivo protegido e obtém um único snapshot target com `readNativeTargetSnapshot`. A sessão readonly/repeatable-read e seu dump nativo conservam os termos do [protocolo](frente-b-target-snapshot-protocol.md). O inspector não abre o archive da origem, não chama `encryptionSettings`, não acessa Storage HTTP e não altera a aplicação principal.

O dump retido em RAM passa por listagem original `--list --verbose`, preparação nominal B4 e cross-check binário completo B2. Os dois IDs originais das histórias alimentam o reader B3, com o mesmo orçamento absoluto. As quantidades de linhas B3 precisam coincidir individualmente com as duas contagens da transação exportadora. Divergência é `INSPECTION_SNAPSHOT_CHANGED`, não normalização ou aceitação por soma/count aproximado.

Depois de obter agregados, a operação reconfere os receipts e mantém os guards durante a limpeza assíncrona. Descarta o reader de histórias, o store B2 e o snapshot nativo, zerando as cópias emprestadas depois das últimas reconferências. Falhas originais tardias de listagem conservam prioridade sobre wrappers e limpeza; erro em cleanup não promove retorno parcial a sucesso. A remoção do diretório é não recursiva e recusa arquivo inesperado.

## Interface e limites

O comando é `inspect-target`, sem argumento de archive. O wrapper aceita `-Operation restore-inspect-target` sem `-Archive`; argumento inesperado é recusado. O perfil continua sendo o perfil separado de restore, sob seus controles existentes. Não são necessários `SC_BACKUP_ENCRYPTION_KEY` ou `SC_BACKUP_KEY_ID`; a configuração isolada de restore mantém seus requisitos atuais, inclusive as variáveis de Storage, embora essa operação não faça HTTP.

O dispatcher existente importa o perfil DPAPI completo e disponibiliza ao processo Node os campos permitidos que estiverem presentes, inclusive a chave independente de backup se o perfil a contiver. Este recorte não cria uma filtragem nova desse dispatcher nem afirma isolamento dessa chave no ambiente do Node. Os filhos PostgreSQL recebem somente o ambiente PG/OS selecionado pelo adapter; não recebem chaves de backup ou Supabase HTTP.

Sucesso contém somente formato, agregados do snapshot, modo do transporte, quantidades/encoding/bytes do TOC e quantidades/estados fechados de histórias. Portas injetadas continuam explicitamente `synthetic`; seu resultado não declara consulta real ao alvo. `remoteMutation`, `baselineCompared` e `restoreAccepted` permanecem false. Nenhum SQL, conteúdo, owner, nome, OID, identidade de conta, snapshot ID, dump ID ou ref de projeto é publicado.

A projeção de falha conserva operação, código fechado, fase, tentativa de conexão e diagnósticos nominais originais permitidos de snapshot/histórias/TOC. Não exporta texto de provedor ou exceção. O novo caminho não chama o comparador A2, não produz input de comparação para outro processo, não cunha capacidade e não autoriza importação. Uma inspeção real futura terá SHA/preparo/pins e evidência próprios; nenhuma execução nativa é afirmada aqui.

## QA dedicada

`tests/scripts/restore-target-baseline-inspect.test.mjs` usa os módulos reais do inspector, snapshot adapter, B4, B2 e B3, com filhos EventEmitter/PassThrough em RAM. Um PGDMP artificial e as duas histórias COPY foram escritos diretamente como vetores públicos; não há import de fixtures que execute outro teste ou leitura de material privado.

O filesystem real é usado somente para diretórios de fixture novos e exclusivos e sua limpeza. A proteção ACL do inspector recebe um filho RAM; nenhum PowerShell, psql, pg_dump ou pg_restore é iniciado. Toda exclusão da QA também é não recursiva, limitada ao pai criado e ao arquivo inesperado deliberadamente inserido por esse teste. O transporte HTTP global é substituído por uma recusa contada, restaurada ao fim da suíte.

Os controles cobrem caminho completo/fatos frozen/zeragem, ausência de archive/chave de backup, configuração inválida antes de IO, start não autorizado antes de dump, falhas de dump/COMMIT/TOC, escopo B4, divergência B2, quantidades B3 incompatíveis, falhas do parser e da limpeza, eventos originais tardios, prioridade da primeira falha e timeout absoluto que não aceita um término posterior. Uma asserção separada lê somente o dispatcher público para conferir a ausência de exigência de archive nessa operação.

Com semáforo exclusivo de Root, a primeira execução em Node 24.19.0 passou **15/15 testes**, sem skips/falhas, em 721 ms, usando `node --test --test-concurrency=1 tests/scripts/restore-target-baseline-inspect.test.mjs`. O lint desse `.mjs` passou com zero warnings em processo separado. Nenhum runtime de Root precisou ser editado para essa rodada; o semáforo foi devolvido depois. São controles sintéticos com filesystem de fixture exclusivo, não testes de PostgreSQL real, snapshot exportado, vazio remoto, comparação A2, restore, owners/grants, Auth/Storage/Cofre recuperados ou CI hospedado.

Root executou independentemente os 15 controles junto aos 12 do novo reader e aos 34 controles existentes do inspector: **61/61 PASS**, em 14,2 s, Node 24.19.0/concurrency1. O controle nativo separado de ACL foi excluído explicitamente dessa seleção; não é declarado aprovado por esta rodada. Lint dos quatro módulos/testes passou, e o teste PowerShell do dispatcher passou 26 controles, com 13 chamadas Node somente ao argv probe público, sem importar perfil ou executar operações remotas.
