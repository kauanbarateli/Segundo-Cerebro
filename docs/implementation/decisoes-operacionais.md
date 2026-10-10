# Decisões operacionais da implementação

Registro iniciado em 07/10/2026. Estas decisões conciliam instruções atuais com o planejamento aprovado; não alteram seu histórico nem atestam critérios de aceite já cumpridos.

## OP-001 — Repositório principal

Instrução do mantenedor em 07/10/2026: implementar e publicar em `git@github.com:kauanbarateli/Segundo-Cerebro.git`. Este destino prevalece sobre o nome e a localização propostos em D-026. `segundo_cerebro` e `novo-segundo-cerebro` são fontes históricas; não são destinos de novas issues, commits ou pushes. Nenhum arquivamento remoto dos legados é autorizado implicitamente por este registro.

O clone de execução fica no workspace de desenvolvimento. O planejamento é copiado para `docs/planejamento/` para acompanhar o código; sua pasta original permanece fonte documental. Evite versionar caminhos pessoais como requisito de execução.

## OP-002 — Migrations com aplicação manual

**Registro histórico; a OP-009 substitui a restrição de execução por agentes no projeto pessoal autorizado.** A proibição de reset, seeds e aplicação automática em CI/build/deploy permanece.

A instrução atual do mantenedor exige registrar alterações de banco em migrations e deixar sua aplicação para execução manual posterior. Ela substitui as passagens históricas que determinavam “migrations só por pipeline” ou reset automático do banco em CI.

Agentes produzem arquivos SQL, documentação e validações estáticas; **não executam migrations, reset, seeds ou push de schema em banco local ou remoto**. Build, CI e deploy não devem aplicar schema. Testes que dependem de um banco já preparado devem informar o pré-requisito e permanecer pendentes até aplicação manual e execução confirmadas. Credenciais ou um projeto vinculado não substituem essa autorização.

## OP-003 — Ordem e evidência da entrega

O início é T-001 / M0: base compilável, contratos de camadas, docs de domínio, skills e portões de qualidade. DS 2.1 orienta a página provisória; a implementação completa de tokens, primitivas, shell e PWA segue seus tickets. O protótipo não antecipa autenticação, persistência, grafo visual de produção ou integrações.

O agente responsável revisa entregas paralelas antes de incorporá-las. Cada issue conserva pendências e limitações; instalação de ferramenta, existência de workflow e teste local não são sinônimos de validação remota ou aceite concluído. Mensagens de commit, issues e demais publicações não incluem coautoria.

O snapshot do diagnóstico omite a reprodução literal de um trailer de autoria adicional do histórico, para respeitar a instrução atual em todo conteúdo publicado. O original documental não foi alterado.

## OP-004 — Conciliação dos ADRs

D-019 adota cinco ADRs com Plano Pessoal implícito sem billing e eventos do Cofre limitados a metadados. As versões portadas incorporam essas conciliações e as extensões de glossário do doc 05. ADR-0002 esclarece que projeções de leitura podem usar adapters no servidor conforme doc 02 §3, enquanto regras e escritas atravessam o Núcleo.

## OP-005 — Acesso GitHub isolado do Sistema VOE

Leitura dos históricos, push de código e criação/atualização de issues foram confirmados. O token da conta `kauanbarateli` é selecionado somente no ambiente de cada comando; a conta global da CLI permanece inalterada. O token não inclui `workflow`, portanto foi gerada uma chave SSH exclusiva para este repositório e cadastrada pelo mantenedor como deploy key com escrita.

A seleção da nova chave usa `core.sshCommand` somente na configuração local deste clone. Não houve alteração de chaves anteriores, configuração SSH global ou autenticação do Sistema VOE. A chave privada não faz parte do repositório.

## OP-006 — Verificação PWA com ferramentas vigentes

T-005 cita a categoria PWA do Lighthouse. Ela foi removida no [Lighthouse 12](https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0). A verificação automatizada vigente usa o Chromium via `Page.getInstallabilityErrors`, além dos testes de manifest, arquivos, service worker, cache e navegação sem rede. Não se atribui nota ou aprovação de uma categoria que a ferramenta já não oferece.

Essa adaptação de ferramenta não substitui o aceite em Android/iOS reais: a issue permanece aberta até o registro físico exigido. O desenvolvimento independente dos módulos pode prosseguir conforme as dependências dos tickets; isso não declara M0 encerrado.

## OP-007 — Supabase em organização pessoal

Instrução explícita do mantenedor em 07/10/2026: utilizar uma organização pessoal para o Segundo Cérebro. É proibido usar a organização, os projetos ou as credenciais da BlackSheep e do Sistema VOE para este software. O projeto deverá ser novo, dedicado e ter credenciais exclusivas; configurações e autenticações empresariais devem permanecer preservadas.

No registro inicial, o acesso estava pendente: a consulta de organizações disponíveis retornou somente BlackSheep, e nenhum projeto havia sido criado, vinculado ou alterado por esta implementação. Essa escolha nunca autorizou usar a organização empresarial como alternativa. A conexão pessoal posteriormente confirmada e a autorização de aplicação constam na OP-009.

## OP-008 — Desenvolvimento local sem conexão Supabase

**Registro histórico da preparação local; conexão e execução supervisionada foram autorizadas posteriormente na OP-009.** O gerador continua sem acesso ao banco e o histórico abaixo não atesta aplicação.

Instrução explícita do mantenedor em 07/10/2026: prosseguir sem conexão Supabase e preparar os arquivos para aplicação manual pelo SQL Editor. A ausência de acesso à organização pessoal não bloqueia implementação local, revisão, testes de contratos, parsing ou empacotamento. Não se procura outro destino nem se usam recursos empresariais como alternativa à OP-007.

As migrations versionadas em `supabase/migrations/` são a fonte canônica. O gerador `node scripts/build-sql-editor.mjs` produz cópias numeradas para o SQL Editor, preservando os bytes, a ordem das versões e as transações de cada arquivo, com manifest SHA-256 determinístico. `node scripts/build-sql-editor.mjs --check` confere drift sem escrever arquivos. Nenhum desses comandos abre conexão, executa SQL, cria histórico interno do Supabase ou semeia usuários.

Instalação, asserções e bootstrap permanecem separados. O mantenedor deverá revisar o destino pessoal novo e executar cada migration completa na ordem, interrompendo ao primeiro erro e registrando versão, hash e resultado fora do histórico interno do Supabase. A migration inicial continua recusando reexecução pelo preflight; gerar outro pacote não torna sua reaplicação segura. O manifest registra integridade de arquivos, não aplicação em banco.

Asserções manuais e o modelo de bootstrap terminam com `ROLLBACK` explícito e não entram nos arquivos de instalação. O bootstrap não é seed automático; persistir um primeiro master exige decisão manual sobre o UUID conferido. RLS, Auth, concorrência, grants efetivos, tipos gerados do schema e integração real continuam pendentes até aplicação e validação registradas. O avanço local não declara esses critérios concluídos.

## OP-009 — Conexão pessoal e aplicação supervisionada

Em 07/10/2026, após a conexão pessoal ser verificada, o mantenedor autorizou aplicar as migrations pelas conexões disponíveis e prosseguir com as pendências. A autorização permite execução supervisionada por agentes das migrations versionadas e revisadas e das asserções com rollback, exclusivamente no projeto pessoal `rishenjoikgmfubmnfiu`. Substitui a restrição anterior de execução da OP-002 e o estado sem conexão da OP-008; não exige nova confirmação para cada arquivo dentro desse escopo. Não autoriza reset, seeds, alterações em BlackSheep/VOE ou aplicação automática por CI, build, deploy ou integração GitHub.

**Evidência anterior à aplicação:** o endpoint MCP corresponde ao projeto informado pelo mantenedor; PostgreSQL 17.11; consulta em `transaction_read_only=on`; `auth.users` sem contas; nenhuma relação do recorte de identidade; histórico de migrations vazio; três colunas Auth exigidas pelo preflight presentes. O check local confirmou duas migrations e quatro scripts separados de asserções/bootstrap. Essa inspeção não demonstra instalação, RLS/grants efetivos nem funcionamento de Auth.

Antes de escrever, conferir novamente destino, estado e pré-requisitos; usar a conexão autorizada para escrita e aplicar cada migration completa em ordem. Interromper ao primeiro erro e registrar versão, hash, canal e resultado antes de continuar. Não reaplicar a migration inicial: seu preflight recusa contas ou objetos preexistentes. Não fabricar registros do histórico interno do Supabase; o manifest continua sendo prova de integridade local. O pacote SQL Editor permanece uma alternativa manual.

As três asserções são executadas separadamente no ambiente de teste dedicado, antes da primeira conta, conservando `ROLLBACK`. Fixtures transacionais não são seed persistente. Bootstrap continua separado, exige UUID conferido e decisão explícita de persistência. Concorrência demanda conexões simultâneas; uma asserção sequencial não a comprova.

**Execução registrada em 07/10/2026:** três migrations aplicadas por MCP com `success=true`, nove tabelas com RLS e três scripts de asserções aprovados, com rollback e ausência de resíduos conferidos. O [relatório da aplicação](t013-aplicacao-supabase.md) registra versões remotas, versões locais originais, hashes, Advisors e limites. O MCP atribuiu as versões remotas; os nomes locais e as cópias foram alinhados, com manifest regenerado/check aprovado e bytes SQL preservados, sem manipular o histórico do banco. Configuração Auth/callbacks, credenciais server-only, concorrência e fluxos reais continuam pendentes; SMTP e recuperação por e-mail foram postergados conforme OP-010. A autenticação OAuth do MCP não configura a aplicação. T-013/T-014 só encerram os critérios demonstrados; T-015 mantém persistência/adapters como recorte próprio.

Atualização de aplicação posterior: o recorte de Capturas/Tarefas adicionou a quarta migration por MCP, sem reaplicar as três de identidade. Asserções de catálogo e comportamento terminam com rollback e aceitam a conta já existente. Versão canônica, hash e evidências próprias estão no [relatório de T-015](t015-persistencia.md). Essa execução permanece no escopo pessoal supervisionado da OP-009.

## OP-010 — Primeira conta e SMTP postergado

Em 07/10/2026, o mantenedor decidiu continuar sem SMTP e criar a primeira conta pelo Dashboard Auth Users, solicitando acesso administrativo como “SUPERADMIN”. O papel correspondente no modelo aprovado é `master`, em `public.user_roles`; não existe papel de aplicativo `SUPERADMIN`. O usuário Auth permanece `authenticated`: metadata editável e o campo de papel do Auth não concedem administração do aplicativo.

A atribuição inicial usa `public.bootstrap_master(uuid)` pelo canal privilegiado, após a criação da conta e conferência de seu UUID. Em 07/10/2026, o mantenedor forneceu a conta; a raiz conferiu o destino, executou a simulação com rollback, repetiu com commit e confirmou `master` com um evento de promoção. O modelo versionado continua terminando com rollback; o UUID real não é versionado. O diagnóstico local de configuração passou e a chave privilegiada foi validada pela Admin API; confirmação de e-mail e fechamento do cadastro público permaneciam pendentes na última consulta. SMTP, templates e recuperação por e-mail ficam explicitamente postergados; isso não encerra T-014. O [runbook](t014-auth-backend.md#primeira-conta-e-papel-master) registra a operação e o procedimento restante.

## OP-011 — Conta inicial informada e validação de Auth

Em 07/10/2026, o mantenedor informou o UUID da conta que criou e autorizou prosseguir. O UUID foi conferido somente no projeto pessoal: conta Auth `authenticated`, não anônima, ativa, sem ban/exclusão, sem troca obrigatória nem veto administrativo e sem outro master. A promoção pela RPC `bootstrap_master` passou primeiro com rollback e depois foi confirmada com commit. Uma leitura independente confirmou `master`, papel Auth preservado e exatamente um evento de promoção. O UUID, o e-mail e os segredos da conta não são fixados em migrations ou código versionado.

A confirmação de e-mail estava pendente na primeira inspeção. Depois do ajuste pelo mantenedor, a leitura remota confirmou o e-mail; não houve alteração direta em `auth.users`. Os fluxos reais foram validados com contas sintéticas separadas, conforme [relatório de Auth](t014-auth-real.md). A conta pessoal não foi usada como fixture. Naquele recorte, o cadastro público ainda retornou `disableSignup=false` e permanecia pendente de fechamento; a confirmação posterior está na OP-013. O mantenedor preencheu a chave secreta no arquivo local ignorado pelo Git; formato e acesso à API administrativa do projeto foram confirmados, sem exibir o valor. A configuração global de Auth tem conferência própria e não deriva da confirmação de e-mail.

Testes reais de Auth usam somente identidades sintéticas temporárias, criadas pelo canal administrativo com senhas aleatórias em memória e marcador do ensaio. Não usam a conta pessoal como fixture nem enviam e-mail. A limpeza exige UUID e marcador conferidos; falha de limpeza deve permanecer explícita. Isso não é seed de produto e não autoriza reset, alteração de usuários preexistentes ou execução remota pelo CI. As instruções anteriores de que nenhuma promoção real havia sido feita descrevem o estado anterior a esta operação.

## OP-012 — Conclusão local e aplicação manual das próximas migrations

Em 09/10/2026, o mantenedor autorizou prosseguir sem a conexão Supabase e avançar nas tarefas de todas as issues para finalizar o projeto. As novas migrations ficam versionadas e preparadas para aplicação manual posterior. Ao final, entregar um arquivo com pendências, configurações externas, validações ainda necessárias e ordem dos arquivos SQL. Não executar operações remotas de banco enquanto este modo estiver vigente; não usar BlackSheep/VOE como alternativa.

As cinco migrations registradas até 07/10 continuam com evidência histórica de aplicação e seus bytes preservados. A ausência de conexão na retomada não confirma o estado remoto de hoje nem autoriza reaplicá-las. CI/build/deploy continuam sem SQL remoto, contas remotas ou seeds persistentes. O CI pode validar fixtures em PostgreSQL local descartável, sem credenciais ou conexão externa. Uma issue só pode ser encerrada quando seus critérios estiverem demonstrados; aceites que exigem Supabase, SMTP/Google, aparelhos físicos, backup/restauração ou produção permanecem identificados no relatório final, sem confundir implementação local com ativação operacional.

## OP-013 — Aplicação manual informada e conferência da implantação

Em 09/10/2026, o mantenedor informou a aplicação das nove migrations faltantes e o cadastro das variáveis na Vercel, confirmando `APP_MODE=supabase` em Production. A continuidade incorpora esse relato sem reaplicar SQL ou bootstrap. As versões 001–014 permanecem preservadas; futuras alterações exigem novas migrations.

A conferência somente leitura no projeto pessoal encontrou 36 definitions REST, 55 paths RPC e os dois buckets privados. Uma revisão independente confrontou 50 RPCs/186 argumentos usados pela aplicação sem diferença de nomes ou formatos SQL. Essa evidência não certifica corpos das funções, RLS/grants, hashes executados ou concorrência. O MCP recusou acesso ao projeto e à consulta readonly: catálogo hospedado e geração oficial de tipos continuam pendentes. Não houve leitura de conteúdo pessoal como fixture, escrita remota, tentativa em organização empresarial ou extração de credenciais OAuth.

A API Auth ainda retornou `disable_signup=false`. A primeira consulta ao alias Vercel mostrou demonstração e login indisponível; variáveis novas exigem outro deployment. A atualização documental gera o próximo deploy pelo fluxo Git configurado, cujo resultado deve ser verificado e registrado nas issues. SMTP, Google/cron, jornadas conectadas, backup/restore e dispositivos conservam seus aceites próprios. Evidências e continuidade estão na [verificação da implantação](verificacao-implantacao-20261009.md).

O deployment de `1f33380` concluiu, mas o middleware recusou a configuração de Auth com HTTP 503 antes de consultar Supabase. O mantenedor identificou APP_URL ausente e informou seu cadastro em Production. O build passa a conferir o modo Supabase explícito usando as regras de produção, com diagnóstico fechado de nomes/regras sem valores; demo/CI sem credenciais continuam disponíveis. O smoke do próximo deployment precisa confirmar login disponível e guards sem sessão, sem inferir aceites de jornadas autenticadas ou de banco.

A revisão funcional `093baf5` passou no CI completo (1.427 testes nos dois fusos, 67 testes Node, 168 E2E), mas seu deployment Vercel falhou. O erro específico requer Build Logs autenticado; a conexão disponível não tem login Vercel. O log solicitado limita-se à mensagem após prebuild/JSON ready-errors, sem valores ou log inteiro. Não inferir campo adicional inválido, falha SQL ou liberação da produção a partir do status de build.

### Continuidade confirmada em 09/10

O mantenedor forneceu o diagnóstico do prebuild: `SUPABASE_PUBLISHABLE_KEY` tinha formato inválido. A publishable local foi validada exclusivamente na API Auth pessoal e cadastrada em Production pela integração Vercel. O redeploy de `a3b1a52` concluiu; o smoke das 22:30 UTC confirmou login habilitado, redirects privados e APIs sem sessão recusadas. A restrição de leitura dos logs pela integração permanece, mas o bloqueio de configuração foi resolvido. Não houve reaplicação SQL, bootstrap ou uso de recursos empresariais.

O segredo de compromisso `ADMIN_COMMAND_SECRET`, ausente no ambiente local e em Production, foi gerado com 48 bytes aleatórios exclusivos e cadastrado como sensível em Production. Os segredos Auth existentes não foram rotacionados. O próximo deployment incorporará essa configuração; a presença da variável não certifica comandos administrativos, revogação ou concorrência hospedados.

A revisão adicional preserva rascunhos de Conhecimento somente em memória da sessão, corrige os alvos de Calendário e o título da nota de reunião e acrescenta a ferramenta privada de aceite de restore. Esta ferramenta não modifica os pins do aplicativo nem torna automática a execução operacional. Ensaios remotos continuam sujeitos aos destinos/opt-ins do runbook; os testes desta entrega são fixtures locais, sem migrations novas.

### Migration 015 informada como aplicada e conferência posterior

Após a publicação da manutenção em `2507d96`, o mantenedor informou em 09/10/2026 que aplicou manualmente a migration 015 e pediu a conferência e continuidade das issues. O relato mudou sua situação de execução pendente para aplicação informada com conferência hospedada pendente naquele momento; a prova posterior está registrada abaixo. A versão canônica é `20261009231338_file_cleanup_fairness.sql`; seus bytes/hash locais estão no manifest. **Não reaplicar 001–015 nem repetir bootstrap.** Naquela retomada, ainda não havia migration 016 no escopo.

O pedido de conferência permite inspeção somente leitura no projeto pessoal autorizado; não deve ser interpretado como autorização para novas aplicações remotas, fixtures SQL sobre contas reais, execução de limpeza/sync ou ativação automática de jobs. O modo manual da OP-012 continua vigente para novas migrations e operações ainda não ativadas. Catalogar/provar a instalação é distinto de executá-la novamente.

O MCP retornou `-32600`/permission denied ao obter `rishenjoikgmfubmnfiu` e na consulta estreita do fingerprint da função, antes da execução. Nenhum SQL foi executado por esse canal nem se buscaram credenciais ou projetos alternativos. Às 00:41:52.041 UTC de 10/10 (21:41:52.041 de 09/10 em Fortaleza), GETs pessoais de metadados mantiveram 36 definitions, 55 paths RPC e os dois buckets privados; Auth retornou `disable_signup=false` e provedor de e-mail habilitado. Não houve leitura de linhas de usuários. REST não revela nem certifica a função privada alterada pela 015; sua definição e o catálogo hospedado ainda aguardavam o acesso ao painel naquele momento.

O [CI de 2507d96](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38004089325) e seu deployment foram aprovados; o smoke das 23:24:08 UTC de 09/10 confirmou login/guards sem sessão. A nova rodada de conferência da definição no catálogo readonly e executor externo do cron Google foi revisada e validada localmente, sem jobs ativados; CI/deploy têm conferência própria por SHA na issue #35. Resultados novos serão registrados na issue #35; o CI anterior não os certifica. O [relatório de pendências](entrega-mvp-pendencias.md) e a [verificação da implantação](verificacao-implantacao-20261009.md) conservam a cronologia e os aceites externos.

### Painel autenticado, fechamento confirmado e desvio de ACL

O login no painel confirmou **Segundo-Cerebro**, **kauanbarateli's Org** e o ref pessoal `rishenjoikgmfubmnfiu`. A opção de novos cadastros foi desativada e o salvamento confirmado. O GET de metadados às **01:05:44.519 UTC de 10/10/2026 (22:05:44.519 de 09/10 em Fortaleza)** retornou `disable_signup=true`, conservando 36 definitions, 55 paths RPC e dois buckets privados. O fechamento do cadastro público deixou de ser pendência; o `false` anterior permanece como registro histórico. Essa configuração de Auth não certifica SMTP ou OAuth do Calendário.

Antes da aplicação informada da 016, o SQL Editor pessoal autenticado permitiu executar o catálogo atualizado em `BEGIN READ ONLY`, encerrado com `ROLLBACK`. Resultado histórico: `ok=false`, `checks=1246`, `version=1` e um único desvio `default_acl_closed` no objeto `public.S`. A checagem `reviewed_cleanup_definition` da 015 passou, confirmando a função hospedada pelo fingerprint revisado. Naquela conferência readonly, não se aplicou DDL, fixture, migration ou bootstrap nem se escreveu conteúdo de usuários. O MCP continua recusando acesso; o canal UI readonly funcionou sem extração de credenciais.

O desvio anterior referia-se às permissões padrão de sequências do papel `postgres` no schema `public` e motivou a migration **016 mínima**, criada/revisada e posteriormente informada como aplicada pelo mantenedor. O catálogo pós-016 confirmou seus efeitos sem desvios, conforme registro abaixo. Não reaplicar 001–016 ou bootstrap. A contagem 1.246 hospedada inclui três checks de ACL adicionais aos 1.243 do cenário local, não três falhas.

Os portões locais anteriores de 15 migrations/30 asserções/1.243 checks e 91 testes Node permanecem associados ao recorte anterior à 016. A rodada atual tem evidências próprias a seguir. Executor Google pronto continua inativo; tipos oficiais, SMTP/Google, jornadas conectadas, backup/restore e aparelhos conservam seus aceites próprios.

### 016 informada como aplicada e evidências do checkpoint anterior

Fonte canônica: [20261010010955_close_public_sequence_defaults.sql](../../supabase/migrations/20261010010955_close_public_sequence_defaults.sql). Cópia SQL Editor preservada: [016_20261010010955_close_public_sequence_defaults.sql](../../supabase/sql-editor/installation/016_20261010010955_close_public_sequence_defaults.sql). SHA-256 local canônico `add5b17ee8af3162ed893d1ac955c4fe5229707b7807d43a58b8c9124dc8e381`. O timestamp usa UTC de 10/10; a operação pertence a 09/10 em Fortaleza. **O mantenedor informou a aplicação manual da 016 nesta retomada; seus efeitos foram conferidos pelo catálogo readonly posterior.** Não reaplicar 001–016 ou bootstrap e não fabricar histórico interno de aplicação.

Os controles locais reproduziram 12 entradas de privilégios padrão, reduzidas às três do dono após a 016; o catálogo recusou `public.S` antes e passou depois. A correção afeta somente futuras sequências de `postgres/public`, preserva ACLs existentes, Auth/Storage e outros owners/schemas e provoca rollback para grant global inesperado. [Revisão e limites](sequence-defaults.md). Os ensaios foram locais; o agente não executou DDL remoto nem ativou jobs.

A validação final independente passou em 16 migrations/31 asserções, catálogo local 1.243 checks/zero desvios, parser 65 arquivos/zero erros, pacote 16 migrations/33 arquivos gerado/conferido, TypeScript/lint, 111/111 testes Node sem falhas/skips e scanner de 977 arquivos. A primeira tentativa de fixtures encontrou EPERM no sandbox; a execução autorizada com caminho temporário completo passou sem enfraquecer os guards. O [CI de 70f0261](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38013773356) concluiu com sucesso para `70f02610d218e37aae75f3328acc38d4bb12559c`, com 1.458 testes por fuso, 111 scripts, 187 E2E e os demais portões. O [deployment](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/75AwjQP2HQb55aR9E2j2MumXB4mU) foi aprovado para o SHA exato; smoke de 09/10 às 22:38:41.571 em Fortaleza (01:38:41.571 UTC de 10/10) confirmou login 200, Calendário 401 e limpeza 503 pelo guard, sem job executado. As 23 issues foram atualizadas/verificadas, preservando critérios e histórico.

A tentativa de geração/download oficial no Dashboard não produziu arquivo após timeout. O [comparador offline](../operations/database-types.md) foi revisado com 19 testes aprovados; exige snapshot explícito do schema `public` declarado para o projeto pessoal, usa AST sem executar o arquivo e não lê `.env` ou consulta rede. Mesmo `SNAPSHOT_MATCH` mantém `provenance_verified=false` e `freshness_verified=false`. O mecanismo não gera tipos nem comprova coleta oficial ou atualidade; naquele checkpoint, export atual e integração ainda estavam pendentes. O download fornecido posteriormente e a projeção revisada são registrados abaixo.

### Conferência readonly após o relato da 016 — 09/10 em Fortaleza

O mantenedor informou a aplicação manual da 016 nesta retomada. Às **22:51:10.820 de 09/10/2026 em Fortaleza (01:51:10.820 UTC de 10/10)**, o SQL Editor pessoal autenticado executou o catálogo em **READ ONLY**, encerrado com **ROLLBACK**. Retornou `ok=true`, `checks=1246`, `version=1` e `deviations=[]`. A conferência confirmou os efeitos esperados da 016 e catálogo hospedado sem desvios naquele estado; o resultado anterior com `default_acl_closed/public.S` fica preservado como histórico. Não foi fabricado registro de aplicação pelo agente.

Evidências privadas ignoradas: `work/hosted-catalog-post016.json`, `work/hosted-catalog-post016.txt` e `work/hosted-catalog-post016.jpg`. Cadastro público continua desligado no painel. Nesta rodada, o agente não escreveu migrations, fixtures ou dados de usuários; não reaplicar 001–016 ou bootstrap. Jornadas autenticadas, concorrência, SMTP/Google, backup/restore e aparelhos conservam seus aceites próprios; o export fornecido e a projeção pública têm evidência separada. Nenhum job foi ativado.

### Export manual fornecido e contratos públicos integrados

Depois da conferência pós-016, o mantenedor forneceu o download oficial do Dashboard. A [revisão](t013-hosted-types-20261009.md) registra origem informada, data observada e hashes distintos do original/projeção. Somente `Database.graphql_public` e `Constants.graphql_public` foram removidos; tipos públicos e helpers permaneceram intactos. Não alterar o escopo público do comparador para aceitar outros schemas e não apresentar essa derivação como cópia integral do original.

Nove adapters usam o baseline de 35 tabelas/uma view/54 RPCs, com Args individuais e exceções escalares de UUIDs nulos previstas no SQL. O gate do CI compara inventário, colunas Row e Args/defaults com a cadeia local descartável e recusa modos/overloads não revisados; não afirma equivalência de todos os tipos ou freshness hosted. A validação local integrada aprovou 1.508 testes por fuso, 137 scripts, TypeScript/lint, cadeia 16/31 e catálogo local 1.243/zero. CI/deploy/smoke da nova revisão têm evidência própria por SHA na issue #35. Não aplicar 001–016 ou bootstrap, ativar jobs, fazer coleta remota em CI ou substituir jornadas reais por esses resultados.

## OP-014 — Retomada supervisionada dos ensaios reais de Auth e persistência

Em 09/10/2026, o mantenedor autorizou retomar as jornadas reais de Auth e persistência. A autorização permite criar, usar e remover **contas e dados sintéticos temporários**, pelos canais revisados, exclusivamente no projeto pessoal `rishenjoikgmfubmnfiu` e no alias HTTPS `https://segundo-cerebro-of.vercel.app`. O destino deve permanecer fixo durante o ensaio; o ambiente local/demo e a evidência de 07/10 não substituem resultados atuais de produção. Não é necessária nova confirmação para cada etapa já autorizada desse recorte.

A restrição de operações remotas da OP-012 não impede este fluxo novamente autorizado. Ela continua vigente para novas migrations e operações fora do recorte: **não aplicar nem reaplicar 001–016, executar bootstrap, reset ou seeds, alterar o master pessoal, ativar jobs ou executar testes remotos em CI/build/deploy**. A conta pessoal permanece preservada e não é fixture. BlackSheep, Sistema VOE e suas credenciais/configurações continuam fora do escopo; não são destinos ou alternativas de acesso.

O preflight somente leitura por SDK/API em **10/10 às 02:46:19.884 UTC (09/10 às 23:46:19.884 em Fortaleza)** confirmou `disable_signup=true` e os buckets `second-brain-staging`/`second-brain-files` privados no projeto pessoal. Não houve leitura de dados pessoais como fixture. A conexão MCP continuou recusando a consulta por falta de permissão; não repetir tentativas nem procurar credenciais/projetos alternativos. Esse preflight confirma apenas os metadados observados, não login, persistência, políticas efetivas ou execução das jornadas.

As contas de teste devem ter identidade sintética, marcador e UUID exatos registrados em manifesto privado ignorado. Senhas aleatórias e tokens permanecem em memória; não enviar e-mail nem usar credenciais da conta pessoal. A limpeza fica limitada aos UUIDs, marcadores, objetos e hashes exatos do ensaio, depois de todas as chamadas terminarem. Remover contas não comprova a remoção de limitadores pré-autenticação; conferir os conjuntos acessíveis separadamente e manter explícito qualquer resíduo ou resultado de limpeza inconclusivo. Não executar fixtures SQL integrais sobre a base com contas reais.

Registrar os resultados por revisão, horário, canal e critério, usando contagens, códigos públicos e booleans. Relatórios versionáveis não recebem e-mails, UUIDs, conteúdo de domínio, cookies, senhas, tokens, URLs assinadas ou erros brutos do provedor. Chamadas HTTP paralelas não provam sobreposição PostgreSQL; SDK direto não comprova o limitador/cookies do canal do aplicativo. Diário durável, reload/abas, erro visível e descarte no logout exigem evidência atual de navegador. SMTP/recuperação por e-mail, Google, aparelhos e os demais aceites externos mantêm seus próprios limites.

**Checkpoint inicial registrado no [relatório real de T-014/T-015](t014-t015-producao-20261010.md).** A rodada SDK aprovou 28 etapas; o formulário HTTPS confirmou três logins do roteiro, e as rodadas posteriores aprovaram Capturar/Tarefas/Activity antes de interromper a extensão dos módulos em Configurações HTTP 503. A primeira expectativa incorreta de Activity vazia fica preservada como falha do harness. A correção inicial passou em 49 testes focados e na validação integrada local; o código foi publicado em `8346aec`, com CI/deployment e reensaio ainda pendentes naquele checkpoint. Oito fixtures tiveram limpeza Auth/API registrada. A prova SQL inicial cobria quatro fixtures/42 relações; a conferência readonly de 10/10 às 03:44:38.782301 UTC (00:44:38.782301 em Fortaleza) confirmou oito fixtures/52 relações/zero linhas vinculadas. Seis linhas candidatas de limitador de login continuavam presentes. Nenhum ensaio de Storage havia sido executado nesse recorte. Essa prova inicial não certificava módulos adicionais, navegador/journal, troca de senha ou ausência global de resíduos.

**Continuidade real de 10/10:** o CI de `8346aec` foi aprovado com 1.512 testes por fuso, 146 scripts e 187 E2E; os reensaios próprios aprovaram módulos, PNG/Drive/Cofre/Busca, senha normal, limitador, avatar/conteúdo incompatível, domínios ampliados e pausas de hábitos. Domínios tiveram 31 etapas SDK/harness e 44 do aplicativo às 04:32:29.159 UTC / 01:32:29.159 em Fortaleza; pausas tiveram 31/37 às 04:44:05.269 UTC / 01:44:05.269 local. São ensaios SDK/HTTP sequenciais, sem herdar aceites de navegador, SMTP, Google, aparelhos ou concorrência PostgreSQL.

Ao fim das onze rodadas, **22 fixtures** tiveram remoção Auth/API confirmada por identificadores/marcadores exatos. A prova final **READ ONLY/ROLLBACK de 04:47:50.981345 UTC / 01:47:50.981345 em Fortaleza** confirmou 22 fixtures/53 relações, todas as contagens vinculadas zero, incluindo Auth/sessões/conjuntos privados e os seis caminhos Storage exatos. A [cópia somente de metadados](evidence/auth-cleanup-before-login-purge-20261010.json) não contém IDs/HMAC. Remoção/listagem física limitada por SDK antes de excluir Auth e ausência de catálogo SQL são evidências distintas; não equivalem a ausência global.

Permanecem **19 linhas candidatas do limitador de login sem `user_id`**, com hits de um em oito linhas, dois em nove, quatro em uma e cinco em uma. O sujeito exato do ensaio conserva cinco hits no intervalo de 2.881,298 ms; não há prova de sua remoção. O DELETE exato foi preparado/revisado independentemente, **não executado**, e a confirmação humana solicitada no painel permanece pendente. Não inferir limpeza global ou cron. As provas anteriores de quatro/oito/18 fixtures e as falhas históricas são preservadas no relatório. A autorização e as provas não encerram critérios ou issues por inferência.

## OP-015 — Plano financeiro total e migration 017 manual

Em 10/10/2026, o porte da referência financeira v2 recuperada revelou uma lacuna real: o ERD e T-018 preveem plano total por dono/mês no backend, embora sua UI permaneça na fase 2. A referência fixada em `a9422bcb90dc8965de4695570c9d338881e78975`, SHA-256 `a188e2b48b315bcb59e3e69c5556452c585c8f5df008d765f6b08502b8e1f868`, tem 18 lançamentos preservados; o [porte literal e suas mudanças declaradas](t018-legacy-v2-port-20261010.md) é separado da massa nova autorada de 20 casos. Código antigo não foi executado.

O Core e o gateway passam a aceitar `category_id: null` explícito para o plano total, sem promover valor ausente/malformado a plano. Categorias presentes continuam exigindo despesa/dono correto. O cálculo puro separa consumo realizado, disponibilidade, alocação e reserva, usa os estados D-006 e estorno de categoria de despesa, e mantém ausência de plano como `null`. Escritas preservam recibo/evento/atomicidade. Nenhuma interface da fase 2 foi antecipada.

A fonte canônica é [20261010044217_finance_monthly_plan.sql](../../supabase/migrations/20261010044217_finance_monthly_plan.sql), cópia [017 do SQL Editor](../../supabase/sql-editor/installation/017_20261010044217_finance_monthly_plan.sql), SHA-256 local `a45052833425a647a193e8d3588257fa6cb392aa12ef39b34f89b57e06d882bf`. A 017 permite categoria nula e protege um plano por dono/mês, preservando FK/RLS/guards e o orçamento por categoria. **Aplicação manual da 017 e conferência hospedada estão pendentes.** Não reaplicar 001–016, bootstrap ou executar asserções com fixtures na base real; CI/build/deploy permanecem sem SQL remoto.

A cadeia local completa de 17 migrations/35 asserções e o pacote 17/37 foram aprovados pela raiz. O check integral local passou com 1.556 testes por fuso, 146 Node sem falhas/skips, TypeScript/lint/build e os demais portões registrados no relatório de entrega. **Novo CI/deployment permanecem pendentes** neste checkpoint. O export oficial pós-016 permanece intacto: depois da aplicação manual de 017, obter novo export oficial e conferir a projeção pública. O gate local de contratos verifica inventário/nome de colunas/Args/defaults, **não nullable nem freshness hosted**. A #25 conserva os portões de aplicação, tipos e critérios externos; os 125 testes focados do porte/planos e a aprovação local não encerram a issue.

## Fontes rastreáveis

| Fonte | Revisão consultada | Uso |
|---|---|---|
| `kauanbarateli/novo-segundo-cerebro` | `20914ce61fefa268ab06fb52d6e0c27fad7e7143` | Glossário, ADRs, convenções de agentes e 25 skills de engenharia/produtividade |
| `kauanbarateli/segundo_cerebro` | `ffdf06435a5b8dcd047574172cddf1cc772dfd09` | História do aplicativo; outras branches devem registrar seus próprios SHAs quando usadas |
| `kauanbarateli/segundo_cerebro` — `v2-interface-e-financeiro` | `a9422bcb90dc8965de4695570c9d338881e78975` | Fonte primária recuperada de regressão financeira v2; porte literal de 18 lançamentos e plano do mês, com origem/hash/mapeamentos declarados |
| Planejamento local aprovado | D-019/D-030 e documentos até a revisão de 29/09/2026 | Especificações, DS 2.1, roadmap e tickets; snapshot em `docs/planejamento/` |
| Impeccable do planejamento | `metadata.version: 4.4.0`; `scripts/VERSION: 0.1.6` | Skill integral em dois diretórios, sem binário/cache; hashes no `skills-lock.json` |

A versão declarada da skill Impeccable e a versão do launcher são registradas separadamente. Copiar seus arquivos não atesta funcionamento do detector nem instalação de runtime. Consulte [catálogo de skills](../../skills/README.md).
