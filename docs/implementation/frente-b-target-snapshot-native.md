# Leitura nativa do snapshot do destino

Preparado por Root em 16/10/2026. Adapter explícito de leitura para o alvo pessoal isolado `jvwduowyavpaxssogadn`; não restaura, aplica migrations, consulta o source ou usa Storage HTTP. Importar o módulo não inicia IO. O protocolo puro e o comparador A2 são entregas independentes, sem autoridade de execução.

## Operação

`readNativeTargetSnapshot(options, originalScope, injectedPorts?)` mantém uma sessão psql em `REPEATABLE READ READ ONLY`, com comandos constantes do protocolo. O frame inicial só é aceito depois da validação de ator, RLS, censo completo e ausência de linhas em toda tabela ordinária não histórica. As duas histórias são as únicas exceções. O identificador exportado permanece privado em RAM.

Um único `pg_dump --format=custom --compress=gzip` importa o snapshot enquanto o psql exportador continua aberto. Os quatro schemas seguem as opções do backup original; não há `--no-owner`, `--no-acl`, exclusão silenciosa de objetos ou dump separado de histórias. A ausência de `app_private` é exigida pelo protocolo. O dump conserva definições, owners, grants, dependências e histórias; o TOC e B3 serão conferidos pelo inspector.

O cliente aceita somente conexão direta ou session pooler do alvo e porta 5432. Credenciais permanecem no ambiente exclusivo dos dois filhos PostgreSQL; nunca entram em argumentos, mensagens ou facts. Não há arquivo de senha, PGOPTIONS, herança livre do ambiente ou chave Supabase HTTP neste adapter. Root confere previamente o perfil DPAPI, certificado e executáveis por caminho, tamanho e hash no preparo operacional. Essa verificação de arquivos não equivale a atestação da imagem carregada, e o processo depende da integridade da mesma conta Windows.

O modo nativo exige Windows x64 e Node 24; qualquer porta injetada marca o receipt como `synthetic`. O adapter não é um qualificador de origem autenticada do archive e não faz mint de A1.

## Encerramento e ownership

O psql fica aberto até o dump apresentar seus eventos originais de spawn, EOF de stdout/stderr, exit zero e close zero. Só então Root envia a reconferência de modo, COMMIT de leitura, frame final e `\quit`. Psql também precisa dos dois callbacks de escrita, finish original de stdin, dois frames válidos, EOF de ambas as saídas e exit/close zero. Frame, ACK, pedido de kill ou close de pipe isolado não substituem esses terminais.

Os observers permanecem ativos depois do retorno. Erro, dados fora da fase, EOF/close duplicado ou saída tardia invalidam o receipt e zeram os buffers dedicados. Cada frame é limitado a 1 MiB, o dump a 64 MiB e stderr a 64 KiB por processo; limites são verificados antes de alocar cópias. Stderr não é exposto, e sucesso do processo continua obrigatório. Chunks originais recebidos e cópias temporárias são zerados, inclusive em recusas. Strings imutáveis de SQL/JSON e credenciais JavaScript não possuem garantia de sobrescrita física.

O prazo herdado é de no máximo 45 segundos para toda a sequência, sem renovação ou encerramento do scope de Root. Há reconferência depois do hash síncrono. Falha solicita cancelamento dos filhos e mantém os observers; isso não certifica que um processo recusado tenha terminado.

`nativeTargetSnapshotFacts(receipt)` confere o guard e a integridade do dump. `copyNativeTargetSnapshot(receipt)` entrega uma única cópia dedicada, também ligada ao guard: alteração da cópia invalida e apaga os buffers. Root mantém a cópia intacta até reconferir os guards depois do cleanup assíncrono, e só então chama `discardNativeTargetSnapshot`. O descarte é idempotente. Nenhum receipt, snapshot ID ou dump é serializado como prova reutilizável.

`nativeTargetSnapshotDiagnostic(error)` retorna apenas fase, modo, código fechado do parser confiável e contadores/terminais dos dois produtores. Não lê message/cause do provedor, não publica SQL, OIDs, nomes, nonce, snapshot ou conteúdo das saídas.

## Testes e limites

Root executou inicialmente 8/9 controles RAM; a única falha era uma asserção que esperava PRODUCER_FAILED para um erro original de stdin, cujo código específico é INPUT_FAILED. Ajustada somente a expectativa, passaram 9/9. O peer encontrou quatro melhorias de implementação: zeragem dos chunks originais e quota anterior à cópia; close duplicado sticky; recusa imediata de prefixo extra depois do frame inicial; reconferência após o SHA. Root corrigiu o código e acrescentou regressões. Passaram **12/12 controles RAM**, sem skips, em Node 24.19.0/concurrency1, além de lint dos dois arquivos sem warnings.

Os controles incluem sequência exata dos dois processos, terminal original ausente ou inválido, recusa antes de dump para alvo não vazio/ator/RLS, deadline, fases, callback/finish, COMMIT inválido, eventos tardios, integridade/zeragem da cópia, fechamento duplicado, limites e isolamento de credenciais. O peer reconferiu os quatro reparos e a integração em fonte. Isso não executa SQL nem qualifica um dump real.

Contagens em um snapshot não garantem que o banco continuará vazio depois de fechá-lo. DDL concorrente possui limitações próprias do PostgreSQL; usar o alvo isolado e recusar inconsistências. A futura importação exige sua própria reconferência de vazio, ator e permissões. Este adapter não autoriza a sétima importação.

## Referências

- [PostgreSQL 18 — pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html): CUSTOM, seleção de schemas e importação de snapshot.
- [PostgreSQL 18 — sincronização de snapshots](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION): o snapshot exportado precisa da transação exportadora aberta.
- [PG18.4 — stdout CUSTOM binário](https://github.com/postgres/postgres/blob/REL_18_4/src/bin/pg_dump/pg_backup_archiver.c): `_allocAH` seleciona O_BINARY para archive não textual enviado a stdout no Windows. O helper B3 de 20 MiB não foi ampliado.
