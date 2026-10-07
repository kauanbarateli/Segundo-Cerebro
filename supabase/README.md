# Identidade e Auth — T-013/T-014

**Estado em 07/10/2026: fluxo T-014 e migrations preparados localmente; conexão pessoal verificada e aplicação supervisionada autorizada pela [OP-009](../docs/implementation/decisoes-operacionais.md#op-009--conexão-pessoal-e-aplicação-supervisionada).** A inspeção em leitura do projeto `rishenjoikgmfubmnfiu` encontrou PostgreSQL 17.11, nenhuma conta Auth, nenhuma relação de identidade da aplicação e histórico de migrations vazio. Esse é o estado anterior à aplicação, não prova de instalação ou Auth funcionando. A preparação inicial sem conexão permanece documentada na OP-008. É proibido usar organizações, projetos ou credenciais da BlackSheep e do Sistema VOE, conforme OP-007.

**Aplicação confirmada em 07/10/2026:** três migrations aplicadas por MCP com `success=true`, nove tabelas com RLS e três asserções SQL aprovadas, com rollback e ausência de resíduos conferidos. O [relatório da aplicação](../docs/implementation/t013-aplicacao-supabase.md) registra versões originais/remotas, hashes, Advisors e limites. Os nomes locais e cópias foram alinhados às versões atribuídas pelo MCP, com manifest regenerado/check aprovado e bytes SQL preservados, sem manipular o histórico remoto. Configuração Auth/callbacks, credenciais server-only, concorrência e fluxos reais continuam pendentes; SMTP e recuperação por e-mail foram postergados por OP-010. Fixtures SQL não comprovam login ou envio de e-mail. T-013/T-014 permanecem abertos nos critérios ainda não demonstrados.

| Arquivo | Finalidade |
|---|---|
| [Migration de identidade](migrations/20261007151834_identity_foundation.sql) | Nove tabelas, índices, RLS, grants e cinco RPCs públicas |
| [Migration de conclusão de senha](migrations/20261007151850_auth_password_completion.sql) | Sexta RPC pública, restrita ao servidor, e eventos de autenticação sem credenciais |
| [Restrição da função de RLS](migrations/20261007151904_restrict_rls_event_trigger_execution.sql) | Revoga EXECUTE dos papéis da API na função preexistente, preservando seu event trigger |
| [Asserções de catálogo](tests/identity-catalog.sql) | RLS, grants efetivos, funções e defaults; termina com rollback |
| [Asserções de comportamento](tests/identity-behavior.sql) | Dois usuários sintéticos, isolamento, revogação, replay, rollback e limite; termina com rollback |
| [Asserções de conclusão de senha](tests/auth-password-completion.sql) | Grants, rollback de flag/evento/recibo, replay e sessão revogada; termina com rollback |
| [Bootstrap manual](manual/bootstrap-master.sql) | Primeiro master por UUID conferido; modelo termina com rollback |
| [Pacote SQL Editor](sql-editor/README.md) | Cópias numeradas das migrations canônicas, sem execução |
| [Manifest SHA-256](sql-editor/manifest.json) | Ordem, origem e hashes; não registra aplicação em banco |

A CLI Supabase **2.117.0** criou o nome canônico da primeira migration por `migration new identity_foundation`. Esse comando apenas gerou o arquivo local. A OP-009 autoriza agora migrations revisadas e asserções com rollback pela conexão pessoal supervisionada. Reset/seeds e aplicação automática por build, deploy, CI ou integração GitHub continuam proibidos. Instalação, asserções e bootstrap permanecem separados.

## Modelo e acesso

| Tabela | Leitura por `authenticated` | Escrita |
|---|---|---|
| `profiles` | Próprio usuário ativo | RPC de identidade |
| `user_preferences` | Próprio usuário ativo | RPC de identidade |
| `user_modules` | Próprio usuário ativo | RPC de identidade |
| `user_roles` | Próprio usuário ativo | Bootstrap; administração posterior em T-017 |
| `user_moderation` | Nenhum grant ou policy | Provisionamento e conclusão de senha; administração posterior em T-017 |
| `user_entitlements` | Próprio usuário ativo | Administração posterior em T-017 |
| `domain_events` | Próprio usuário ativo | Helpers internos; retenção operacional explícita |
| `app_private.command_receipts` | Nenhuma | Mesma transação do dado e evento |
| `app_private.rate_limits` | Nenhuma | RPC operacional com lock por chave |

O Usuário é a unidade de isolamento. Plano Pessoal é implícito: ausência de entitlement permite, veto explícito recusa; Admin exige também papel master. Preferência controla visibilidade e ordem, sem conceder acesso. Início, Capturar e Configurações são essenciais e não podem ser ocultados; a preferência de qualquer módulo exige entitlement permitido. A paridade dessa restrição na interface real pertence a T-027.

Os sete recursos públicos e as duas tabelas privadas têm RLS. Moderação não pode ser lida diretamente pelo dono. O owner esperado é `postgres`; a migration revoga defaults globais e por schema, além de aplicar grants explícitos por objeto. `app_private` deve permanecer fora dos schemas expostos pela Data API. As RPCs públicas são `SECURITY INVOKER`; os helpers privilegiados privados têm `search_path` vazio e execução restrita. Defaults para outro owner exigem revisão própria.

RLS confere dono, sessão existente em `auth.sessions`, vínculo da sessão ao usuário, ban, exclusão do Auth, expiração e moderação atuais. Senha provisória impede leitura por RLS e escrita. Somente `my_access_state` pode retornar `{user_id, must_change_password: true}` para encaminhar a troca; não retorna papel ou entitlements nesse estado. O acoplamento a colunas internas de Auth é explícito e exige conferência da versão real. O fluxo de senha está implementado no servidor em T-014; políticas nativas de inatividade/sessão única continuam dependendo da configuração Auth e de validação real.

## RPCs e atomicidade

```text
authenticated:
  update_identity(resource, patch, client_id, canal = 'web') -> estado salvo
  my_access_state() -> estado mínimo de acesso

service_role, somente servidor/operador:
  bootstrap_master(user_uuid) -> void
  consume_rate_limit(scope, subject_hash, user_uuid = null, session_uuid = null)
  prune_operational_data() -> contagens removidas
  complete_password_change(user_uuid, session_uuid, client_id) -> {completed: true}
```

`update_identity` recebe patches fechados de perfil, preferência ou módulo. Extrai o dono da sessão, valida acesso, limita escritas e salva dado, evento e recibo juntos. Não aceita papel, moderação, dono ou timestamps no patch. O recibo é identificado por usuário + comando + `client_id`: mesmo pedido JSONB retorna o resultado anterior; conteúdo diferente é conflito. O Canal `web/api` pertence ao servidor, nunca deve ser copiado de um formulário.

`complete_password_change`, adicionada pela segunda migration, só pode ser executada por `service_role`. O backend a chama após confirmar a alteração no Auth e a revogação das outras sessões. Ela valida a sessão ativa e confirma `must_change_password=false`, evento `authentication` e recibo idempotente na mesma transação. O payload do evento contém somente `operation: password_changed` e `forced`; a RPC não recebe senha, hash de senha ou token e não altera a senha no Auth. Falhas entre Auth e banco são tratadas pelo checkpoint assinado do servidor, conforme o [runbook T-014](../docs/implementation/t014-auth-backend.md#troca-de-senha-e-falha-parcial).

O gatilho de provisionamento cria perfil, preferências, papel comum e moderação com eventos na transação de criação Auth. É uma exceção de infraestrutura documentada ao orquestrador do Núcleo. Não copia privilégios, nome ou avatar de metadata editável; não cria categorias nem envia e-mail. Cadastro público fechado depende da configuração Auth posterior.

Login admite cinco tentativas por minuto; a sexta é recusada. O limitador usa janela deslizante, lock de linha e relógio capturado após obter o lock. Tentativas negadas não prolongam o bloqueio. T-014 calcula a chave de login por HMAC no servidor, sem e-mail, IP ou senha em claro no banco; recuperação usa namespace separado. Configuração e rotação estão no [runbook T-014](../docs/implementation/t014-auth-backend.md#configuração-manual-fora-do-sql-editor). Identidade admite 30 escritas confirmadas por minuto, com chave derivada do UUID. Replays de `update_identity` não consomem novamente; falhas transacionais não consomem seu limite. Tentativas de troca de senha são limitadas antes de chamar o Auth, inclusive durante a reconciliação.

Eventos não concedem DML ao dono nem à service role; esta também não recebe leitura de conteúdo de eventos ou recibos. A rotina de retenção remove eventos com mais de 90 dias e limites ociosos há mais de um dia. Não instala agendamento. Recibos permanecem para preservar idempotência tardia; minimização e retenção exigem decisão antes de generalizá-los em T-015. Eventos aceitam recursos de identidade e os metadados de `authentication` descritos acima: outros módulos ampliarão o contrato por migrations próprias; Cofre exigirá uma lista estrita de metadados permitidos.

## Auth local e conexão supervisionada

T-014 inclui entrar, recuperar/trocar senha e sair, cookies httpOnly, guardas de sessão/Entitlement no servidor, limites persistentes e CSP em bloqueio. O [runbook do backend](../docs/implementation/t014-auth-backend.md) separa implementação e testes com doubles dos procedimentos reais ainda pendentes; a [interface Auth](../docs/implementation/t014-auth-ui.md) não simula entrada quando falta configuração. `APP_MODE=demo` continua disponível sem Supabase; em modo conectado, os dados dos módulos permanecem demonstrativos até seus adapters. A página pública `/offline` não consulta Auth, e a PWA não armazena páginas pessoais, respostas de API ou sessões. Gerar e conferir o pacote SQL Editor continua sendo trabalho local; aplicar migrations e validar Auth são etapas supervisionadas distintas, com resultados próprios.

## Revisão e validação disponível

Um agente preparou o SQL; outro revisou permissões e asserções, com revisão adicional na integração. Foram corrigidos defaults de EXECUTE, leitura durante troca obrigatória, preferência de módulo essencial/vetado, resolução do schema temporário nos testes e bootstrap de conta excluída. Administração avançada saiu deste recorte: T-017 deverá provar veto do ator, proteção do último master utilizável e coordenação entre ban Auth, revogação e moderação.

O [parser estático](../scripts/check-sql.py) usa **pglast 7.18 / gramática PostgreSQL 17** para verificar SQL externo, corpos SQL/PLpgSQL e blocos DO. Não abre conexão nem executa SQL. Instalação isolada para uso local:

```sh
python -m venv work/sql-check
# Ative o ambiente virtual conforme seu sistema.
python -m pip install --only-binary=:all: -r scripts/sql-validation-requirements.txt
python scripts/check-sql.py
```

Para SQL, o CI verifica parsing e integridade do pacote, sem executar banco. O parser não resolve objetos, tipos do catálogo, SQL dinâmico, permissões ou comportamento transacional. **A execução supervisionada separada aprovou as três asserções de catálogo, comportamento e conclusão de senha**, conforme relatório: grants/RLS, isolamento por fixtures, replay e rollback foram testados. Concorrência e Auth pelos canais reais permanecem pendentes. Tipos foram gerados via MCP; isso não implementa adapters reais dos módulos nem prova equivalência com a suíte de memória.

**Registro histórico de T-013, anterior à migration de Auth:** os quatro arquivos então existentes passaram na validação local, com 224 instruções SQL externas, 24 funções e sete blocos DO. Quatro controles negativos recusaram SQL externo, corpo SQL, corpo PL/pgSQL e bloco DO com sintaxe inválida. Um controle inicial com `RETURN` sem expressão demonstrou o limite semântico do parser: verificar compatibilidade com o tipo de retorno requer o banco; esse caso não foi contado como prova de recusa sintática. O conjunto atual contém sete arquivos canônicos: três migrations, três scripts de asserções e um bootstrap. Após incluir a restrição da função de RLS, o parser conferiu esses sete arquivos e as três cópias de instalação: dez arquivos sem erros sintáticos. Os cinco testes do gerador e o check de integridade também passaram; isso não atesta aplicação.

## Pacote local para o SQL Editor

Na raiz do repositório:

```sh
node scripts/build-sql-editor.mjs
node scripts/build-sql-editor.mjs --check
node --test tests/scripts/build-sql-editor.test.mjs
```

O gerador descobre todas as migrations canônicas em `supabase/migrations/`, ordena as versões e grava cópias exatas em `supabase/sql-editor/installation/`. A ordem atual é identidade (`001`), conclusão de senha (`002`) e restrição de EXECUTE do helper RLS (`003`); migrations futuras entram ao gerar novamente, sem nomes fixados no gerador. Cada arquivo mantém seus próprios limites de transação. O pacote não concatena transações, não altera SQL e não inclui bootstrap ou asserções na instalação.

O manifest registra SHA-256 e tamanho dos bytes canônicos, versão, ordem e destino da cópia. Também registra hashes dos scripts separados em `supabase/tests/` e `supabase/manual/`, que continuam em seus caminhos originais e devem terminar com `ROLLBACK;`. Os arquivos de texto do repositório usam LF conforme `.gitattributes`; não há horário de geração, caminho pessoal ou dado de ambiente no pacote.

`--check` é somente leitura: recusa cópia alterada/ausente, manifest divergente, migration nova ainda não empacotada ou arquivo inesperado no pacote. A geração também recusa versões duplicadas e nomes inválidos; arquivos inesperados ou obsoletos exigem revisão e remoção manual, sem limpeza automática. Edite a fonte canônica, nunca a cópia gerada. Um hash coerente prova integridade local, não correção do SQL nem execução bem-sucedida.

## Aplicação supervisionada

As três migrations e as asserções já foram executadas neste projeto; consultar o relatório antes de qualquer operação. Não reaplicar a instalação. A sequência abaixo documenta o procedimento, suas verificações e as etapas Auth ainda pendentes.

1. Reconferir o projeto pessoal autorizado `rishenjoikgmfubmnfiu`, versão PostgreSQL/Auth, owner e schemas expostos. Nunca usar organização, projeto ou credenciais da BlackSheep ou do VOE. A migration inicial recusa contas Auth preexistentes ou objetos do recorte; não é upgrade do legado. A inspeção inicial sem contas não substitui a conferência imediatamente anterior à execução.
2. Gerar o pacote e executar `--check`; revisar integralmente as migrations, incluindo defaults e trigger Auth. Pela conexão autorizada para escrita, aplicar **uma migration canônica completa por vez**, em ordem, e só prosseguir após conferir sucesso; o SQL Editor permanece alternativa manual. Ao primeiro erro, interromper e revisar o estado antes de continuar. Registrar versão, hash, destino, canal e resultado; não fabricar registros em `supabase_migrations.schema_migrations`. O pacote não registra aplicações. A repetição da migration inicial é deliberadamente recusada pelo preflight. Para um destino parcialmente preparado, conferir o registro e o estado antes de decidir qual arquivo falta; o pacote não decide isso.
3. Após as três migrations, em ambiente de teste dedicado **sem contas**, executar separadamente as três asserções: catálogo de identidade, comportamento de identidade e conclusão de senha, como owner/postgres. São fixtures sem senha ou dados pessoais reais. Os arquivos devem terminar com rollback; qualquer erro invalida a evidência. Essas fixtures SQL não comprovam alteração de senha ou envio de e-mail pelo Auth.
4. Verificar concorrência com duas conexões: mesma chave de login permite no máximo cinco tentativas; mesmo comando confirma um único evento/recibo; conteúdo incompatível conflita. Chaves independentes devem progredir separadamente. Asserções sequenciais não provam concorrência.
5. O mantenedor criará a conta inicial no Dashboard Auth Users; conferir UUID e seguir o [bootstrap de master](../docs/implementation/t014-auth-backend.md#primeira-conta-e-papel-master). O papel Auth permanece `authenticated`; “SUPERADMIN” corresponde ao `master` do aplicativo, nunca a metadata editável. O arquivo fornecido termina com rollback e não persiste a promoção como está. SMTP e recuperação por e-mail estão postergados; não usar convite por e-mail como pré-requisito dessa primeira conta.
6. Seguir a configuração e os testes reais do [runbook T-014](../docs/implementation/t014-auth-backend.md#configuração-manual-fora-do-sql-editor), incluindo e-mail/PKCE, HTTPS/cookies, revogação, senha provisória e falhas parciais. Registrar resultados, gerar tipos do schema real e definir verificação de divergência sem aplicação de migrations. As [decisões propostas](../docs/implementation/t014-t015-decisoes-propostas.md) preservam o planejamento de transações e imagens de T-015; não são evidência de integração real.

## Fontes

Planejamento: docs 02/06/09/13, ADRs 0001–0004 e migrations históricas do legado `ffdf06435a5b8dcd047574172cddf1cc772dfd09`. Foram usadas as skills Supabase e Postgres; as decisões operacionais registram a preparação originalmente manual e a autorização posterior de aplicação supervisionada.

Consultas oficiais em 07/10/2026: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [sessões](https://supabase.com/docs/guides/auth/sessions), [grants explícitos da Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [defaults globais e por schema](https://www.postgresql.org/docs/15/sql-alterdefaultprivileges.html), [parser pglast](https://pglast.readthedocs.io/en/v7/api.html). O changelog foi consultado; não se instalam extensões nem se usa criptografia SQL neste recorte.
