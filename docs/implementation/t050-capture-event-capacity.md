# T-050 / #75 — capacidade dos eventos de Captura rica

Refs #75. Part of #71. Delta preparado em 21/10/2026 sobre `50531044174f455865c0d692e45ec588f4f13f13` (árvore `a6ceac87561d0ef40bcb7593fdbe360e62c00599`), branch local `codex/spec08-capture-write-20261021`. A correção física de recibos desse commit permanece separada. Este bloco ainda não tem execução, publicação ou aplicação remota; o manifesto da Root identificará seu commit final.

## Problema e decisão autorizada

O CHECK físico de `public.domain_events`, criado em 001, limitava a **soma** de `before::text` e `after::text` a 1 MiB. Cada Captura rica pode ser válida e individualmente menor que 1 MiB, enquanto o par excede esse orçamento. Um upgrade legado→rico pode caber e o save seguinte do mesmo documento falhar. A RPC, os adapters e os leitores de snapshot não têm outro teto de 1 MiB por evento; o batch/snapshot continua limitado a 8 MiB.

A Root aprovou a opção A nesta rodada: exceção física de até **2 MiB somente para transições válidas de Captura rica**, preservando 1 MiB por estado e 1 MiB para os demais pares. A proposta inicial de apenas caracterizar a falha foi substituída por essa decisão antes da entrega. O handoff externo usado como fonte foi preservado. A alternativa de recusa explícita de capacidade não foi implementada.

O recorte é a capacidade da nova borda documental. Não amplia acesso, criação rica, promoção, edição conjunta de título/documento, uso comercial, restore ou autoridade de publicação. As regras de Auth, Entitlements, dono e recibo antes de CAS continuam nos caminhos existentes.

## Implementação preparada

Somente o draft novo `supabase/migrations/20261021171416_spec08_capture_document_write.sql` recebe código de produção. Nenhuma migration histórica é editada.

O predicado privado `capture_document_event_pair_allowed` recebe os dez valores da **própria linha física**: ID, Usuário, tipo/ID da entidade, ação, canal, horário, before, after e `capture_task_payload`. Ele exige envelope fechado e correspondente a todas essas colunas. Os dois estados passam por `capture_document_event_state`, também privado: mede o DTO original até 1 MiB e valida o documento/cache originais; o validador puro legado fixado em `capture_task_validate_payload_v1` confere o restante do DTO fechado, retirando apenas document/document_version e substituindo apenas attachments por uma lista vazia temporária. A lista original de anexos é validada separadamente, sem descartá-la.

O contrato histórico dos anexos exige até seis metadados com exatamente seis chaves, IDs canônicos únicos, nome com trim JS não vazio e até 200 unidades UTF-16, MIME string PNG/JPEG, números inteiros seguros positivos, área até 24 milhões de pixels e bytes até 8 MiB. As operações numéricas usam `numeric`/`trunc`, aceitando um inteiro serializado como `1.0`. Não há consulta de arquivo atual para validar esses metadados históricos.

Ambos os helpers são **IMMUTABLE**, sem `SECURITY DEFINER`, wrapper público ou lookup de Captura/Auth/sessão/arquivo, e têm EXECUTE revogado de PUBLIC/anon/authenticated/service_role. Erro de validação ou SQL NULL não concede a exceção. A conferência focal identificou que chamar o validador ativo no CHECK herdaria consulta mutável a `drive_files`; essa primeira proposta foi corrigida antes da entrega. O trigger/cadeia ativa continua intacto e mantém as verificações preexistentes de dono/finalização/estado atual dos anexos no caminho de escrita. Em restore, essas dependências preexistentes ainda exigem ordenação/disponibilidade de arquivos pela Root; a correção não afirma eliminar esse gate.

As identidades de entidade/dono/client_id/criação/captura permanecem iguais. Uma origem convertida não pode trocar sua tarefa. O upgrade exige revisão 1 e a atualização rica exige n+1, inclusive se o documento for igual; nesses ramos a ação é `updated` e somente documento/cache/revisão/updated_at podem mudar. Título não recebe permissão adicional.

Metadados conservam documento/cache/revisão e título. A ação `updated` permite somente os campos de metadata do comando existente; `status_changed` permite os campos de status/organização/conversão/arquivo e conserva exclusão; `deleted` exige passagem de deleted_at null para timestamp; `restored` exige a inversa. Os dois últimos conservam todo o restante além de updated_at. Archive/unarchive/delete/restore existentes conseguem carregar o mesmo par rico, sem fingir que o evento revela o intent HTTP ou substitui os guards do comando.

O CHECK original é localizado por expressão exata, relação, colunas, validação e dependências. Seu nome gerado é descoberto, preservado e não presumido. Apenas pares acima de 1 MiB precisam passar pelo predicado total (`IS TRUE`) e caber em 2 MiB. A rota histórica para pares menores conserva seu comportamento; os demais CHECKs e o trigger ativo continuam validando eventos pequenos. Não foi ampliado shape de evento, grant, limite individual de payload, request comum, resultado, body ou snapshot. O trigger de evento não é substituído nem desativado.

## Caso-limite mensurável

O SQL novo constrói um documento sintético sem conteúdo pessoal: um parágrafo, 243 textnodes `x` com link HTTP(S) de 2.048 caracteres ASCII e um textnode de preenchimento. O próprio SQL calcula o preenchimento usando o contador compacto da borda nova e exige 8.800 caracteres. O documento precisa medir exatamente 524.288 bytes compactos, 526.727 bytes em JSONB e 9.043 unidades UTF-16 de cache.

Esses valores são **expectativas analíticas e asserts preparados**, não medições já executadas. O runner deve produzir/conservar o NOTICE numérico com:

- documento compacto/JSONB, cache UTF-16/JSONB;
- metadados sem document/document_version/content;
- cada payload e a parcela residual de campos/estrutura;
- par do upgrade e do resave, envelopes completos e envelope de evento;
- fingerprint escapado da string JSONB e resultado de ambos os comandos;
- snapshot após resave, metadata e cada etapa de lifecycle.

`metadata_base_bytes` é uma medida descritiva separada. `residual_fields_structure_bytes` é a parcela aditiva após retirar os valores serializados do documento/cache; inclui nomes, separadores, revisão e metadados. Não somar metadados outra vez ao payload.

O par rico deve superar 1 MiB e caber em 2 MiB; cada estado e resultado continua menor que 1 MiB. Os fingerprints deste caso usam ASCII comum e precisam ficar **até 1 MiB já escapados**, isolando esta correção da exceção física de recibos em `5053104`.

## Provas preparadas e seams

Novo arquivo: `supabase/tests/capture-document-event-capacity.sql`. É standalone, usa helpers/tabelas `pg_temp.capture_capacity_*`, dois usuários/sessões sintéticos com e-mail `example.invalid` e termina com rollback. Não cria contas reais nem contatos externos.

A primeira jornada usa `public.capture_task_commit` e as tabelas reais no runner: upgrade legado→v1, reconstrução do batch após o upgrade com revisão CAS atual, novo client_id/event_id, resave do mesmo documento→v2 e metadata. Uma atualização posterior confirma v3 com documento pequeno para conservar o orçamento de snapshot. Depois o evento v1→v2 é reinserido com novo ID/envelope correspondente em subtransação: os estados históricos precisam ser aceitos pelo trigger/CHECK real quando a Captura atual já difere de ambos. A subtransação é revertida e o estado externo comparado. Replay/snapshot isoladamente não reexecutariam o CHECK e não serviriam a essa prova histórica. O replay do upgrade ainda conserva v1 como resultado e não altera o estado atual v3.

Outra jornada usa um segundo dono sintético, com snapshot rico preparado por INSERT privilegiado de fixture, para archive→unarchive→delete→restore. Não é prova de novo comando de criação rica ou de restore supervisionado. Documento/cache/revisão ficam iguais nas quatro operações. Cada etapa mede o snapshot; a separação evita que o histórico acumulado confunda uma recusa legítima de 8 MiB com o CHECK corrigido. Não existe promessa de histórico ilimitado.

Para atomicidade, a jornada principal tenta v2→v3 com ID de evento já existente. Exige SQLSTATE **23505** e constraint **domain_events_pkey** após a RPC ter alcançado a gravação da Captura. Outra tentativa usa metadata válida e envelope correspondente, mas ação `deleted` sem alterar deleted_at: o trigger antigo aceita o envelope e o **CHECK físico novo** deve recusar a transição incompatível com SQLSTATE **23514 e o nome descoberto da constraint**. Fora de cada subtransação de exceção, compara linhas físicas completas de Capturas, eventos, recibos, revisão, rate-limit e links; também compara snapshot/CAS e ausência de recibo do comando falho. O rollback externo do fixture, sozinho, não é tratado como evidência de atomicidade interna.

Os negativos malformados normalmente são recusados pelo trigger real **antes** de a constraint física ser avaliada. Para isolar o CHECK, o teste copia sua expressão instalada exata para uma tabela temporária que conserva os tipos e a nullabilidade dos dez campos. INSERT e UPDATE precisam falhar com SQLSTATE **23514 e CONSTRAINT_NAME descoberto do CHECK**. A expressão copiada é comparada com a original e cada probe reverte sua subtransação. Nenhum trigger/FK/RLS é desativado; não há alteração de `session_replication_role`.

Esse seam temporário **não prova ACL, RLS, Auth ou todos os triggers**. Os positivos e a falha pós-DML usam a RPC/tabela reais; as consultas de inspeção e o setup usam o papel privilegiado do runner. A função privada continua sem grant de cliente. Ao final, o teste confere que OID/definição/ativação do trigger e expressão do CHECK real permaneceram iguais durante os probes e que as linhas/ledgers reais estão intactos.

Os probes cobrem par rico válido acima de 1 MiB, limite comum exato/excesso, par legado válido acima de 1 MiB, entidade/contexto/ID/dono divergentes, envelope misto ou null, estados parciais, cache forjado, revisão zero/salto/regressão, imutáveis, ação incompatível, par >2 MiB e estado individual >1 MiB. Também aceitam metadados históricos de anexo sem arquivo atual e inteiros `1.0`, recusando shape/tipos/chaves, duplicação/quantidade, nome/UTF-16, MIME, dimensões, frações/overflow e tamanho inválidos. Esse aceite de DTO no seam de CHECK não concede upload ou escrita real sem arquivo finalizado. SQL NULL e JSON null são distintos. Documento null encolhe este exemplo abaixo de 1 MiB: sua recusa é afirmada diretamente no predicado, sem fingir recusa física por tamanho; a validação ativa de estado continua obrigatória na tabela real.

## Execução GitHub e integração Root

Não foi executado SQL, Node/npm, lint, compilador, teste, navegador, serviço ou CLI nesta autoria. Revisão de fonte e `git diff --check` não são PASS de persistência/capacidade. Os resultados das fatias anteriores e do commit base não validam este delta.

Após reconciliar catálogo/ordem/artefatos oficiais e inventários na integração, a Root pode selecionar no runner GitHub, Node 24, um processo pesado por vez:

```text
node scripts/test-local-sql.mjs supabase/tests/capture-document-event-capacity.sql
```

O script existente cria PostgreSQL descartável/PGlite com Auth e Storage como fixtures explícitas; aplica os arquivos canônicos apenas nesse banco e confere os contratos públicos antes das assertions. Esse comando **não foi executado aqui**. Conservar os NOTICEs numéricos ou os resultados equivalentes do SQL como artefato sanitizado, associados ao SHA executado. Se o runner não expuser NOTICE, a coleta desses números deve ser providenciada pela Root, sem apresentar valor analítico como observado.

Depois do lote focal: catálogo/comportamento de Captura e recibos, E2E issue22 e regressões pertinentes. O protocolo nativo `tests/e2e-auth-local/capture-task-persistence-support.mjs` tem teto próprio de resposta HTTP de **1 MiB**; seu PASS atual não certifica este snapshot grande. Esse teto não foi alterado por conveniência. A prova SQL não certifica Supabase hospedado, PostgREST, Auth real, SDK, concorrência real ou editor visual; a Root mantém os respectivos aceites e a operação supervisionada.

Pontos de integração: incorporar os novos objetos privados/constraint nos catálogos e hashes oficiais; regenerar/conferir SQL Editor e inventários na ordem reservada; executar no SHA final e registrar ambiente/resultado. Sem aplicação por build/deploy, alteração de migrations 001–021, concessão de restore ou encerramento de #75/#71/#44/#68/#81 a partir deste ensaio.
