# Banco pessoal — instalação incremental do MVP

Em 09/10/2026 há **14 migrations versionadas**. As cinco de 07/10 têm aplicação histórica registrada e bytes preservados. As nove novas, **006–014**, foram validadas localmente e aguardam execução manual no projeto pessoal `rishenjoikgmfubmnfiu`, conforme [OP-012](../docs/implementation/decisoes-operacionais.md#op-012--conclusão-local-e-aplicação-manual-das-próximas-migrations).

**Não reaplicar 001–005 nem repetir bootstrap master.** Nenhum SQL remoto foi executado nesta finalização. BlackSheep e Sistema VOE não são destinos ou fontes de credenciais. O [relatório de entrega](../docs/implementation/entrega-mvp-pendencias.md#aplicação-manual-das-migrations) contém os nove arquivos completos, hashes, ordem, configurações e aceites externos.

## Modelo e canais

O usuário é a unidade de isolamento. Plano Pessoal é implícito: ausência de entitlement permite e veto explícito recusa. Admin exige também master. Preferência organiza visibilidade/ordem, sem conceder acesso; Início, Capturar e Configurações são essenciais. “SUPERADMIN” corresponde ao papel master da aplicação; Auth continua authenticated, sem privilégio vindo de metadata editável.

RPCs estreitas conferem dono/sessão, ban/exclusão/moderação, troca obrigatória e Entitlement atuais. Mutação confirmada grava dado, Evento e recibo juntos; replay exato do mesmo client_id antecede a cobrança/CAS. Corpos públicos recebem comandos de domínio, nunca patches de dono/papel ou lotes arbitrários de eventos. Helpers privilegiados privados usam search_path vazio e grants explícitos. `app_private` permanece fora dos schemas expostos.

| Área | Persistência e fronteira |
| --- | --- |
| Identidade | Perfil, preferências, papéis, moderação e vetos; sessão Auth conferida pelo servidor/banco |
| Capturas/Tarefas | Snapshot/revisão/commit, conversão e referências, anexos por IDs publicados do dono |
| Financeiro | Contas/cartões, categorias/tags, lançamentos, transferências, faturas/encargos e séries finitas |
| Conhecimento | Cadernos/páginas, documento validado, wiki-links/backlinks/vínculos e promoção com origem preservada |
| Projetos/Hábitos | Contêineres das fontes, owner/projeto vivo, marcações/pausas e histórico completo |
| Drive/Storage | Buckets privados, reservas/claims, quotas, publicação imutável e limpeza idempotente |
| Cofre | Envelopes cifrados no cliente; servidor não recebe conteúdo, senha mestra ou kit em claro |
| Calendário | OAuth/execuções e tokens cifrados privados; cache e projeções por fonte selecionada/conectada |
| Busca/Atividade | Projeções com gates das fontes; sem conteúdo Cofre, payload de Evento ou valores financeiros |

`authenticated` não recebe DML direto das tabelas do aplicativo; comandos passam pelos canais autorizados. Eventos preservam leitura direta somente das sete colunas de metadados permitidas, sem before/after/payload. A service role não torna sessão/dono/veto opcionais nas RPCs. O [catálogo de release](tests/release-catalog.sql) confronta políticas, grants por coluna/papel, funções, defaults, índices, buckets e gates atuais.

## Pacote e verificação local

```sh
npm run sql:editor
npm run check:sql-editor
npm run test:local-sql
node scripts/test-local-sql.mjs supabase/tests/global-search-performance.sql
```

O gerador cria cópias exatas, numeradas, em [sql-editor/installation](sql-editor/installation) e o [manifest SHA-256](sql-editor/manifest.json). Ele não executa SQL, concatena transações ou grava histórico de aplicação. Edite somente a fonte canônica em migrations, regenere e confira o pacote. Os textos usam LF; alteração dos bytes exige nova revisão.

O runner PostgreSQL descartável PGlite instala as 14 migrations e executa 29 asserções padrão, sem variáveis de conexão ou acesso remoto. A asserção de performance é optativa. Auth/Storage são fixtures explícitas; cada teste termina com rollback e confere resíduos. O catálogo final passou 1.242 checks locais sem desvio; parsing passou 59 arquivos. [Método, correções e limites](../docs/implementation/validacao-sql-finalizacao.md).

CI executa parsing, integridade e fixtures descartáveis; **não aplica migrations remotas, cria contas remotas, faz seeds persistentes ou usa o projeto pessoal**. Serialização local não comprova transações simultâneas, Auth/Storage reais ou latência hospedada.

## Procedimento manual posterior

1. Conferir organização/ref, versões históricas, schema e compatibilidade Auth/Storage do destino; interromper escritores/cron e preparar recuperação. Não resetar ou fazer seed.
2. Executar check do pacote e confrontar hashes. No SQL Editor, aplicar somente 006 completa; confirmar e registrar versão/hash/resultado. Seguir 007–014, um arquivo por vez. Parar ao primeiro erro e conferir rollback/estado antes de repetir.
3. Executar o catálogo readonly no destino. Exigir zero desvios; revisar o relatório antes de liberar. Catálogo estrutural não cria fixtures.
4. Gerar tipos do schema realmente instalado e confrontar `src/lib/supabase/database.generated.ts` e contratos PlannedDatabase dos novos adapters. Reexecutar contratos, typecheck e build.
5. Usar **base dedicada vazia** para asserções de comportamento/fixtures, mantendo rollback. Não executá-las sobre contas reais. Ensaios HTTP/Auth conectados usam opt-ins e limpeza por identidades/marcadores exatos, nunca o master pessoal como fixture.
6. Validar Auth, revogação e corridas com conexões realmente sobrepostas, Storage, Google, backups e aparelhos conforme [pendências](../docs/implementation/entrega-mvp-pendencias.md). Não habilitar execução SQL em build/deploy/GitHub.

O bootstrap existente pertence à instalação histórica e não integra as migrations pendentes. Restore tem procedimento próprio em outro projeto vazio, usando dump com schema/ACLs/owners; não aplicar a cadeia antes do dump. Consulte o [runbook de operação](../docs/operations/backup-restore-release.md).

## Histórico e relatórios

O [README histórico de 07/10](README-historico-20261007.md) preserva o contrato inicial e os ensaios daquela data. Suas instruções de conexão supervisionada foram substituídas pela conclusão offline/manual de OP-012.

- [Identidade aplicada](../docs/implementation/t013-aplicacao-supabase.md), [Auth real histórico](../docs/implementation/t014-auth-real.md), [Capturar/Tarefas](../docs/implementation/t015-persistencia.md), [Atividade](../docs/implementation/t016-atividade.md).
- [Admin](../docs/implementation/t017-admin.md), [Financeiro](../docs/implementation/t018-t020-financeiro.md), [Conhecimento](../docs/implementation/t021-conhecimento.md), [Drive](../docs/implementation/t022-drive-storage.md).
- [Projetos/Hábitos](../docs/implementation/t023-projetos-habitos.md), [Cofre](../docs/implementation/t024-cofre-cifrado.md), [Google](../docs/implementation/t025-calendario-google.md), [Busca/Configurações](../docs/implementation/t026-t027-busca-configuracoes.md).
