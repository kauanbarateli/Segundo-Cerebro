# Restore — provas públicas de ordem e infraestrutura (24/10/2026)

## Estado ao congelar

Três arquivos novos de teste/documento, sem alteração de A2v1, seus15 motivos, observer, plano, reader, operadores, ACLs ou dados. Os testes estão escritos e ainda não foram executados no momento do freeze; eventual rodada pura posterior deve ter recibo próprio ligado aos hashes congelados. Não existe evolução da autoridade de comparação nesta fatia.

Base de autoria799b7426b088f88ae3e0aa04c8d256df21fe371d. A proposta pública anterior13163 bytes/SHA256 `6bc7f7d1819a9d32edaaeccd1ed66e96d175d392de14b4c587591988d57b1471` permanece preservada. O recibo V8 é12463 bytes/SHA256 `72fa09fb476d77bd94be09ba1fb32c401e20a95e592402ff0f9f3047dd846606`:350 pares,36 permutações managed com mesma multiplicidade, cinco definições públicas diferentes; baselineQualified/restoreAccepted=false. Este pacote não leu nem reproduziu seu inventário privado.

## Versões concretas e limite

Antes de escrever, foram confrontados cinco fontes restore799 versus057ec5b. Custom TOC, managed plan, A2 e managed stream são byteiguais. O inspected-baseline799 é SHA256 `5ad64f4bc5bcf15daab3e0e180a3288a693a52e25cb7583419c8e7f79104b66a`; o057 é `c98f65c43997c41fab4c2a0292e91a7cd6faab561cec7c104021bccd6ff99c4e`. **Não são declarados equivalentes.** Root autorizou usar somente APIs comuns atuais; nenhum getter/telemetria/suíte gaps de057 foi transportado.

A fixture pública existente `restore-inspected-baseline-fixture.mjs` é byteigual entre as bases, SHA256 `fcc87835421f1261846c9bff45438283ae4bcf1071934a13fd957d937054117a`. Ela fabrica listagem e bytes CUSTOM artificiais antes da extração nominal e não exporta um issuer de aceitação. Os novos testes exercitam os módulos799 reais. Os resultados/contagens diagnósticos de V8 não são calculados ou atribuídos a esse observer anterior.

## O que os novos controles verificam

`tests/scripts/restore-dependency-order-provenance.test.mjs` mantém ordem/multiplicidade depois de extrair listagem+CUSTOM correspondentes, com IDs diferentes em cada lado. A permutação só pode retornar a recusa original dependency_vector_mismatch; uma ordem correspondente permanece comparação de inspeção sem qualificação. Duplicata perdida ou adicionada continua divergente. Ao cruzar binário de uma fixture com listagem da outra, cada binding referencia os bytes realmente entregues: a recusa precisa ser PLAN_MISMATCH, não um checksum antigo que esconda a causa. Um caso separa managed e união: aresta externa no primeiro contexto não recebe indevidamente o veredito do segundo.

`tests/scripts/restore-public-infrastructure-contract.test.mjs` mantém divergências de FUNCTION/ACL/DEFAULT ACL com dependências iguais. Textos são comentários artificiais públicos; não representam política de privilégio real nem reconstroem DDL por hash. CRLF, espaço, mudança dentro de literal e NULL/vazio continuam diferentes. DEFAULT ACL conserva owner emissor como identidade; owner de função é campo semântico. Um multiset conhecido igual não esconde definição ou histórias diferentes. Até uma comparação benigna totalmente igual não transforma relatório/clone/booleano em TargetBaseline e não permite appDDL público no perfil operacional de alvo vazio.

Esses controles não duplicam a suíte negativa antiga. `restore-managed-baseline.test.mjs` e `restore-inspected-baseline.test.mjs`, existentes em799, permanecem as regressões integrais de tipos/histórias/hooks/limites/nominais. Os novos testes não cunham baseline, authorization, receipt ou restore handle e não executam SQL, parser SQL, PG, subprocessos, rede ou serviços. Não há biblioteca nova: somente node:test/assert/crypto e módulos puros existentes.

## Prova de semântica que motivou a proposta

A revisão oficial foi limitada à tag REL_18_4. Em [pg_dump.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_dump.c), a consulta de dependências ordena apenas o objeto referenciador; a montagem do archive percorre as ocorrências existentes. Em [common.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/common.c), addObjectDependency acrescenta sem deduplicar. Em [archiver](https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup_archiver.c), o vetor é emitido como está e o consumidor serial percorre TOC/passes. [pg_dump_sort.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_dump_sort.c) ordena objetos sob restrições, não canoniza vetores internos.

A ferramenta web não forneceu bytes raw íntegros verificáveis para novos SHA256. Não atribuir hash ao texto renderizado. As referências/hashes históricos no parser continuam históricos; qualquer uso normativo em contrato operacional novo exige raw/commit/pins e revisão próprios. Estes testes verificam a recusa/extração do código local, não compilam C nem pretendem provar a construção privada de cada um dos36 vetores.

## Infraestrutura: decisão ainda aberta

001 fecha defaults globais/public de tabelas/funções;003 revoga EXECUTE do helper preexistente mantendo corpo/OID/vínculo;016 fecha defaults postgres/public de sequências e recusa deriva global. São políticas declaradas, não scripts a reaplicar num alvo fresh. A diferença1103→1205 bytes do helper não está explicada pela003. Hash de identidade/nome conhecido não valida corpo/owner/ACL ou event trigger ensure_rls.

Nenhuma ACL/grant real foi lida ou alterada. A comparação de infraestrutura continua integral e separada da prova de ordem. Nem esse diagnóstico nem uma futura política de multiset resolveriam sozinhos a presença de helper público já existente no alvo e selecionado pelo Sourceplan atual. Fonte, plano, cobertura e autoridade de preservação precisariam de proposta versionada explícita; não há exclusão silenciosa de helper/ACL, DROP/CASCADE ou normalização para obter PASS.

Comando puro proposto para os dois novos arquivos, somente depois do freeze e em janela serial coordenada:

```text
node --max-old-space-size=128 --test --test-concurrency=1 tests/scripts/restore-dependency-order-provenance.test.mjs tests/scripts/restore-public-infrastructure-contract.test.mjs
```

A execução não depende de node_modules e não substitui as regressões completas em CI próprio. Nenhuma operação de backup/inspeção/restore, mudança do alvo, novo campo operacional, nova janela humana, schema ou produção decorre deste pacote. Os prazos45/90, EOF/ACK, readersV5–V8 e o archive imutável permanecem intactos.
