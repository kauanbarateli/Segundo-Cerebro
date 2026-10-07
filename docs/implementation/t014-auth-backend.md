# T014 — autenticação preparada no servidor

Implementação em arquivos, em 07/10/2026. **Não há projeto conectado, credenciais configuradas, SQL aplicado ou autenticação real validada.** A organização de destino é exclusivamente pessoal; BlackSheep e Sistema VOE estão fora do escopo. OP-002, OP-007 e OP-008 prevalecem sobre a aplicação automática de schema prevista nos documentos históricos.

## Implementado

- `APP_MODE=demo` por padrão, sem instanciar clientes Supabase. `APP_MODE=supabase` exige configuração completa e válida; erro nunca vira uma sessão de demonstração.
- Clientes criados por requisição, somente no servidor, com `fetch(...,{cache:'no-store'})`. Cliente privilegiado criado apenas quando uma operação o exige, sem sessão persistente. Nenhum browser client, JWT ou refresh token é entregue por props/actions.
- Cookies de sessão, fragmentos, PKCE, recuperação e remoção sempre `httpOnly`, `sameSite=lax`, `path=/`, sem domain compartilhado e `secure` em HTTPS/produção. A ponte do middleware propaga cookies renovados tanto à resposta quanto à requisição encaminhada, preservando nonce/CSP e os headers de cache do SSR.
- `getUser()` precede claims verificados e `my_access_state`. Claims servem para correlacionar a sessão; não substituem o usuário autenticado nem a moderação/Entitlement atual do banco. O DTO deve pertencer ao usuário e ter tipos/chaves reconhecidos. Metadata editável não concede papel.
- Guards por operação: `requireUser`, `requireFeature` e `requireMaster`. Preferência oculta não revoga direito; veto impede operação inclusive de master. Senha provisória redireciona para troca e só aceita o DTO mínimo emitido pela RPC.
- Server Actions validam origem e campos independentemente da UI. Login não enumera contas, recuperação tem resposta pública genérica, limites persistentes falham fechados e retornos só aceitam destinos internos seguros.
- Recuperação PKCE pelo mesmo navegador, com nonce aleatório no callback, cookie assinado e HMAC do e-mail solicitado. Após exchange, a prova curta exige usuário/e-mail/sessão verificados. Código/state não aparecem em avisos nem logs; callback redireciona removendo-os da URL e usa `Referrer-Policy: no-referrer`.
- Logout real somente `POST /auth/logout` com origem validada. GET não executa saída. Limpa os cookies do aplicativo mesmo quando a revogação remota falha e informa essa limitação; resposta remove cache/storage local via `Clear-Site-Data` em navegadores compatíveis.

## Interface dos canais

`src/lib/auth/actions.ts` exporta `signInAction`, `recoverPasswordAction` e `updatePasswordAction`, cada uma com `(previousState, FormData)`. O estado público contém status, mensagem, erros de campo, espera do limitador e, quando necessário, `completionPending`. Esse booleano orienta a UI; **nunca autoriza** concluir uma troca. O backend sempre verifica o checkpoint assinado e a identidade/sessão corrente.

Rotas: `/entrar`, `/recuperar-senha`, `/redefinir-senha`, `/trocar-senha`, `GET /auth/callback` e `POST /auth/logout`. Campos: `email`, `password`, `confirmPassword`, `currentPassword`, `returnTo`. Senha atual é exigida também para a senha provisória, salvo recuperação comprovada ou conclusão pendente. Não há cadastro público, magic link, OAuth Google ou TOTP implementado nesta entrega.

Nova senha: mínimo de 12 pontos de código Unicode, teto de 72 bytes UTF-8 e recusa de controles ASCII. O teto acompanha o `len(password)` do Auth/bcrypt; não se trunca nem transforma a senha. Confirmação deve coincidir exatamente. O provedor pode aplicar requisitos adicionais configurados no Dashboard, que precisam ser conciliados manualmente com a política de produto.

## Troca de senha e falha parcial

Auth e Postgres não compartilham transação. A ordem é:

1. Validar sessão/estado atual e limite persistente. Fora do recovery, reautenticar com senha atual e enviar `current_password` ao `updateUser`.
2. Confirmar `updateUser({password,...})` e a identidade da sessão que continua ativa. Criar checkpoint assinado/httpOnly de até 15 minutos, contendo apenas usuário, sessão e `client_id`; nunca senha, hash de senha ou tokens.
3. Revogar as outras sessões. Só depois chamar `complete_password_change(p_user,p_session,p_client_id)` no canal privilegiado. A migration complementar confere a sessão e grava flag/evento/recibo na mesma transação; metadata de autenticação não contém senha.
4. Efetuar saída global, limpar os cookies e pedir nova entrada. A confirmação da troca não mantém uma sessão aberta automaticamente.

Se revogação das outras sessões ou RPC falhar, o checkpoint permite repetir apenas a conclusão, usando o mesmo `client_id`; a UI oculta os campos e oferece concluir a proteção. Limitação/erro transitório preserva esse estado enquanto o checkpoint é válido. Se ele expirar ou pertencer a outra sessão, a autorização desaparece.

Se a senha mudou, mas a leitura de identidade falhou **antes** do checkpoint, a saída local ocorre e o aviso pede nova entrada com a senha nova. Sem prova suficiente, o backend não limpa a flag provisória. Pode ser necessário concluir pela recuperação ou por nova troca após entrar; uma operação Auth que efetivou a mudança mas perdeu a resposta não pode ser reconstruída como se nada tivesse ocorrido.

Falha na saída global final é diferente: o SDK pode remover a sessão local mesmo retornando erro. Como senha, revogação das outras sessões e RPC já foram confirmadas, o backend limpa o checkpoint e informa saída local/revogação final não confirmada, sem prometer retry por uma sessão removida. Entrar e sair novamente é a tentativa disponível; a validação real desse cenário continua pendente.

## Configuração manual, fora do SQL Editor

O arquivo `.env.example` tem nomes sem credenciais. Valores reais ficam no cofre de ambiente do deploy ou arquivo local fora de pastas sincronizadas; não copiar credenciais existentes de outro sistema. Não usar variáveis `NEXT_PUBLIC_*` para Auth deste aplicativo.

| Variável | Valor esperado |
|---|---|
| `APP_MODE` | `demo` ou, por escolha explícita, `supabase` |
| `APP_URL` | Origin canônica do aplicativo, HTTPS em produção, sem caminho/query/fragmento |
| `SUPABASE_URL` | Origin do projeto pessoal novo; sem caminho/query/fragmento |
| `SUPABASE_PUBLISHABLE_KEY` | Chave atual `sb_publishable_...`, usada apenas pelo servidor |
| `SUPABASE_SECRET_KEY` | Chave atual `sb_secret_...`, exclusiva desse projeto e só no servidor |
| `AUTH_RATE_LIMIT_SECRET` | Segredo aleatório independente com pelo menos 32 bytes |
| `AUTH_STATE_SECRET` | Outro segredo aleatório independente com pelo menos 32 bytes |

O código aceita HTTP somente para localhost em desenvolvimento. Não há fallback para as chaves JWT legadas nem inferência de organização a partir de uma chave; confirmar origem e titularidade é uma etapa manual. Rotacionar `AUTH_STATE_SECRET` invalida provas/checkpoints em andamento; rotacionar `AUTH_RATE_LIMIT_SECRET` muda as chaves dos limites correntes. Fazer isso deliberadamente e registrar o procedimento operacional.

Procedimento futuro do mantenedor, **não executado** nesta entrega:

1. Confirmar a organização pessoal, projeto novo dedicado e custo. Nunca selecionar projeto/credencial BlackSheep ou VOE. Conferir schema Auth, owner e exposed schemas antes de aplicar qualquer arquivo.
2. Usar [o pacote SQL Editor](../../supabase/sql-editor/README.md): conferir hashes localmente, revisar e executar manualmente cada migration completa em ordem. Testes e bootstrap ficam separados, com seus pré-requisitos; não executar seed/reset/push pelo CI ou build. Registrar destino, versão, hash e resultado real.
3. No **Dashboard Auth**, desabilitar cadastro público e usuários anônimos; habilitar e-mail/senha e confirmar a estratégia de criação de contas pelo administrador. O SQL não configura esses itens e não oferece cadastro alternativo.
4. Configurar Site URL igual a `APP_URL` e allowlist restrita do callback `/auth/callback` no origin aprovado. O redirect inclui `state` e o PKCE pode incluir `sb_flow_id`; conferir que o projeto preserva esses parâmetros e rejeita hosts externos. Não liberar wildcard de domínio. Testar o fluxo no mesmo navegador que iniciou a recuperação.
5. Configurar SMTP próprio, remetente verificado e template de recuperação compatível com o link PKCE do Auth (`ConfirmationURL`). Não trocar por fluxo implícito/fragmento de token ou template `token_hash` que o callback atual não implementa. Verificar entregabilidade, limites nativos de e-mail e duração do link. A mensagem pública genérica não comprova envio.
6. Configurar política de senha compatível, **Require current password when changing password** ligado e reautenticação recente. A aplicação cria sessão recente na troca normal e a recuperação PKCE também cria sessão própria. O código Auth consultado dispensa `current_password` apenas quando `session.IsRecovery()` é verdadeiro. Nonce de reautenticação por e-mail para sessões antigas não é um fluxo implementado; a troca normal faz nova entrada com a senha atual.
7. Configurar as variáveis server-only, com segredos distintos, no ambiente autorizado e então selecionar `APP_MODE=supabase`. Revisar cookies, TLS, domínio e cache no deploy/CDN: respostas pessoais/refresh não podem ser compartilhadas; cache mínimo de CDN deve ser zero.
8. Só depois executar os testes reais abaixo, registrar resultados e gerar tipos reais do schema. A UI em modo real ainda não equivale ao adapter de Capturas/Tarefas de T015; manter a limitação visível.

## Limites e evidência

Login usa `consume_rate_limit(scope='login')` com HMAC do e-mail normalizado e namespace de operação. Recuperação usa chave separada e o mesmo teto de cinco tentativas por minuto. Senha usa `identity_write` com usuário/sessão verificados e sua reautenticação consome também o mesmo limite de login por e-mail antes de verificar a credencial. O banco fornece a janela persistente; mocks locais verificam a recusa e a ordem, não a concorrência real. Não se confia em `x-forwarded-for` arbitrário. Limitação adicional por origem de rede confiável, defesa contra abuso distribuído e recuperação fora do mesmo navegador permanecem decisões futuras explícitas.

Validação local preparada/executada: testes unitários de configuração, destinos/origem, DTO/Entitlement, bytes de senha, assinatura/expiração, replays de conclusão, erros parciais, cookies/headers/refresh, chamadas diretas de actions e guards. SDK, rede e RPCs são substituídos por doubles nesses testes. Typecheck e lint focado foram executados; testes de UI/CSP/bundle e integração final são coordenados pela raiz. A skill Supabase e as práticas aplicáveis foram consultadas; a proibição de conexão/aplicação atual substitui sua sugestão de testar queries num banco.

Continuam pendentes em ambiente real manualmente preparado: envio/recebimento de e-mail, PKCE e templates, sexta tentativa efetivamente bloqueada entre instâncias, refresh/chunking real, flags dos cookies no HTTPS/CDN, logout/revogação imediata, bloqueio com JWT ainda válido, usuário provisório, isolamento entre dois usuários, RLS/grants efetivos, falhas entre Auth e RPC, retorno perdido após completion e concorrência de troca/revogação. Não se declara T014 inteiramente aceita com unitários ou build verde.

Fontes oficiais verificadas em 07/10/2026: [SSR avançado](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [sessões](https://supabase.com/docs/guides/auth/sessions), [recovery por e-mail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [exchange PKCE](https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession), [segurança de senhas](https://supabase.com/docs/guides/auth/password-security), [limite de bytes no Auth](https://github.com/supabase/auth/blob/master/internal/api/password.go), [reautenticação/current_password/recovery no Auth](https://github.com/supabase/auth/blob/master/internal/api/user.go), [SSR 0.12.7](https://github.com/supabase/ssr/releases/tag/v0.12.7), [supabase-js 2.117.2](https://github.com/supabase/supabase-js/releases/tag/v2.117.2) e [changelog](https://supabase.com/changelog). A arquitetura exclusivamente servidor permite `httpOnly` apesar de exemplos genéricos SSR preverem browser client para renovar sessão.
