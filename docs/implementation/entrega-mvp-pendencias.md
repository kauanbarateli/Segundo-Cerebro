# Entrega do MVP e pendências externas — 09/10/2026

A implementação local do MVP inclui Núcleo, interfaces, adapters, canais autenticados, migrations versionadas e testes dos módulos. Em 09/10, o mantenedor informou a aplicação das nove migrations e o cadastro das variáveis de produção na Vercel; a introspecção REST pessoal confirmou objetos dos módulos e dois buckets privados. A configuração publishable de Production foi corrigida e o alias passou a oferecer login e recusar acesso sem sessão. Calendário, Conhecimento e restore foram publicados em `190f5f0`; a manutenção, em `2507d96`; a 016 e o comparador de tipos, em `70f0261`, com CI/deploy e smoke próprios aprovados. O cadastro público foi fechado, a função da 015 foi conferida e o mantenedor informou a aplicação manual da 016. A conferência readonly de **09/10 às 22:51:10.820 em Fortaleza** aprovou **1.246 checks hospedados, zero desvios**, confirmando os efeitos da 016. A [issue #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) acompanha cada revisão. **A liberação ainda depende de jornadas autenticadas e dos aceites externos deste arquivo. O mantenedor forneceu o export oficial nesta retomada; a projeção pública e os adapters foram atualizados, conforme registro de tipos abaixo.** A [verificação da implantação](verificacao-implantacao-20261009.md) registra evidências e limites. Não reaplicar 001–016 ou bootstrap.

Este documento atualiza o estado do código, conservando os relatórios anteriores como evidência de seus próprios recortes. A disponibilidade do login sem sessão não declara o aceite operacional do MVP nem encerra issues por implementação local. O resultado do CI pertence à revisão publicada, conforme registro na issue #35.

## Implementação entregue

| Área | Comportamento implementado | Referência |
| --- | --- | --- |
| Identidade/Auth | Cookies de servidor, guards de sessão/moderação/troca obrigatória, recuperação preparada, rate limit persistente e CSP em bloqueio | [Auth](t014-auth-backend.md), [ensaio histórico real](t014-auth-real.md) |
| Capturar/Tarefas | Persistência por dono, conversões/referências, CRUD/lixeira, CAS, Evento e recibo atômicos; journal reconcilia resultado incerto; anexos usam IDs verificados | [Persistência](t015-persistencia.md), [journal](t015-journal.md), [anexos](t022-drive-storage.md) |
| Início/Atividade | Projeções dos módulos permitidos/visíveis, ações do dia e histórico paginado; 28 tipos de Evento com projeção sem conteúdo privado ou valores financeiros | [Atividade](t016-atividade.md), [validação ampliada](validacao-sql-finalizacao.md) |
| Administração | Papéis/vetos, criação com senha provisória, bloqueio/desbloqueio, troca forçada e revogação; saga preserva fence/claim em resposta Auth incerta e protege último master utilizável | [Admin/reconciliação](t017-admin.md), [ADR-0007](../adr/0007-admin-auth-saga-fechada.md) |
| Financeiro | Contas/cartões, categorias/etiquetas, lançamentos, transferências, pagamento de fatura/encargos, séries finitas, arquivamento, lixeira e Desfazer | [T018–T020](t018-t020-financeiro.md), [ADR-0006](../adr/0006-financeiro-series-finitas.md) |
| Conhecimento/vínculos | Cadernos/páginas, TipTap sob demanda, documento validado, wiki-links/backlinks por ID, Relacionados e restauração por lote; promoção conserva origem arquivada sem segunda cópia editável | [Conhecimento](t021-conhecimento.md) |
| Drive/anexos/avatar | Árvore, mover/destacar/lixeira/restaurar, quota; staging privado, bytes reais, validação de formato/re-encode, publicação imutável e limpeza idempotente | [Drive/Storage](t022-drive-storage.md) |
| Projetos/Hábitos | Contexto por tarefa/captura/caderno/pasta, criar/vincular/desvincular sem copiar conteúdo; hábitos, marcações, pausas e histórico | [Projetos/Hábitos](t023-projetos-habitos.md) |
| Cofre | AES-256-GCM no cliente, Argon2id em worker, chave não extraível, kit de duas partes com prova, recuperação/rewrap, versionamento/AAD e descarte imediato no logout | [Cofre](t024-cofre-cifrado.md), [hardening](revisao-hardening-cofre-monitoramento.md) |
| Calendário Google | Leitura de até duas contas, fontes selecionadas, dia/semana/mês, paginação/cursor/410, nota vinculada, lembrete dentro do app; OAuth PKCE/estado e tokens cifrados no servidor | [Calendário/runbook](t025-calendario-google.md), [ADR-0008](../adr/0008-google-calendar-readonly.md) |
| Busca/Configurações | Paleta dos sete tipos, acento/ranking, navegação/ações; perfil, avatar, tema, ordem/visibilidade dos módulos, agenda/lembrete e senha; Preferência separada de Entitlement | [Busca/Configurações](t026-t027-busca-configuracoes.md), [Validação SQL](validacao-sql-finalizacao.md), [avatar](t022-drive-storage.md) |
| Hardening/operação | Sentry por allowlist, scanners de segredos/bundle, PWA sem cache de dados privados, backup cifrado/restore isolado e catálogo readonly | [Revisão](revisao-hardening-cofre-monitoramento.md), [PWA](t005-pwa.md), [backup/release](../operations/backup-restore-release.md) |

`demo` continua disponível sem credenciais, com ports em memória. O Cofre demo executa criptografia real e perde seus envelopes ao recarregar. `supabase` usa canais conectados e recusa configuração ausente; não apresenta exemplos como dados persistidos. Credenciais, tokens, URLs assinadas, senha mestra e kit não entram no journal de comandos. O journal de reconciliação não equivale à outbox/sincronização offline completa da Fase 2.

## Evidência local e limites

Checkpoint publicado de 09/10/2026, após consolidar as três entregas revisadas. O [CI de 190f5f0](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38001056671) concluiu com sucesso, assim como o [CI documental de 5cb](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38001699333). Os CIs anteriores de `093baf5` e `a3b1a52` conservam suas próprias contagens. A tabela abaixo registra o checkpoint `190f5f0`; a rodada de manutenção tem evidências próprias logo após a tabela. A issue #35 registra CI/deploy da revisão publicada e os aceites restantes.

| Portão | Evidência disponível | Limite/estado |
| --- | --- | --- |
| Instalação SQL local | As 14 migrations instalaram em PGlite descartável; todas as 29 asserções padrão passaram | Auth/Storage são fixtures; sem Supabase remoto ou concorrência real |
| Catálogo de release | 1.242 verificações readonly, zero desvios, na cadeia local completa | Recorte histórico; o catálogo hospedado pós-016 passou em 1.246 checks/zero desvios, conforme registro abaixo |
| Integridade SQL Editor | Manifest com 14 migrations e 31 arquivos separados; cinco hashes históricos preservados; SQL novo em LF | Integridade local não registra aplicação remota |
| TypeScript/lint | Verificação integral aprovada; inspector conferido novamente após os ajustes finais | Recorte histórico; a geração manual informada e a integração revisada dos tipos atuais são registradas abaixo |
| Vitest nos dois fusos | 94 arquivos, 1.441 testes aprovados em UTC e em America/Sao_Paulo | Sem credenciais ou integrações remotas |
| Scripts/arquitetura | 78 testes Node aprovados; camadas: 320 módulos/1.292 dependências | Fixtures e contratos locais; o caminho temporário Windows completo evitou a recusa correta do alias curto pelas proteções de backup |
| Design system/Impeccable | 164 contrastes verificados; zero registros no portão Impeccable | Não substitui auditoria visual/aparelho/leitor real |
| Parser SQL | 59 arquivos, zero erros | Sintaxe não prova execução remota |
| Build/scanners | Build local/CI aprovado; scanner público: 78 bundles; scanner local final: 957 arquivos após remover o diagnóstico Chromium da árvore versionável | Não garante detectar todo segredo sem assinatura |
| Busca com massa grande | Rodada final local: 50 mil metadados Drive, seis termos, máximo 29 ms | Orçamento de 500 ms RECOMENDADO; medição hospedada pendente. [Ensaio independente anterior/método](validacao-sql-finalizacao.md) |
| E2E integrado | CI: 187/187 Chromium aprovados. Na rodada local, três fechamentos de trace tiveram conflito entre pastas; os casos passaram com diretório isolado e o inspector final passou 3/3 | A ocorrência local permanece no relatório de implantação. Fixtures e crypto real; sem jornada autenticada hospedada. [Auditoria anterior](t028-validacao-final.md) |
| CI/commit publicado | [190f5f0](https://github.com/kauanbarateli/Segundo-Cerebro/commit/190f5f05cf47f0a15c3b23f6414bfe70f5a38334), [CI concluído com sucesso](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38001056671): instalação limpa, audit de produção, parser 59/zero erros e todos os portões | Não usa credenciais ou ensaios remotos |
| Produção sem sessão | Deployment de `190f5f0` aprovado; às 22:49:52 UTC, login HTTP 200 habilitado, rotas privadas redirecionaram ao login e APIs recusaram acesso | Não houve login, leitura de dados pessoais ou escrita. [Verificação](verificacao-implantacao-20261009.md) e [deployment](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/HnSDSurqQdFUPTcnJfAQFFShLH3h) |
| REST sem sessão | HEAD nas 36 tabelas observadas retornou somente HTTP 401/403 às 22:32:49 UTC | Sem linhas retornadas ou SQL executado; não comprova todas as policies, grants, corpos de funções ou isolamento entre usuários |
| Dependências | Consulta de 09/10: `npm audit --omit=dev` com zero vulnerabilidades; audit completo com cinco registros high na cadeia de lint, `braces@3.0.3` sem patch oficial | #36 permanece aberta para a correção compatível das dependências de desenvolvimento |

As provas reais de 07/10 para Auth/Capturar/Tarefas estão em [Auth real](t014-auth-real.md) e [persistência](t015-persistencia.md). Não certificam os nove arquivos novos, Storage/Google ou telas ampliadas. Doubles, React local e SQL serializado não comprovam SMTP, HTTPS/cookies no deploy, RLS hospedada, corridas de revogação, iPhone ou leitor de tela real.

A revisão publicada em `190f5f0` corrigiu os alvos de eventos sobrepostos no Calendário e o limite de 120 caracteres UTF-16 da nota de reunião, preservando o título completo no conteúdo e sem dividir emoji; a criação do primeiro Caderno e a preservação de rascunhos em memória no Conhecimento, com descarte no logout/401/troca de sessão; o encerramento do stream de restore quando o upload falha antes de consumir os bytes. Acrescentou também o inspector privado de restore, com prova criptográfica de senha e kit em fixtures, sem mudar o destino fixo do app. Revisão independente, regressões e inspeção visual local foram concluídas. Nenhuma nova migration foi produzida naquele recorte.

A rodada de manutenção foi revisada por agentes e integrador. A rota de limpeza aceita GET/POST, exige Bearer antes de configurar o adapter, limita o header a 1.024 caracteres e retorna HTTP 503 com contagens quando há falha parcial; 24 testes desse recorte passaram nas duas verificações. Um ensaio SQL local confirmou que 150 reservas vencidas já limpas ocupavam o limite de 100 candidatos ordenados pelo vencimento original, impedindo a seleção de um órfão. A migration 015 corrige a ordem dos lotes; controles negativos comprovaram a regressão sem essa correção e o problema da alternativa `NULLS FIRST`. [Diagnóstico e limites](cleanup-fairness.md).

| Manutenção — portão local | Resultado |
| --- | --- |
| Unidade/contratos | 94 arquivos, 1.458 testes em cada fuso UTC e America/Sao_Paulo |
| Scripts | 78/78; primeira tentativa recusou o alias temporário curto do Windows, repetição com caminho completo passou sem enfraquecer a proteção |
| SQL local | 15 migrations, 30 asserções padrão, catálogo 1.242 checks/zero desvios; Auth/Storage simulados, rollback sem resíduos |
| Integridade/sintaxe | 15 migrations + 32 arquivos separados no manifest; 001–014 preservadas byte a byte; parser 62 arquivos/zero erros |
| Aplicação | TypeScript/lint/build e camadas 320 módulos/1.292 dependências aprovados |
| DS/scanner público | 164 contrastes, Impeccable zero registros; 78 bundles públicos sem assinaturas de segredo/SDK servidor |

O [CI de 2507d96](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38004089325) concluiu com sucesso: 1.458 testes por fuso, 78 testes de scripts e 187 E2E. O [deployment de manutenção](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/HR4ciY9Qyb1mTAN2GAXJqrMz1nJF) recebeu status success; o smoke sem sessão de 09/10 às 23:24:08 UTC conservou login/guards disponíveis. Esses resultados pertencem à revisão publicada, sem certificar aplicação SQL hospedada ou jobs. Nenhum job foi ativado e nenhum SQL remoto foi executado pelos agentes nesta rodada; a aplicação manual posterior da 015 foi informada pelo mantenedor.

A nova conferência de metadados ocorreu em **10/10 às 00:41:52.041 UTC (09/10 às 21:41:52.041 em Fortaleza)**: REST manteve 36 definitions e 55 paths RPC; os dois buckets continuam privados; Auth retornou `disable_signup=false` e provedor de e-mail habilitado. Foram somente GETs de metadados, sem linhas de usuários ou SQL remoto. A função privada alterada pela 015 não é verificada por essas respostas. O MCP pessoal recusou tanto os detalhes do projeto quanto uma consulta readonly estreita do fingerprint (`-32600`/permission denied); nenhuma consulta SQL foi executada. O painel disponível pediu login. Não houve extração de credenciais ou tentativa em outro projeto.

Posteriormente, o login no painel confirmou **Segundo-Cerebro**, **kauanbarateli's Org** e o ref pessoal autorizado. A opção de cadastro público foi desativada e o salvamento confirmado. O GET de metadados às **01:05:44.519 UTC de 10/10 (22:05:44.519 de 09/10 em Fortaleza)** retornou `disable_signup=true`, mantendo 36 definitions, 55 paths RPC e dois buckets privados. O valor `false` anterior fica preservado como histórico; fechar cadastro deixou de ser pendência. SMTP, recuperação e OAuth do Calendário exigem provas próprias.

Antes da aplicação informada da 016, o catálogo foi executado no SQL Editor pessoal em transação **READ ONLY**, encerrada com **ROLLBACK**: retornou `ok=false`, **1.246 checks** e um único desvio, `default_acl_closed` em `public.S`. A checagem `reviewed_cleanup_definition` passou, confirmando o corpo da função corrigida pela 015. O desvio aponta permissões padrão de sequências do papel `postgres` no schema `public` e motivou a 016 descrita abaixo. Naquela conferência readonly, não houve escrita de banco, fixtures ou aplicação de migrations. As três verificações adicionais no catálogo hosted decorrem das ACLs presentes na plataforma; não são três desvios nem substituem a contagem local de 1.243. Esse resultado é histórico e não comprova o estado posterior ao relato de aplicação da 016.

A retomada reforça o [catálogo readonly](../../supabase/tests/release-catalog.sql) com o SHA-256 do corpo completo (`prosrc`) da função da 015. Há 1.243 checks no cenário local, incluindo a recusa de código antigo ou alterado; normaliza somente CRLF→LF. Fonte da migration e sua cópia permanecem intactas. O catálogo hospedado anterior à 016 confirmou essa definição e encontrou o desvio de ACL registrado acima; o resultado histórico de 1.242 checks não certifica essa revisão. A execução hosted pós-016 passou em 1.246 checks/zero desvios, conforme a seção de conferência abaixo.

O [executor Google](../../scripts/operations/google-calendar-cron.mjs) envia o Bearer próprio em um único GET HTTPS ao alias fixo, exige opt-in literal pessoal e não lê `.env`. Valida DTO/status/contagens e limita corpo/deadline. Timeout ou perda de resposta são resultado remoto incerto, sem retry nem liberação de claim. [Guia e exemplo de agenda](../operations/examples/google-calendar-cron.md) ficam em docs, fora dos workflows ativos; nenhuma configuração ou execução foi ativada.

Validação integrada da retomada, antes da correção 016: **91/91 testes Node**, TypeScript/lint, parser **62 arquivos/zero erros**, cadeia **15 migrations/30 asserções**, catálogo **1.243 checks/zero desvios**, pacote **15 migrations/32 arquivos separados**, scanner **968 arquivos versionáveis**. Os 15 arquivos históricos foram conferidos byte a byte. Os testes de cron usam somente doubles; não executam Google/SQL remoto. Nenhuma migration nova foi criada nesse recorte validado; as provas da 016 ficam separadas a seguir. Os 91 testes Node não são a contagem final da rodada atual.

A 016 foi criada e revisada. Nos controles locais, as 12 entradas do default de sequências foram reduzidas às três do dono `postgres`; o catálogo recusou `public.S` antes e passou depois. A correção afeta somente **futuras sequências** de `postgres/public`; preserva ACLs existentes, Auth/Storage e outros owners/schemas, e provoca rollback diante de grant global inesperado. A validação independente da cadeia completa aprovou **16 migrations/31 asserções**, catálogo **1.243 checks/zero desvios**, parser **65 arquivos/zero erros** e pacote **16 migrations/33 arquivos separados**, gerado e conferido. [Escopo, regressões e aplicação manual](sequence-defaults.md).

A rodada local final aprovou **111/111 testes Node**, sem falhas ou skips, TypeScript/lint e scanner de **977 arquivos** sem assinaturas de segredo. A primeira tentativa de fixtures no sandbox encontrou EPERM; a execução autorizada com o diretório temporário completo passou sem enfraquecer os guards. Os 91 testes da retomada anterior conservam seu recorte histórico. A publicação em `70f0261` tem evidências próprias confirmadas a seguir.

O [CI de 70f0261](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38013773356) concluiu com sucesso para `70f02610d218e37aae75f3328acc38d4bb12559c`: **1.458 testes em cada fuso**, **111 testes de scripts**, **187 E2E**, parser **65 arquivos/zero erros**, cadeia **16 migrations/31 asserções**, catálogo local **1.243 checks/zero desvios**, pacote **16 migrations/33 arquivos** e scanner **977 arquivos**. O [deployment](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/75AwjQP2HQb55aR9E2j2MumXB4mU) recebeu status success para esse SHA. O smoke de **09/10 às 22:38:41.571 em Fortaleza (10/10 às 01:38:41.571 UTC)** confirmou login HTTP 200, Calendário sem sessão HTTP 401 e limpeza HTTP 503 pelo guard, sem executar job. As 23 issues foram atualizadas e verificadas, conservando critérios e histórico. Esses portões não comprovam a aplicação hospedada da 016 ou os aceites externos.

A tentativa automatizada de gerar e baixar tipos oficiais pelo Dashboard não produziu arquivo após timeout naquele recorte. Posteriormente, o mantenedor forneceu o download; a [revisão de tipos](t013-hosted-types-20261009.md) registra origem informada, hashes, projeção pública e integração nos nove adapters. O [comparador offline](../operations/database-types.md) foi revisado e aprovado em 19 testes, com leitura explícita de snapshot TypeScript privado, guard do projeto pessoal/schema `public` e parser AST sem executar o conteúdo, rede ou `.env`. `database:types:help` orienta o uso e `check:database-types` prepara a comparação separada da coleta. Mesmo em `SNAPSHOT_MATCH`, `provenance_verified` e `freshness_verified` ficam `false`; o mecanismo não comprova origem oficial ou atualidade, nem certifica drift hospedado. Não se renomearam contratos planejados como tipos gerados.

O [advisory oficial de braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), consultado em 09/10, informa versões afetadas até `3.0.3` e nenhuma versão corrigida. Não se aplicou downgrade incompatível da stack nem se retirou o lint para ocultar o resultado do audit.

## Tipos recebidos e validação da integração pós-016

O mantenedor forneceu o download oficial `supabase.ts`; o arquivo inclui `graphql_public` e `public`. A [revisão e procedência informada](t013-hosted-types-20261009.md) registra os hashes do original e da projeção pública, removendo somente as duas propriedades `graphql_public`, sem alterar os bytes públicos. Os tipos cobrem 35 tabelas, uma view e 54 RPCs; os nove adapters usam contratos individuais oficiais. As seis extensões `Planned*` e os três casts globais de `client.rpc` foram retirados. Nulls permitidos pelo SQL permanecem explícitos e têm adaptação escalar limitada. O arquivo original não foi publicado, executado ou usado para obter credenciais.

O runner PostgreSQL descartável compara inventário, colunas Row e nomes/defaults de Args com as migrations efetivamente instaladas **localmente**. Passou em 35 tabelas, uma view, 54 RPCs, 326 colunas e 194 argumentos. Controles negativos detectam catálogo divergente e o caso OUT antes de IN; modos/overloads não revisados são recusados. O comparador de snapshots preserva a ordem de overloads observável pelo SDK. Nenhum desses mecanismos afirma equivalência semântica completa ou coleta hosted contínua.

As consultas operacionais `queryPostgres` passam a observar falhas de `exit`/`error` em paralelo aos pipes e têm prazo local total de 45 segundos, conexão de oito segundos, saída até 1 MiB e UTF-8/JSON estritos. Regressões cobrem pipes/iterator/kill que não encerram. O [guia de limites](../operations/postgres-query-deadline.md) distingue falha local de término remoto/rollback; dump, importação e uploads não receberam esse prazo.

| Portão integrado local pós-016 | Resultado |
| --- | --- |
| Revisão | Três recortes de adapters, comparador e consultas operacionais revisados por pares e integrador; controles negativos corrigidos antes da publicação |
| Unidade/contratos | 97 arquivos; **1.508 testes em UTC e 1.508 em America/Sao_Paulo**, incluindo 50 novos com SDK real e fetch falso |
| Scripts | **137/137**, sem falhas/skips; 19 regressões de consultas PostgreSQL e cinco de contratos locais |
| SQL local | **16 migrations/31 asserções**, catálogo **1.243 checks/zero desvios**, inventário de tipos 35/1/54/326/194 |
| Tipos/camadas | TypeScript e lint integrais aprovados; **320 módulos/1.295 dependências**, sem violações |
| Pacote/imutabilidade | **16 migrations/33 arquivos separados**; fontes, cópias, bytes, hashes e manifest 001–016 idênticos ao checkpoint publicado |
| Build/scanners | Build demo aprovado, **78 bundles públicos**, scanner de **985 arquivos** sem assinaturas de segredo |

Essas contagens pertencem à integração local desta retomada; CI, E2E, deployment e smoke da revisão publicada são registrados por SHA na [issue #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) depois da execução, sem herdar resultados dos checkpoints anteriores. O catálogo hosted aprovado e o export informado têm provas separadas. Nenhuma nova migration, fixture remota, bootstrap, job ou envio Google foi executado nesta entrega.

## Aplicação manual das migrations

Destino autorizado: **projeto pessoal `rishenjoikgmfubmnfiu`**. BlackSheep/Sistema VOE não são destinos, fontes de credenciais ou fallback. CI/build/deploy/integração GitHub não executam SQL nem bootstrap. O [manifest](../../supabase/sql-editor/manifest.json) registra bytes canônicos LF; o [pacote SQL Editor](../../supabase/sql-editor/README.md) contém uma cópia por arquivo, sem executor automático.

**001–005 já foram aplicadas em 07/10/2026 e são imutáveis. Não reaplicar nenhuma delas e não repetir `bootstrap-master.sql`.** A primeira conta master já foi provisionada; UUID/e-mail/credenciais não fazem parte deste relatório.

| Já aplicada | Migration histórica |
| --- | --- |
| 001 | `20261007151834_identity_foundation.sql` |
| 002 | `20261007151850_auth_password_completion.sql` |
| 003 | `20261007151904_restrict_rls_event_trigger_execution.sql` |
| 004 | `20261007210519_capture_task_transactions.sql` |
| 005 | `20261007223710_activity_page.sql` |

**As nove migrations abaixo foram informadas como aplicadas manualmente pelo mantenedor em 09/10.** Tabelas/RPCs correspondentes foram observadas por REST; o catálogo pós-016 passou e o export fornecido foi revisado. Relato de aplicação, integridade local dos arquivos e estado hospedado são evidências distintas; não foi fabricado histórico interno de execução. A tabela preserva ordem/bytes para rastreabilidade, **não é uma instrução para reaplicar**.

| Ordem informada como aplicada | Arquivo | SHA-256 dos bytes canônicos |
| --- | --- | --- |
| 006 | [Financeiro](../../supabase/sql-editor/installation/006_20261009144343_financial_transactions.sql) | `af3f102412f78e83f5f612666761c8b65b07239ee72bbf3ea81c56f9dd1c3557` |
| 007 | [Conhecimento/vínculos](../../supabase/sql-editor/installation/007_20261009144350_knowledge_pages_links.sql) | `a9da2bb78314f2eb2b0f773fa5b200496b8a963e5103a25ebe13198e0fa37b2c` |
| 008 | [Admin](../../supabase/sql-editor/installation/008_20261009150122_identity_admin_settings.sql) | `461708ac47abb50465bd71bd5a70f76fadba7dee599d6f114a82f8c22aee7862` |
| 009 | [Preferências](../../supabase/sql-editor/installation/009_20261009151557_account_preferences.sql) | `d183f660303227d21ceb11dd84a676d3ebeefb233d3a76802b2d0b380c58806c` |
| 010 | [Projetos/Hábitos](../../supabase/sql-editor/installation/010_20261009152200_projects_habits.sql) | `c57c54245926c66b5cbe87baaceee101d8d0d9cc0b0537c22040d6d423d3abe6` |
| 011 | [Storage/Drive](../../supabase/sql-editor/installation/011_20261009152822_private_storage_drive.sql) | `a1a66fcd601d46e905f6db5a890a4799d9b3409b3331bb832e6e74301184f8b9` |
| 012 | [Busca/Atividade](../../supabase/sql-editor/installation/012_20261009154609_global_search_activity.sql) | `b91f2acbf62794811bd906e2592fb86b48205d5366e1446e6de7c9bfbd3a58e7` |
| 013 | [Cofre](../../supabase/sql-editor/installation/013_20261009160151_encrypted_vault.sql) | `3f1af61dbe5954e2e5354441e47e411463eb6314f0ae7471edfbc8cae7aa35ff` |
| 014 | [Calendário Google](../../supabase/sql-editor/installation/014_20261009160158_google_calendar.sql) | `621bc732a818da2627e245a1614264b5e3a70b8f330510d1fae06bef524ed0e3` |

**001–016 permanecem imutáveis e não devem ser reaplicadas; não repetir bootstrap.** A migration 015 foi revisada e validada localmente e **informada como aplicada manualmente pelo mantenedor em 09/10**. O catálogo hospedado confirmou sua definição por `reviewed_cleanup_definition`; isso verifica a função atual, sem fabricar histórico de aplicação. Ela ordena candidatos por `coalesce(cleaned_at + interval '1 day', expires_at)`, depois `expires_at` e `id`. A comparação local da função confirmou somente essa alteração na ordenação; objetos, grants, locks, quota e confirmação de limpeza foram preservados localmente. Falhas permanentes sem ACK ainda podem ocupar lotes e exigem investigação operacional.

| Aplicação manual informada | Arquivo canônico/pacote SQL Editor | SHA-256 local canônico | Estado |
| --- | --- | --- | --- |
| 015 — seleção de candidatos de limpeza | [20261009231338_file_cleanup_fairness.sql](../../supabase/sql-editor/installation/015_20261009231338_file_cleanup_fairness.sql) | `f71c6bb9debb24f032bb64824420693c9be6b4ab566f54d51dac6cdb658f897a` | Revisada, 3.522 bytes; aplicação informada em 09/10 e definição hospedada confirmada pelo catálogo; não reaplicar |

Os arquivos 015 e 016 não voltam à fila de execução. O manifest e as cópias foram regenerados e conferidos; sua integridade local, o fingerprint hospedado da 015 e o relato de aplicação da 016 têm evidências distintas. Asserções com fixtures continuam separadas e não devem rodar sobre contas reais. Nenhuma migration fica indicada para nova aplicação nesta retomada.

| Aplicação manual informada | Arquivo/pacote SQL Editor | SHA-256 local canônico | Estado |
| --- | --- | --- | --- |
| 016 — permissões padrão de sequências | [20261010010955_close_public_sequence_defaults.sql](../../supabase/sql-editor/installation/016_20261010010955_close_public_sequence_defaults.sql) | `add5b17ee8af3162ed893d1ac955c4fe5229707b7807d43a58b8c9124dc8e381` | Aplicação informada pelo mantenedor em 09/10 em Fortaleza; efeitos conferidos pelo catálogo hosted com zero desvios às 22:51:10.820; não reaplicar |

Fonte canônica: [20261010010955_close_public_sequence_defaults.sql](../../supabase/migrations/20261010010955_close_public_sequence_defaults.sql). O timestamp usa UTC de 10/10; o evento pertence a 09/10 em Fortaleza. Preservar a fonte, o hash e o relato do mantenedor, sem fabricar histórico interno da aplicação. O catálogo readonly conferiu o estado hospedado depois do relato, sem impor a contagem local ao ambiente real. Não reaplicar 001–016 ou bootstrap. Este relatório não aplica migrations ou modifica ACLs.

### Conferência após a aplicação informada da 016

Às **22:51:10.820 de 09/10/2026 em Fortaleza (01:51:10.820 UTC de 10/10)**, o SQL Editor pessoal autenticado executou o catálogo em **READ ONLY**, encerrado com **ROLLBACK**. Retornou `ok=true`, `checks=1246`, `version=1`, `deviations=[]`. Os efeitos esperados da 016 e o catálogo sem desvios ficaram confirmados naquele estado. O resultado anterior de 1.246 checks/um desvio continua identificado como anterior à 016; o relato de aplicação do mantenedor permanece distinto dessa prova readonly, sem fabricação de histórico.

Evidências privadas ignoradas: `work/hosted-catalog-post016.json`, `work/hosted-catalog-post016.txt` e `work/hosted-catalog-post016.jpg`. O agente não escreveu migrations, fixtures ou dados nessa rodada. O cadastro público continua desligado no painel. O catálogo estrutural não encerra jornadas autenticadas, concorrência, SMTP/Google, backup/restore ou aparelhos. Os tipos recebidos posteriormente têm revisão separada.

Continuidade após a aplicação informada:

1. Conferir organização/ref pessoal, registro de execução e hashes/versões, sem reaplicar migrations ou bootstrap.
2. Preservar o catálogo hosted pós-016 aprovado e o relato da aplicação. Não reaplicar 001–016 ou bootstrap. O MCP continua recusando acesso, mas o SQL Editor pessoal autenticado permitiu a conferência readonly; a projeção pública do export fornecido foi integrada e confrontada com os adapters e o catálogo local. Preservar a origem informada e repetir coleta/revisão após novas alterações hospedadas.
3. Conservar o diagnóstico resolvido de Production: `APP_URL` ausente foi cadastrado pelo mantenedor; o log posterior identificou formato inválido de `SUPABASE_PUBLISHABLE_KEY`. A chave publishable pessoal foi validada sem exibir o valor e corrigida em Production. O redeploy de `a3b1a52` passou e login/guards sem sessão foram conferidos. As próximas correções exigem seus próprios CI, deploy e smoke; o erro anterior não foi atribuído às migrations.
4. Preservar o cadastro público fechado, confirmado por `disable_signup=true` às 01:05 UTC de 10/10. Prosseguir com SMTP, Google/cron, Storage, jornadas conectadas, concorrência, backups e aparelhos conforme tabela abaixo.
5. Fixtures SQL são somente para base dedicada vazia com rollback; não executar no projeto com contas reais. Ensaios Auth usam opt-ins e limpeza por IDs/marcadores exatos.

Detalhes: [verificação da implantação](verificacao-implantacao-20261009.md). O manifest prova integridade dos arquivos locais, não registra execução remota. Restore permanece em outro projeto pessoal vazio, com procedimento próprio.
## Configurações externas pendentes

Os nomes de servidor estão em [.env.example](../../.env.example); os valores pertencem ao ambiente privado do hosting, sem `NEXT_PUBLIC_`. Cada integração valida sua configuração quando usada. Usar valores independentes; não publicar segredos em docs, URLs de cron, argumentos, logs, screenshots ou relatórios.

| Configuração | Ação posterior e prova necessária |
| --- | --- |
| Aplicação/Supabase | Redeploy de `a3b1a52` aprovado após correção publishable; `APP_URL` HTTPS, login habilitado, guards sem sessão, cache privado e CSP foram observados no alias. Falta jornada autenticada, cookies HttpOnly/Secure/SameSite e refresh; conferir URLs Auth/proxy/CDN e `app_private` fora dos schemas expostos. Novo código exige novo deploy e smoke. |
| Auth | Cadastro público fechado no Dashboard e confirmado pela API: `disable_signup=true` em 09/10 às 22:05:44.519 em Fortaleza. Conferir `AUTH_STATE_SECRET` e `AUTH_RATE_LIMIT_SECRET` independentes, ≥32 bytes; completar os demais ensaios Auth. Isso não comprova SMTP ou entrega. Revisar alerta histórico de proteção contra senhas vazadas no Security Advisor e registrar estado escolhido. |
| SMTP/recuperação | Configurar provedor pessoal, remetente/domínio, templates e redirects; testar entrega, link expirado/uso único, PKCE, adulteração e troca de senha com revogação. OP-010 adiou estes ensaios; não estão concluídos. |
| Admin | `ADMIN_COMMAND_SECRET` exclusivo, gerado com 48 bytes aleatórios e cadastrado como sensível em Production antes do deployment `190f5f0`. Validar efeitos Auth e revogação reais. Não expirar/roubar claim incerta; seguir [reconciliação](t017-admin.md#procedimento-futuro-para-auth-incerto) após provar término de todas as chamadas anteriores. |
| Storage | Buckets `second-brain-staging`/`second-brain-files` privados confirmados por API em 09/10; policies estruturais conferidas no catálogo, comportamento efetivo ainda exige ensaios. O catálogo hosted pós-016 confirmou os controles estruturais; isso não substitui testes de acesso e bytes reais. CSP permite somente origem pessoal exata necessária ao upload. Conferir `DRIVE_QUOTA_BYTES`/`DRIVE_MAX_FILE_BYTES`; defaults RECOMENDADOS: 1 GiB/dono e 25 MiB/arquivo Drive; imagens/anexos/avatar até 8 MiB. Confirmar re-encode/bytes/quota hospedados. |
| Limpeza de arquivos | Definição da 015 e efeitos da 016 confirmados; catálogo hosted com zero desvios. GET/POST `/api/files/cleanup` exigem `CRON_SECRET` independente ≥32 bytes no Bearer, antes do adapter; header até 1.024 caracteres e HTTP 503 com contagens em falha parcial. [Guia de manutenção](../operations/scheduled-maintenance.md) e exemplo documental propõem GET diário às 06:00 UTC; **nenhum job/configuração foi ativado**. Ainda configurar agenda/segredo e conferir execução, órfãos/disputa com vínculos e reconciliação; logs somente horário/contagens. |
| Google OAuth | Habilitar Calendar API, consentimento e cliente Web; redirect URI exata: `APP_URL` + `/api/calendar/oauth/callback`. Definir `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_CALENDAR_STATE_SECRET` ≥32 bytes, `GOOGLE_CALENDAR_TOKEN_KEY` base64 canônico de 32 bytes aleatórios e `GOOGLE_CALENDAR_TOKEN_KEY_ID`. Rotação opcional: `GOOGLE_CALENDAR_TOKEN_KEYS`. Conferir test users/publicação/verificação de escopos; [configuração completa](t025-calendario-google.md#configuração-manual-posterior). |
| Google cron/recuperação | Executor externo revisado, com `SC_GOOGLE_CRON_ALLOW_RUN` literal pessoal, `GOOGLE_CALENDAR_CRON_SECRET` próprio e endpoint fixo; ajuda/check não fazem rede, run não repete operação incerta. [Configuração e exemplo documental](../operations/examples/google-calendar-cron.md). **Nenhum job foi ativado**. Configurar OAuth/segredo privado, conferir capacidade de 200 contas e observar execução; validar paginação/410/consentimento/desconexão reais. Claims sem TTL só são liberadas após prova de término; [runbook](t025-calendario-google.md#recuperação-operacional). |
| Backup/restore | Obter pg_dump/pg_restore/psql compatíveis; destino/relatórios externos privados fora de sync/serving, ACL NTFS e perfil DPAPI/chave independente. Estabelecer quiescência em cada execução, verificar backup e observar agendamento. Restore em outro projeto pessoal vazio precisa provar UUIDs Auth, hashes Storage e **Cofre aberto com senha/kit originais em sessão limpa**. [Runbook](../operations/backup-restore-release.md). |
| Sentry opcional | `SENTRY_DSN` somente servidor, projeto pessoal. Se ativado, verificar envelope real de evento **e transação** contra allowlist, sem corpo/usuário/URLs/stacks/valores/ciphertext/tokens/kit; não habilitar Replay/logs/tracing automático. Se desativado, registrar essa escolha sem alegar envio aprovado. |
| PWA/aparelhos | Publicar HTTPS e validar instalação/update/offline no iPhone real; páginas/APIs/imagens privadas não ficam no service worker/cache após sair. Lembrete dentro do app não é push nem execução garantida com navegador fechado. |

## Aceites que mantêm as issues abertas

O snapshot consultado mantém abertas **#12, #20–35, #36 e os épicos #2, #4–7**. #3 (SPEC-02) já estava fechada e continua como histórico. Esta entrega mantém os aceites externos abertos; a tarefa raiz registra os avanços nas issues após publicar o código. Implementação e aceites operacionais são registros distintos.

| Issues | Evidência que falta no ambiente real |
| --- | --- |
| #12 — PWA/visuais | Instalação/update em Android e iPhone reais, offline controlado, temas/capturas atuais; Tab/leitor real/reduced motion e revisão visual final |
| #20 — identidade/pipeline | Aplicação 006–016 informada, definição da 015/efeitos da 016 confirmados e CI/deploy de `70f0261` aprovados. Catálogo hosted pós-016: 1.246 checks/zero desvios. Export oficial informado, projeção pública e contratos dos nove adapters integrados; gate local no CI compara inventário/colunas/Args/defaults com migrations descartáveis. Ainda faltam jornadas autenticadas e concorrência real; coleta periódica hospedada não configurada, registros de procedência não são fabricados. HEAD anônimo 401/403 nas 36 tabelas não encerra os ensaios de isolamento. Pipeline permanece sem SQL automático |
| #21 — Auth | Cadastro fechado e confirmado pela API; pendem SMTP/PKCE, HTTPS/cookies/refresh, senha atual obrigatória e sessões antigas revogadas em dois aparelhos |
| #22–23 — Capturar/Tarefas/Início | Anexos reais, persistência após reload, resposta perdida/replay, projeções/ações; veto/ocultação e conteúdo limpo no logout |
| #24 — Admin | Dois contextos/aparelhos, bloqueio/veto/role em leitura/escrita, último master concorrente, conta provisória antes da troca e Auth incerto protegido |
| #25–27 — Financeiro | RPCs/grants hospedados, transações simultâneas, rollback/replay de transferência/fatura/série, massa de regressão e UI conectada/privacidade/Desfazer |
| #28 — Conhecimento | Primeiro Caderno, rascunhos de sessão e wiki-link/backlink aprovados no harness local com TipTap real. Ainda faltam jornada hospedada, promoção sem duplicação editável, restauração exata, queries em lote e Entitlement atual; teclado/leitor real |
| #29 — Drive | Guard HTTP/retorno de falha parcial validados em 24 testes; seleção SQL e controles negativos validados localmente e definição da 015 confirmada no catálogo hospedado. Ainda faltam upload/download, quota em dois envios, nome/MIME/bytes falsos, re-encode/EXIF, revogação após reserva, falha objeto→commit e limpeza/vínculo concorrentes |
| #30 — Projetos/Hábitos | Contexto conectado sem cópia, refs do mesmo dono, histórico/pausa/dias no fuso e restauração preservando fontes |
| #31 — Cofre | Persistência/reload/dois usuários, recuperação em navegador limpo, rewrap/kit anterior, revogação concorrente, Argon2id/worker/clipboard em aparelho real e descarte no lock/logout |
| #32 — Calendário | Alvos ≥44px, nota editável e executor cron externo validados localmente. Ainda faltam OAuth duas contas/terceira recusada, estado/expiração/replay/troca de sessão, fontes/períodos/páginas/410, nota/vínculo hospedados, ativação/prova do cron e revogação incerta segura |
| #33 — Busca | Item correto nos sete tipos, E2E em pelo menos três, ranking/literais, orçamento hospedado com massa descartável, leitor anunciando contagem e privacidade em option/aria |
| #34 — Configurações | Tema/ordem desktop→celular, essenciais protegidos, avatar/remover, agenda/lembrete atualizados e troca de senha revogando sessões |
| #35 — release | CI/deploy/smoke de `70f0261` e catálogo hosted pós-016 com 1.246 checks/zero desvios aprovados, sem jobs ativados. Ainda registrar execução de manutenção e backup agendado/restore, telemetria se ativada, seis jornadas desktop/iPhone e auditoria Impeccable final |
| #36 — lint | Consulta de 09/10 mantém cinco registros high na cadeia de lint; advisory de `braces@3.0.3` sem patch oficial. Reavaliar correção compatível e repetir instalação limpa/audit/lint/typecheck/build/smoke; não substituir esta pendência por downgrade ou remoção do portão |
| #2, #4–7 — épicos | Anexar provas dos filhos e critérios de saída antes de fechar |

Corridas precisam de conexões/transações realmente sobrepostas: login/rate limit, CAS/replay, revogação contra comando, dois masters, quota, limpeza contra vínculo e disconnect contra sync. SQL local serializado não encerra estes critérios. Usar contas sintéticas identificadas e limpar somente IDs/marcadores/hashes exatos depois de todas as chamadas terminarem; master existente não é fixture.

Registrar as seis [jornadas-âncora](../planejamento/05-arquitetura-de-produto.md#3-jornadas-âncora-critério-de-aceite-do-produto-inteiro) em desktop/iPhone: capturar/organizar, agir no Início, lançar/pagar, buscar/vínculos, reunião com nota/tarefa e Cofre copiar/bloquear. Inspecionar 390/1440, claro/escuro, títulos longos, vazio/erro/carregamento, foco inicial/devolvido, Tab/Shift+Tab/setas/Enter/Esc, leitor real e reduced motion. Evidências usam dados sintéticos sem segredos/tokens/valores pessoais/kit em traces ou screenshots.

## Fase 2+ e limites do MVP

Permanecem fora desta entrega, conforme [doc 12](../planejamento/12-roadmap.md) e [doc 13](../planejamento/13-tickets.md): outbox/sincronização offline completa, push/Google watch, grafo visual persistente, orçamentos/plano do mês completos na UI, métricas agregadas de Admin, ClickUp/Gmail/API externa, exportação/exclusão completa de conta e TOTP. Prévia de arquivos/templates, multi-moeda, subcategorias, anexos/importação financeira e realtime também ficam para fases futuras. Tabelas/metadados preparados não declaram essas interfaces prontas.

IA dentro do app, colaboração/compartilhamento multiusuário, billing e escrita no Google continuam excluídos do corte aprovado. Preferência organiza a interface; Entitlement autoriza no servidor/banco. Lembrete funciona com app visível. O Cofre protege conteúdo persistido, mas não promete resistência a código hostil já executando no navegador desbloqueado nem apagamento físico garantido de strings JavaScript.

A liberação exige configurações e provas externas acima. O export fornecido e a projeção pública têm origem, hashes e limites registrados separadamente. Estado atual: **MVP publicado com login disponível, cadastro público fechado, definição da 015/efeitos da 016 e catálogo hosted sem desvios confirmados, CI/deploy de `70f0261` aprovados; aceite operacional ainda pendente**. Não reaplicar 001–016 ou bootstrap. Tipos públicos e adapters foram atualizados nesta retomada; jornadas e demais aceites continuam pendentes. Os exemplos de agendamento não ativaram jobs.
