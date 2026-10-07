# T-014 — validação de Auth no projeto pessoal

Execução supervisionada em 07/10/2026, exclusivamente em `rishenjoikgmfubmnfiu`. A conta informada pelo mantenedor recebeu `master` por `bootstrap_master`, após simulação com rollback e aplicação com commit. A leitura posterior confirmou um evento de promoção, papel Auth `authenticated`, moderação ativa, ausência de troca obrigatória e e-mail confirmado. UUID, e-mail pessoal e credenciais não são versionados. A senha dessa conta não foi usada nos testes.

## Evidência real

A chave administrativa foi validada pela Admin API. O ensaio criou duas contas sintéticas por execução, com UUID previamente registrado, senha aleatória mantida em memória e marcador em `app_metadata`. Usou o SDK instalado e a aplicação Next em desenvolvimento em `http://127.0.0.1:3000`, com `APP_MODE=supabase`. Nenhum e-mail foi enviado.

Nas duas contas, passaram login, `getUser`, claims assinadas, `my_access_state`, leitura do próprio perfil, isolamento do perfil alheio, recusa de alteração direta de papel e saída global. Depois da saída, o JWT anterior recebeu recusa na RPC e nenhuma linha nas leituras RLS. O papel anônimo também teve acesso recusado.

Os dez cenários executados no Chromium passaram:

1. Rota protegida redireciona visitante para entrada.
2. Formulário entra com credenciais reais da conta sintética.
3. Sessão usa cookies `httpOnly`, `SameSite=Lax` e caminho `/`, inacessíveis a `document.cookie`; resposta privada tem `no-store` e CSP em bloqueio.
4. Usuário comum recebe 404 em `/admin`.
5. Segundo contexto de navegador entra na mesma conta.
6. Troca de senha exige a senha atual, termina com nova entrada obrigatória e remove cookies.
7. O outro contexto perde acesso após a troca de senha.
8. A nova senha permite entrar.
9. Logout recusa GET (405) e origem externa (403); POST da origem correta retorna 303, remove cookies e protege a navegação seguinte.
10. As cinco primeiras tentativas com senha errada recebem mensagem genérica; a sexta recebe bloqueio do limitador persistente. O banco confirmou cinco hits, separados por 4,13 segundos entre primeiro e último registro.

A primeira execução encontrou ambiguidade no seletor de alerta do teste em desenvolvimento. O seletor foi restrito ao feedback do formulário e a execução completa passou, sem alteração no comportamento da aplicação. As duas contas de cada execução foram removidas pela Admin API após conferir UUID, e-mail sintético e marcador. Os quatro hashes exatos do limitador de login foram removidos separadamente por SQL, pois não pertencem a um usuário autenticado. A leitura final confirmou ausência das quatro contas e dos quatro registros de login; a conta master permaneceu ativa e confirmada. Logs geridos pelo serviço Auth podem preservar o histórico normal dessas operações.

## Reprodução e proteção das credenciais

`scripts/verification/auth-live.mjs` é um ensaio optativo do SDK, sem efeito remoto ao importar ou executar sem argumentos. A execução exige `--execute`, reconhecimento explícito do projeto pessoal e configuração completa no `.env.local` regular deste repositório. Ele recusa ambientes automatizados, outros projetos e redirecionamentos de rede. O manifesto fica em `work/auth-live/`, ignorado pelo Git, com IDs sintéticos e hashes para reconciliação; não contém senhas, tokens ou chaves.

O callback `onFixtures` permite testar o navegador antes da limpeza. Senhas e clientes recebidos pelo callback não podem ser serializados em traces, screenshots, logs ou relatórios. Se o aplicativo consumir limites pré-autenticação, conferir e remover somente os hashes exatos do manifesto, depois de todas as chamadas encerrarem. Resultado de limpeza inconclusivo exige reconciliação por ID e marcador; nunca enumerar/remover usuários por aproximação. Os testes automatizados do harness usam doubles e rodam com `npm run test:auth-live`, sem rede ou credenciais reais.

O diagnóstico `npm run auth:check` verifica apenas preparação local, conforme o [runbook](t014-auth-backend.md#diagnóstico-local-sem-conexão). Ele não autentica nem substitui este ensaio.

Depois dos ensaios, o arquivo local ignorado pelo Git foi ativado com `APP_MODE=supabase`; o diagnóstico confirmou `ready=true` e `authEnabled=true`. A origem local usa HTTP somente em desenvolvimento. A suíte Playwright comum fixa o servidor em `demo`, independentemente desse arquivo, para não iniciar testes remotos implicitamente.

## Revisão local

Revisão independente do contrato, adapter e scripts sem bloqueadores. `npm run check` passou com 755 testes Vitest, além dos testes isolados dos scripts (10 de configuração, 10 do harness de concorrência e 9 do harness Auth), TypeScript, lint, build, camadas, pacote SQL e scanner de 50 bundles públicos. Os 164 pares de contraste e o Impeccable passaram, sem apontamentos. A suíte completa aprovou 140 cenários E2E em modo demo; esses resultados são separados dos dez cenários Auth reais acima.

## Limites e pendências

- A consulta pública de Auth ainda retornou `disableSignup=false` após a confirmação do e-mail. Fechar o cadastro no Dashboard pessoal continua pendente; esconder cadastro na interface não bloqueia a API pública.
- SMTP, entrega de e-mail, templates e recuperação PKCE ponta a ponta permanecem postergados por OP-010.
- HTTP local não prova cookie `Secure` em HTTPS, comportamento de CDN/proxy ou refresh automático após expiração. Esses ensaios continuam abertos.
- Os seis logins foram sequenciais. Não comprovam concorrência PostgreSQL. `scripts/verification/rate-limit-concurrency.mjs` prepara um ensaio por processos `psql` simultâneos, com sobreposição medida, destino pessoal e TLS verificados, limpeza exata e execução optativa. Sua execução real continua pendente de cliente/conexão PostgreSQL apropriados; testes offline não são prova de concorrência no serviço.
- Nenhuma migration foi adicionada ou reaplicada neste recorte. Os três arquivos já aplicados permanecem canônicos. CI executa testes isolados e E2E demo, sem aplicar migrations nem criar contas remotas.
- Capturas e Tarefas continuam em memória nas telas. O novo [estágio transacional](t015-transacoes.md) ainda exige schema, gateway Supabase, canais e integração do provider.

T-014, T-015 e o marco M2 permanecem abertos. As issues registram o commit, o CI e as próximas evidências necessárias.
