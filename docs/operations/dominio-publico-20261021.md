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

Login humano, recuperação e retorno Google reais ainda precisam de seus próprios resultados. Não transferir a esse teste negativo o aceite desses fluxos. Os endereços/callbacks antigos não foram removidos. A Root não alterou plano de hospedagem, chaves, permissões Google ou schema remoto.
