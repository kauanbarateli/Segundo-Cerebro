# Domínio público: login, recuperação e Google Calendar

## Estado observado

Em 21/10/2026, Vercel voltou a permitir leitura e deploy no projeto `segundo-cerebro-of`, equipe `kauanbarateli-projects`. Domínios raiz/www verificados; raiz redireciona com HTTP 308 para www. O deployment `dpl_52eJwrhdzLaQmc9DW5wqrhtFT1d1` publicou o SHA revisado `b67f58ac3973fcef5f45daa23f36cdf84432a3fb` da PR #70, com 17 checks aprovados, sem a migration 020 ou SQL remoto.

Leituras HTTP deram200 em `/privacidade`, `/termos-de-servico`, `/conheca` e `/entrar`. Links legais foram encontrados. Isso não certifica login. Um único POST do formulário original em www, com e-mail/senha vazios, retornou **origem recusada**, antes de chamar login, limitador ou e-mail; nenhuma credencial/conta real foi enviada.

O guard de `src/lib/auth/actions.ts` compara exatamente a origem do formulário com `APP_URL`. Portanto, a configuração efetiva não está alinhada ao domínio www. Não flexibilizar esse guard para aceitar qualquer host. A leitura Vercel das variáveis sensíveis confirmou apenas metadados, sem devolver seus valores; não é prova do conteúdo atual de `APP_URL`.

## 1. Preparar os destinos no Supabase pessoal

Responsável: mantenedor, enquanto a conexão Supabase recusa acesso ao projeto pessoal. Não usar BlackSheep, VOE ou Ensaio_restore.

1. Abra [URL Configuration do projeto pessoal](https://supabase.com/dashboard/project/rishenjoikgmfubmnfiu/auth/url-configuration).
2. Em **Site URL**, prepare `https://www.segundocerebroapp.com.br` como endereço público final.
3. Em **Redirect URLs**, adicione `https://www.segundocerebroapp.com.br/auth/callback`. Preserve temporariamente os destinos específicos anteriores até concluir a transição; não habilite domínios ou previews por wildcard.
4. Mantenha o template de recuperação baseado em `{{ .ConfirmationURL }}`. Não altere senha, SMTP, signup ou chaves para corrigir somente o domínio.
5. Salve e informe apenas que as URLs estão configuradas. O ensaio real ainda precisa comprovar a preservação de `state` e dos parâmetros PKCE no retorno; não afirmar esse aceite por salvar a lista.

O aplicativo acrescenta `state` aleatório ao callback e valida nonce/e-mail/sessão. O callback Supabase não é o callback Google Calendar. [Documentação Supabase sobre URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## 2. Preparar o callback no cliente Google existente

1. Abra o projeto pessoal usado pelo Calendar no [Google Cloud Console](https://console.cloud.google.com/).
2. Abra **Google Auth Platform → Clients** (ou **APIs e serviços → Credenciais**, conforme a interface) e selecione o **cliente Web já usado pelo Segundo Cérebro**.
3. Em **Authorized redirect URIs / URIs de redirecionamento autorizados**, acrescente exatamente:

```text
https://www.segundocerebroapp.com.br/api/calendar/oauth/callback
```

4. Preserve o URI anterior durante a transição. Não troque Client ID/secret, crie outro cliente ou amplie escopos. O fluxo é server-side; não precisa acrescentar origens JavaScript por tentativa.
5. Salve e informe apenas que o URI está cadastrado. A propagação e o retorno real ainda serão validados.

O código deriva esse URI de `APP_URL` e da constante `GOOGLE_CALLBACK_PATH`. Recuperação usa `/auth/callback`; Calendar usa `/api/calendar/oauth/callback`. [Documentação Google para cliente Web e redirect URIs](https://developers.google.com/identity/protocols/oauth2/web-server).

## 3. Concluir a troca na Vercel

Após os dois preparos, Root ajusta **somente `APP_URL` de Production** para `https://www.segundocerebroapp.com.br`, preservando as demais variáveis, e gera um novo build do mesmo candidato revisado. Não copiar segredos para o chat/Git, alterar Preview/Development ou modificar o banco.

As variáveis são incorporadas ao deployment; salvar não altera o build já existente. O novo deployment deve estar READY e vinculado ao mesmo projeto/SHA. Não publicar a PR91 enquanto020/gates próprios estiverem pendentes.

## 4. Aceite da transição

- O POST vazio do formulário original passa da verificação de origem e retorna erro de campo, sem chamar autenticação/limite/e-mail.
- O mantenedor entra normalmente em www, sem fornecer senha à Root.
- O ensaio de recuperação usa conta comum autorizada, link no mesmo navegador que iniciou o PKCE e confirmação humana, sem compartilhar link/código/senha.
- Calendar continua lendo as contas existentes; uma conexão/retomada autorizada volta ao mesmo www com nonce e PKCE válidos, sem solicitar permissões novas.
- Conferir o comportamento do endereço antigo antes de encerrar sua transição. Não remover callbacks usados por fluxos ainda em andamento nem supor que cookies migram entre hosts.

Páginas legais acessíveis e build READY não encerram #44/#68/#81, revisão do inventário internacional, aplicação020 ou aceites reais acima. Nenhuma contratação foi aberta por esta troca de domínio.

## Resultado da configuração

O mantenedor confirmou a configuração das URLs no Supabase pessoal e do URI no cliente Google existente. A Root alterou somente `APP_URL` de Production na Vercel, mantendo seu tipo/escopo e as demais variáveis; a API confirmou ID/chave/escopo/atualização, mas não devolveu o valor sensível como prova legível.

Novo deployment `dpl_2HTfZ1ePMb759Uw2onhFqi76buX5`, mesmo SHA aprovado `b67f58a`, terminou READY em produção com os domínios atribuídos. O POST vazio do formulário original em www passou a retornar **HTTP200 / erro de e-mail válido**, com `originRejected=false`, `fieldValidation=true`, `authUnavailable=false`. Isso comprova o alinhamento da origem efetiva sem credenciais e sem chamada de login/limite/e-mail. Nenhum código de autenticação ou guard foi flexibilizado.

O mantenedor confirmou login real e reconexão de uma conta Google no domínio novo. Inicialmente não apareceram eventos; após habilitar a agenda na seleção de Calendários, confirmou a visualização das informações. Isso valida a leitura da fonte selecionada; não certifica automaticamente todas as contas/períodos ou o fluxo de recuperação PKCE.

O diagnóstico não exigiu modificar o produto, desconectar contas, apagar espelhos ou reaplicar schema. Consultas de runtime não encontraram erros registrados, sem confundir isso com prova de importação. A rotina diária de20/10 (`39405805128`) retornou `SYNC_FAILED/503`, complete0/failed2; a de21/10 (`39583365671`), anterior à reconexão humana, retornou `OK/200`, complete0/failed0 — nenhuma conta elegível processada, não zero eventos. O scheduler permaneceu habilitado. Um GET sem autenticação no endpoint antigo retornou403/FORBIDDEN sem redirect; o endereço antigo não foi demonstrado como causa dos eventos ausentes. Sua migração operacional e o próximo resultado diário precisam de conferência própria, sem retry automático.

Recuperação real ainda precisa de resultado próprio. Não transferir a ela o aceite do POST vazio ou do login. Os endereços/callbacks antigos não foram removidos. A Root não alterou plano de hospedagem, chaves, permissões Google ou schema remoto. Registro no GitHub: [validação do domínio](https://github.com/kauanbarateli/Segundo-Cerebro/pull/70#issuecomment-6317753947).

## Recuperação: destino antigo no e-mail recebido

No ensaio humano posterior, o e-mail chegou, mas seu destino de retorno era a raiz de `segundo-cerebro-of.vercel.app`; o mantenedor encontrou a tela de login. Entrega do e-mail foi observada, **definição da nova senha e login posterior no domínio www não foram validados**. Não reutilizar esse link: solicitar outro somente depois de conferir a configuração, no mesmo navegador que iniciar o pedido.

A revisão do SHA de produção `b67f58a` confirmou que o aplicativo solicita `/auth/callback` na origem configurada e acrescenta `state` aleatório. O adapter repassa esse destino a `resetPasswordForEmail`. Um retorno à raiz antiga, sem essa rota, não demonstra falha no nonce ou no PKCE e não autoriza flexibilizar essas verificações.

A Root solicitou conferir os três pontos do projeto pessoal: Site URL em www; callback exato na lista permitida; botão Reset Password baseado em `{{ .ConfirmationURL }}`, sem URL antiga fixa. O Supabase recusou a leitura pela integração; a causa exata continua pendente dessa conferência. Metadados de uma variável sensível da Vercel não provam seu valor, e probes públicos inconclusivos não receberam aceite. Produção permanece no mesmo SHA/novo deployment READY, sem mudança de código ou de configuração nesta investigação.

Site URL é o destino padrão quando o pedido não informa um retorno aceito; o template também pode alterar o link enviado. Conferir a configuração efetiva antes de atribuir a causa a qualquer um deles. Fontes: [URLs de retorno](https://supabase.com/docs/guides/auth/redirect-urls) e [variáveis dos templates de e-mail](https://supabase.com/docs/guides/auth/auth-email-templates).
