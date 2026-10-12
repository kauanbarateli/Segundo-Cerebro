# Frente B: validações conectadas de 12/10/2026

A retomada segue a [divisão em duas frentes](handoff-duas-frentes-mvp-20261012.md). A construção offline será revisada na PR da Frente A. As conferências abaixo usam produção/projetos pessoais, sem modificar o checkout dessa frente ou incorporar sua entrega por antecipação.

## Auth e Configurações em produção

Às 20:11:45 UTC, a consulta somente leitura do projeto pessoal `rishenjoikgmfubmnfiu` confirmou que a conta comum existente continua com e-mail validado. `GET /auth/v1/settings` retornou HTTP 200, `disable_signup=true` e provedor de e-mail habilitado. Não houve criação de usuário, troca de senha ou alteração de configuração nesta consulta. O endpoint expõe a [configuração pública de Auth](https://github.com/supabase/auth/blob/master/README.md#get-settings).

Na sessão humana já existente em `https://segundo-cerebro-of.vercel.app/configuracoes`, a raiz:

1. Conferiu a identidade da conta comum, sem usar a master como fixture.
2. Alterou **Tema da conta** de Sistema para Escuro e enviou **Salvar aparência**.
3. Observou `Configurações salvas na sua conta.`, recarregou a página e aguardou a leitura das configurações. O seletor da conta continuou com `dark`; a prova não se limita ao tema armazenado no navegador.
4. Restaurou Sistema, salvou, recarregou e confirmou o seletor da conta com `system`.
5. Usou **Atualizar sessões**. A lista voltou com uma sessão, marcada como atual, sem erro ou identificador privado renderizado. Os elementos `time` exibiram criação `2026-10-12T15:29:22.09376+00:00` e renovação `2026-10-12T20:07:19.433633+00:00`.

O recorte comprova leitura/gravação e persistência da preferência na própria conta, além da atualização da lista real de sessões. Não certifica tema em outro aparelho, isolamento concorrente entre contas, revogação ou término de requests dos runners. Nenhuma senha, cookie, token, e-mail ou UUID integra esta evidência pública. A [recuperação SMTP anterior](smtp-producao-20261012.md) permanece válida e não foi repetida.

## Candidato ao restore informado pelo mantenedor

O mantenedor indicou o projeto antigo `nqxgtnvmzuempxemlaku`, advertindo que ele não está vazio. O painel autenticado mostrou **Segundo_Cérebro**, na organização pessoal **kauanbarateli's Org**. A conferência em novo rascunho SQL usou `BEGIN TRANSACTION READ ONLY`, `statement_timeout=5s` e `ROLLBACK`:

| Metadado | Resultado |
| --- | --- |
| PostgreSQL | 17.6 / `170006` |
| Banco | `postgres` |
| Tabelas públicas | 42 |
| Views públicas | 2 |
| Usuários Auth | 1 |
| Buckets Storage | 2 |
| Objetos Storage | 1 |

Nenhum registro pessoal foi aberto, copiado ou removido. A seleção não alterou schema/dados; o painel criou somente um rascunho privado para a consulta.

O [restore existente](../../scripts/operations/restore-target.mjs) recusa esse estado com `RESTORE_TARGET_NOT_EMPTY` antes de restaurar o banco. A indicação do projeto não transforma o conteúdo em vazio nem comprova preservação do legado. Para utilizá-lo, preparar antes a preservação verificável do banco, Auth e bytes do Storage antigos e uma operação revisável; a substituição ainda não foi executada. Um destino pessoal vazio continua sendo a opção direta para o procedimento vigente. A origem e suas migrations 001–019 permanecem intactas.

O PostgreSQL instalado pelo mantenedor em `C:\Program Files\PostgreSQL\17` contém os três clientes 17.11, em caminhos regulares sem reparse. Uma execução de `--version` por cliente confirmou `psql` 17.11 com saída 0. `pg_dump` e `pg_restore` foram recusados pelo Controle de Aplicativo do Windows, erro 4551. Não houve repetição ou alteração da política, PATH, serviços ou PostgreSQL 18.4. A conferência de conexão pode usar `psql` 17; criar/restaurar o dump continua pendente.

## Execuções próprias do CI: `1f1f568`

Os oito workflows automáticos terminaram: cinco aprovados por metadados (CI geral, Foundation, Captura Storage, Avatar Storage e Admin backend) e três com falha. O status GitHub da Vercel confirmou deploy às 19:56:08 UTC; isso não certifica as variáveis nem as jornadas de produção. Cada uma das três execuções com falha recebeu uma captura própria, única e fechada, após revisão independente e 57 controles puros. Nenhum log, report ou status privado histórico foi reaberto. [Recorte público fechado](evidence/frente-b-native-1f1f568-20261012.json).

- **Admin — [38300788319/1](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38300788319):** BLOCK comprovou oito estágios até `actor-intact`, incluindo duas RPCs/duas visões de sessões próprias e negação das sessões bloqueadas. Falhou no encerramento com um request Auth/GET de login, sem resposta, introduzido em `fixtures`, `continue-ack`, identidade exata do request e nenhum terminal de protocolo/público observado. Escrita incerta e limpeza zero preservadas; FIRST não executou.
- **Recovery — [38300788292/1](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38300788292):** sete estágios até `credentials-changed`, com 195 requests browser/seis SDK/cinco SQL/três Mailpit. O encerramento conservou sete scripts pendentes, origem de estágio mista, `continue-ack` e identidade exata, sem terminal de protocolo/público observado. O caso não marcou escrita incerta; o runner conservou incerteza e limpeza zero.
- **Auth — [38300788270/1](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38300788270):** logout global e identidade/RLS/eventos/Captura passaram, com limpeza própria e as duas barreiras entre casos. A troca de senha comprovou aviso terminal, negação das sessões antigas e conta B intacta, mas recusou `POST_REQUEST_ABORTED` na tentativa com a senha antiga. Caso com `CLEANUP_UNCONFIRMED`/`OUTCOME_UNCERTAIN` e zero fixtures excluídas. O runner confirmou descarte do namespace, stack e diretórios; essa prova de infraestrutura não aprova o caso incompleto.

Os diagnósticos de protocolo desta fonte **não confirmam** a hipótese de terminal anterior ao pause para os requests ainda pendentes. Ausência de evento observado também não prova que o provedor terminou. Não converter ACK, cabeçalho, fechamento de contexto ou descarte do namespace em EOF ou PASS. O prazo absoluto de 15 segundos e o veto de limpeza permanecem preservados.

## Correção no observador de CI

A varredura de fallback do [observador original](../../tests/e2e-auth-local/admin-browser-support.mjs) percorre um Map compartilhado entre sessões de protocolo. Ela tentava vincular a entrada antes de conferir sua sessão. Assim, uma sessão estrangeira descartava o vínculo exato mesmo quando ele estava disponível, independentemente da ordem das sessões.

Um reproduzidor com entrega assíncrona via `setImmediate`, como o Playwright 1.63, passou com uma sessão e falhou nas duas ordens de duas sessões. A correção verifica `entry.session === port.session` antes de criar/vincular o trace. A mesma reprodução passou nos três casos depois do ajuste.

Os seis [controles novos](../../tests/scripts/admin-browser-support.test.mjs) também recusam sessão desconhecida, duplicata e accessor; mantêm o request pendente, o Map original intacto e zero comandos/leitura de getters. A alteração corrige somente o diagnóstico. Não soluciona nem aprova as falhas de `1f1f568`, e não modifica o produto, schemas, deadlines, primeira falha, terminais ou veto de cleanup.

Validação local do diff: 81 controles distintos de suporte aprovados, 58 controles de contrato/Recovery aprovados, TypeScript integral, sintaxe/lint dos dois arquivos, scanner de 1.303 arquivos versionáveis e whitespace aprovados. Onze testes de suporte e cinco de Recovery foram recusados inicialmente pelo sandbox em `realpath`; somente esses controles herméticos foram repetidos com permissão local e passaram. Revisão independente confirmou código, seis novos controles e as evidências conectadas deste documento. Os 57 controles dos parsers de captura são outra prova; não certificam execução funcional do CI.

## Conexões e revisão da Frente A

Os conectores Supabase e Vercel voltaram a recusar a consulta: permissão MCP indisponível no Supabase e HTTP 403 no escopo `kauanbarateli-projects` na Vercel. Não houve repetição automática ou mudança de escopo/chaves. SDK de servidor restrito ao projeto pessoal e painel autenticado permitiram as conferências acima.

A primeira consulta GitHub desta retomada não encontrou PR aberta. Quando a Frente A publicar sua entrega, conferir base/SHA, escopo, diff e provas; reproduzir os checks pertinentes e validar integrações antes de incorporar. Este documento não declara revisão ou merge antecipados.
