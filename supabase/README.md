# Identidade — preparação de T-013

**Estado em 07/10/2026: migration versionada e revisada estaticamente, ainda não aplicada.** Nenhum projeto foi criado, vinculado ou alterado. A organização de destino está pendente; projetos do Sistema VOE ficam fora do escopo. T-013 permanece aberto até a aplicação manual e a validação real.

| Arquivo | Finalidade |
|---|---|
| [Migration de identidade](migrations/20261007082811_identity_foundation.sql) | Nove tabelas, índices, RLS, grants e cinco RPCs públicas |
| [Asserções de catálogo](tests/identity-catalog.sql) | RLS, grants efetivos, funções e defaults; termina com rollback |
| [Asserções de comportamento](tests/identity-behavior.sql) | Dois usuários sintéticos, isolamento, revogação, replay, rollback e limite; termina com rollback |
| [Bootstrap manual](manual/bootstrap-master.sql) | Primeiro master por UUID conferido; modelo termina com rollback |

A CLI Supabase **2.117.0** criou o nome canônico por `migration new identity_foundation`. Esse comando apenas gerou o arquivo local. A [OP-002](../docs/implementation/decisoes-operacionais.md) prevalece sobre instruções históricas de aplicação em CI: agentes, build, deploy e CI não executam migrations, reset, seed ou push de schema, inclusive em banco local. Um teste terminar com rollback não autoriza sua execução agora.

## Modelo e acesso

| Tabela | Leitura por `authenticated` | Escrita |
|---|---|---|
| `profiles` | Próprio usuário ativo | RPC de identidade |
| `user_preferences` | Próprio usuário ativo | RPC de identidade |
| `user_modules` | Próprio usuário ativo | RPC de identidade |
| `user_roles` | Próprio usuário ativo | Bootstrap; administração posterior em T-017 |
| `user_moderation` | Nenhum grant ou policy | Provisionamento; protocolo posterior em T-014/T-017 |
| `user_entitlements` | Próprio usuário ativo | Administração posterior em T-017 |
| `domain_events` | Próprio usuário ativo | Helpers internos; retenção operacional explícita |
| `app_private.command_receipts` | Nenhuma | Mesma transação do dado e evento |
| `app_private.rate_limits` | Nenhuma | RPC operacional com lock por chave |

O Usuário é a unidade de isolamento. Plano Pessoal é implícito: ausência de entitlement permite, veto explícito recusa; Admin exige também papel master. Preferência controla visibilidade e ordem, sem conceder acesso. Início, Capturar e Configurações são essenciais e não podem ser ocultados; a preferência de qualquer módulo exige entitlement permitido. A paridade dessa restrição na interface real pertence a T-027.

Os sete recursos públicos e as duas tabelas privadas têm RLS. Moderação não pode ser lida diretamente pelo dono. O owner esperado é `postgres`; a migration revoga defaults globais e por schema, além de aplicar grants explícitos por objeto. `app_private` deve permanecer fora dos schemas expostos pela Data API. As RPCs públicas são `SECURITY INVOKER`; os helpers privilegiados privados têm `search_path` vazio e execução restrita. Defaults para outro owner exigem revisão própria.

RLS confere dono, sessão existente em `auth.sessions`, vínculo da sessão ao usuário, ban, exclusão do Auth, expiração e moderação atuais. Senha provisória impede leitura por RLS e escrita. Somente `my_access_state` pode retornar `{user_id, must_change_password: true}` para encaminhar a troca; não retorna papel ou entitlements nesse estado. O acoplamento a colunas internas de Auth é explícito e exige conferência da versão real. Isso não implementa o fluxo de senha ou as políticas de inatividade/sessão única do Auth.

## RPCs e atomicidade

```text
authenticated:
  update_identity(resource, patch, client_id, canal = 'web') -> estado salvo
  my_access_state() -> estado mínimo de acesso

service_role, somente servidor/operador:
  bootstrap_master(user_uuid) -> void
  consume_rate_limit(scope, subject_hash, user_uuid = null, session_uuid = null)
  prune_operational_data() -> contagens removidas
```

`update_identity` recebe patches fechados de perfil, preferência ou módulo. Extrai o dono da sessão, valida acesso, limita escritas e salva dado, evento e recibo juntos. Não aceita papel, moderação, dono ou timestamps no patch. O recibo é identificado por usuário + comando + `client_id`: mesmo pedido JSONB retorna o resultado anterior; conteúdo diferente é conflito. O Canal `web/api` será definido pelo servidor em T-014, nunca copiado de um formulário.

O gatilho de provisionamento cria perfil, preferências, papel comum e moderação com eventos na transação de criação Auth. É uma exceção de infraestrutura documentada ao orquestrador do Núcleo. Não copia privilégios, nome ou avatar de metadata editável; não cria categorias nem envia e-mail. Cadastro público fechado depende da configuração Auth posterior.

Login admite cinco tentativas por minuto; a sexta é recusada. O limitador usa janela deslizante, lock de linha e relógio capturado após obter o lock. Tentativas negadas não prolongam o bloqueio. A chave de login será um HMAC calculado no servidor, sem e-mail, IP ou senha em claro no banco; composição e rotação ficam em T-014. Identidade admite 30 escritas confirmadas por minuto, com chave derivada do UUID. Replays não consomem novamente; falhas transacionais não consomem o limite. O servidor não deve cobrar esse mesmo limite duas vezes.

Eventos não concedem DML ao dono nem à service role; esta também não recebe leitura de conteúdo de eventos ou recibos. A rotina de retenção remove eventos com mais de 90 dias e limites ociosos há mais de um dia. Não instala agendamento. Recibos permanecem para preservar idempotência tardia; minimização e retenção exigem decisão antes de generalizá-los em T-015. Eventos aceitam somente recursos de identidade: outros módulos ampliarão o contrato por migrations próprias; Cofre exigirá uma lista estrita de metadados permitidos.

## Revisão e validação disponível

Um agente preparou o SQL; outro revisou permissões e asserções, com revisão adicional na integração. Foram corrigidos defaults de EXECUTE, leitura durante troca obrigatória, preferência de módulo essencial/vetado, resolução do schema temporário nos testes e bootstrap de conta excluída. Administração avançada saiu deste recorte: T-017 deverá provar veto do ator, proteção do último master utilizável e coordenação entre ban Auth, revogação e moderação.

O [parser estático](../scripts/check-sql.py) usa **pglast 7.18 / gramática PostgreSQL 17** para verificar SQL externo, corpos SQL/PLpgSQL e blocos DO. Não abre conexão nem executa SQL. Instalação isolada para uso local:

```sh
python -m venv work/sql-check
# Ative o ambiente virtual conforme seu sistema.
python -m pip install --only-binary=:all: -r scripts/sql-validation-requirements.txt
python scripts/check-sql.py
```

O CI executa somente esse parsing. Ele não resolve objetos, tipos do catálogo, SQL dinâmico, permissões ou comportamento transacional. **RLS, Auth, concorrência, grants efetivos e asserções de banco ainda não foram executados.** Não há tipos de banco gerados ou adapters reais; tampouco se declara equivalência com a suíte de memória.

Na validação local, os quatro arquivos passaram: 224 instruções SQL externas, 24 funções e sete blocos DO. Quatro controles negativos recusaram SQL externo, corpo SQL, corpo PL/pgSQL e bloco DO com sintaxe inválida. Um controle inicial com `RETURN` sem expressão demonstrou o limite semântico do parser: verificar compatibilidade com o tipo de retorno requer o banco; esse caso não foi contado como prova de recusa sintática.

## Aplicação manual posterior

1. Confirmar organização, custo e projeto novo dedicado. Conferir destino, versão PostgreSQL/Auth, owner e schemas expostos. Nunca usar um projeto do VOE. A migration recusa contas Auth preexistentes ou objetos do recorte; não é upgrade do legado.
2. Revisar integralmente a migration, incluindo defaults e trigger Auth. O mantenedor aplica e registra sua versão pelo procedimento manual escolhido. A execução direta repetida é deliberadamente recusada pelo preflight; o comportamento de não reaplicar versões registradas ainda precisa de evidência no ambiente real.
3. Em ambiente de teste dedicado **sem contas**, executar manualmente as asserções de catálogo e comportamento como owner/postgres. São fixtures sem senha ou dados pessoais reais. Os arquivos devem terminar com rollback; qualquer erro invalida a evidência.
4. Verificar concorrência com duas conexões: mesma chave de login permite no máximo cinco tentativas; mesmo comando confirma um único evento/recibo; conteúdo incompatível conflita. Chaves independentes devem progredir separadamente. Asserções sequenciais não provam concorrência.
5. Configurar Auth com cadastro público fechado e e-mail; criar a conta inicial pelo canal autorizado, conferir UUID e seguir o modelo de bootstrap. O arquivo fornecido sempre desfaz: a decisão de persistir é manual. Não contém senha nem e-mail fixo.
6. Registrar resultados, gerar tipos do schema real, definir verificação de divergência sem aplicação de migrations e prosseguir em T-014/T-015. As [decisões propostas](../docs/implementation/t014-t015-decisoes-propostas.md) tratam cookies, CSP, transações e imagens.

## Fontes

Planejamento: docs 02/06/09/13, ADRs 0001–0004 e migrations históricas do legado `ffdf06435a5b8dcd047574172cddf1cc772dfd09`. Foram usadas as skills Supabase e Postgres com a exceção explícita de aplicação manual determinada pelo mantenedor.

Consultas oficiais em 07/10/2026: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [sessões](https://supabase.com/docs/guides/auth/sessions), [grants explícitos da Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [defaults globais e por schema](https://www.postgresql.org/docs/15/sql-alterdefaultprivileges.html), [parser pglast](https://pglast.readthedocs.io/en/v7/api.html). O changelog foi consultado; não se instalam extensões nem se usa criptografia SQL neste recorte.
