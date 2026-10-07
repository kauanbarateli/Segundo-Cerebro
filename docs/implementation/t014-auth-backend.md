# T014 — autenticação preparada no servidor

Implementação local em 07/10/2026, inicialmente sem conexão. **As três migrations foram aplicadas por MCP ao projeto pessoal `rishenjoikgmfubmnfiu`; as três asserções SQL passaram, com rollback conferido**, conforme [relatório da aplicação](t013-aplicacao-supabase.md) e autorização da [OP-009](decisoes-operacionais.md#op-009--conexão-pessoal-e-aplicação-supervisionada). PostgreSQL 17.11 e nove tabelas com RLS foram confirmados. Os testes usam fixtures SQL, não login ou e-mail real. Credenciais server-only e configuração Auth/callbacks continuam pendentes; SMTP e recuperação por e-mail foram postergados pelo mantenedor (OP-010). OAuth do MCP não configura o aplicativo. BlackSheep e Sistema VOE continuam fora do escopo; CI/build/deploy não aplicam schema automaticamente.

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

## Primeira conta e papel master

O mantenedor criará a primeira conta no Dashboard Auth Users do projeto pessoal, sem depender de convite por e-mail. O acesso solicitado como “SUPERADMIN” corresponde a `master` em `public.user_roles`, o nível administrativo já modelado. O usuário Auth deve permanecer com papel `authenticated`; inserir `SUPERADMIN` em metadata ou alterar o papel Auth não concede acesso administrativo ao aplicativo. O master também continua sujeito a sessão ativa, moderação e Entitlement.

Antes da promoção, conferir no projeto pessoal o UUID exato copiado de Auth Users e a conta correspondente. O papel Auth deve continuar `authenticated`, com e-mail confirmado para entrada por senha sem depender de SMTP, conta não anônima, não excluída e sem ban ativo. Conferir também o provisionamento da identidade, moderação `active`, `must_change_password=false` e ausência de veto explícito `admin` nos Entitlements. A verificação não altera Auth, moderação ou Entitlements; qualquer divergência exige revisar a conta antes de promover. Não inserir `SUPERADMIN` em Auth ou metadata nem corrigir divergências com alteração direta de papel.

Usar a RPC privilegiada `public.bootstrap_master(uuid)` pelo [modelo de bootstrap](../../supabase/manual/bootstrap-master.sql), em conexão autorizada. Substituir o placeholder pelo UUID conferido e executar **o batch inteiro**, do `BEGIN` ao `ROLLBACK`. O `SET LOCAL app.bootstrap_master_user_id` está dentro da mesma transação da chamada, sem depender de afinidade de conexão entre execuções do SQL Editor/MCP. O resultado mostra o UUID e o papel `master`, mas o `ROLLBACK` final desfaz a promoção.

Após validar esse resultado e decidir persistir, repetir **todo o mesmo batch com o mesmo UUID**, trocando somente o `ROLLBACK` final por `COMMIT`; conferir depois o papel persistido para esse UUID. Executar um `COMMIT` isolado após a simulação não promove nada, pois a transação já foi desfeita. Não remover a chamada à RPC nem substituí-la por `UPDATE public.user_roles`.

O bootstrap serializa tentativas com um lock transacional: repetir o mesmo UUID ativo que já é o único master não duplica a promoção/evento; tentar outro UUID quando já existe um master é recusado. Também recusa conta indisponível ou troca de senha obrigatória. Isso não torna o bootstrap um mecanismo geral para promover usuários nem remove veto de Entitlement. Nenhuma conta real ou bootstrap persistente foi executado nesta entrega.

SMTP, templates e recuperação por e-mail ficam postergados por decisão do mantenedor, conforme [OP-010](decisoes-operacionais.md#op-010--primeira-conta-e-smtp-postergado). Essa decisão permite prosseguir na configuração de entrada por senha e do ambiente, mas não demonstra envio de mensagens nem encerra os critérios de recuperação de T-014.

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

Procedimento supervisionado autorizado pela OP-009; registrar o resultado de cada etapa, sem inferir sucesso a partir da conexão:

As etapas de instalação e asserções SQL já foram concluídas neste projeto; versões e hashes estão no relatório. Não reaplicar as migrations. A sequência abaixo permanece referência para as etapas de configuração ainda pendentes e para instalações futuras em destinos autorizados.

1. Conferir o destino pessoal autorizado `rishenjoikgmfubmnfiu`, schema Auth, owner e exposed schemas. A inspeção inicial encontrou Auth sem contas; reconferir o estado antes da migration inicial. Nunca selecionar projeto/credencial BlackSheep ou VOE.
2. Conferir hashes no [pacote SQL Editor](../../supabase/sql-editor/README.md), revisar e aplicar cada migration canônica completa em ordem pela conexão autorizada, ou manualmente pelo SQL Editor. Interromper ao primeiro erro e registrar destino, versão, hash, canal e resultado real. Executar as três asserções separadas com rollback antes da primeira conta; bootstrap fica separado. Não executar reset/seeds nem aplicação automática pelo CI/build/deploy.
3. No **Dashboard Auth**, desabilitar cadastro público e usuários anônimos; habilitar e-mail/senha e confirmar a estratégia de criação de contas pelo administrador. O SQL não configura esses itens e não oferece cadastro alternativo.
4. Configurar Site URL igual a `APP_URL` e allowlist restrita do callback `/auth/callback` no origin aprovado. O redirect inclui `state` e o PKCE pode incluir `sb_flow_id`; conferir que o projeto preserva esses parâmetros e rejeita hosts externos. Não liberar wildcard de domínio. Testar o fluxo no mesmo navegador que iniciou a recuperação.
5. **Postergado por OP-010:** configurar SMTP próprio, remetente verificado e template de recuperação compatível com o link PKCE do Auth (`ConfirmationURL`). Quando esse recorte for retomado, não trocar por fluxo implícito/fragmento de token ou template `token_hash` que o callback atual não implementa. Verificar entregabilidade, limites nativos de e-mail e duração do link. A mensagem pública genérica não comprova envio.
6. Configurar política de senha compatível, **Require current password when changing password** ligado e reautenticação recente. A aplicação cria sessão recente na troca normal e a recuperação PKCE também cria sessão própria. O código Auth consultado dispensa `current_password` apenas quando `session.IsRecovery()` é verdadeiro. Nonce de reautenticação por e-mail para sessões antigas não é um fluxo implementado; a troca normal faz nova entrada com a senha atual.
7. Configurar as variáveis server-only, com segredos distintos, no ambiente autorizado e então selecionar `APP_MODE=supabase`. Revisar cookies, TLS, domínio e cache no deploy/CDN: respostas pessoais/refresh não podem ser compartilhadas; cache mínimo de CDN deve ser zero.
8. Só depois executar os testes reais abaixo e registrar resultados. Os tipos do schema já foram gerados via MCP; sua integração e validação no código são separadas. A UI em modo real ainda não equivale ao adapter de Capturas/Tarefas de T015; manter a limitação visível.

## Limites e evidência

Login usa `consume_rate_limit(scope='login')` com HMAC do e-mail normalizado e namespace de operação. Recuperação usa chave separada e o mesmo teto de cinco tentativas por minuto. Senha usa `identity_write` com usuário/sessão verificados e sua reautenticação consome também o mesmo limite de login por e-mail antes de verificar a credencial. O banco fornece a janela persistente: asserções SQL sequenciais provaram a sexta tentativa recusada e a fronteira da janela. Mocks locais verificam a ordem do canal; concorrência e login entre instâncias reais continuam pendentes. Não se confia em `x-forwarded-for` arbitrário. Limitação adicional por origem de rede confiável, defesa contra abuso distribuído e recuperação fora do mesmo navegador permanecem decisões futuras explícitas.

O ensaio posterior despachou seis chamadas MCP em paralelo e obteve cinco permissões e uma recusa, com cinco hits confirmados no banco. Apesar dos seis PIDs distintos, as execuções não se sobrepuseram; o transporte as serializou. O verificador recusou a evidência de concorrência, que permanece **inconclusiva e pendente**. A chave aleatória exclusiva foi removida e sua ausência conferida, sem fixture Auth nesse ensaio. Horários, resultados e limpeza estão no [relatório T-013](t013-aplicacao-supabase.md#ensaio-do-limitador-concorrência-inconclusiva).

Validação local preparada/executada: testes unitários de configuração, destinos/origem, DTO/Entitlement, bytes de senha, assinatura/expiração, replays de conclusão, erros parciais, cookies/headers/refresh, chamadas diretas de actions e guards. SDK, rede e RPCs são substituídos por doubles nesses testes. Typecheck e lint focado foram executados; testes de UI/CSP/bundle e integração final são coordenados pela raiz. A skill Supabase e as práticas aplicáveis foram consultadas. A preparação inicial não executou SQL; a OP-009 permite agora as verificações supervisionadas no projeto pessoal, cujos resultados devem ser registrados separadamente.

Após a integração, `npm run check` passou com 727 testes, TypeScript/ESLint/build/camadas, 164 verificações de contraste, gerador e scanner de 50 bundles. Isso não substitui Auth real nem o ensaio de concorrência ainda pendente.

O relatório registra RLS/grants e isolamento testados no banco com papéis/claims sintéticos, além de atomicidade e replay da conclusão de senha. Continuam pendentes pelos canais reais: envio/recebimento de e-mail, PKCE/templates, sexta tentativa bloqueada entre instâncias, refresh/chunking, cookies HTTPS/CDN, logout/revogação imediata, bloqueio com JWT ainda válido, senha provisória e isolamento entre dois usuários autenticados. Falhas entre Auth/RPC, resposta perdida e concorrência de troca/revogação também permanecem pendentes. Não se declara T014 inteiramente aceita com fixtures SQL, unitários ou build verde.

Fontes oficiais verificadas em 07/10/2026: [SSR avançado](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [sessões](https://supabase.com/docs/guides/auth/sessions), [recovery por e-mail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [exchange PKCE](https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession), [segurança de senhas](https://supabase.com/docs/guides/auth/password-security), [limite de bytes no Auth](https://github.com/supabase/auth/blob/master/internal/api/password.go), [reautenticação/current_password/recovery no Auth](https://github.com/supabase/auth/blob/master/internal/api/user.go), [SSR 0.12.7](https://github.com/supabase/ssr/releases/tag/v0.12.7), [supabase-js 2.117.2](https://github.com/supabase/supabase-js/releases/tag/v2.117.2) e [changelog](https://supabase.com/changelog). A arquitetura exclusivamente servidor permite `httpOnly` apesar de exemplos genéricos SSR preverem browser client para renovar sessão.
