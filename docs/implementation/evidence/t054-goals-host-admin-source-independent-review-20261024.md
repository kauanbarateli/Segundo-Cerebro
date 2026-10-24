# Peer estático — inventário Admin H0

24/10/2026. Parecer favorável ao delta de inventário dos três paths abaixo, condicionado à execução própria em CI limpo. Não identifiquei bloqueador objetivo nesta leitura. Nenhum Git, Node, teste, lint, browser, SQL, rede ou serviço foi executado; o checkout Root não foi alterado.

## Fontes e hashes conferidos

A evidência `root-h0-admin-source-delta-20261024.json` tem 6.705 B/SHA256 `27d824058d2bb1e0592a711b41b5de65a64089492586e9b9d19cf478a7b658c8`. Declara base 0d933d9, dois originais próprios (runs 40066983781 e 40066980100), 471→504 fontes, 33 adições, zero remoções e 61 dependências. Usei-a como derivação candidata preservada; não executei o coletor nem promovi os relatos anteriores a aceite do candidato novo.

| Path no checkout Root | Bytes | SHA256 |
| --- | ---: | --- |
| tests/e2e-auth-local/admin-browser-contract.mjs | 23114 | 0b3bbd8a4345146020271ff03aaa91b83f2db99e536b8ddd80337a78ecc63417 |
| tests/e2e-auth-local/admin-browser-contract.d.mts | 8970 | 4ad578736f92ce37c3f7e1db57a80d9cc643c045cf718b0dfdc3bc1735f0d04f |
| tests/scripts/admin-browser-local-ci.test.mjs | 134619 | 93ab7e38cff6b4dfaa2f61c1f347ea44604b3bfced467dfeda91f746a4c82e7b |

Comparação textual com os três arquivos inalterados da base 0d933d9 no WT isolado G0: remover exclusivamente o bloco GOALS_SOURCE_PATHS e inverter 504→471 reproduz o contrato mjs inteiro; remover a nova declaração e inverter o literal reproduz o d.mts inteiro. Esses controles foram comparação de texto, não execução dos módulos. O coletor original `scripts/verification/admin-browser-local-ci.mjs` também está byteigual à base: SHA256 `23b177ca099ffcbc6fa1d09661ad65517e20a9f73d08563aa8f6d7e281086348`.

## Resultado da leitura

- O array congelado `ADMIN_BROWSER_GOALS_SOURCE_PATHS` (mjs 39–73) tem exatamente 33 entradas únicas, na mesma ordem e com os mesmos nomes das 33 adições do JSON. Não há exclusão ou aceitação dinâmica de tamanho. O literal permanece finito em 504/61 no mjs e na declaração.
- Todos os predicados de relatório permanecem byteiguais fora desse bloco/literal: status/incerteza, sourcesAbsent restrito, classes de erro, shape fechado, unicidade/path/hash/bytes, 26 migrations, catálogo 0|1720 e sucesso somente com 26/1720, infraestrutura e teardown. Não há elevação de falha para PASS.
- O teste integral (422–477) passa a exigir 504 fontes e preserva 61 dependências, JPEG binário original e Git blob real. Conserva os negativos onboarding/SSR/effect/Kanban, os 26 paths Series e os negativos de ausência/blob forjado.
- O novo bloco exige array Goals congelado, ordenado e sem duplicatas; para cada um dos 33 paths, confere presença derivada, uma única entrada coletada e bytes/SHA256 reais. Remover qualquer fonte continua recusando o relatório. Os ataques de blob forjado foram ampliados para client Goals e host Goals, sem retirar os ataques Series ou JPEG.
- A comparação de linhas do teste mostrou somente novo import, nome/contagem 504, três asserts do array Goals, união dos paths no laço existente e duas novas fontes nos ataques de blob. Não houve alteração de timeout, processo, Auth, matriz, cleanup ou coletor.

## Validação pendente

Root informou dois controles puros de derive/shape aprovados, mas não os executei nem os reclassifiquei. O teste integral local terminou SOURCE_REFUSED antes da matriz porque node_modules é junction e o realpath do primeiro módulo AuthAdminApi diverge da cópia isolada. Isso é uma recusa conservadora do ambiente local, sem bypass ou instalação; não é PASS do coletor integral nem prova de falha do candidato em CI limpo.

O próximo gate é o CI próprio do novo SHA, com dependências físicas/isoladas que satisfaçam o realpath original. As contagens 504/61 descrevem a closure declarada, inclusive referências de tipos; não afirmam observação de todos os módulos internos Next/SDK nem aceite de Admin hospedado.
