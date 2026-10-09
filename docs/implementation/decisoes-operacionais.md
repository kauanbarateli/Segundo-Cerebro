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

A confirmação de e-mail estava pendente na primeira inspeção. Depois do ajuste pelo mantenedor, a leitura remota confirmou o e-mail; não houve alteração direta em `auth.users`. Os fluxos reais foram validados com contas sintéticas separadas, conforme [relatório de Auth](t014-auth-real.md). A conta pessoal não foi usada como fixture. O cadastro público ainda retornou `disableSignup=false` e continua pendente de fechamento. O mantenedor preencheu a chave secreta no arquivo local ignorado pelo Git; formato e acesso à API administrativa do projeto foram confirmados, sem exibir o valor. A configuração global de Auth requer conferência própria, incluindo fechamento do cadastro público.

Testes reais de Auth usam somente identidades sintéticas temporárias, criadas pelo canal administrativo com senhas aleatórias em memória e marcador do ensaio. Não usam a conta pessoal como fixture nem enviam e-mail. A limpeza exige UUID e marcador conferidos; falha de limpeza deve permanecer explícita. Isso não é seed de produto e não autoriza reset, alteração de usuários preexistentes ou execução remota pelo CI. As instruções anteriores de que nenhuma promoção real havia sido feita descrevem o estado anterior a esta operação.

## OP-012 — Conclusão local e aplicação manual das próximas migrations

Em 09/10/2026, o mantenedor autorizou prosseguir sem a conexão Supabase e avançar nas tarefas de todas as issues para finalizar o projeto. As novas migrations ficam versionadas e preparadas para aplicação manual posterior. Ao final, entregar um arquivo com pendências, configurações externas, validações ainda necessárias e ordem dos arquivos SQL. Não executar operações remotas de banco enquanto este modo estiver vigente; não usar BlackSheep/VOE como alternativa.

As cinco migrations registradas até 07/10 continuam com evidência histórica de aplicação e seus bytes preservados. A ausência de conexão na retomada não confirma o estado remoto de hoje nem autoriza reaplicá-las. CI/build/deploy continuam sem SQL remoto, contas remotas ou seeds persistentes. O CI pode validar fixtures em PostgreSQL local descartável, sem credenciais ou conexão externa. Uma issue só pode ser encerrada quando seus critérios estiverem demonstrados; aceites que exigem Supabase, SMTP/Google, aparelhos físicos, backup/restauração ou produção permanecem identificados no relatório final, sem confundir implementação local com ativação operacional.

## Fontes rastreáveis

| Fonte | Revisão consultada | Uso |
|---|---|---|
| `kauanbarateli/novo-segundo-cerebro` | `20914ce61fefa268ab06fb52d6e0c27fad7e7143` | Glossário, ADRs, convenções de agentes e 25 skills de engenharia/produtividade |
| `kauanbarateli/segundo_cerebro` | `ffdf06435a5b8dcd047574172cddf1cc772dfd09` | História do aplicativo; outras branches devem registrar seus próprios SHAs quando usadas |
| Planejamento local aprovado | D-019/D-030 e documentos até a revisão de 29/09/2026 | Especificações, DS 2.1, roadmap e tickets; snapshot em `docs/planejamento/` |
| Impeccable do planejamento | `metadata.version: 4.4.0`; `scripts/VERSION: 0.1.6` | Skill integral em dois diretórios, sem binário/cache; hashes no `skills-lock.json` |

A versão declarada da skill Impeccable e a versão do launcher são registradas separadamente. Copiar seus arquivos não atesta funcionamento do detector nem instalação de runtime. Consulte [catálogo de skills](../../skills/README.md).
