# Backup e ensaio pessoal — preparação de 12/10/2026

**Perfil da origem criado; nenhum backup ou restore executado.** O alvo pessoal autorizado é `jvwduowyavpaxssogadn`, Ensaio_restore, separado da origem fixa `rishenjoikgmfubmnfiu`. O legado e os ambientes VOE/BlackSheep permanecem preservados.

## Provas de preparação

- Check v2 real: [1.269 verificações e zero divergências](evidence/source-catalogue-20261012.json), TLS `verify-full`, consulta de metadados em leitura/rollback.
- Alvo: [PostgreSQL 17.11 e quatro contagens vazias](evidence/restore-target-preflight-20261012.json), em organização pessoal; o guard revalida o vazio antes do restore.
- Ferramentas permitidas: `C:\Program Files\PostgreSQL\18\bin\pg_dump.exe` e `pg_restore.exe`, **18.4**, ambas com versão/saída 0. `psql.exe` 17.11 permanece permitido. Exportar 17 com pg_dump 18 é suportado; restauração em servidor 17 não é garantida pelo [PostgreSQL](https://www.postgresql.org/docs/18/app-pgdump.html#APP-PGDUMP-NOTES) e precisa de ensaio.
- Assistente local: revisão da raiz e peer independentes, AST PowerShell 7 e 15 controles sintéticos do parser literal aprovados. Leu somente os dois campos necessários da configuração e o perfil Check pinado, sem imprimir os valores.

O perfil DPAPI novo está em `C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\profiles\backup-source-pg18-20261012-v1.xml`, fora de Git/OneDrive, sob ACL privada. SHA-256: `5d9c83138241dbbf3ea94722e46bf4a67ea52b2ef22d72f7f05055bbc214f32c`. Saída fechada: `ok=true`, 17 campos, `remoteExecuted=false`, `backupExecuted=false`, `quiescenceDeclared=false`. O hash comprova bytes do perfil, não prova conexão ou recuperação.

Chave aleatória independente de 32 bytes; identificador não secreto **SC-20261012-001**. A chave permanece em DPAPI/SecureString. **Custódia offline independente ainda pendente**; não imprimir, enviar ou versionar chave/perfil. Uma cópia DPAPI na mesma máquina não atende à recuperação após perda do usuário ou equipamento.

## Próximos aceites

1. O responsável guarda chave/ID em meio offline cifrado independente, conforme os [passos privados](../operations/perfis-privados-backup.md), e confirma somente a conclusão.
2. Preparar um perfil Restore novo, com senha PostgreSQL e chave secreta exclusivas do Ensaio_restore inseridas pelo responsável no terminal privado. A chave do archive deve ser a original; nenhuma nova chave de cifragem é gerada.
3. Conferir uma janela real sem escritores: outras abas/clientes, uploads, Admin, imports e crons. A preparação do perfil não autoriza declarar essa condição.
4. Executar criação, preservar o archive e verificar em outro processo; só então importar no alvo novamente comprovado vazio. O operador conserva owners/grants e aborta a transação em falha, sem retry que suprima ownership.
5. Comparar owners/grants, confirmar UUIDs/Auth/Storage e conferir os bytes selecionados; abrir o Cofre com senha e kit originais em ensaio isolado. Agendamento e execução observada permanecem aceites separados.

Nenhuma migration foi aplicada nesta rodada. Não reaplicar 001–019 na origem nem instalar a chain antes do restore. Falha após commit do banco exige outro projeto vazio, conforme o [runbook](../operations/backup-restore-release.md).
