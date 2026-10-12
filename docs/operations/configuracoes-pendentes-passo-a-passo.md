# Configurações pendentes: SMTP, Google Calendar e backup

Guia operacional em português, preparado em **12/10/2026**. Os passos abaixo são instruções para a próxima configuração supervisionada; este documento não cria contas, contrata serviços, envia e-mails, ativa agendamentos ou executa backup/restore.

Atualização de execução em 12/10: [duas contas Google, sincronização manual e filtros foram validados em produção](../implementation/google-producao-20261012.md). Para concluir os próximos passos, use o [workflow com rotina diária inicialmente inativa](google-calendar-scheduler.md) e o [assistente local de perfis privados de backup](perfis-privados-backup.md). SMTP, cron real, backup/restore e demais aceites mantêm suas conferências próprias.

## 1. Ponto de partida e decisões

| Item | Estado e valor que deve ser preservado |
| --- | --- |
| Aplicação de produção | `https://segundo-cerebro-of.vercel.app` |
| Supabase pessoal | `rishenjoikgmfubmnfiu`; URL `https://rishenjoikgmfubmnfiu.supabase.co` |
| Modo de produção | `APP_MODE=supabase` **já configurado**. Não voltar para demonstração nem recriar o projeto. |
| Banco | Migrations **001–019 já aplicadas**. Não reaplicar, resetar ou executar seeds. O catálogo próprio pós-019 registrou **1.269 checks e zero desvios**. |
| Tipos | A geração local oficial contém **55 RPCs**. O export manual hospedado foi obtido e apresenta diferenças documentadas; não substituir a baseline nem aplicar SQL para ocultá-las. |
| Serviços externos | SMTP próprio, cliente Google e destino de backup ainda dependem de escolha/configuração. Android/iPhone e aceite humano de produção permanecem adiados. |
| Escopo | Somente organização/projeto pessoais. Drive foi retirado da entrega do MVP; Captura, Avatar, Calendário, Cofre e sessões permanecem. |

Escolha os itens da tabela seguinte quando quiser iniciar cada frente. Uma escolha de fornecedor não autoriza cobrança, criação de conta ou publicação automática.

| Frente | Você decide/configura | Mantenedor/Root valida e registra |
| --- | --- | --- |
| SMTP | Serviço, domínio que controla, remetente, DNS e credencial SMTP no painel Supabase | Configuração sem revelar senha; recuperação real pelo aplicativo; entrega e estado final |
| Google | Projeto Cloud pessoal, duas contas autorizadas, consentimento e client Web; segredos no hosting | Contratos/redirects, fluxo real, isolamento, filtros, revogação e uma execução supervisionada do cron |
| Backup | Unidade/pasta externa, custódia das chaves, janela sem escritas e projeto descartável | Perfil/ACL, compatibilidade dos executáveis, backup verificado, restore, owners/grants/Auth/Storage e Cofre |

**Não envie senhas, API keys, tokens, kit do Cofre ou links de recuperação pelo chat.** Insira-os diretamente no painel correto ou em perfil privado local. Entregas públicas contêm status, horários, contagens e hashes permitidos; dados pessoais e evidências sensíveis ficam privados.

Ordem mínima: preparar as três escolhas em paralelo; configurar SMTP e Google; fazer um deploy com as variáveis finais; validar cada integração; preparar backup manual; executar restore descartável; habilitar recorrência apenas quando seus pré-requisitos operacionais estiverem comprovados. Reutilize os runbooks abaixo em vez de criar outro sistema.

## 2. SMTP: recuperar senha por e-mail real

### 2.1 Escolher serviço e remetente

**RECOMENDADO:** usar um serviço SMTP transacional já contratado, se houver. Se for necessário escolher um novo, Resend é uma opção concreta com [integração SMTP oficial para Supabase](https://resend.com/docs/send-with-supabase-smtp). Postmark e Amazon SES são alternativas citadas pela [documentação Supabase](https://supabase.com/docs/guides/auth/auth-smtp). Compare limites/custos no painel antes de contratar; nenhum plano ou preço é assumido aqui.

Você precisa de um domínio que controla e acesso à sua zona DNS. A URL `vercel.app` do aplicativo não dá controle de DNS de um domínio remetente. Um exemplo de organização é subdomínio `auth.seudominio.com` e remetente `acesso@auth.seudominio.com`; são exemplos, não valores para copiar literalmente. Não usar endereço Gmail como remetente de um domínio não verificado.

### 2.2 Verificar DNS no fornecedor

1. No fornecedor escolhido, adicione o domínio/subdomínio de envio. No Resend: **Domains → Add Domain**.
2. No painel do registrador/DNS, copie os registros exatos apresentados pelo fornecedor: nome, tipo, valor, prioridade quando houver e TTL. Confira se o painel acrescenta o domínio ao nome automaticamente.
3. Publique DKIM e a configuração SPF/Return-Path indicada. Não substitua os MX da sua caixa de entrada por registros de outro subdomínio. Se um nome já tiver SPF, revise a combinação com o operador do domínio; não acrescente registros incompatíveis por tentativa.
4. Se houver CNAME de verificação, mantenha-o como DNS direto, sem proxy. Aguarde o fornecedor marcar o domínio como verificado; não prometa um prazo de propagação.
5. Configure DMARC compatível com o domínio e com os demais remetentes existentes. Comece pela política e destinatário de relatórios acordados com quem administra o DNS; endurecer a política exige revisar todos os serviços que enviam por esse domínio.
6. Deixe rastreamento de abertura/clique desativado para recuperação de senha. O link PKCE não deve ser reescrito por marketing/tracking. [Domínio e registros Resend](https://resend.com/docs/add-a-domain), [DMARC](https://resend.com/docs/dashboard/domains/dmarc).

**Entrega sua, sem segredos:** fornecedor escolhido, domínio/remetente, verificação DNS concluída e tracking desativado. O valor da credencial fica somente no fornecedor/Supabase.

### 2.3 Configurar o SMTP no projeto pessoal

1. Abra o [SMTP do projeto pessoal](https://supabase.com/dashboard/project/rishenjoikgmfubmnfiu/auth/smtp). Confira o ref antes de salvar. A documentação atual descreve **Authentication → Email/Notifications → SMTP Settings**; a posição visual do menu pode mudar.
2. Habilite SMTP próprio; preencha nome do remetente, e-mail, host, porta, usuário e senha fornecidos pelo serviço.
3. Para a opção Resend, os valores documentados são:

| Campo | Valor |
| --- | --- |
| Sender name | `Segundo Cérebro` |
| Sender email | Seu endereço no domínio verificado |
| Host | `smtp.resend.com` |
| Porta recomendada neste exemplo | `465`, TLS implícito |
| Username | `resend` |
| Password | API key SMTP apropriada inserida diretamente no painel; nunca neste arquivo |

Uma alternativa documentada é porta `587` com STARTTLS. A porta e o modo de transporte devem corresponder às instruções do fornecedor; não usar conexão sem proteção nem desativar validação de certificado para contornar falhas. [Portas e TLS Resend](https://resend.com/docs/send-with-smtp).

4. Salve e confira o resultado do painel. SMTP é configuração do **Supabase Auth**, não uma nova variável `SMTP_PASSWORD` da aplicação ou da Vercel.
5. Confira os limites de e-mail em **Authentication → Rate Limits** e a validade do link de recuperação existente. Registre os valores escolhidos; não elevar limites ou alterar políticas de senha por tentativa. SMTP padrão Supabase é limitado e não substitui envio transacional próprio. [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
6. Confira que **Allow new users to sign up** está desativado e mantenha essa opção assim. Não habilitar signup/autoconfirmação nem alterar o master para testar e-mail.

### 2.4 Conferir URLs e template de recuperação

| Configuração/canal | Valor vigente |
| --- | --- |
| Supabase Auth Site URL | `https://segundo-cerebro-of.vercel.app` |
| Callback do aplicativo para recuperação | `https://segundo-cerebro-of.vercel.app/auth/callback` |
| Tela onde começa a solicitação | `/recuperar-senha` |
| Tela de senha nova após recuperação comprovada | `/redefinir-senha` |
| Callback Google Calendar, canal diferente | `/api/calendar/oauth/callback` — não inserir no template de recuperação |

Em **Authentication → URL Configuration**, preserve o origin de produção e a entrada restrita do callback; não liberar wildcard de domínio/preview por conveniência. O aplicativo acrescenta `state` aleatório, e o PKCE pode acrescentar `sb_flow_id`: Root deve confirmar sua preservação no fluxo real. A lista do provedor não substitui os guards de nonce, e-mail, sessão e origem implementados no aplicativo. [Redirect URLs Supabase](https://supabase.com/docs/guides/auth/redirect-urls).

Em **Email Templates → Reset Password**, mantenha o link PKCE baseado em `{{ .ConfirmationURL }}`. Não trocar por `token_hash`, magic link ou fragmento com token: o callback atual não implementa essas alternativas. Use assunto e texto simples de recuperação, sem marketing. O contrato vigente está no [runbook Auth](../implementation/t014-auth-backend.md#procedimento-de-configuração).

### 2.5 Teste supervisionado e aceite

1. Combine um endereço pessoal autorizado e uma conta comum apropriada ao teste. Não reutilizar master, contas de empresa ou fixtures hospedadas sem autorização própria.
2. No navegador, abra produção, solicite recuperação e mantenha **o mesmo navegador/perfil** aberto. A mensagem genérica da tela não comprova envio.
3. Confira recebimento, remetente, ausência de reescrita do link e pasta de spam. Abra o link nesse mesmo perfil, uma vez; não publique sua URL, código ou state.
4. Root acompanha callback limpo, senha nova, aviso terminal e confirmação de sessão/efeito por canais autorizados. Confirme que a senha antiga foi recusada e que o login com a nova funciona. Falha/perda de resposta não autoriza presumir resultado ou repetir uma escrita automaticamente.
5. Registre apenas horário, fornecedor/remetente, entrega confirmada, etapas aprovadas e falha fechada se houver. Não exportar o corpo do e-mail, senha, cookies ou token.

**Pronto para esta frente:** SMTP/DNS salvos, recuperação real entregue e fluxo completo confirmado. CI com Mailpit e login isolado continuam provas distintas; este documento não transforma um resultado parcial da issue #21 em aceite completo.

## 3. Google Calendar: OAuth pessoal, duas contas e cron

### 3.1 Criar a configuração Google correta

**RECOMENDADO:** projeto Google Cloud pessoal separado, cliente OAuth **Web application** e audiência **External/Testing** para a primeira validação com suas contas. Não usar service account ou configurar Google como login do Supabase: a integração existente conecta calendários depois do login por senha.

1. Abra [Google Cloud Console](https://console.cloud.google.com/), selecione/crie o projeto pessoal aprovado e confira sua conta/organização. Não selecionar BlackSheep/VOE. Revise eventuais solicitações de cobrança antes de aceitar.
2. Em **APIs & Services → Library**, habilite **Google Calendar API**.
3. Em **Google Auth platform → Branding**, informe nome do aplicativo, e-mail de suporte e contato do responsável. Se a plataforma ainda não estiver configurada, use **Get Started**.
4. Em **Audience**, selecione External quando houver contas pessoais fora de uma organização Workspace. Em Testing, adicione explicitamente as **duas contas Google autorizadas** como test users. Internal só serve para usuários da organização Workspace correspondente. [Consentimento e test users](https://developers.google.com/workspace/guides/configure-oauth-consent).
5. Em **Data Access**, cadastre os escopos já pedidos pelo código:

```text
openid
email
https://www.googleapis.com/auth/calendar.calendarlist.readonly
https://www.googleapis.com/auth/calendar.events.readonly
```

Eles permitem identidade verificada, lista de calendários e leitura de eventos. Não adicionar Drive, Gmail, acesso de escrita ou escopo amplo `calendar` para eliminar uma recusa. [Escopos oficiais Calendar](https://developers.google.com/workspace/calendar/api/auth).

6. Em **Clients → Create Client**, escolha **Web application**, nomeie o cliente e cadastre exatamente esta **Authorized redirect URI**:

```text
https://segundo-cerebro-of.vercel.app/api/calendar/oauth/callback
```

Não usar `/auth/callback`, o callback do Supabase, `/calendario`, a URL de preview ou uma barra final adicional. O código deriva esse URI de `APP_URL` e da constante do adapter. O fluxo atual é server-side e não precisa de cliente JavaScript Google no browser; não adicionar origens JavaScript por tentativa. [Cliente Web e redirect URIs](https://developers.google.com/identity/protocols/oauth2/web-server).

7. Guarde client ID e secret no seu gerenciador de segredos e transfira diretamente para a Vercel. Não commitar/downloadar o JSON do cliente em pasta de trabalho sincronizada.

Testing é apropriado para o ensaio, não uma promessa de conexão permanente: o Google aplica limites de usuários e de refresh tokens nesse estado, inclusive a regra de sete dias para os escopos usados aqui. Antes de uso duradouro, revise publicação/verificação e exigências apresentadas pelo Google; não marcar Published nem contornar alertas automaticamente. Se o Google exigir domínio verificado para branding/publicação, use um domínio que realmente controla, sem declarar propriedade de `vercel.app`. [Estados do aplicativo OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).

### 3.2 Configurar variáveis na Vercel e fazer deploy

No projeto pessoal da Vercel, abra **Environment Variables**; crie/edite as entradas no escopo **Production**. Preserve as variáveis Auth/SQL já configuradas, especialmente `APP_MODE=supabase`, `APP_URL` e `SUPABASE_URL`. Não compartilhar segredos de produção com Preview/Development por padrão.

| Nome exato | Conteúdo/regra do código |
| --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` | ID do cliente Web terminado em `.apps.googleusercontent.com` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Secret desse cliente, privado e server-only |
| `GOOGLE_CALENDAR_STATE_SECRET` | Segredo aleatório independente, ao menos 32 bytes UTF-8; diferente de Auth/Admin/Supabase |
| `GOOGLE_CALENDAR_TOKEN_KEY` | **32 bytes aleatórios**, base64 RFC4648 canônico; chave própria de cifra de tokens |
| `GOOGLE_CALENDAR_TOKEN_KEY_ID` | Identificador não secreto, 1–32 caracteres `[A-Za-z0-9_-]`, por exemplo `calendar-v1` |
| `GOOGLE_CALENDAR_TOKEN_KEYS` | Opcional na rotação: JSON de até cinco IDs antigos e suas chaves; deixe ausente inicialmente |
| `GOOGLE_CALENDAR_CRON_SECRET` | Outro segredo independente, ao menos 32 bytes UTF-8; não igualar a `CRON_SECRET` ou a qualquer chave acima |

Use armazenamento de segredo do painel para valores sensíveis. Todos os nomes são server-only: **nenhum `NEXT_PUBLIC_`**. Não solicitar a chave de login do usuário Google; o consentimento ocorre no navegador. Guarde chave ativa/IDs anteriores em custódia recuperável: removê-los prematuramente torna tokens já cifrados ilegíveis; o dump não inclui essas variáveis.

Salve e faça **um novo deploy/redeploy** do SHA aprovado, com Root. Alterações de variáveis não corrigem deployments anteriores. Registre deployment/SHA, nomes presentes e resultado de configuração, sem valores. [Gestão de variáveis Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).

#### Gerar os três segredos novos sem mostrá-los no terminal

Em uma sessão PowerShell local, sem transcript, gere os valores abaixo. A função usa o gerador criptográfico do sistema, converte **32 bytes** para base64 e devolve `SecureString`. Cada chamada gera um valor novo; não usar senha digitada, UUID ou uma senha de 64 caracteres como substituto da chave binária Google.

```powershell
function New-GooglePrivateSecret {
    $googleBytes = New-Object byte[] 32
    $googleRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $googleRng.GetBytes($googleBytes)
        ConvertTo-SecureString -String ([Convert]::ToBase64String($googleBytes)) -AsPlainText -Force
    } finally {
        [Array]::Clear($googleBytes, 0, $googleBytes.Length)
        $googleRng.Dispose()
    }
}
$googleStateSecure = New-GooglePrivateSecret
$googleTokenKeySecure = New-GooglePrivateSecret
$googleCronSecure = New-GooglePrivateSecret
```

Guarde os três valores no gerenciador de segredos ou em um arquivo DPAPI privado fora do Git, OneDrive e pastas servidas, junto ao ID não secreto da chave. Se usar `Export-Clixml`, siga os cuidados de ACL/custódia do passo 4.2. **Esse perfil Google é separado do perfil `run-operator.ps1` de backup**, que não aceita nomes Google. Não feche a sessão antes de guardar os valores; DPAPI sozinho não substitui a cópia de recuperação em custódia separada.

Para preencher o painel, desative antes o histórico e a sincronização da área de transferência do Windows. Este exemplo copia somente a chave de tokens para a área de transferência local, sem imprimi-la:

```powershell
$googlePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($googleTokenKeySecure)
try {
    Set-Clipboard -Value ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($googlePointer))
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($googlePointer)
}
```

Cole em `GOOGLE_CALENDAR_TOKEN_KEY` na Vercel e limpe a área de transferência com `Set-Clipboard -Value ''`. Repita o mesmo trecho, usando `$googleStateSecure` para `GOOGLE_CALENDAR_STATE_SECRET` e `$googleCronSecure` para `GOOGLE_CALENDAR_CRON_SECRET`. Não cole a expressão `SecureString` no campo, não envie os valores ao agente/chat e não use esses três valores como chave de backup.

### 3.3 Validar o fluxo com duas contas

1. Você entra no aplicativo com a conta comum autorizada, abre `/calendario` e clica **Conectar Google**. O app escolhe a conta Google e pede consentimento; não construir manualmente URLs com state/token.
2. Autorize a primeira conta e confirme retorno para `/calendario`, conta conectada e calendários disponíveis. Se faltar consentimento, mostre a recusa; não ampliar escopos nem liberar grants no SQL.
3. Conecte a segunda conta do mesmo usuário pelo mesmo botão; o limite existente é **duas contas**. Não criar novo usuário/master como requisito.
4. Selecione calendários das duas contas, use **Sincronizar período** e confira eventos conhecidos nas vistas de dia/semana/mês. Amplie a janela e confira atualização sem reload completo. Desative uma fonte e confira os filtros no Calendário, Início e lembretes.
5. Root confirma isolamento por dono/sessão, persistência, contagens e registro de sincronização por canais existentes; nomes, títulos e tokens pessoais não entram na evidência pública.
6. Em uma conexão autorizada para esse ensaio, use **Desconectar**. A implementação só conclui a desconexão após ACK HTTP **200** do endpoint de revogação Google e remoção local confirmada. `revocation_pending` é pendência, não sucesso. Confira o estado no Google/aplicativo; reconecte depois somente se desejado.

**Entrega:** duas conexões reais, scopes somente leitura, projeções/filtros persistidos, revogação confirmada e evidência fechada. Testes com fixtures continuam válidos, mas não certificam a execução do provider real. [Guia Google existente](../implementation/t025-calendario-google.md), [matriz de verificação](google-calendar-release-verification.md).

### 3.4 Preparar o scheduler, validar uma rodada e só então ativar

**RECOMENDADO para reaproveitar a ferramenta existente:** executor Node em scheduler que permita header privado, usando o [exemplo documental GitHub Actions](examples/google-calendar-cron.yml). O arquivo está fora de `.github/workflows` e **não está ativo**. Alternativa: scheduler externo aprovado com a mesma chamada autenticada. Escolha e custo ficam com você.

Não adicionar apenas essa rota ao cron nativo Vercel: ele envia `CRON_SECRET`, enquanto a rota Google exige `GOOGLE_CALENDAR_CRON_SECRET`. Os valores permanecem diferentes; não criar fallback nem juntá-los. [Header automático Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).

1. No ambiente privado do executor, configure apenas os nomes do contrato:

| Variável do operador | Valor/regra |
| --- | --- |
| `APP_URL` | `https://segundo-cerebro-of.vercel.app` |
| `GOOGLE_CALENDAR_CRON_SECRET` | Mesmo segredo privado configurado na rota Google da Vercel |
| `SC_GOOGLE_CRON_ALLOW_RUN` | Literal `rishenjoikgmfubmnfiu`, somente após autorização da execução |
| `SC_GOOGLE_CRON_TIMEOUT_MS` | Opcional; `30000` é o padrão recomendado do executor, não a duração máxima da função remota |

O executor não carrega `.env`. A chave fica no armazenamento privado do scheduler ou no ambiente efêmero do processo, nunca em URL, argv ou `curl` no histórico.

2. Root revisa o SHA e roda `check` sem rede. Depois da sua configuração/consentimento, executa **uma rodada supervisionada** de `run`:

```sh
node scripts/operations/google-calendar-cron.mjs check
node scripts/operations/google-calendar-cron.mjs run
```

3. Registre HTTP/contagens/horário e confira o registro de sincronização no Admin autorizado. `200` com `complete:0` é resposta válida do executor, mas não comprova sincronização de suas duas contas. Observe capacidade/duração antes de recorrência.
4. Se escolher Actions, você cadastra `GOOGLE_CALENDAR_CRON_SECRET` em **Settings → Secrets and variables → Actions** do repositório pessoal, sem publicar seu valor. Root revisa/copiará o exemplo para um workflow ativo e publicará somente após autorização. Preserve branch `main`, checkout sem credenciais persistidas e sem execução de PR com segredo.
5. Horário de exemplo: `17 5 * * *`, UTC, **02:17 em Fortaleza**. GitHub pode atrasar/perder disparos sob carga; horário não é SLA. [Schedule GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
6. Em timeout, perda de resposta ou `REMOTE_RESULT_UNKNOWN`, **não repetir automaticamente**: a operação remota pode continuar. Claims não expiram automaticamente; use a recuperação operacional do [runbook do executor](examples/google-calendar-cron.md).

**Entrega do cron:** escolha do executor, segredo privado cadastrado, execução real confirmada com contas elegíveis, registro no Admin e recorrência observada. Preparar YAML/`check` não equivale a ativação.

## 4. Backup: cifra externa, janela segura e restore descartável

### 4.1 Definir o destino e as ferramentas

**RECOMENDADO:** uma unidade local dedicada/externa com NTFS e ACL privada, fora do disco/pastas de trabalho sincronizadas; mantenha uma cópia cifrada independente depois de um restore validado. O CLI atual grava em **diretório local absoluto**: não aceita URL S3, UNC, OneDrive, pasta do repo/`work`, nomes curtos com `~` ou symlinks/junctions. Um serviço de cópia externa pode ser uma etapa posterior escolhida por você; não há upload remoto automático implementado nesse CLI.

1. Escolha pasta, retenção, segunda cópia e responsável. Exemplo de localização, se essa unidade existir: `E:\SegundoCerebroBackup\archives`; perfil em pasta privada separada. Não copiar o exemplo sem conferir a unidade.
2. Nas propriedades de segurança do diretório/perfil, remova acesso herdado de grupos gerais e permita somente sua identidade Windows, SYSTEM e administradores locais. Valide ACL no arquivo e nos ancestrais; `chmod` do Node não garante privacidade NTFS.
3. Tenha Node compatível com `.nvmrc`/runbook e os executáveis PostgreSQL em caminhos absolutos: `pg_dump.exe`, `pg_restore.exe`, `psql.exe`. O ponto de partida solicitado é o conjunto **PostgreSQL 17**, instalado da [distribuição oficial Windows](https://www.postgresql.org/download/windows/); Root verifica `--version` antes de conectar.
4. Confirme a versão do servidor de origem/alvo: `pg_dump` 17 não pode exportar servidor de major superior a 17. Se a origem for mais recente, selecionar ferramentas compatíveis antes da operação; não presumir versão nem reduzir proteções para executar. [Compatibilidade pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).
5. No Supabase pessoal, abra **Connect** e copie host/porta/usuário do modo **Direct connection** ou **Session pooler**. Direct pode requerer IPv6; Session pooler é alternativa para rede IPv4. Não inventar o host regional nem usar o transaction pooler como atalho para dump/restore. [Conexões Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

6. Prepare também uma pasta temporária privada, existente, fora de repo/`work`, OneDrive e raízes servidas. Antes de chamar o operador, configure `TEMP` e `TMP` **somente nessa sessão/processo**, usando o caminho completo e extenso, sem alias 8.3 com `~`:

```powershell
$taskOperatorTemp = (Resolve-Path -LiteralPath '<pasta-temporaria-privada-absoluta-existente>').Path
$env:TEMP = $taskOperatorTemp
$env:TMP = $taskOperatorTemp
```

Não adicionar `TEMP`/`TMP` ao perfil DPAPI: o wrapper não os aceita ali. O restore usa `os.tmpdir()` e recusa temporário inseguro; a pasta e seus ancestrais também precisam de ACL privada, sem junction/symlink. Esses comandos não alteram a configuração global do Windows. Use uma sessão dedicada e encerre-a ao terminar. [Verificação do restore](../../scripts/operations/restore-verify.mjs).

Formato existente: `.scbackup` versionado com AES-256-GCM por chunks, HKDF-SHA256 e manifesto autenticado. Contém dump custom dos schemas `auth`, `public`, `app_private`, `storage` e bytes dos buckets privados `second-brain-staging`/`second-brain-files`. Preserva UUIDs, owners e grants; export genérico JSON/SQL sem os objetos não substitui esse archive. Dados Drive preexistentes podem permanecer no inventário histórico, sem reintroduzir entrega do módulo.

### 4.2 Preparar chave e perfil DPAPI externo

O template correto é [scripts/operations/.env.example](../../scripts/operations/.env.example), **não** o `.env.example` da raiz. Ele documenta nomes; não deve receber valores reais. O [wrapper PowerShell](../../scripts/operations/run-operator.ps1) carrega uma Hashtable em arquivo DPAPI externo e restaura o ambiente ao terminar; ele não lê `.env` da aplicação.

| Nome exato do perfil de backup | Preencher com |
| --- | --- |
| `SC_BACKUP_ENCRYPTION_KEY` | 32 bytes aleatórios em base64 canônico, como `SecureString`; independente de Auth/Admin/Google/cron/Supabase |
| `SC_BACKUP_KEY_ID` | ID da chave, 1–50 caracteres `[A-Za-z0-9_-]`, por exemplo `backup-v1` |
| `SC_BACKUP_DESTINATION` | Diretório absoluto privado escolhido |
| `SC_BACKUP_PG_DUMP` | Caminho absoluto de `pg_dump.exe` |
| `SC_BACKUP_QUIESCED` | Inicialmente ausente/vazio; `YES` apenas durante janela realmente sem escritas |
| `SC_BACKUP_SUPABASE_URL` | `https://rishenjoikgmfubmnfiu.supabase.co` |
| `SC_BACKUP_SUPABASE_KEY` | Chave `sb_secret_…` do projeto pessoal, como `SecureString` |
| `SC_BACKUP_APP_SERVING_ROOT`, `SC_BACKUP_WORK_ROOT` | Raízes adicionais da aplicação/trabalho que não podem receber backups |
| `PGHOST`, `PGPORT` | Valores do Connect: direto `db.rishenjoikgmfubmnfiu.supabase.co:5432`, ou host real Session pooler |
| `PGDATABASE` | `postgres` |
| `PGUSER` | Direto: `postgres`; Session pooler: `postgres.rishenjoikgmfubmnfiu` |
| `PGPASSWORD` | Senha do banco pessoal como `SecureString`; não é API key Supabase |
| `PGSSLMODE` | Preferir `verify-full` com certificado correto; `require` só por decisão explícita do operador |
| `PGSSLROOTCERT` | Caminho do certificado de CA apropriado quando necessário |

Siga o trecho de geração em memória e `Export-Clixml` do [runbook backup](backup-restore-release.md#destino-chaves-e-perfil-externo). Obtenha senhas com `Read-Host -AsSecureString`; atribua chave aleatória gerada em memória. Nunca escrever valores em shell/history/transcript, XML da tarefa ou este guia. DPAPI é ligado ao mesmo usuário/máquina Windows: tenha cópia de recuperação da chave e ID em meio offline protegido, separado do disco de backup. Chaves antigas precisam permanecer enquanto houver archives cifrados por elas.

**Entrega de preparação:** destino/ACL conferidos, versões/caminhos dos executáveis, perfil DPAPI externo legível somente pelo operador e custódia da chave definida. Perfil configurado não é backup executado.

### 4.3 Fazer o primeiro backup manual consistente

1. Combine uma janela sem escritores: aplicativo/abas/clientes, Admin, imports, uploads, limpeza e sincronização Google. Root confirma término das operações anteriores. **Não existe API automática de manutenção** no software atual.
2. Somente após essa confirmação, use `SC_BACKUP_QUIESCED=YES` no perfil/ambiente específico da execução. Não deixá-lo permanente num job que rodará com usuários ou crons escrevendo. O inventário antes/depois de Storage detecta mudanças, mas não cria snapshot atômico banco+Storage.
3. Execute manualmente o wrapper aprovado. Os comandos abaixo contêm apenas caminhos; substitua-os por caminhos reais revisados. Estes passos fazem operação remota e ficam para a execução supervisionada, não para a leitura deste guia:

```powershell
& '<powershell-ou-pwsh-absoluto>' -NoProfile -NonInteractive -File '<repo>\scripts\operations\run-operator.ps1' -Operation create -ProfilePath '<perfil-privado-absoluto>' -NodePath '<node.exe-absoluto>'
& '<powershell-ou-pwsh-absoluto>' -NoProfile -NonInteractive -File '<repo>\scripts\operations\run-operator.ps1' -Operation verify -ProfilePath '<perfil-privado-absoluto>' -NodePath '<node.exe-absoluto>' -Archive '<archive.scbackup-absoluto>'
```

4. Exija `create` com código 0 e `verify` em **outro processo**, com a chave/ID originais. Confira `.report.json`, nome/hash do archive, contagens e integridade; não publicar dados do dump ou nomes de objetos. Preserve a última cópia válida se uma execução falhar.
5. Remova a declaração de quiescência/reabra escritores só após a operação terminar e o operador confirmar o resultado. Defina retenção/cópia independente sem apagar archives necessários ao restore.

### 4.4 Preparar agendamento desabilitado

No **Task Scheduler/Agendador de Tarefas** do Windows, prepare uma tarefa **desabilitada**, sob a mesma identidade que criou o perfil DPAPI. Ação: caminho absoluto de `powershell.exe`/`pwsh.exe`, com os argumentos de `create` acima. O XML guarda caminhos, nunca valores secretos. Configure **Do not start a new instance** e uma janela local acordada; `03:30` é apenas exemplo.

Não habilitar backup diário unattended neste estado. Falta estabelecer e validar como pausar **todos** os escritores e comprovar ausência de operações em voo a cada disparo; a flag `YES` não faz isso. Enquanto essa rotina não existir, manter backup manual supervisionado. Verificação offline de um archive já conhecido pode ser agendada separadamente.

Depois da rotina segura e da execução manual, Root observa um disparo real, confirma os códigos e o `verify`, e só então registra agendamento ativo. Computador desligado, unidade desmontada, perda da identidade DPAPI ou writers ativos não devem produzir um falso sucesso. [Agendamento existente](backup-restore-release.md#task-scheduler-manual).

### 4.5 Restaurar em destino descartável e conferir Cofre

**Escolha sua:** autorizar/criar um projeto Supabase novo, vazio e descartável na organização pessoal, com versões compatíveis. O ref deve ser diferente de `rishenjoikgmfubmnfiu`. O aplicativo de produção continua apontando à origem; não editar seus pins/CSP/env para usar o alvo.

1. Preserve o archive original e seu `verify`. No alvo, confirme zero usuários Auth, objetos/buckets e tabelas de aplicação; revise papéis/extensions/owners compatíveis. **Não aplicar 001–019 antes do restore**: o dump já inclui schema. O mecanismo faz `--clean --if-exists` e exige autorização específica do alvo descartável.
2. Crie **outro perfil DPAPI**, usando a mesma chave/ID que abre o archive e os nomes abaixo:

| Nomes de restore | Valor/regra |
| --- | --- |
| `SC_RESTORE_PROJECT_REF`, `SC_RESTORE_CONFIRM_PROJECT` | Mesmo ref do alvo novo e distinto da origem |
| `SC_RESTORE_ISOLATED` | Literal `YES` após confirmar isolamento |
| `SC_RESTORE_SUPABASE_URL`, `SC_RESTORE_SUPABASE_KEY` | URL exata e chave privada do alvo, nunca da origem |
| `SC_RESTORE_PG_RESTORE`, `SC_RESTORE_PSQL` | Caminhos absolutos dos executáveis compatíveis |
| `SC_RESTORE_PGHOST`, `SC_RESTORE_PGPORT`, `SC_RESTORE_PGDATABASE`, `SC_RESTORE_PGUSER`, `SC_RESTORE_PGPASSWORD`, `SC_RESTORE_PGSSLMODE`, `SC_RESTORE_PGSSLROOTCERT` | Conexão/certificado do alvo; regras equivalentes às de `PG*`, com senha privada |

3. Root revisa o alvo/perfil e executa `run-operator.ps1 -Operation restore`, com `-Archive`, usando os caminhos absolutos do passo anterior. Nunca restaurar sobre o pessoal original.
4. O CLI autentica o archive antes das conexões; `pg_restore` conserva owners/ACLs. Papel ausente/permissão incompatível deve falhar; não usar `--no-owner`/`--no-acl` para ocultar divergência. Compare owners, grants, papéis gerenciados e catálogo da origem/alvo. Importação com código 0 não certifica permissões ou desbloqueio do Cofre.
5. Banco e uploads não são uma transação única. Se falhar depois do commit do banco, não continuar num alvo parcial: Root decide descartar/recomeçar em outro vazio. Não há retry automático ou exclusão de projetos pelo CLI.
6. Antes de abrir o alvo ao ensaio, trate sessões/refresh tokens restaurados pelo procedimento Auth supervisionado, preservando UUIDs; backup/restore não altera passwords nem revoga essas sessões automaticamente.
7. Use a [ferramenta privada de aceitação](../../scripts/operations/restore-acceptance-cli.mjs) e o inspector offline descritos no [runbook](backup-restore-release.md#ferramenta-privada-para-aceitar-cofre-e-arquivos-restaurados). O operador prepara o manifesto com dados conhecidos de um usuário comum autorizado: ref da organização/alvo, hash do archive, IDs originais de 1–10 itens Cofre e de 1–10 arquivos conhecidos Captura/Avatar, com SHA-256 e bytes. O template `prepare` possui exemplo histórico `kind:"drive"`; para este MVP selecione `capture_image`/`avatar`, aceitos pelo código.
8. A ferramenta usa **outro ambiente privado** `SC_RESTORE_ACCEPT_*`: confirma alvo/usuário, PAT Management pessoal explícito para conferir as organizações, publishable/Storage keys do alvo, credenciais da conta comum restaurada, conexão `PSQL/PG*` do alvo e diretório privado de saída. O wrapper `run-operator.ps1` **não aceita** esses nomes; não adicioná-los ao perfil de backup. A lista completa e os guards estão no [config original](../../scripts/operations/restore-acceptance-config.mjs). Não extrair tokens de conectores nem colocar valores em argv.
9. Após revisão, Root usa `prepare` sem rede, `execute <manifesto-privado-absoluto>` supervisionado e `inspect` local. O reader faz login/logout local dessa conta no alvo, compara bytes e exporta pacote cifrado; não escreve domínio nem cria usuário. Você importa o pacote no inspector e verifica, separadamente, senha mestra **original** e kit original de duas partes numa sessão nova. Senha/kit ficam no navegador local, nunca no CLI/servidor/ambiente. A chave de backup não abre o Cofre.
10. Registre apenas ref descartável autorizado, horário, hash do archive/pacote, contagens, integridade, catálogo/desvios e aprovação manual de owners/Auth/Storage/Cofre. O ensaio de senha/kit prova a fixture criptográfica; não substitui jornadas/RLS do aplicativo. Depois da revisão, você autoriza a exclusão do projeto descartável.

**Entrega do backup:** archive externo verificado, custódia recuperável da chave, restore real em destino compatível/descartável, bytes comparados e Cofre recuperado por senha e kit, owners/grants/Auth/Storage conferidos. Teste descartável local dos componentes pode antecipar defeitos, mas não substitui o aceite do backup externo agendado da issue #35.

## 5. Pacote final de entregas e verificações

| Frente | Entrega sua | Evidência fechada que Root anexa |
| --- | --- | --- |
| SMTP | Domínio/remetente/fornecedor e configuração salvos; conta comum autorizada disponível | Entrega do e-mail e recuperação completa, horário/estado; sem link ou senha |
| Google | Consentimento/client Web/scopes/duas contas/variáveis/scheduler escolhidos | Conexão/filtros/revogação reais, contagens de sync e registro Admin; sem tokens/eventos privados |
| Backup | Destino/ACL/perfis/chaves/janela/target descartável preparados | Archive/hash/verify, execução/restore real, ownership/catálogo/bytes e Cofre; sem dump/kit |
| Produção/aparelhos | Janela humana e Android/iPhone, quando retomados | Jornadas e aceite físico conforme critérios já existentes; não substituir por viewport/emulação |

Root executa os checks afetados uma vez por lote/SHA aprovado e reutiliza as provas já válidas de Auth, catálogo, Avatar, SDK/SQL, qualidade e build. Repetição fica para mudança, falha ou preocupação específica. Configurar um serviço não fecha automaticamente uma issue, não exige novos gates para #24/#37 e não transforma CI ou simulação em aceite físico/produção.

### Resposta que você pode enviar ao concluir a preparação

Preencha somente os campos não secretos; use **pendente** quando ainda não tiver concluído. Os caminhos devem apontar a arquivos privados, sem anexar seu conteúdo.

```text
SMTP
- Serviço:
- Domínio e remetente:
- DNS verificado / tracking desativado:
- SMTP salvo no Supabase pessoal:
- Conta comum autorizada disponível para teste: sim / pendente

Google
- Projeto pessoal e cliente Web criados:
- API Calendar, quatro scopes e callback exato configurados:
- Duas contas adicionadas como test users:
- Seis variáveis Google obrigatórias em Production: presentes / pendente
- Keyring opcional: ausente inicialmente / configurado para rotação
- URL do deployment aprovado:
- Executor escolhido e segredo cadastrado nele:

Backup
- Caminho absoluto do destino e estado da ACL:
- Caminhos e versões de pg_dump, pg_restore e psql:
- Caminhos dos perfis privados, sem seus conteúdos:
- Custódia separada de chave/ID: preparada / pendente
- Ref do projeto descartável pessoal autorizado, diferente da origem:
- Janela proposta sem escritores:
- Tarefa de agendamento: preparada e desabilitada / pendente
```

Se não houver domínio de envio, unidade de backup ou projeto descartável disponível, informe essa ausência. Não substitua por recursos da empresa. Com essa resposta, Root identifica exatamente o que está pronto para conferir e organiza uma única rodada supervisionada; os resultados reais de SMTP/OAuth/backup/restore continuam sendo registrados depois da execução.

## 6. Fontes verificadas e limites desta autoria

Os caminhos de configuração/CLI, nomes de variáveis, callbacks, scopes, cookies de fluxo e guards foram conferidos no código vigente: [Auth config](../../src/lib/auth/config.ts), [Auth service](../../src/lib/auth/service.ts), [Google security](../../src/adapters/db/google-calendar-security.ts), [Google service/scopes](../../src/core/calendario/service.ts), [Google cron](../../scripts/operations/google-calendar-cron.mjs), [backup config](../../scripts/operations/backup-config.mjs), [restore target](../../scripts/operations/restore-target.mjs) e [perfil operador](../../scripts/operations/run-operator.ps1).

As fontes oficiais de Supabase, Resend, Google, Vercel, GitHub e PostgreSQL citadas em cada passo foram consultadas em 12/10/2026. Menus podem mudar; confirmação autenticada e execução real continuam pendentes. A consulta inicial a `supabase.com/changelog.md` não foi renderizada pelo navegador documental devido ao tipo `text/markdown`; isso não foi tratado como confirmação de ausência de mudanças. O guia não depende de uma mudança de SDK/CLI ou de um valor de versão hospedada presumido.

Nenhuma conta/serviço foi criado, nenhum segredo consultado, mensagem enviada, alteração de painel aplicada, cron ativado, DDL executado, backup/restore real realizado ou teste físico declarado nesta autoria. O estado atual e as provas próprias permanecem no [guia de entrega](../implementation/entrega-mvp-pendencias.md), nas [decisões operacionais](../implementation/decisoes-operacionais.md) e nos runbooks ligados acima.
