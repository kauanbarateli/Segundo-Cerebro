# Restore: preservar o candidato legado — 12/10/2026

**Recomendação:** preservar `nqxgtnvmzuempxemlaku` intacto e ensaiar o backup da origem `rishenjoikgmfubmnfiu` em outro projeto pessoal vazio e compatível. A indicação do antigo não autoriza apagar ou sobrescrever seu conteúdo.

## Fatos deste checkpoint

A consulta supervisionada no painel, somente leitura com rollback, retornou metadados agregados: PostgreSQL **17.6**, **42 tabelas públicas**, **2 views**, **1 usuário Auth**, **2 buckets** e **1 objeto Storage**. Nenhum conteúdo pessoal foi aberto ou alterado.

No Windows, `psql --version` confirmou **17.11**, saída 0. `pg_dump` e `pg_restore --version` foram bloqueados pelo Controle de Aplicativo, erro **4551**. Política, PATH, serviços e PostgreSQL 18.4 foram preservados. Essa prova de versão não valida credenciais ou restore.

A tentativa com o perfil Check v1 foi recusada com **PSQL_FAILED**, com diagnóstico readonly **AUTHENTICATION_FAILED** (saída 2). Após a atualização da senha pelo responsável, o novo **Check v2 passou**: conexão autenticada ao projeto atual, TLS `verify-full`, **1.269 verificações e zero divergências** em transação de leitura e rollback. A [evidência do catálogo](evidence/source-catalogue-20261012.json) não certifica backup, restore ou histórico de aplicação das migrations. Não houve backup, verificação de archive, restore ou reaplicação de migrations.

## Por que o antigo ainda não serve ao operador

O [guard](../../scripts/operations/restore-target.mjs) exige zero usuários Auth, buckets, objetos e tabelas de aplicação em `public`/`app_private`. O candidato deve receber `RESTORE_TARGET_NOT_EMPTY` antes da importação. Não relaxar o guard ou retirar registros para fazê-lo passar.

Staging em schemas paralelos não é compatível: o operador usa `auth`, `public`, `app_private` e `storage`, sem remapeamento, preservando UUIDs, owners e grants. O [backup atual](../../scripts/operations/backup-config.mjs) aceita somente a origem fixada e dois buckets específicos; não certifica cobertura integral do legado.

Reutilizar o antigo exige preservação separada de banco, Auth e todos os bytes Storage, com recuperação do legado verificada. Só depois, um alvo comprovadamente vazio poderia entrar no operador. Preservação e substituição não foram realizadas.

## Sequência mínima do ensaio

1. **Conferir:** preparar perfil Check pelos [passos privados](../operations/perfis-privados-backup.md); senha só no terminal humano. Executar `check` pelo wrapper e comprovar conexão/TLS.
2. **Preparar:** obter ferramentas permitidas e outro alvo vazio, conferindo versões, papéis e ownership. O ensaio com ferramentas 18.4 e alvo 17.11 indicado abaixo ainda não certifica compatibilidade. Não aplicar migrations/seeds: o dump inclui schema.
3. **Criar:** preparar perfil Backup e chave/ID com custódia offline independente; confirmar janela sem escritores, incluindo uploads e crons. Declarar quiescência apenas nessa execução; chamar `create`.
4. **Verificar:** preservar o archive e executar `verify` em outro processo, com chave/ID originais. Criação com saída 0 não basta.
5. **Restaurar:** usar perfil Restore separado e ref confirmado. Archive autenticado precede acesso ao alvo; banco precede uploads, hashes e catálogo. Falha após commit exige outro alvo vazio.
6. **Aceitar:** comparar owners/grants, tratar sessões restauradas e comprovar Auth, bytes selecionados e Cofre com senha mestra/kit originais. Código 0 ou descarte de namespace não substituem esses aceites.

O [runbook](../operations/backup-restore-release.md) detalha os comandos e aceites. A conexão Check está validada; faltam runtime permitido para `pg_dump`/`pg_restore`, perfis Backup/Restore, custódia da chave, archive verificado, destino vazio e fixture selecionada. O caminho recomendado reutiliza código existente; substituir o legado exige esforço maior. Não enviar senha, chave ou DPAPI pelo chat.

## Atualização: novo alvo pessoal e ferramentas permitidas

O responsável disponibilizou `jvwduowyavpaxssogadn`, **Ensaio_restore**, na mesma organização pessoal da origem. A [consulta readonly com rollback](evidence/restore-target-preflight-20261012.json) retornou PostgreSQL **17.11**, zero usuários Auth, buckets, objetos Storage e tabelas de aplicação. O horário da evidência é de consolidação, sem alegação de timestamp da consulta. O operador deve revalidar o vazio antes de importar; o projeto antigo permanece preservado.

A raiz confirmou saída 0 de `pg_dump --version` e `pg_restore --version` em `C:\Program Files\PostgreSQL\18\bin`: ambos **18.4**. Os executáveis 17 continuam bloqueados; não foi alterada a política do Windows. Segundo o [contrato oficial do pg_dump 18](https://www.postgresql.org/docs/18/app-pgdump.html#APP-PGDUMP-NOTES), exportar PostgreSQL 17 é suportado, mas carregar em servidor de major inferior ao da ferramenta não é garantido. Portanto, 18 → 17 será um ensaio qualificado deste archive, sem alegação geral de compatibilidade ou supressão de ownership para contornar falhas.

O [perfil Backup privado](backup-preparacao-pg18-20261012.md) foi criado após revisão de fonte e peer, sem conectar, declarar quiescência ou executar backup. Chave/ID originais, custódia independente, perfil Restore, janela sem escritores, archive autenticado e aceites continuam necessários. Não reaplicar migrations no alvo: o dump contém a estrutura.
