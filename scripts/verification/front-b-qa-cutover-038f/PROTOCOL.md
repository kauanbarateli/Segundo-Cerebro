# Proposta guardada: corte de writers legados no QA

**Rascunho para revisão; não executar.** Projeto pretendido: `twrydxsdemaykgvdlpyd`. A fonte da composição é `same-browser-composed-v1.guarded.sql.txt`, SHA-256 `038f7a9fa96eaebcdee44b8974e41a1b13dd796651ca5d0fe12a56dcec7fb652`. Os dois SQLs terminam em `ROLLBACK` e contêm bloqueios que lançam erro. Não alteram a fonte nem qualificam a candidata para execução. O gerador local `proposals.mjs` recusa outra composição.

**Bloqueado no Supabase hospedado:** em leitura de QA PostgreSQL 17, `cron.job` pertence a `supabase_admin`; o executor `postgres` não é superusuário, não herda a propriedade e não tem UPDATE, DELETE, TRUNCATE ou MAINTAIN nessa tabela. Assim o PostgreSQL recusará o `SHARE ROW EXCLUSIVE` dos dois SQLs, mesmo se seus guards forem removidos. Não remover o lock nem ampliar privilégios para contornar o bloqueio; os arquivos continuam como proposta histórica inerte, não são receita executável no ambiente atual.

Uma alternativa precisa estabelecer, por meio suportado pelo Supabase e revisado para esse projeto, uma exclusão mútua efetiva contra a criação e alteração concorrente de jobs durante toda a janela, além da drenagem de execuções já iniciadas e dos demais writers. Não há essa garantia demonstrada aqui; sem ela o corte permanece bloqueado. `cron.schedule`, `cron.unschedule` e `cron.alter_job` gerenciam jobs individuais e não demonstram impedir que outro ator os crie ou altere concorrentemente. A consulta de QA confirmou `BYPASSRLS` para o executor e um job total visível, não correspondente aos filtros de cadastro. A ausência de jobs conhecidos não impede criação concorrente.

O mantenedor informou que somente os previews de QA e Codex têm acesso privilegiado. Foram observados cadastro Auth e singleton do banco desativados, zero intents/fences e nenhum cron identificado; estas são observações pontuais, não uma prova permanente de drenagem. O cliente precisa comprovar no plano de controle a identidade do projeto e a correspondência da conexão: `current_database()` e `current_user` não distinguem QA de produção. Repetir as leituras e verificar também PT409, ledger 028, Auth fechado e a ACL das quatro funções imediatamente antes de cada etapa. Cancelar ao surgir qualquer diferença.

## 1. Quarentena seletiva

`quarantine.guarded.sql.txt` descreve uma transação que, após verificar corpo, owner `postgres` e ACL exata, remove apenas `EXECUTE` de `service_role` das quatro assinaturas:

- `app_private.signup_prune()` e `public.signup_prune()`;
- `app_private.signup_recover_verified_intent(uuid,uuid,text,text,text)` e `public.signup_recover_verified_intent(uuid,uuid,text,text,text)`.

A verificação inclui os hashes e as ACLs dos dois wrappers públicos, inclusive `public.signup_prune()`. `anon` e `authenticated` devem continuar sem acesso; não se altera `signup_fence_withdraw`, outras funções, dados, roles ou segredos. A proposta bloqueia alterações simultâneas nas tabelas pertinentes e em `cron.job`, impõe tempos máximos e exige singleton explicitamente desativado, ausência de intents e fences e ausência dos nomes/comandos de cron previstos. Uma busca pontual em `cron.job` não identifica código dinâmico ou chamadas externas.

Essa transação altera permissões remotamente caso seja preparada para commit: exige revisão e autorização específica prévias para QA. Depois de um eventual commit autorizado, reler as quatro ACLs e testar a negação pelo papel real; uma resposta perdida exige consultar o estado antes de qualquer repetição. A quarentena não interrompe funções que já começaram e não restringe `postgres`, superusuários, funções `SECURITY DEFINER` ou eventual herança de papéis.

## 2. Drenagem externa obrigatória

Com a quarentena confirmada, o operador deve interromper novas chamadas dos previews de QA e do Codex, esgotar suas requisições iniciadas e demonstrar que não restam chamadas privilegiadas, diretas ou indiretas. Conferir de forma autorizada `pg_stat_activity`, `pg_locks`, transações em andamento/espera e atividade do serviço Auth e dos clientes; inspecionar membros de roles e entradas `SECURITY DEFINER`, inclusive chamadas dinâmicas. Uma sessão `idle`, contagem zerada, timeout ou snapshot isolado não comprova a ausência de chamadas enfileiradas. Não encerrar sessões automaticamente; não tocar produção nem excluir previews.

Confirmar novamente cadastro Auth e banco fechados, ausência de jobs, intents e fences e integridade das quatro ACLs. Manter todos os writers efetivamente parados até o commit ou rollback final. Se não for possível inventariar e drenar todos os caminhos com acesso de owner/superusuário, **parar**: o `drain_guard` representa uma condição externa que o SQL não pode comprovar por si. Não apagar fences ou dados para satisfazer a verificação. Nenhum cron é ativado por este procedimento.

## 3. Corte atômico

`cutover.guarded.sql.txt` é uma composição revisável e ainda inerte: contém `cutover_guard`, `drain_guard` e os dois guards originais, mais `ROLLBACK` final. Após identidade QA, drenagem e autorização específica para a migration, uma eventual cópia de execução precisaria de revisão explícita de todos esses gates e da troca do rollback por commit; não modificar o arquivo versionado nem presumir essa autorização.

Na **mesma transação**, o plano adquire locks, confere o baseline em quarentena, restaura os quatro `GRANT`s exatos, confere a ACL original, executa a candidata integral com seus preflights e confere corpos e ACLs esperados. Assim, os grants restaurados e as novas funções só ficam visíveis juntos no commit; um rollback mantém a quarentena anteriormente commitada. Os locks não substituem a drenagem externa e não provam que outros caminhos de privilégio estejam parados. Desvios, timeout ou erro abortam a transação; não aplicar partes separadamente nem reparar o ledger para fazê-la passar.

## 4. Falha, retomada e limites

- Falha antes do commit da quarentena: confirmar rollback e ACLs. Se a resposta for ambígua, observar o estado antes de agir.
- Falha ou rollback durante o corte, depois da quarentena commitada: os grants permanecem revogados e a lógica antiga permanece. Manter Auth e cadastro fechados; confirmar ACLs e estado antes de decidir. A recuperação da ACL antiga, se necessária, é outra operação a revisar e autorizar, não uma consequência automática.
- Commit concluído ou resultado incerto: conferir objetos, ACLs, corpos, ledger e status do banco antes de qualquer ação; não repetir a candidata, apagar fences, substituir o patch PT409 ou tentar rollback destrutivo. Recuperação de backup permanece tratada à parte na issue #158.
- Abrir cadastro, ligar retenção/cron, habilitar feedback e fazer deploy são etapas independentes; nenhuma está autorizada ou executada por este pacote.

Referências: [PostgreSQL 17: privilégios para LOCK](https://www.postgresql.org/docs/17/sql-lock.html), [bloqueios explícitos](https://www.postgresql.org/docs/17/explicit-locking.html), [Supabase Cron](https://supabase.com/docs/guides/cron) e [pg_cron: gestão e RLS](https://github.com/citusdata/pg_cron#managing-and-creating-jobs). Locks de tabela e REVOKE não são prova de drenagem de requisições iniciadas.
