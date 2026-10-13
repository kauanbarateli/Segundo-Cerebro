# Restore: capacidades efetivas no alvo — 13/10/2026

O Ensaio_restore `jvwduowyavpaxssogadn` permitiu `SET LOCAL session_replication_role = replica`, o retorno a `origin` e o encerramento com `ROLLBACK`. A prova transacional foi executada uma única vez após revisão Root e peer. Isso qualifica essa operação no alvo observado; não identifica a causa das seis falhas antigas, a versão do hook ou a recuperação completa.

A [consulta de capacidades padrão](evidence/restore-managed-capabilities-native-20261013.json) encontrou duas schemas e 35 tabelas gerenciadas, sem ownership imediato ou disponibilidade de `SET ROLE` para seus owners. O operador tinha BYPASSRLS, SELECT nas 35 tabelas, INSERT em 31 e TRIGGER em `auth.users`; nenhuma das 24 tabelas com RLS tinha RLS ativo para essa conexão. O privilégio padrão de SET do parâmetro era falso. As contagens não identificam quais quatro tabelas recusam INSERT nem autorizam uma seleção de dados por inferência.

A [prova separada de delegação](evidence/restore-supautils-delegation-native-20261013.json) mostrou as configurações registradas de Supautils e delegação para as relações exatas `storage.objects` e `storage.buckets`. O SET literal e seus readbacks passaram independentemente da interpretação dessas configurações. Configuração de política não prova que CREATE POLICY já foi executado. O [Supautils oficial](https://github.com/supabase/supautils#table-ownership-bypass) distingue esse bypass de políticas de ownership geral; seu [handler de parâmetros](https://github.com/supabase/supautils#non-superuser-settings) também explica por que ACL padrão não mede toda a capacidade efetiva.

## Revisão e limites

- Capacidades padrão: Root e peer executaram 12/12 controles próprios; SQL literal em PostgreSQL em memória, transporte original e projeção fechada foram revisados. O primeiro despacho PowerShell recusou argumentos antes de consultar o banco. A correção preserva argv como array; a consulta corrigida executou uma única vez.
- Delegação: Root e peer executaram 11/11 controles próprios. Quatro bancos em memória usaram o SQL literal; os 17 cenários restantes simulam explicitamente somente a descoberta de registro de configurações. Não havia Supautils nessa simulação. A regressão PowerShell passou 14/14 controles sintéticos, sem perfis ou serviços.
- As duas consultas nativas retornaram saída 0 pelo transporte original, com EOF e fechamento do processo exigidos. O campo `replicationRestored` mede o readback antes do rollback externo; sozinho não demonstra rollback. O SQL fixo termina em ROLLBACK e o sucesso do transporte completa a evidência.
- Não houve nova importação, criação de política/trigger, alteração persistente, leitura de linhas da aplicação, abertura do arquivo de backup ou reaplicação de migration. O projeto principal, o legado, VOE e BlackSheep foram preservados.

O modo original `--clean`, sem troca de papel, continua recusado por sua [pré-condição própria](restore-readiness-20261013.md). A implementação gerenciada preservará o baseline Auth/Storage somente após comparar o snapshot autenticado, DDL, owners, ACLs e históricos de migrations. Dados, customizações e referências devem ser qualificados separadamente e conferidos na mesma transação antes de COMMIT. Auth, arquivos e Cofre restaurados continuam como aceites de #35.

Na publicação, foi removida somente uma quebra de linha excedente no fim do módulo e de seu teste. Os hashes executados permanecem na evidência; os hashes após essa normalização são registrados separadamente. Nenhuma nova consulta foi realizada para essa mudança de whitespace.

Avanço posterior: a [prova de CREATE e ausência após rollback](restore-custom-ddl-20261013.md) passou no alvo isolado para os dois triggers e as duas políticas. Isso acrescenta capacidade efetiva observada às configurações descritas acima, preservando os limites do snapshot e das seis falhas antigas.
