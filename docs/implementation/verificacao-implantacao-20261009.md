# Verificação da implantação — 09/10/2026

O mantenedor informou que cadastrou as variáveis na Vercel e aplicou as nove migrations faltantes no Supabase pessoal. Confirmou também `APP_MODE=supabase` no ambiente Production e, posteriormente em 09/10, informou a aplicação manual da migration 015. Os relatos foram incorporados ao estado do projeto; não se reaplicou SQL, fez bootstrap ou criou fixture remota.

O checkpoint publicado inclui `190f5f0`, `5cb794f` e a manutenção em `2507d96`, com CI/deploy aprovados e smokes sem sessão. A função corrigida pela 015 foi confirmada no catálogo hospedado readonly; o cadastro público foi fechado e confirmado pela API. O catálogo retornou um desvio de permissões padrão de sequências; a 016 foi criada, revisada e validada localmente, com aplicação manual pendente. Executor externo Google e comparador offline de tipos estão prontos, sem jobs ou export oficial atual obtido. A issue #35 registra os resultados de CI/deploy e as evidências de cada SHA desta revisão. As verificações abaixo conservam a cronologia dos deployments anteriores. Disponibilidade sem sessão não certifica login real, persistência ou aceite operacional.

## Banco pessoal: evidência obtida

Consultas HTTP somente leitura foram feitas exclusivamente em `rishenjoikgmfubmnfiu`, com a configuração local já autorizada, sem exibir chaves ou conteúdo de usuários:

- REST OpenAPI retornou HTTP 200, com 36 definitions e 55 paths RPC; uma entrada é o event trigger `rls_auto_enable`, não uma RPC comum de domínio.
- Tabelas/RPCs dos módulos Financeiro, Conhecimento, Admin, preferências, Projetos/Hábitos, Drive, Busca/Atividade, Cofre e Google estão presentes.
- Revisão independente comparou as 50 RPCs usadas pela aplicação e 186 argumentos: não encontrou diferença de nomes ou formatos SQL entre adapters e metadados observados.
- Os buckets `second-brain-staging` e `second-brain-files` existem e estão privados.
- Na leitura anterior das 00:41 UTC de 10/10, Auth settings ainda retornou `disable_signup=false`; o fechamento confirmado às 01:05 UTC está registrado abaixo. O valor anterior fica preservado como histórico.
- Às 22:32:49 UTC de 09/10, HEAD sem sessão nas 36 tabelas observadas retornou apenas HTTP 401/403, usando a chave publishable pessoal. Nenhuma linha foi solicitada ou retornada, e nenhum SQL foi executado. O relatório privado ignorado é `work/anonymous-rest-verification-20261009.json`.

Metadados corroboram a instalação informada; o HEAD demonstra a recusa de acesso anônimo aos caminhos consultados. Não comprovam bytes/hashes das migrations executadas, histórico de execução, corpos das funções, todas as RLS/grants efetivas, nulabilidade, isolamento entre usuários ou comportamento de transações/sessões. Nenhum dado pessoal foi lido como fixture.

Na conferência anterior, o MCP respondeu sem permissão tanto para obter o projeto pessoal quanto para uma consulta explicitamente readonly. Na retomada após o relato da 015, obter `rishenjoikgmfubmnfiu` e consultar apenas o fingerprint da função voltaram a retornar `-32600`/permission denied, antes da execução. Nenhum SQL foi executado por esse canal nem se consultaram outros projetos ou credenciais. O SQL Editor pessoal autenticado posteriormente permitiu executar o catálogo readonly, conforme resultado abaixo; o MCP continua recusando acesso. A geração oficial de tipos permanece pendente. O catálogo anterior tinha 1.242 verificações locais; o atualizado passou em 1.243 verificações, sem desvios, no banco descartável. O arquivo gerado existente permanece identificado como histórico; contratos planejados não foram rebatizados como geração real.

Às **00:41:52.041 UTC de 10/10/2026 (21:41:52.041 de 09/10 em Fortaleza)**, novos GETs somente de metadados pessoais confirmaram 36 definitions e 55 paths RPC sem mudança, os dois buckets privados, `disable_signup=false` e provedor de e-mail habilitado. Não houve retorno de linhas de usuários ou execução de SQL remoto naquela conferência. A habilitação do provedor não prova SMTP/entrega; esses metadados não expõem nem certificam a definição privada alterada pela 015. Naquele momento, a aplicação era relato do mantenedor com conferência hospedada pendente; a prova posterior consta abaixo.

## Painel pessoal, cadastro fechado e catálogo hospedado

O login no painel confirmou o projeto **Segundo-Cerebro**, a organização **kauanbarateli's Org** e o ref autorizado `rishenjoikgmfubmnfiu`. A opção “Allow new users to sign up” foi desativada e “Save changes” confirmou o salvamento. O GET pessoal de metadados às **01:05:44.519 UTC de 10/10/2026 (22:05:44.519 de 09/10 em Fortaleza)** retornou `disable_signup=true`, mantendo 36 definitions, 55 paths RPC e dois buckets privados. **Fechamento do cadastro concluído e confirmado pela API.** Isso não certifica SMTP, recuperação ou o OAuth do Calendário; o provedor Google do Auth é uma configuração distinta da integração do aplicativo.

O catálogo atualizado foi executado no SQL Editor desse projeto em `BEGIN READ ONLY`, encerrado com `ROLLBACK`. Resultado fechado:

```json
{"ok":false,"checks":1246,"version":1,"deviations":[{"check":"default_acl_closed","object":"public.S"}]}
```

O único desvio foi `default_acl_closed` em `public.S`, nas permissões padrão de sequências do papel `postgres` no schema `public`. A checagem `reviewed_cleanup_definition` passou, confirmando o corpo completo de `app_private.file_cleanup_candidates()` da 015, com SHA-256 `57c5cd0cf62b5992b186850cef9690cb3fb10ef3e29180e8c1e0933a59a71d50`, normalizado somente CRLF→LF. Esse fingerprint da função é distinto do hash do arquivo da migration. Confirma a definição atual sem fabricar histórico de execução.

O catálogo hospedado apresentou 1.246 checks, incluindo três verificações adicionais das ACLs presentes na plataforma em relação ao cenário local de 1.243. **Um desvio permanece; catálogo de produção ainda não está verde.** A correção 016 foi criada e revisada, com aplicação manual pendente somente no projeto pessoal. Não houve escrita de banco, fixture, aplicação/reaplicação de migration ou bootstrap no destino hospedado. O fallback UI readonly funcionou; a conexão MCP permanece recusada.

## Correção 016 e comparação de tipos preparadas

Fonte canônica: [20261010010955_close_public_sequence_defaults.sql](../../supabase/migrations/20261010010955_close_public_sequence_defaults.sql). Cópia completa para aplicação manual: [016_20261010010955_close_public_sequence_defaults.sql](../../supabase/sql-editor/installation/016_20261010010955_close_public_sequence_defaults.sql). SHA-256: `add5b17ee8af3162ed893d1ac955c4fe5229707b7807d43a58b8c9124dc8e381`. O timestamp do arquivo usa UTC de 10/10; o evento ocorreu em 09/10 em Fortaleza. **A 016 não foi aplicada no projeto pessoal.**

Nos controles locais, as 12 entradas do default passaram às três do dono `postgres`; o catálogo recusou `public.S` antes da 016 e passou depois. A migration afeta somente permissões padrão de futuras sequências de `postgres/public`, preserva ACLs existentes, Auth/Storage, outros owners/schemas e provoca rollback diante de grant global inesperado. O [relatório da 016](sequence-defaults.md) registra revisão, limites e regressões.

A validação independente atual passou na cadeia **16 migrations/31 asserções**, catálogo local **1.243 checks/zero desvios**, parser **65 arquivos/zero erros** e pacote **16 migrations/33 arquivos separados**, gerado e conferido. TypeScript/lint, **111/111 testes Node** sem falhas/skips e scanner de **977 arquivos** passaram. A primeira tentativa de fixtures encontrou EPERM no sandbox; a execução autorizada com caminho temporário completo passou sem alterar os guards. Não atribuir essas contagens às rodadas históricas de 91 testes ou 15 migrations. CI/deploy atuais ainda serão registrados por SHA na issue #35.

A geração/download oficial pelo Dashboard não entregou arquivo após timeout; os tipos oficiais atuais e a conferência de drift hospedado continuam pendentes. O [comparador offline](../operations/database-types.md) foi revisado com 19 testes aprovados: exige snapshot TypeScript explícito, projeto pessoal/schema `public`, valida entrada pelo AST e não executa seu conteúdo, consulta rede ou lê `.env`. `database:types:help` e `check:database-types` orientam essa operação separada da coleta. `provenance_verified` e `freshness_verified` permanecem `false`, inclusive em `SNAPSHOT_MATCH`; não se declara export oficial ou atualidade pelo resultado da comparação.

## Vercel: estado antes do novo deployment

GitHub registrou deployment Production para `5403b70e119564859d516bde61f589ebf39b544c`, concluído, no projeto `segundo-cerebro-of`. Homepage oficial: `https://segundo-cerebro-of.vercel.app`.

O agente verificou HTTP sem login ou bypass:

- Alias público: `/`, `/entrar`, `/tarefas`, `/offline` e manifest HTTP 200. Raiz/Tarefas contêm marcadores explícitos da demonstração; não há redirect Auth. `/entrar` informa autenticação indisponível e desabilita o formulário. `/api/search` e `/api/calendar` retornam 503 `UNAVAILABLE`.
- HTTPS, HSTS, CSP nonce/strict-dynamic/wasm-unsafe-eval, origem Storage restrita ao projeto pessoal, nosniff, DENY e no-store foram observados nas páginas. Isso não comprova a jornada autenticada.
- URL específica do deployment: HTTP 401 por Vercel Deployment Protection em todas as rotas consultadas. Não foi contornada; essa resposta pertence à borda Vercel, não ao Auth do aplicativo.

Esse recorte precedeu o redeploy que incorporou as variáveis, registrado abaixo. Alterações de variáveis não atingem deployments anteriores, conforme [documentação Vercel](https://vercel.com/docs/environment-variables).

## Novo deployment e diagnóstico

O deployment Production de `1f33380632b227eddb9869778c07e6ab1e70a376` concluiu com status Vercel success em 09/10 às 20:15:40 UTC. O [CI dessa revisão](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/37985618234) também concluiu com sucesso.

A conferência do alias às 20:16:46 UTC encontrou HTTP 503 em `/`, `/tarefas`, `/entrar`, `/api/search` e `/api/calendar`, com a mensagem fixa do middleware de Auth. Offline/manifest seguiram HTTP 200. Essa falha ocorre em `readAuthConfiguration()`, antes de criar o SDK ou consultar o banco. É configuração efetiva inválida/ausente, não evidência de falha nas migrations ou de Deployment Protection.

O mantenedor identificou `APP_URL` ausente e informou seu cadastro em Production como `https://segundo-cerebro-of.vercel.app`. O build passou a validar a configuração explícita de modo Supabase com as regras de produção, emitindo somente nomes/regras dos campos inválidos, sem valores. Demo/CI sem credenciais continuam funcionando. O novo prebuild revelou outro campo inválido, conforme diagnóstico resolvido abaixo; build concluído sozinho não certifica disponibilidade de Auth.

## CI aprovado e falha anterior de Production

A correção foi publicada em [093baf5](https://github.com/kauanbarateli/Segundo-Cerebro/commit/093baf58e79eebe02fecb6027243ea37dd9f0100), revisada independentemente e validada com dez regressões novas. TypeScript, lint, build, integridade SQL e scanners locais passaram. O [CI dessa revisão funcional](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/37986615792) concluiu com sucesso: 1.427 testes nos dois fusos, 67 testes Node e 168 E2E, além dos demais portões.

O [deployment Production da correção](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/Fukp21HNaZ9613LZDkZfoxf8tdTC) falhou em 09/10 às 20:23:14 UTC. O status público não fornecia o erro específico. Após autorizar e reautorizar a integração Vercel no escopo pessoal, as consultas a logs/deployments continuaram recusadas pela plataforma; não houve contorno da autenticação. O mantenedor forneceu o trecho do Build Logs necessário ao diagnóstico.

Este relatório separa o CI aprovado da revisão funcional e o deployment que falhou. Um commit posterior apenas documental não substitui a prova de disponibilidade. As issues mantêm seus aceites externos e o histórico; migrations informadas como aplicadas não voltam à fila de execução.

## Configuração corrigida no redeploy anterior

O trecho fornecido pelo mantenedor identificou a falha do prebuild, sem valores de chaves:

```json
{"ready":false,"errors":["SUPABASE_PUBLISHABLE_KEY: Formato inválido; exige chave publishable atual."]}
```

O aviso de install scripts não foi a causa indicada pelo prebuild. A chave publishable local foi validada exclusivamente contra o endpoint Auth do projeto pessoal, que respondeu HTTP 200; seu valor não foi exibido, registrado neste relatório ou enviado ao Git. A integração Vercel permitiu corrigir esse campo no ambiente Production do projeto `segundo-cerebro-of`, embora continuasse recusando os logs. Nenhuma chave de BlackSheep/VOE foi consultada ou alterada.

O [redeploy Production](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/G8d25EJg6KkVtATuiSrpbgghum2y), identificado como `dpl_G8d25EJg6KkVtATuiSrpbgghum2y`, publicou a revisão `a3b1a5296a504c758739e2a8facad0b716bcc53b` e recebeu status success no GitHub. O [CI dessa revisão documental](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/37987747165) também concluiu com sucesso. As correções locais subsequentes ainda em revisão não foram incluídas nesse redeploy.

Às **22:30 UTC de 09/10/2026 (19:30 em Fortaleza)**, o smoke HTTP somente leitura no [alias oficial](https://segundo-cerebro-of.vercel.app) confirmou:

| Caminho/verificação | Resultado observado |
| --- | --- |
| `/` e `/tarefas` | HTTP 307 para `/entrar?notice=session-required` no alias oficial |
| `/entrar` | HTTP 200; campos e envio do login habilitados, sem demonstração ou aviso de Auth indisponível |
| `/api/search` | HTTP 401, código fechado `UNAVAILABLE` do aplicativo |
| `/api/calendar` | HTTP 401, código `UNAUTHENTICATED` do aplicativo |
| `/offline` e manifest | HTTP 200; manifest standalone com quatro ícones |
| Headers | HTTPS/HSTS, CSP com nonce/strict-dynamic/wasm, origem pessoal restrita, no-store nas páginas privadas, nosniff e DENY |

Não foram observados HTTP 503 nessa rodada. As recusas 401 das APIs pertencem ao aplicativo, não à Vercel Deployment Protection. O relatório privado ignorado é `work/deploy-smoke-20261009-repaired-publishable.json`.

**O bloqueio de configuração e disponibilidade do login foi resolvido.** Não houve login com conta real, bypass, leitura de dados pessoais, envio de senha, escrita no banco ou reaplicação de migrations. Cookies de uma sessão autenticada, refresh, isolamento entre usuários, SMTP, concorrência, Google e Storage continuam exigindo ensaios próprios.

## Revisão adicional validada localmente

As entregas dos agentes passaram por revisão independente e regressões. Calendário mantém alvos de pelo menos 44px em quatro/oito eventos sobrepostos e cria nota com título editável de até 120 caracteres UTF-16, preservando o contexto completo. Conhecimento permite criar o primeiro Caderno e preserva rascunhos somente em memória da sessão, com descarte no logout, 401 e troca de usuário. Restore encerra o stream em falha precoce de upload e dispõe de inspector privado para conferir senha/kit originais em alvo isolado sem mudar os pins do aplicativo. A revisão encontrou e corrigiu a retenção das metades anteriores do kit ao trocar o pacote.

A rodada local aprovou TypeScript/lint, 1.441 testes nos dois fusos, 78 testes Node, build, camadas, DS/Impeccable, integridade SQL, catálogo PGlite e scanners. A suíte Chromium exercitou 187 casos: 184 passaram; três falharam ao fechar traces porque outra execução limpou os artefatos compartilhados. Os quatro casos Financeiro correspondentes passaram com diretório isolado, e os três casos finais do inspector passaram após o último ajuste. A falha de infraestrutura permaneceu registrada; não se ampliaram timeouts nem alterou a aplicação para mascará-la. O audit de produção retornou zero vulnerabilidades; o audit de desenvolvimento mantém cinco registros high sem patch oficial de braces.

Também foi gerado `ADMIN_COMMAND_SECRET` exclusivo com 48 bytes aleatórios, salvo somente na configuração local ignorada e cadastrado como sensível em Production antes do deployment `190f5f0`. Os segredos Auth existentes não foram alterados. Efeitos administrativos e concorrência ainda não estão certificados.

Não houve migration nova ou SQL remoto executado no recorte de Calendário/Conhecimento/restore publicado em `190f5f0`. Os resultados de `093baf5` e `a3b1a52` permanecem atribuídos às suas próprias revisões; validação local não equivale a CI verde ou jornada autenticada em produção.

## Publicação da revisão adicional

O commit [190f5f0](https://github.com/kauanbarateli/Segundo-Cerebro/commit/190f5f05cf47f0a15c3b23f6414bfe70f5a38334) foi enviado para main. O [deployment Vercel](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/HnSDSurqQdFUPTcnJfAQFFShLH3h) recebeu status success no GitHub para esse SHA. Às **22:49:52 UTC (19:49:52 em Fortaleza)**, nova rodada sem sessão no alias confirmou `/entrar` HTTP 200 habilitado, `/` e `/tarefas` HTTP 307 para login, APIs de busca/calendário HTTP 401 da aplicação, offline/manifest HTTP 200 e os headers de proteção. Nenhum HTTP 503 foi observado.

O relatório sanitizado ignorado é `work/deploy-smoke-190f5f0.json`. A consulta HTTP isolada não identifica o SHA do alias: o vínculo de revisão provém do status Vercel dessa revisão. Não houve login, credenciais, bypass, comandos Admin ou escrita remota.

O [CI da revisão](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38001056671) concluiu com sucesso: instalação limpa, audit de produção com zero vulnerabilidades, parser SQL de 59 arquivos sem erros, chain local/catálogo, TypeScript/lint, 1.441 testes em cada fuso, 78 testes Node, camadas/DS/Impeccable, build/scanner e **187/187 E2E Chromium aprovados**. A rodada E2E terminou às 22:53:03 UTC, sem a colisão de artefatos observada no computador local. Resultados e aceites externos permanecem registrados na [issue #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35).

O [CI documental posterior de 5cb794f](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38001699333) também concluiu com sucesso. O [deployment dessa revisão](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/87ZcEipwLytMwQCti6WXszetsbgw) recebeu status success para o SHA exato. Às 22:56:38 UTC, smoke readonly confirmou login HTTP 200 habilitado e Calendário HTTP 401 `UNAUTHENTICATED`, com headers de proteção. Relatório ignorado: `work/deploy-smoke-5cb794f.json`. Esse registro preserva o histórico; não comprova CI/deploy da rodada descrita abaixo.

## Manutenção: validação local e aplicação informada

A limpeza de arquivos passou a aceitar GET/POST com o mesmo Bearer guard antes da configuração do adapter. O header é limitado a 1.024 caracteres; resposta com `failed > 0` retorna HTTP 503 e somente contagens. Os 24 testes desse recorte passaram nas verificações do agente e do integrador, sem execução remota ou processamento de objetos pessoais.

Um ensaio SQL local com 150 reservas vencidas já limpas e um órfão confirmou um defeito na seleção: o limite de 100, ordenado pelo vencimento original, podia ser ocupado diariamente pelas mesmas reservas antigas. A migration **015 foi revisada** e ordena por `coalesce(cleaned_at + interval '1 day', expires_at)`, `expires_at` e `id`, preservando objetos, grants, locks, quota e confirmação da limpeza. A comparação da definição constatou somente a alteração de ordem; todos os bytes de 001–014 foram conferidos e preservados. Controles negativos falharam sem a 015 e com a alternativa `NULLS FIRST`, nos pontos previstos. [Diagnóstico e limites](cleanup-fairness.md).

Arquivo versionado: [015_20261009231338_file_cleanup_fairness.sql](../../supabase/sql-editor/installation/015_20261009231338_file_cleanup_fairness.sql), 3.522 bytes, SHA-256 local canônico `f71c6bb9debb24f032bb64824420693c9be6b4ab566f54d51dac6cdb658f897a`. O pacote foi regenerado e verificado. **O mantenedor informou sua aplicação manual em 09/10 e o catálogo readonly hospedado posteriormente confirmou sua definição. 001–015 permanecem imutáveis e não devem ser reaplicadas; não repetir bootstrap.** A prova deriva do catálogo SQL, enquanto REST conserva somente sua evidência de metadados.

A validação integrada local da manutenção passou: TypeScript/lint/build, 1.458 testes em cada fuso, 78 testes Node, camadas, DS/Impeccable e scanner de 78 bundles públicos; 15 migrations e 30 asserções padrão em PGlite, catálogo com 1.242 checks e zero desvios, parser 62 arquivos/zero erros. A primeira tentativa dos scripts recusou o caminho temporário curto do Windows; a repetição com caminho completo passou, mantendo as proteções. Esses resultados são locais; a publicação tem seu CI próprio registrado abaixo.

O [guia de manutenção](../operations/scheduled-maintenance.md) inclui um [exemplo documental](../operations/examples/vercel-cleanup.json) para GET `/api/files/cleanup` diário às 06:00 UTC (03:00 em Fortaleza). O arquivo fica em docs, fora da configuração ativa: **nenhum job ou configuração de agendamento foi ativado**. Google continua exigindo `GOOGLE_CALENDAR_CRON_SECRET` próprio e um scheduler capaz de enviar esse header; o Bearer automático do cron Vercel usa `CRON_SECRET` e não satisfaz o guard Google com os segredos distintos.

O plugin Vercel 0.54.1 não restabeleceu a leitura de logs/detalhes: a plataforma continuou retornando HTTP 403 para o escopo `kauanbarateli-projects`. A CLI Vercel não está disponível neste ambiente. Não houve extração de credenciais, contorno de autenticação ou uso de BlackSheep/VOE como alternativa. Esse limite de inspeção não invalida o smoke público já registrado nem fornece prova de execução de jobs.

## Publicação da manutenção e continuidade da revisão

A revisão [2507d96](https://github.com/kauanbarateli/Segundo-Cerebro/commit/2507d96) recebeu [CI aprovado](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38004089325), com 1.458 testes por fuso, 78 testes de scripts e 187 E2E. O [deployment](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/HR4ciY9Qyb1mTAN2GAXJqrMz1nJF) recebeu status success para essa revisão. O smoke sem sessão de **09/10 às 23:24:08 UTC (20:24:08 em Fortaleza)** confirmou a disponibilidade do login/guards. CI/deploy não aplicaram schema e não certificam jobs ou jornadas autenticadas. A aplicação manual posterior da 015 foi informada pelo mantenedor, conforme registro acima.

A retomada acrescenta ao [catálogo readonly](../../supabase/tests/release-catalog.sql) o SHA-256 do corpo completo de `app_private.file_cleanup_candidates()`, normalizando somente CRLF→LF. O corpo esperado deriva da fonte imutável da 015; não foi calculado a partir do banco hospedado. A checagem anterior não distinguia o código antigo. O controle negativo local com 001–014 retorna exatamente um desvio `reviewed_cleanup_definition`; 001–015 retorna 1.243 checks/zero desvios. Alteração de lease, comentário ou espaço também é recusada; nenhuma migration nova foi criada nesse recorte. A execução hospedada posterior passou no fingerprint e encontrou o desvio de ACL indicado acima.

O [executor Node Google](../../scripts/operations/google-calendar-cron.mjs) exige opt-in pessoal e segredo próprio, usa GET HTTPS fixo sem redirects, limita resposta/deadline e não repete resultados incertos. Os [exemplos de operação/agenda](../operations/examples/google-calendar-cron.md) ficam em docs, fora de `.github/workflows`. Nenhum job ou chamada Google real foi ativado. Review de agentes e integrador aprovou o contrato e os limites de claims.

Validação local da retomada, anterior à correção 016: 91 testes Node, TypeScript/lint, parser 62 arquivos/zero erros, cadeia 15 migrations/30 asserções, catálogo 1.243 checks/zero desvios, pacote 15 migrations/32 arquivos separados e scanner 968 arquivos versionáveis. Fontes/cópias das 15 migrations foram conferidas e preservadas. Esse recorte é histórico; a 016 e a rodada final têm suas próprias evidências acima. CI/deploy da nova revisão são registrados por SHA na [issue #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35), sem herdar os 187 E2E de `2507d96`.

A consulta readonly estreita do fingerprint pelo MCP foi recusada antes da execução, com `-32600`/permission denied. O navegador inicialmente pediu login; a sessão pessoal foi concluída e o SQL Editor permitiu a execução readonly do catálogo com rollback, registrada acima. A definição hospedada da 015 deixou de ser pendência; resta corrigir o desvio de ACL e obter novo catálogo sem desvios. Nenhuma chave foi solicitada ou extraída para contornar o MCP.

## Continuidade

1. Registrar CI, deployment/SHA e smoke próprios da revisão com 016/comparador na issue #35 após publicação. A rodada local final passou; os resultados de `190f5f0`/`5cb794f`/`2507d96` continuam atribuídos às suas revisões. Login/guards sem sessão já foram comprovados, mas as jornadas autenticadas permanecem pendentes.
2. Preservar o cadastro público fechado, confirmado pela API às 01:05 UTC. SMTP/recuperação continuam exigindo provedor e ensaio próprios.
3. Conferir destino/hash/pacote e aplicar manualmente somente a 016 revisada no projeto pessoal, registrando resultado; repetir `supabase/tests/release-catalog.sql` readonly e exigir zero desvios. Não reaplicar 001–015 ou bootstrap. O resultado hospedado atual confirma a 015, mas não libera o catálogo com desvio. Não usar fixtures SQL no banco com contas reais.
4. Obter tipos oficiais atuais do schema instalado via canal pessoal/CLI/Dashboard, registrar origem/ref/schema/data/hash, usar o comparador offline e confrontar os contratos antes de atualizar o arquivo gerado e revalidar. [Guia de comparação](../operations/database-types.md) e [Guia Supabase](https://supabase.com/docs/guides/api/rest/generating-types).
5. Revisar/configurar os schedulers conforme o guia, observar e registrar uma execução autorizada; o exemplo não é job ativo. Prosseguir com jornadas conectadas, Storage, Google/cron, concorrência, backup/restore e dispositivos do [relatório de pendências](entrega-mvp-pendencias.md).

Nenhuma issue foi encerrada somente com o relato de instalação, introspecção REST ou testes locais de manutenção. Cadastro fechado e definição hospedada da 015 foram confirmados; a 016 foi criada/revisada com cadeia local aprovada, mas sua aplicação manual e o catálogo hospedado sem desvios continuam pendentes. Tipos oficiais, CI/deploy atuais e os demais aceites externos ainda impedem declarar a finalização operacional. BlackSheep/VOE e suas chaves/configurações foram preservados.
