# T028 — backup pessoal cifrado e validação operacional

Esta entrega prepara as ferramentas. Nenhum dump real, objeto remoto, tarefa do Windows, restore Supabase ou revisão de produção foi executado. O `pg_dump` não está instalado no ambiente de desenvolvimento; não foi instalado por esta tarefa. O operador deve obter ferramentas PostgreSQL compatíveis antes da primeira execução real, em equipamento autorizado.

## Arquivos e comandos

- `scripts/operations/backup.mjs create`: dump nativo custom de `auth`, `public`, `app_private`, `storage`, mais bytes dos dois buckets privados `second-brain-staging` e `second-brain-files`.
- `scripts/operations/backup.mjs verify <arquivo absoluto>`: autentica toda a cópia cifrada, ordem dos chunks, hashes por entrada, manifest e fim do arquivo; não acessa serviços.
- `scripts/operations/backup.mjs restore <arquivo absoluto>`: verifica uma cópia cifrada privada antes de abrir sinks; exige outro projeto Supabase, novo e vazio, explicitamente confirmado. Executa `pg_restore` e restaura cada objeto por streaming; baixa novamente cada objeto e compara tamanho e SHA-256. Ao terminar, exige zero desvios em `release-catalog.sql`.
- `scripts/operations/release-checks.mjs check`: catálogo somente leitura no projeto pessoal. Salva relatório de nomes de objetos/checks, sem conteúdo de usuários, e sai com código 1 quando houver desvio.
- `scripts/operations/run-operator.ps1`: carrega perfil DPAPI externo sob a mesma identidade Windows, transmite segredos pelo ambiente do processo e repõe o ambiente anterior ao sair. Não agenda tarefas.
- `scripts/operations/.env.example`: nomes de configuração do operador, separados dos nomes do servidor da aplicação. Valores reais nunca devem ser gravados nessa cópia versionada.

Use Node 22 ou posterior e caminhos absolutos para executáveis e arquivos. `--help` nos dois CLIs não lê segredos nem abre conexão. Os erros são códigos fechados; stderr de PostgreSQL é descartado, pois pode conter credenciais ou conteúdo. O wrapper produz um erro genérico de setup; revise caminhos, permissões e nomes no perfil sem imprimir seus valores.

## Destino, chaves e perfil externo

O backup só aceita o projeto pessoal `rishenjoikgmfubmnfiu`; projetos da empresa/VOE não são aceitos. O caminho de destino é obrigatório, fora do repositório, da pasta `work`, das raízes de sincronização e de qualquer raiz servida indicada por `SC_BACKUP_APP_SERVING_ROOT`. UNC, nomes curtos com `~`, symlinks/junctions e componentes `OneDrive` são recusados. O relatório usa a mesma proteção. Informe também toda raiz de trabalho/serviço adicional em `SC_BACKUP_WORK_ROOT` e `SC_BACKUP_APP_SERVING_ROOT`.

Crie uma pasta privada local fora desses limites, por exemplo um diretório dedicado na unidade de backup. Remova herança de leitura de grupos gerais; permita somente sua identidade Windows, SYSTEM e administradores locais. Em Windows, `chmod 0600/0700` do Node não substitui uma ACL NTFS adequada. O wrapper recusa um perfil legível por outras identidades e recusa junctions no caminho. As cópias cifradas temporárias de restore ficam no diretório temporário da identidade operadora, nunca contêm plaintext e são removidas ao final; mantenha esse diretório sob a ACL privada padrão do usuário, sem sincronização ou serving. Não execute o operador sob a conta do serviço web.

A chave `SC_BACKUP_ENCRYPTION_KEY` deve ter 32 bytes aleatórios, em base64 RFC4648 canônico. É independente das chaves Auth, Admin, Google, cron e Supabase; o CLI recusa reutilizações conhecidas. `SC_BACKUP_KEY_ID` identifica qual chave abrirá cada arquivo. Gere-a em memória e guarde em perfil DPAPI; não a imprima. Exemplo para preparar somente a chave em uma sessão PowerShell local:

```powershell
$backupKeyBytes=New-Object byte[] 32
$backupKeyRng=[Security.Cryptography.RandomNumberGenerator]::Create()
$backupKeyRng.GetBytes($backupKeyBytes)
$backupKeySecure=ConvertTo-SecureString ([Convert]::ToBase64String($backupKeyBytes)) -AsPlainText -Force
[Array]::Clear($backupKeyBytes,0,$backupKeyBytes.Length)
$backupKeyRng.Dispose()
```

Construa uma Hashtable apenas com os nomes de `.env.example`. Configuração não secreta pode ser string; toda chave que termina em `KEY` e toda senha deve ser `SecureString`, obtida com `Read-Host -AsSecureString`. Atribua `$backupKeySecure` à entrada `SC_BACKUP_ENCRYPTION_KEY`, exporte a Hashtable com `Export-Clixml -LiteralPath <perfil externo>` e aplique ACL privada no arquivo. DPAPI só abre sob o usuário/máquina que exportou. Não coloque segredos em argumentos, histórico de shell, transcript, XML de tarefa, logs, `.env` da aplicação ou OneDrive.

Mantenha uma segunda cópia da chave em meio offline protegido e independente do disco de backup, com o identificador. DPAPI sozinho não é um plano de recuperação depois de perder usuário/máquina. Rotação: gere chave independente com novo ID; backups novos usam o novo perfil. Preserve as chaves anteriores enquanto houver arquivos antigos. `verify`/`restore` exigem o ID e a chave originais. A chave de backup não abre o Cofre: recuperar um Cofre ainda exige senha mestra ou suas duas partes de recuperação. Guarde separadamente o keyring Google do servidor e as configurações externas de Auth/OAuth, pois o dump contém seus envelopes, mas não o ambiente de hosting.

## Execução real e consistência

Antes de `create`, coloque **todos** os escritores em pausa: app, outras abas/clientes, Admin, imports, uploads, cron de limpeza e sincronização Google. Confirme que não há operação em voo; só então exponha `SC_BACKUP_QUIESCED=YES` no ambiente dessa execução. Esse valor é uma declaração do operador, não uma API de manutenção implementada pelo software. Não o deixe ligado permanentemente para uma tarefa que roda enquanto usuários escrevem.

PostgreSQL dá ao dump uma fotografia consistente do banco. Storage é outro serviço: o CLI compara o inventário anterior e posterior e falha se objetos mudarem, mas isso sozinho não comprova uma fotografia atômica entre banco e Storage. A janela de quiescência é obrigatória. Uma chave Supabase secreta do projeto pessoal acessa Storage; a conexão PostgreSQL usa exclusivamente `PG*`, nunca URL/senha em argv. Prefira `PGSSLMODE=verify-full` e certificado correto; `require` existe como opção explícita do operador. Pooler só é aceito quando `PGUSER=postgres.<ref>` corresponde ao projeto.

O dump conserva valores originais, UUIDs Auth, owners e ACLs/grants. Nem dump nem restore usam `--no-owner`, `-O`, `--no-acl` ou `--no-privileges`; o destino precisa dos papéis Supabase correspondentes e das permissões para restaurar os owners originais. A metadata cifrada exige `preserves_owners=true`, que declara essa estratégia, sem comprovar por si só um catálogo remoto. Arquivos sem essa declaração são recusados, sem fallback. Os bytes dos objetos vêm de HTTPS nativo, sem decodificação automática de `Content-Encoding`, transformação de imagem ou reconversão de arquivo. Cada objeto é cifrado por chunks de até 64 KiB junto de seu nome/metadata e hash. AES-256-GCM autentica cada record e sequência; HKDF-SHA256 com sal aleatório deriva uma chave por arquivo. Nenhum dump/objeto plaintext é escrito em disco.

Publicação usa arquivo cifrado parcial exclusivo, fsync e cópia exclusiva, sem sobrescrever um backup existente. Após verificar o arquivo inteiro, `create` salva ao lado um `.report.json` exclusivo com contagens, hashes, nome do arquivo e ID da chave; nunca nomes de objetos, UUIDs, senhas ou chaves. A cópia final não é uma operação atômica em todos os sistemas; queda no meio pode deixar arquivo inválido. Somente `create` com código 0 **e** `verify` bem-sucedido conta como backup. Arquivos parciais/inválidos não são prova de recuperação. Não apague a última cópia verificada ao tratar uma falha. Retenção e cópia offline devem ser definidas pelo operador depois do primeiro restore validado.

## Task Scheduler manual

Não foi criada automação Codex nem tarefa Windows. Prepare inicialmente uma tarefa **desabilitada** no Agendador de Tarefas, sob a mesma identidade que exportou o DPAPI. Ação: executável `powershell.exe`/`pwsh.exe` de caminho absoluto; argumentos `-NoProfile -NonInteractive -File "<repo>\scripts\operations\run-operator.ps1" -Operation create -ProfilePath "<perfil externo privado>" -NodePath "<node.exe absoluto>"`. O XML/argv contém só caminhos, nunca valores secretos.

Defina a janela diária desejada na hora local do computador, por exemplo 03:30, sem execuções sobrepostas (`Do not start a new instance`), retomada após falha temporária e código de saída registrado. Não redirecione a saída para diretório público/sincronizado. Habilite somente depois de estabelecer uma rotina operacional que pausa e confirma os escritores durante **cada** execução; até isso existir, execute backup manual dentro da janela aprovada. Agendar sozinho não torna o backup consistente. `verify` pode ser agendado separadamente com arquivo absoluto conhecido e o perfil da sua chave.

Faça primeiro uma execução manual do wrapper, confira código 0 e execute `verify` em outro processo com a chave original. Observe uma execução disparada pelo Task Scheduler e confirme o mesmo resultado. Esses passos e a rotina de quiescência estão pendentes externamente.

## Restore descartável e Cofre

1. Preserve o backup original; escolha a chave/ID corretos e execute `verify` offline. Não retorne dados para o projeto pessoal de origem.
2. Crie manualmente um projeto Supabase **novo, vazio, pessoal e descartável**, com versões PostgreSQL/Auth/Storage compatíveis. O restore exige zero usuários Auth, zero objetos/buckets e nenhuma tabela de aplicação prévia em `public`/`app_private`. Não aplique a chain antes de restaurar o dump: ele já inclui schema, RLS, funções, triggers, owners e grants. Os papéis, memberships, permissões de ownership e extensions de infraestrutura Supabase precisam existir e ser compatíveis. Revise o inventário do dump em ambiente isolado antes de autorizar substituição dos schemas gerenciados; o CLI não promete compatibilidade entre versões de Auth diferentes. Se o serviço gerenciado não permitir repor os owners originais, use um procedimento autorizado do provedor ou outro alvo compatível; não suprima owners nem altere papéis para fazer uma execução incompatível parecer bem-sucedida.
3. Configure todos os `SC_RESTORE_*` em perfil separado. `SC_RESTORE_PROJECT_REF` deve ser diferente da origem; `SC_RESTORE_CONFIRM_PROJECT` deve repetir exatamente o ref; `SC_RESTORE_ISOLATED=YES` confirma o caráter descartável. As credenciais `SC_RESTORE_PG*` são distintas de `PG*`; URL, host direto ou usuário pooler precisam corresponder ao ref alvo.
4. Execute `restore`. A cópia cifrada privada autentica inteiramente antes de qualquer conexão com alvo. `pg_restore --exit-on-error --single-transaction --clean --if-exists` mantém UUIDs, owners e ACLs do archive. O comportamento padrão emite as alterações de ownership; `--no-owner` as suprimiria e mudaria o contexto de permissões/SECURITY DEFINER para o usuário da conexão. Papel ausente ou alteração de owner não permitida deve falhar e abortar a transação inteira, antes dos uploads; não há retry sem ownership. Esse comportamento está documentado pelo [PostgreSQL para pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html). Storage vem depois, por streaming, com SHA-256/tamanho comparados após upload. O catálogo readonly da aplicação deve retornar zero desvios. **Banco e uploads não formam uma transação única**: em falha posterior ao commit do banco, descarte o projeto inteiro e recomece em outro vazio; não use um alvo parcialmente restaurado. O CLI não apaga projetos nem altera o projeto original.
5. Configure uma instância isolada da aplicação apontando somente para esse alvo; preserve configurações externas necessárias, com credenciais próprias do projeto descartável e sem cron/OAuth ativos. Revogue sessões/refresh tokens restaurados pelo procedimento Auth supervisionado, preservando os UUIDs dos usuários, antes de disponibilizar essa instância. O CLI não realiza chamadas SDK Auth nem altera passwords. Verifique que os UUIDs das contas conhecidas coincidem com os originais. Faça login Auth de uma conta fixture; abra arquivos Drive/Captura/Avatar e compare hashes, não apenas nomes ou imagens.
6. Abra o Cofre da mesma conta e desbloqueie com a **senha mestra original**, sem chave mantida por uma sessão anterior. Abra uma entrada conhecida e valide conteúdo sem capturar plaintext em relatório/screenshots/logs. Em segunda sessão limpa, teste o kit original de duas partes e confirme uma entrada. AES-GCM usa AAD `user_id:item_id:version`; reatribuir usuários ou IDs quebraria essa recuperação. Não forneça senha/kit ao CLI nem a telemetria.
7. Compare o inventário readonly de owners da origem, capturado na janela do backup, com o alvo restaurado; confira schemas, relações/sequências, tipos e funções, incluindo suas flags `SECURITY DEFINER`, além da compatibilidade dos papéis/memberships gerenciados. Registre só metadata: data, ref descartável, nome/hash do arquivo cifrado, contagens, código de saída, checks/desvios e aprovação manual ownership/Auth/Storage/Cofre. O CLI retorna `app_catalogue_verified=true` somente para os checks da aplicação; não retorna `permissions_verified`. `managed_owners_verification=pending_manual_source_catalog_comparison` e `vault_unlock=pending_manual_in_isolated_app` continuam pendentes mesmo quando a importação termina. Não libere recuperação com base apenas no código 0. Descarte o projeto após revisão. Repita pelo menos semestralmente e após mudanças de formato/schema/chaves.

Consulta de inventário de ownership, a executar manualmente em origem na janela congelada e em alvo compatível, guardando somente esses resultados em local privado externo. Ela não lê dados de usuários:

```sql
begin transaction read only;
with owned_objects(kind,schema_name,object_name,owner_name,security_definer) as (
 select 'schema',n.nspname,'',pg_get_userbyid(n.nspowner),false from pg_namespace n
 where n.nspname in ('auth','public','app_private','storage')
 union all
 select 'relation:'||c.relkind,n.nspname,c.relname,pg_get_userbyid(c.relowner),false
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('auth','public','app_private','storage') and c.relkind in ('r','p','v','m','S','f')
 union all
 select 'function',n.nspname,p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',pg_get_userbyid(p.proowner),p.prosecdef
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('auth','public','app_private','storage')
 union all
 select 'type',n.nspname,t.typname,pg_get_userbyid(t.typowner),false
 from pg_type t join pg_namespace n on n.oid=t.typnamespace
 where n.nspname in ('auth','public','app_private','storage')
)
select * from owned_objects order by kind,schema_name,object_name;
rollback;
```

Restaurar schemas gerenciados Auth/Storage requer revisão supervisionada no alvo descartável e não substitui procedimentos de recuperação do provedor. Configurações de hosting, OAuth, JWT/API keys e cron são externas ao dump. Nenhum ensaio real desse procedimento foi feito aqui.

## Catálogo de produção e critérios

`supabase/tests/release-catalog.sql` faz `BEGIN TRANSACTION READ ONLY` e `ROLLBACK`, sem DDL, fixtures, escrita de recibos ou alteração de usuários. Confere existência, RLS, grants de tabela/coluna, policies de dono, superfície RPC, caminhos de resolução, allowlists de EXECUTE, defaults ACL, buckets privados, view financeira invoker, guards de metadata Cofre/Calendar e locks de acesso. Predicados de policy são comparados com digests das expressões normalizadas da chain local revisada, com resolução de schema fixada; acrescentar `OR true` ou outra policy permissiva deve aparecer como desvio. Esses digests descrevem código/schema, não dados pessoais nem autenticação criptográfica. Diferença de deparse entre versões PostgreSQL exige revisão da expressão antes de atualizar a referência; nunca use o próprio banco de produção para aceitar automaticamente um drift. Não lê payloads de usuários nem envelopes; seu relatório só contém nomes de objetos/checks.

Execute `release-checks.mjs check` com `SC_RELEASE_PSQL` absoluto e `SC_RELEASE_REPORT_DIRECTORY` externo privado. Qualquer desvio bloqueia a liberação; não edite o catálogo para ocultar uma exposição. A revisão é estrutural: efeitos Auth reais, isolamento concorrente, Storage HTTP, OAuth, iPhone e produção exigem validações próprias.

| Critério | Evidência local | Estado externo |
|---|---|---|
| Cifrar/verificar e recusar adulteração, chave errada, truncamento e troca do arquivo | Fixtures Node com AES-GCM real e snapshot cifrado; nenhum sink antes da autenticação | Backup real ainda não executado |
| DB/Auth UUIDs, owners e ACLs, Storage original | Fake `pg_dump`/`pg_restore` preservam stream; argv não suprime owners/grants e falhas de papel/ownership interrompem antes de upload/retry; upload/download hash exato | Ferramentas nativas + comparação owners/memberships Auth/Storage + Supabase reais pendentes |
| Cofre restaurável | Segunda fixture com Argon2id 64 MiB/t3/p1, AES-GCM e AAD originais, aberta com a senha original | Login e desbloqueio em projeto descartável pendentes |
| Zero desvio de catálogo | PGlite descartável sobre toda a chain; relatório estruturado é validado pelo harness | Execução readonly em produção pendente |
| Backup agendado fora de sync | Wrapper DPAPI e instruções Task Scheduler, sem tarefa criada | Provisionar janela de quiescência, perfil, job e observar execução |
| Restore renovável | CLI, chaves com IDs, hash/manifests e procedimento documentado | Primeiro ensaio real + calendário semestral pendentes |

Os testes locais não substituem a liberação externa acima. As seis jornadas visuais, auditoria Impeccable final e gate de telemetria são consolidados pela tarefa raiz.
