# Frente B — checkpoint próprio 503f00d, 12/10/2026

**BLOCK passou integralmente, com limpeza confirmada. FIRST e Recovery continuam sem aceite de encerramento.** A [projeção pública fechada](evidence/frente-b-native-503f00d-20261012.json) corresponde às capturas próprias dos novos eventos push de `503f00df7a60e2330f28ebef80faab3c76a61a3a`, uma vez por run após Root e peer. Os arquivos privados raw/status/report permanecem fechados. Não atribuir a variação dos resultados ao novo observador.

## Casos nativos próprios

- [Admin 38317185500/1](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38317185500), job `115036494341`: BLOCK completou os 12 estágios, incluindo inventário, revogação, limpeza e contextos fechados. Duas fixtures criadas/excluídas, duas leituras de ausência, uma revogação e uma sessão já revogada; zero pendências e incerteza false. O worker saiu com zero e a infraestrutura confirmou I/O quieto, namespace e diretórios privados removidos.
- FIRST executou 13 estágios até `actor-intact`, incluindo login forçado, negação de páginas/APIs, troca de senha e sessões próprias — duas RPCs, três visões e um reload. Conservou quatro requests pendentes após blank, com detalhes mistos e `QUIESCENCE_HTTP_DETAILS_MIXED_PENDING`. Limpeza zero, escrita incerta e infraestrutura incompleta; o resultado geral Admin é failed.
- [Recovery 38317185570/1](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38317185570), job `115036494550`: sete estágios até `credentials-changed`, cinco scripts pendentes em full e `QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING`. O caso manteve incerteza false e o runner true; limpeza zero e infraestrutura incompleta.

Os dois runs aplicaram 19 migrations e fizeram 1.269 checks somente nos ambientes descartáveis de CI. As fontes declaradas 348/50 e 192/50 corresponderam, sem alegação de representar todo código executado ou de certificar produção.

## O que o novo diagnóstico distingue

FIRST e Recovery observaram `identity=exact-server-request`, `managerEntry=same-request` e `sessionRegistered=registered`, sem terminal de protocolo ou público observado. Isso contraria a hipótese de sessão removida **no instante desses snapshots**. Não determina a causa física, ordem de eventos anteriores ou EOF; ACK de rota continua sem autoridade para retirar pendências.

A investigação deve se concentrar no ramo ainda registrado, preservando os 15 segundos absolutos, os eventos terminais reais, a primeira falha e o veto de limpeza. Nenhum Map, handler ou sessão foi alterado pelo observador. #21/#24/#37 permanecem abertas para seus critérios restantes.

O [CI geral 38317185569](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38317185569) concluiu success às 22:44:42 UTC. Isso é conferência de metadados do workflow, separada das duas provas próprias acima; não significa que todos os CIs passaram.

## Produção e operação pessoal

Depois da [incorporação revisada da PR #38](revisao-pr38-frente-a-20261012.md#resultado-da-incorporação), a navegação conectada exibiu o título semanal `12 – 18 de outubro de 2026` e o link `/configuracoes#lembretes`. O clique chegou a Configurações, com o elemento `lembretes` presente. Calendário/semana original foram restaurados, sem alteração de dados ou preferências. O commit exato servido e a ausência de reload de documento não foram medidos; isso não substitui aparelhos ou jornadas completas. Um atraso inicial no transporte CDP não foi atribuído ao produto.

As issues [#21](https://github.com/kauanbarateli/Segundo-Cerebro/issues/21), [#32](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32) e [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) receberam somente atualizações dos critérios comprovados e histórico preservado, com leitura posterior conferida às 22:52:13/16/20 UTC, respectivamente. Permanecem abertas.

O responsável concluiu os prompts do perfil Restore. O arquivo `restore-target-pg18-20261012-v1.xml`, externo e privado, existe com 3.901 bytes e SHA-256 `9ba15117b92309c80806fc4cdbe7296a5523693d6955fac9c28e42d6962ad1ff`; a presença/hash não certifica credenciais, TLS ou restore. A [preparação anterior](backup-preparacao-pg18-20261012.md) conserva suas provas. O responsável recebeu o [guia específico de custódia](../operations/guardar-chave-backup-passo-a-passo-20261012.md), com comandos completos; a confirmação da cópia offline cifrada ainda está pendente.

Nenhum backup, verificação de archive, restore ou migration remota executou neste checkpoint. Faltam validação de credenciais do alvo, custódia, janela sem escritores e aceites nativos de recuperação. O projeto legado permanece preservado.

Posteriormente, o responsável adiou a cópia externa por não possuir pendrive e autorizou seguir com a chave original no perfil DPAPI local. A [OP-021](decisoes-operacionais.md#op-021--ensaio-com-custódia-externa-adiada) registra essa orientação: a cópia externa deixa de impedir o ensaio, mas sua realização e a recuperação após perda da máquina/identidade Windows continuam sem comprovação. A janela sem escritores e os demais aceites permanecem necessários.

## Backup real após confirmação da janela

O responsável confirmou a janela sem alterações. A criação real do archive cifrado `second-brain-2026-10-12T23-12-50-811Z-be03596d.scbackup` saiu com código 0; a verificação em outro processo também saiu com 0 e repetiu o SHA-256 **18199363331725253953c10dfebb99955315e3eed6676824bd2244cb03af314c**. A [evidência própria](evidence/backup-real-create-verify-20261012.json) conserva contagens e limites: uma entrada de banco, zero objetos Storage e 941.617 bytes processados antes da cifragem, sem arquivo plaintext no disco. O ID original da chave/perfil foi preservado.

A execução usou as fontes do checkout limpo `503f00df`, `pg_dump` 18.4 e TLS `verify-full`. A declaração de quiescência ficou só no processo operacional. As abas do navegador do agente estavam ausentes e a última rotina Google estava concluída; isso não equivale a um lock global. O resultado comprova criação/verificação desse archive, não restore nem recuperação após perda de máquina. O inventário vazio não comprova restauração de arquivos de fixture.

A única execução do preflight readonly do Ensaio_restore retornou recusa com código 1, sem qualificar a fase ou a causa. Não houve tentativa de restore, alteração de senha, fallback de TLS/owners ou migration. O diagnóstico local deve distinguir preparação/configuração antes de repetir uma conexão. Comparação de owners/grants, Auth, Storage/Cofre restaurados e agendamento permanecem pendentes.

O [diagnóstico posterior do alvo](evidence/target-connection-diagnosis-20261012.json) separou essas etapas: a qualificação local passou; a primeira consulta nativa conservou resultado não classificado; a versão revisada para mensagens nativas Windows identificou **AUTHENTICATION_FAILED**, saída **2**, sem imprimir o erro bruto. Isso confirma a recusa de autenticação nessa última execução, sem atribuir retroativamente causa às anteriores. É necessário preparar um novo perfil com a senha PostgreSQL atual do Ensaio_restore, preservando o original. A restauração continua sem execução.

A [coleta readonly de owners/grants da origem](evidence/source-ownership-real-20261012.json) também terminou com saída 0, sem ler cadastros ou dados de aplicação. O relatório privado registra quatro schemas, 87 relações, 211 funções e os demais metadados necessários à comparação. A coleta ocorreu após a criação do archive; representa o catálogo atual e não seu snapshot de transação. Ainda faltam conferir o TOC autenticado, restaurar no alvo vazio e comparar permissões. A janela do aplicativo foi liberada depois de create/verify.

Depois da nova entrada privada da senha, o [preflight do perfil Restore V2](evidence/restore-target-v2-preflight-20261012.json) passou com saída 0: PostgreSQL 17.11, TLS `verify-full`, guard original vazio e GET de buckets com HTTP 200. As contagens de usuários Auth, objetos, buckets e tabelas de aplicação foram zero. São duas leituras de banco e uma consulta de Storage separadas, sem reserva global do alvo. A conexão deixa de ser um impedimento nesta execução; TOC, restore nativo e comparação de permissões seguem pendentes, incluindo a compatibilidade de importação 18→17.

## Primeira importação nativa e diagnóstico pendente

O [registro fechado do ensaio](evidence/restore-trial-native-20261013.json) confirma que a listagem nativa do TOC terminou com saída 0 e 1.332 entradas, após autenticar o archive. A primeira execução real do restore original, com transação única e preservação de owners/grants solicitada, sem supressão, e guard de alvo vazio, terminou com saída 1 e `PG_RESTORE_FAILED`. O runner descartou stderr; a causa permanece desconhecida, sem atribuição a versão ou ownership.

Uma reconferência readonly separada após essa falha voltou a mostrar zero usuários, objetos, buckets e tabelas de aplicação, TLS `verify-full` e HTTP 200 no GET de buckets. Essa observação não comprova todo o estado dos schemas gerenciados, rollback integral ou reserva do alvo. O próximo passo é uma tentativa supervisionada com diagnóstico nativo limitado a categorias/código de saída, mantendo as validações originais. Não suprimir owners/ACLs, alterar roles gerenciadas ou repetir a importação sem esse diagnóstico. A comparação de catálogo já foi revisada para execução somente depois de restore bem-sucedido; Auth, arquivos, Cofre e agendamento continuam sem aceite.

A [tentativa supervisionada com observer V1](evidence/restore-observed-attempt2-20261013.json) foi executada uma vez, depois de revisão integral e 28 controles por autor, raiz e peer. O runner original voltou a retornar `PG_RESTORE_FAILED`; o processo nativo fechou com saída 1. A observação limitada recebeu 166 bytes, sem truncamento, mas retornou `UNCLASSIFIED`. Não atribuir causa à primeira nem à segunda tentativa. Outro preflight readonly, episódio separado após essa falha, passou e conservou as quatro contagens e buckets em zero. Antes de outro restore, verificar localmente o idioma/formato das mensagens, sem conexão ao banco ou uso do archive real.

Atualização posterior de 13/10: a [terceira tentativa nativa supervisionada](evidence/restore-observed-attempt3-20261013.json), com observer V2 e runner original `503f00d`, também retornou `PG_RESTORE_FAILED`/saída 1. A saída nativa fechou com código 1 e 166 bytes de stderr não classificados; as causas das três tentativas permanecem desconhecidas, sem atribuição a DDL gerenciado, owners ou versão. Um postcheck V3 readonly separado passou no alvo `jvwduowyavpaxssogadn`, PostgreSQL 17.11/TLS `verify-full`, mantendo usuários Auth, objetos, buckets e tabelas de aplicação em zero, com Storage HTTP 200. São checks selecionados posteriores à falha, sem reserva do alvo, prova de rollback global ou estado completo; restore, comparação de owners/grants e aceites de recuperação continuam pendentes.
