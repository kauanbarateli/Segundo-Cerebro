# Qualificação real do modo atual de restore — 13/10/2026

O novo [preflight canônico](../../scripts/operations/restore-readiness.mjs) foi revisado e executado **uma vez**, usando o perfil Restore V2 existente em subprocesso privado. Executa somente as duas SQL readonly originais, com prazo de 15 segundos cada e transporte `queryPostgres`. Não abre archive, usa HTTP, inicia `pg_restore`, escreve no banco ou retorna credenciais, nomes de papéis ou conteúdo pessoal. O [resultado fechado](evidence/restore-readiness-native-20261013.json) registra apenas contagens, booleanos e código permitido.

O guard selecionado de vazio passou no Ensaio_restore `jvwduowyavpaxssogadn`, em PostgreSQL 17.11. A identidade de sessão permaneceu igual e não era superuser. Os dois schemas e as 35 tabelas gerenciadas de Auth/Storage tinham **zero owners imediatamente disponíveis** para o operador. O preflight recusou com `RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED`.

Isso demonstra que o **modo atual**, com `--clean` integral e sem troca de papel, não atende sua pré-condição de ownership nesse alvo/operador. Não identifica a causa das seis importações anteriores nem mede `SET ROLE`, INSERT, RLS, privilégios de parâmetros, policies ou triggers. Não houve sétima importação. A consulta não reserva o destino; o guard de vazio possui seu recorte próprio.

## Próxima implementação

Preservar o baseline gerenciado de Auth/Storage e qualificar a seleção do TOC do mesmo snapshot autenticado: dados gerenciados, DDL/dados/owners/grants da aplicação e customizações expressas de triggers/policies. Cada item omitido precisa ser comprovadamente coberto pelo baseline; seleção desconhecida ou ambígua deve recusar. O operador deverá validar privilégios concretos e integridade antes da importação, sem remover owners/grants globalmente.

A [orientação oficial Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) separa schema, dados e alterações customizadas de Auth/Storage. O compilador e o pipeline propostos serão testados primeiro em RAM. No pipeline SQL→psql, COMMIT deve depender do EOF **e** do encerramento bem-sucedido do produtor, além da confirmação do consumidor; um prefixo válido seguido de erro não pode ser aceito como restore parcial bem-sucedido.

## Revisão

Root passou **42/42 testes**: seis novos de preflight, 17 de operações e 19 de transporte PostgreSQL. Leu os três arquivos completos/diffs; lint, sintaxe, parser PowerShell e diff passaram. O peer independente leu fonte/QA/wrapper e repetiu **6/6 novos testes**, com os mesmos checks estáticos. Esses controles são offline; a operação real acima tem prova separada. Os hashes foram reconferidos antes de executar o subprocesso privado.

O wrapper acrescenta apenas `restore-preflight` ao enum e seu despacho; argumentos de archive são recusados nessa operação. ACL, DPAPI, zero de BSTR e restauração do ambiente permanecem originais. Não houve leitura da chave no pendrive, mudança do perfil, reaplicação de 001–019 ou migration nova. Restore, owners/grants, Auth/Storage/Cofre e agendamento ainda não têm aceite.
