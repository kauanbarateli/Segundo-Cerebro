# Ensaio de cadastro no QA — preparação, não execução

Este overlay parte de `f19a550ad31bb41e6d3f87b5546d827d406d9c65` do PR #212.
Ele é uma **proposta de ensaio**, não uma liberação: não aplicar na main,
não mesclar no PR de produto, não executar DDL, não trocar flags e não enviar
emails como parte desta preparação. `vercel.json` bloqueia o deploy automático
desta branch; a publicação do PR é para revisão. O teste ainda não ocorreu.

## Isolamento do overlay

O overlay conserva `TRANSACTIONAL_SIGNUP_RELEASED=false` e
`SIGNUP_DUPLICATE_CONTRACT_QUALIFIED=false` e adiciona um desvio apenas para o
experimento. Ele só é possível com todas estas condições simultâneas:

- projeto Supabase QA `twrydxsdemaykgvdlpyd` e URL exatamente
  `https://twrydxsdemaykgvdlpyd.supabase.co`;
- projeto Vercel de homologação `prj_68nPrMlzdTLhvhXF2zWvNK6BFaW2`, ambiente
  Preview, branch **exclusiva** `codex/qa-cadastro-browser-f19a550`, repositório
  GitHub e dono conferidos pelo guard existente;
- `APP_DEPLOYMENT_TARGET=homologation`, `APP_MODE=supabase`, `NODE_ENV=production`,
  `VERCEL=1`, URL HTTPS de branch Vercel exatamente igual a `APP_URL`, com
  `VERCEL_BRANCH_URL` compatível com o guard e diferente da URL de produção;
- flags de servidor `SC_QA_SIGNUP_BROWSER_EXPERIMENT=true` e
  `PUBLIC_SIGNUP_ENABLED=true` exclusivamente para o intervalo de teste.
  `SC_FRONT_B_SCHEMA_READY=true` é necessária para a apresentação no login;
  verificar outros recursos afetados por ela. Nenhuma dessas flags é credencial.

O patch troca a branch permitida **somente nessa cópia experimental**. O guard
normal e as duas constantes de produto não são alterados; o desvio não significa
que a versão/comportamento do GoTrue esteja qualificado. A exatidão da branch,
dos metadados Vercel e da URL de Preview precisa ser conferida em um deployment
real protegido antes de permitir a janela. Mudança no destino ou SHA invalida
esta preparação. Uma Preview protegida precisa permitir que os dois testadores
aprovados abram a aplicação e os links enviados sem expô-los publicamente.

## Bloqueios atuais e autorizações separadas

1. A frente principal informou que quarentena, corte da composição e retirada
   da barreira foram aplicados ao QA e seus hashes confrontados. Revalidar o
   catálogo e o estado atual por leitura antes do ensaio; os arquivos guardados
   não são migrations executáveis. Não reescrever nem reaplicar 028.
2. Conferir `disable_signup`, `signup_settings.enabled` e versões legais no QA:
   enquanto o Auth ou o singleton estiverem fechados o cadastro não funciona.
   O código desta base usa termos `0.2 · revisão do uso atual`, privacidade
   `0.4 · origem de cadastro` e consentimento de origem `signup-origin-v1`.
   A linha `signup_browser_legal_versions` precisa corresponder às versões
   exibidas pelo build; sua criação/atualização é uma alteração remota separada.
3. Confirmar SMTP real do QA, domínio/remetente, redirect exato e caixas de teste
   autorizadas; o histórico registra SMTP próprio ausente no QA, não comprova
   seu estado atual. A verificação não autoriza copiar chaves de produção.
4. A mudança de Auth `disable_signup` é **global no projeto QA**: durante a
   janela, clientes que alcancem a API QA também poderão tentar criar usuários
   Auth, ainda que a Preview esteja protegida. Duração curta, proteção de acesso,
   limites e monitoramento devem ser acordados. A flag do aplicativo não fecha
   o endpoint direto do Supabase. Usar somente contas sintéticas identificáveis.
5. Tratar em ações separadas e revisáveis a configuração SMTP/redirect, o
   preview isolado e suas variáveis, a alteração temporária do Auth e do
   `signup_settings.enabled` e o envio às caixas sintéticas. Observar as
   autorizações e os limites efetivamente concedidos para cada ação. A presente
   preparação não executa deploy, configuração ou envio.

## Exercício proposto, após os bloqueios

- Registrar estado anterior, SHA exato do overlay, catálogo e flags sem segredos;
  confirmar a qualificação do ambiente e o plano para suspender/drenar cron e
  escritores antigos. Confirmar versões legais publicadas e seu registro
  transacional no QA antes de abrir. O schema e as guards devem estar íntegros.
- Habilitar somente a janela aprovada. Testar cadastro e confirmação por
  e-mail/senha, CTA, login explícito após admissão, onboarding opcional e
  dashboard. Repetir em outro dispositivo e após expiração/reenvio. Não registrar
  token, senha, link de confirmação ou endereços reais no relatório.
- Com contas de teste autorizadas, verificar duplicata, sessão principal em outra
  aba, moderação e contenção de resultado incerto. Não inferir que uma chamada
  expirou ou foi cancelada. Conferir UTM consentida/ausente e isolamento sem
  inventar uma garantia do provedor a partir de um único teste.
- Anotar resultados, versões, horários e identificadores sintéticos; qualquer
  comportamento ambíguo encerra a janela e mantém o produto bloqueado. Um fluxo
  que falhe não pode ser anunciado como qualificado.

## Fechamento e retorno

Fechar imediatamente ambas flags da Preview, restaurar `disable_signup` e
`signup_settings.enabled` aos valores anteriores capturados, verificar bloqueio
das rotas e do endpoint Auth diretamente, e retirar o acesso à Preview. Fazer
somente as alterações remotas expressamente autorizadas. Não remover contas ou
dados sintéticos sem plano e autorização aplicáveis. Confirmar que Vercel, QA e
produção voltaram aos destinos esperados e registrar evidências sem segredos.
Desligar flags não reverte DDL nem mensagens enviadas: eventual reversão de
schema requer procedimento e autorização separados; nunca reparar o ledger por
suposição. Não abrir o cadastro de produção com base neste ensaio.
