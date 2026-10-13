# Pré-condição de ownership antes do restore — 13/10/2026

O restore completo contém DDL de Auth/Storage e usa `--clean`. O guard de alvo vazio não verifica se o operador pode alterar os objetos gerenciados que já existem mesmo num projeto novo. Foi acrescentada uma pré-condição no [operador canônico](../../scripts/operations/restore-target.mjs): depois do guard de vazio e antes de iniciar `pg_restore`, uma consulta fixa mede a disponibilidade atual dos owners de schemas e tabelas.

A consulta literal usa `REPEATABLE READ READ ONLY`, `search_path=pg_catalog`, statement timeout de 10 segundos, lock timeout de três segundos e `ROLLBACK`. O transporte original limita a chamada a 15 segundos. Retorna somente 12 campos de versão, contagens e booleanos; não retorna nomes de objetos, papéis, usuários ou credenciais. A validação recusa campos adicionais, getters, coerção, valores inseguros e contagens contraditórias. Exige dois schemas, pelo menos uma tabela, ator de sessão inalterado e privilégios imediatos dos owners de todos os schemas/tabelas selecionados.

O header conserva um token local de qualificação. Uma nova tentativa de header invalida a anterior, inclusive em falha; o sink retido não pode tomar emprestada uma qualificação posterior. O início nativo verifica esse mesmo token sincronicamente antes do spawn. Abrir o sink sem header ou durante consulta pendente também é recusado. Falta de privilégio gera `RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED`; relatório inválido gera `RESTORE_MANAGED_OWNER_REPORT_INVALID`.

Os cinco argumentos nativos, owners/ACLs originais, bytes do archive, UUIDs, transação única e ordem banco/Storage foram preservados. A saída não recebeu `permissions_verified`; a comparação manual de owners/grants e o aceite de Auth/Cofre permanecem pendentes. A fonte original `503f00d` foi preservada. Perfis, archive e arquivos privados das seis capturas anteriores não foram alterados ou reabertos nesta incorporação. Nenhuma sétima importação foi executada.

## Revisão e validação

Autor: 17/17 testes de operações, lint/sintaxe/diff. Root leu fonte/testes/diff completos, conferiu os hashes e incorporou somente os dois arquivos aprovados. Em Main, Root repetiu **59/59** testes de operações, transporte PostgreSQL, backup e aceites de restore, sem falhas/skips, além de lint/sintaxe/diff.

Peer independente conferiu os dois arquivos, quatro validadores e quatro controles adicionais inteiramente em RAM, sintaxe e o novo caso SQL **1/1**; não declarou execução própria dos 17 casos. O caso SQL executa a consulta original em três instâncias PGlite descartáveis: membership sem INHERIT recusa; owner do schema permite DROP com rollback mas não ALTER da tabela e o guard recusa; todos os owners imediatamente disponíveis passam. Atores, versão e 12 campos vêm do SQL executado, sem resposta fabricada. Os marcadores persistidos e a ausência da coluna recusada permanecem iguais. Instâncias separadas evitam depender de `RESET SESSION AUTHORIZATION`, que não restabeleceu o superuser inicial no runtime incorporado observado.

Hashes de integração: `restore-target.mjs`, 11.357 bytes, SHA-256 `f29bd0b5d23f78ede190c6b85cd467e87dc0048e7172e8c8f686771df49b4aa0`; `operations.test.mjs`, 27.185 bytes, SHA-256 `ffa15cd2cb55e160bc3335820b4f702b35c372b69be9a790a323f349d8fa1326`. Os 16 testes anteriores foram reconstruídos em RAM sem o import/caso PGlite e coincidiram com o hash anterior `afbd466ad68054281e97ed88b1d972b3b4b2348a33e8194e394425b617967079`.

## Limites e próximo recorte

Essa é uma pré-condição necessária de ownership **atual** para schemas/tabelas `r/p`. Não reserva o alvo entre as consultas e a importação; não verifica todo o DDL do archive, outros objetos, CREATE, ALTER OWNER, ACLs, dependências ou compatibilidade PostgreSQL 18→17. PGlite não certifica Supabase hospedado. A causa das seis falhas continua desconhecida; este patch não declara restore aprovado nem atribui a elas um erro de ownership.

A próxima operação precisa qualificar o alvo e a estratégia de importação contra os owners e o DDL original, antes de novo ensaio. Depois de um restore aprovado, ainda faltam comparação de owners/grants, entrada Auth, arquivos, Cofre e agendamento. A custódia externa da chave continua adiada pelo responsável. Não reaplicar 001–019: este patch não cria migration ou altera schema remoto.

Referências oficiais consultadas: [privilégios de papéis do PostgreSQL 17](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE), [owners gerenciados do Supabase](https://supabase.com/docs/guides/platform/permissions) e [backup/restore entre projetos Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). O histórico e as falhas permanecem no [ensaio](restore-ensaio-20261013.md).
