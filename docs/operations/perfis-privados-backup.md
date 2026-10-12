# Preparar os perfis privados de backup

O [assistente](../../scripts/operations/prepare-operator-profile.ps1) prepara um arquivo **novo**, cifrado com DPAPI do Windows e com ACL privada. Ele solicita senhas/chaves sem exibi-las, não lê `.env` ou perfis anteriores e não executa SQL, backup, restore ou agendamento. Use **PowerShell 7 no Windows**, no terminal pessoal, sem transcript. O PowerShell 5.1 é recusado antes dos prompts.

As pastas `SegundoCerebro-Operations/profiles`, `archives`, `temp` e `reports`, na pasta do usuário, foram preparadas em 12/10/2026 fora do Git e OneDrive. A ACL permite somente o usuário atual, SYSTEM e administradores. Preserve-a; o assistente exige que as pastas privadas já existam e recusa junctions, UNC, aliases com `~`, sincronização e arquivos existentes.

## 1. Conferir as entradas sem segredos

Abra um terminal PowerShell 7 na raiz do repositório. O runtime instalado pelo Codex está em `%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe`, caso `pwsh` não esteja no PATH. Não altere a instalação PostgreSQL existente ou a configuração do VOE.

```powershell
$taskRepo = (Resolve-Path -LiteralPath '.').Path
$taskOperations = Join-Path $env:USERPROFILE 'SegundoCerebro-Operations'
```

No Supabase pessoal `rishenjoikgmfubmnfiu`, abra **Connect**. Confira host, porta e usuário de Direct connection ou Session pooler. Não use o transaction pooler. A senha pedida é a senha **PostgreSQL**, diferente da API key. A chave `sb_secret_…` da origem entra em outro prompt privado.

Parâmetros não secretos conferidos no painel pessoal em 12/10: Session pooler `aws-1-sa-east-1.pooler.supabase.com`, porta `5432`, banco `postgres`, usuário `postgres.rishenjoikgmfubmnfiu`. Substitua os defaults de conexão direta do assistente por esses valores se escolher esse modo. A origem usa **PostgreSQL 17.11**, confirmada por consulta `READ ONLY`/`ROLLBACK`; a versão do alvo ainda não foi informada.

Executáveis existentes: `C:\Program Files\PostgreSQL\18\bin\psql.exe`, `pg_dump.exe` e `pg_restore.exe`, 18.4. Preserve essa instalação. O ZIP portátil oficial 17.11 foi extraído em `SegundoCerebro-Operations/tools/postgresql-17.11-5`; SHA-256 `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`, conforme [EDB](https://github.com/EnterpriseDB/edb-installers/issues/731). O Windows bloqueou iniciar `pg_dump.exe --version` pelo Controle de Aplicativos. Não declarar os três executáveis aprovados nem contornar a política. É necessário runtime permitido/compatível antes do backup; dump gerado por major 18 não tem carregamento em 17 garantido. [Contrato pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html#APP-PGDUMP-NOTES).

TLS usa `verify-full` como padrão; informe o caminho absoluto da CA quando necessário. `require` só deve ser escolhido deliberadamente pelo operador. Não desative a validação para contornar um erro.

A primeira conferência TLS sem credencial recusou a cadeia por `UntrustedRoot` no Windows. A CA pública foi então baixada pelo link **Database → Settings → SSL Configuration → Download Certificate** do painel pessoal e copiada para `SegundoCerebro-Operations/certificates/prod-ca-2021.crt`. SHA-256 `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`. Uma conexão sem credencial validou nome e cadeia com essa CA somente no processo, em TLS 1.3, às 15:52:15 UTC. Nenhuma confiança foi adicionada ao Windows e não houve autenticação PostgreSQL. Apontar `PGSSLROOTCERT` para esse arquivo; o `check` ainda precisa comprovar `verify-full` e autenticação pelo cliente PostgreSQL.

## 2. Criar o perfil da origem

```powershell
& "$taskRepo\scripts\operations\prepare-operator-profile.ps1" `
    -Mode Backup `
    -ProfilePath (Join-Path $taskOperations 'profiles\backup.xml')
```

Preencha host/porta/usuário, senha do banco e TLS; `psql.exe` e a pasta `reports`; chave `sb_secret` pessoal; pasta `archives` e `pg_dump.exe`. Os prompts de raízes adicionais podem ficar vazios se não houver outra pasta de trabalho/servida. Escolha um ID não secreto, por exemplo `backup-v1`. O assistente gera uma chave independente de 32 bytes. Não copie segredos para o chat, argumentos ou arquivos de texto.

Esse perfil também serve ao `check` somente leitura. Para preparar apenas a consulta, use `-Mode Check` e outro arquivo novo, por exemplo `profiles\check.xml`; ele não pede API key nem chave de backup.

A saída `ok=true` contém caminho/hash/contagem de campos; não confirma a conexão. Em qualquer falha, pare e informe apenas o código. Uma falha depois da criação pode deixar um arquivo parcial privado: não reutilize ou sobrescreva esse caminho por suposição.

`SC_BACKUP_QUIESCED` fica ausente. O assistente não declara que existem condições para criar um backup. `TEMP/TMP` também não entram no perfil; pertencem ao processo operacional dedicado, conforme o [runbook](backup-restore-release.md).

## 3. Guardar a chave para recuperação

Faça esta etapa **você mesmo no terminal pessoal**, sem o agente capturando a sessão. Desative histórico e sincronização da área de transferência antes. Depois de criar o perfil com sucesso, este trecho abre somente seu arquivo novo e copia a chave para a área de transferência local, sem imprimi-la:

```powershell
$taskPrivateProfile = Import-Clixml -LiteralPath (Join-Path $taskOperations 'profiles\backup.xml')
$taskKeyPointer = [IntPtr]::Zero
try {
    $taskKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskPrivateProfile.SC_BACKUP_ENCRYPTION_KEY)
    Set-Clipboard -Value ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskKeyPointer))
} finally {
    if ($taskKeyPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskKeyPointer)
    }
    foreach ($taskValue in $taskPrivateProfile.Values) {
        if ($taskValue -is [Security.SecureString]) { $taskValue.Dispose() }
    }
    $taskPrivateProfile.Clear()
}
```

Cole exclusivamente no armazenamento offline cifrado sob seu controle, em meio separado do disco/máquina do backup, junto ao ID `backup-v1` ou ao ID escolhido. Logo depois, execute `Set-Clipboard -Value ''`. Não envie a chave ao chat. Uma cópia do DPAPI na mesma máquina não substitui a custódia independente; a perda do usuário/máquina pode impedir sua recuperação. Confirme somente que a cópia protegida e o ID estão guardados antes do primeiro backup real.

## 4. Perfil do restore

Primeiro informe ao agente o ref de um **outro projeto pessoal, novo e vazio**, autorizado para o ensaio. Não aplicar migrations, bootstrap ou seeds nele: o dump inclui o schema. O restore recusa a origem e exige confirmação/isolamento do alvo. Sua criação pode envolver serviço/custo e permanece uma escolha do responsável.

```powershell
& "$taskRepo\scripts\operations\prepare-operator-profile.ps1" `
    -Mode Restore `
    -ProfilePath (Join-Path $taskOperations 'profiles\restore.xml')
```

Digite e confirme o ref alvo, marque `YES` somente se ele for pessoal/isolado/descartável, insira a chave `sb_secret` e a senha PostgreSQL **desse alvo** e informe `pg_restore.exe`/`psql.exe`. No prompt de chave do archive, use a chave **original** guardada no passo 3, com seu ID original; não gerar outra.

Preparar esse perfil não autoriza uma restauração em dados existentes. O ensaio requer alvo vazio comprovado, archive autenticado e revisão da operação. Falha após o commit do banco exige outro alvo novo; nenhuma repetição automática no alvo parcial.

## 5. Entrega para a rodada supervisionada

Envie somente os caminhos absolutos dos perfis, host/porta/usuário, ref alvo, versões dos servidores e confirmação de custódia da chave. Não envie arquivos DPAPI ou seus conteúdos. Com isso, o agente poderá conferir a origem somente leitura, combinar a janela sem escritores e executar criação/verificação/restore pelos [comandos existentes](backup-restore-release.md). Cofre, owners/grants, sessões restauradas e o primeiro backup agendado continuam aceites separados.

Validação de preparação em 12/10: oito controles locais com DPAPI real e credenciais artificiais passaram, incluindo ACL, exclusividade, origem/alvo e recusa no PowerShell 5.1. Vinte e cinco testes existentes de backup/executor Google passaram. Não foi criado perfil real nem executado banco, backup ou restore por esses testes.
