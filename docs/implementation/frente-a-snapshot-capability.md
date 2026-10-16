# Frente A — capacidade e lifetime do snapshot de restore (A1) — 16/10/2026

Pacote A1 da Frente A para a [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35), definido na seção 6.1 do [handoff de retomada](handoff-retomada-20261013-restore-auth.md). Iniciado em 13/10 e concluído localmente em 16/10. Nenhum serviço real foi acessado: sem Supabase, Vercel, Google, perfis, archive, chave, `.env`, capturas privadas, `pg_restore` ou `psql`. Os dados são sintéticos: buffer `PGDMP_*` artificial, TOC PG18 artificial e o `PERSONAL_REF` público do código. Nenhuma migration, SQL, workflow, transporte ou arquivo de Root foi alterado. Root (Frente B) liga a capacidade ao inspector real e valida a integração.

| Item | Valor |
| --- | --- |
| Base | `origin/main` @ `41b30fd9330c05afe1ed5340f4673502d44085cb` (igual à referência documental; difere do checkpoint `46e551f` somente pelo handoff; `main` remota inalterada em 16/10) |
| Branch | `codex/frente-a-snapshot-v1` |
| Código verificado | `975d345f5e747ba589268d073ec7f140811b0559` (o commit seguinte acrescenta só este documento) |
| Ambiente | Windows 11; Node 25.9.0 e Node 24.19.0 (CI usa 24); `npm ci --ignore-scripts` do lockfile em clone próprio, sem junction; hashes de manifesto e lockfile inalterados |

## 1. Problema e comportamento

O inspector autentica o archive inteiro, mantém a entrada `PGDMP` em RAM, planeja e **zera tudo no `finally`**, devolvendo só o plano. O streaming recebe depois um `databaseSource` arbitrário, e seu comentário presume que "o chamador já autenticou o snapshot". A autorização ainda aceita o boolean `archiveAuthenticated: true`. Não havia objeto que ligasse os bytes autenticados ao plano original, com prazo, uso único e descarte.

O módulo novo [`restore-managed-snapshot-capability.mjs`](../../scripts/operations/restore-managed-snapshot-capability.mjs) cria essa ligação sem IO, processo, rede, banco ou timer:

- `mintManagedSnapshot(plan, source)`:
  - Exige o **objeto original** de `planManagedRestore`: identidade em `WeakMap`, sem traps de Proxy.
  - `source` é um descritor fechado `{ database, sourceProjectRef, keyId, createdAt, lifetimeMs }`: sem getters, extras, símbolos, herança ou Proxy, inclusive Proxy revogado.
  - Todos os hashes vêm do próprio plano. Nenhum hash, boolean ou relatório JSON do chamador é aceito.
  - O tamanho é conferido antes da cópia, pelos slots internos de um `Uint8Array` genuíno e não compartilhado. Os bytes são então copiados para um `ArrayBuffer` próprio, fora do pool de `Buffer`, e só a cópia é conferida contra o plano: os cinco bytes `PGDMP` e SHA-256.
  - O buffer do chamador não é retido, desanexado nem alterado, então o `database.fill(0)` do inspector continua válido.
  - `sourceProjectRef` precisa ser `PERSONAL_REF`. `keyId` e `createdAt` seguem a gramática do header original.
  - Cada plano admite **uma única tentativa** de mint, inclusive quando recusada.
  - O prazo conta do **início** do mint: cópia e hash consomem o lifetime.
- `checkManagedSnapshot(plan, snapshot)`:
  - Verificação não consumidora para autorização e futura qualificação (A2). Não renova o prazo.
  - Devolve sempre o mesmo objeto congelado, sem protótipo, com os três hashes e o tamanho do plano (os quatro campos de vínculo) e a identidade do header.
  - São metadados privados, como os de `managedRestoreRequirements`: nunca relatório público nem autoridade aceita de volta.
- `claimManagedSnapshot(plan, snapshot)`:
  - Uso único. Devolve um iterável assíncrono de um só uso, escrito à mão (não async generator), compatível com o `databaseSource` atual de `runManagedRestore`.
  - Entrega uma vista do armazenamento próprio. Na leitura seguinte, em `return()`, na expiração ou no descarte, os bytes próprios são zerados.
  - Expiração ou descarte rejeitam a leitura e **nunca** relatam fluxo truncado como completo.
  - `return()` nunca rejeita, para não mascarar a falha do consumidor.
- `discardManagedSnapshot(snapshot)`:
  - Total e idempotente, seguro em qualquer `finally`.
  - Para valores estranhos devolve `false` sem tocar neles; devolve `true` somente quando zerou plaintext próprio. Se o consumidor já transferiu o `ArrayBuffer`, devolve `false`: não há como zerar a cópia que saiu.

Estados: `live` → `claimed` → `consumed`, ou terminal `expired`/`discarded`. O primeiro motivo terminal fica fixo. A expiração lazy e uma troca de plano **zeram em qualquer estado**, inclusive com uma vista em voo depois do claim. Precedência do código relatado: objeto estranho → reuso → expiração → descarte anterior → troca de plano. Uma troca de plano é tratada como indício de uso indevido: além de recusar, zera a capacidade correta em vez de manter plaintext vivo.

A expiração é lazy. Ela limita a **autoridade** de uso; a permanência dos bytes em RAM depende do descarte no `finally` de cada dono (seção 4).

Captura na importação:
- O que é capturado: `Reflect.apply`, os intrínsecos de `Uint8Array` que medem, copiam e zeram, os métodos de `WeakMap`/`WeakSet`, o hash SHA-256, `util.types.isProxy`/`isSharedArrayBuffer`, `Number.isSafeInteger`, as resoluções de `Promise` e `performance.now`.
- O que isso garante: substituições posteriores desses objetos, ou overrides próprios e de subclasse nos objetos do chamador, não alteram identidade, vínculo, wipe ou lifetime. Um teste em processo filho comprova isso.
- O que fica fora: código no mesmo realm que rode **antes** da importação ou adultere outros built-ins, como acontece com qualquer módulo do mesmo runtime. O `WeakMap` de `restore-managed-plan.mjs` não tem essa captura.

## 2. Limites e códigos

| Valor | Origem |
| --- | --- |
| `databaseBytes` 64 MiB | Igual a `INSPECTION_LIMITS.databaseBytes`, duplicado para não importar o inspector (evita o ciclo e o grafo `child_process` do inspector; a importação continua inerte, como o teste de processo filho comprova); o teste fixa a igualdade. Recusa antes de alocar. |
| `maxLifetimeMs` 180.000 | RECOMENDADO: 4 × o orçamento absoluto de 45 s do inspector/streaming; o teste fixa a relação para que uma mudança desse orçamento exija revisão. **Sem valor padrão**: o único ponto de mint escolhe explicitamente. Sugestão inicial de 90.000 ms, a recalibrar com a sequência real medida por Root. |

`MANAGED_SNAPSHOT_ERROR_CODES` exporta a lista fechada para Root acrescentar às allowlists. Toda recusa é `BackupError` com `code` de dado igual à mensagem, sem `cause` e sem conteúdo.

| Código | Quando |
| --- | --- |
| `RESTORE_MANAGED_SNAPSHOT_INVALID` (novo) | Forma, gramática, contêiner ou limite inválidos |
| `RESTORE_MANAGED_SNAPSHOT_REQUIRED` (novo) | Capacidade estranha |
| `RESTORE_MANAGED_SNAPSHOT_REUSED` (novo) | Segundo mint, segundo claim, segundo iterador ou check após claim |
| `RESTORE_MANAGED_SNAPSHOT_EXPIRED` (novo) | Prazo esgotado |
| `RESTORE_MANAGED_SNAPSHOT_DISCARDED` (novo) | Uso após descarte |
| `RESTORE_MANAGED_SNAPSHOT_BINDING_INVALID` (novo) | Troca de plano |
| `RESTORE_MANAGED_PLAN_REQUIRED` (reutilizado) | Plano que não é o objeto original, mesmo sentido do módulo de plano |
| `RESTORE_MANAGED_DATABASE_INVALID` (reutilizado) | Bytes divergentes do plano, mesmo sentido do streaming |
| `BACKUP_IDENTITY_MISMATCH` (reutilizado) | `sourceProjectRef` diferente de `PERSONAL_REF`, mesmo sentido do inspector |

## 3. Matriz

| Implementado | Validado localmente | Pendente de Root (B) |
| --- | --- | --- |
| Módulo puro, 6 exports, sem CLI | 21/21 testes próprios em Node 25.9.0 e 24.19.0; ESLint sem avisos | Ligação ao inspector real após autenticação completa; execução no archive real |
| Vínculo ao plano original, hashes do plano, bytes copiados e identidade do header | Recusa de planos estranhos, clonados, Proxy e revogados; bytes trocados; cada byte do prefixo; tamanho; contêineres forjados por protótipo; identidade | Prova de origem autenticada, fora do alcance de um módulo puro |
| Expiração lazy, descarte, uso único, recusa de troca, captura na importação | Relógio real sem seam; prazo desde o início do mint; check não renova; descarte em voo; `finally` preserva a primeira falha; adulteração pós-importação em processo filho | Lifetime real medido na sequência inspect → qualificação → stream |
| Compatibilidade com `runManagedRestore` inalterado | A fonte reivindicada passa o portão de tamanho/`PGDMP`/SHA-256 e falha de forma determinística depois, em `RESTORE_MANAGED_LIST_INVALID`, com 0 spawn. A fonte expirada ou descartada falha antes da lista | Substituir `databaseSource` e `archiveAuthenticated` (seção 4); allowlists |

## 4. Integração proposta para Root (não aplicada)

Os arquivos abaixo são de edição exclusiva de Root; estas mudanças são **propostas** para a revisão.

1. **Inspector** (`restore-managed-inspect.mjs`):
   - Criar um ponto de entrada novo que retorna `{ plan, snapshot }`, sem alterar o CLI `runManagedInspect`. A saída do CLI continua fechada e **nunca** cunha capacidade.
   - Capturar `project_ref`/`key_id`/`created_at` no callback `header`, mas cunhar somente depois de `await pendingRead` (`authComplete`), da reconferência do ciphertext e de `planManagedRestore`, antes do `finally` zerar `database`. O callback `header` roda antes da autenticação, então o mint nunca pode ir para ele.
   - Chamar `discardManagedSnapshot` no `catch` e também no ramo de falha de limpeza: a linha 243 pode lançar depois que o valor de retorno já existe.
   - **Fatos do archive para a qualificação**, como históricos de migration e insumos de DDL/ACL do baseline, precisam ser derivados **dentro** do inspector, depois da autenticação e **antes** do mint. Não existe leitor de bytes não consumidor, e o único claim pertence ao streaming. Se Root precisar dos bytes depois do mint, deve propor um leitor revisado que não renove o prazo, em vez de reutilizar o claim.
2. **Streaming** (`restore-managed-stream.mjs`):
   - Receber `snapshot` no lugar de `databaseSource`.
   - Chamar `checkManagedSnapshot(plan, snapshot)` **antes** de `claimManagedRestore`, para que um snapshot expirado não consuma a autorização. Depois, usar `claimManagedSnapshot` como fonte e chamar `discardManagedSnapshot` no `finally`.
   - Copiar a entrada para armazenamento dedicado em vez de `Buffer.from`/`Buffer.concat`, que usam o pool compartilhado para entradas pequenas, e zerar `chunks` e `database` no `finally`. Hoje o streaming não zera essas cópias (`restore-managed-stream.mjs:48-59` e `:133-136`).
   - Acrescentar `MANAGED_SNAPSHOT_ERROR_CODES` ao conjunto `codes`; até lá essas recusas aparecem como `RESTORE_MANAGED_UNAVAILABLE`. O teste do A1 aceita os dois códigos e afirma só os invariantes fail-closed.
   - Ao trocar a assinatura, o último teste do A1 (`runManagedRestore` inalterado) precisa ser atualizado na mesma integração.
3. **Autorização** (`restore-managed-plan.mjs`): remover `archiveAuthenticated` das evidências quando o streaming exigir o snapshot. Não importar este módulo em `restore-managed-plan.mjs`: ele importa `managedRestoreRequirements` e criaria ciclo.
4. **Allowlist do inspector**: acrescentar os códigos a `errorCodes`.
5. **Processo único**: a capacidade vive só no processo Node que a cunhou. Inspect, qualificação (A2), autorização e streaming precisam rodar no mesmo processo; uma chamada separada de `restore-inspect` nunca alimenta um restore.
6. **Teste do ponto de mint**: é um alarme para uso literal ou acidental, não uma garantia adversarial. Varre todo o código de runtime fora de `tests/`, ou seja, `scripts/`, `src/`, `supabase/`, `design-system/` e a raiz.
   - Aceita `mintManagedSnapshot` somente neste módulo e em `restore-managed-inspect.mjs`.
   - Recusa import por namespace, reexportação `export * from`, `import()` ou `require` com o nome literal deste módulo.
   - Testes podem cunhar snapshots sintéticos. Root não precisa editar o teste ao ligar o inspector ou importar `check`/`claim`/`discard` nominalmente no streaming.
   - Um especificador montado em tempo de execução escapa da varredura; a garantia real continua sendo a revisão do ponto de mint.
7. **A2**: o comparador pode receber `(plan, snapshot)` e chamar `checkManagedSnapshot` para vincular sua qualificação à mesma capacidade viva, sem consumi-la. Ele recebe fatos do archive já extraídos pelo inspector (item 1). A interface final depende do inventário real de Root.

## 5. Comandos e resultados próprios

Executados em sequência, sem processos de teste concorrentes. Testes, ESLint e varredura de segredos rodaram sobre o conteúdo do commit `975d345`:

| Comando | Resultado |
| --- | --- |
| `git ls-remote origin refs/heads/main` (13/10 e 16/10) | `41b30fd9330c05afe1ed5340f4673502d44085cb` nas duas datas |
| `npm ci --ignore-scripts --no-audit --no-fund` | 475 pacotes; `package.json` `3059287d…577e08ba` e lockfile `f35dd101…4468c38a` iguais antes e depois |
| `node --test tests/scripts/restore-managed-snapshot-capability.test.mjs` (Node 25.9.0) | 21 testes, 21 pass, 0 fail, 0 skip |
| Mesmo comando com Node 24.19.0 local | 21 testes, 21 pass, 0 fail, 0 skip |
| `node --test` nos testes de plano, streaming, inspector e adaptadores (arquivos de Root inalterados) | 66/66 em 13/10 e em 16/10 antes da versão final. No commit `975d345`: 65 pass e 1 fail, no controle nativo de ACL do Windows (`restore-managed-inspect.test.mjs:98`, `ACL_FACTS_ETIMEDOUT` no limite de 15 s), com 575 MB de RAM livre; `Get-Acl` isolado levou cerca de 3 s. Repetição única e isolada desse teste: 1/1 pass em 32 s. O teste não importa o módulo novo |
| `npx eslint --max-warnings=0` nos dois arquivos `.mjs` novos | exit 0 |
| `node scripts/check-secrets.mjs` | 1.443 arquivos versionáveis; nenhum valor impresso; exit 0 |
| `git diff --cached --check` antes de cada commit | sem saída |

Revisão adversarial própria, sequencial e em cópia descartável fora do repositório, em quatro frentes: segurança, mutação, convenções/integração e conformidade ao escopo. Cada achado passou por um verificador cético. As correções acrescentaram:
- captura de `Reflect.apply`, `WeakMap`/`WeakSet`, hash, `util.types` e `Promise`;
- recusa fechada de Proxy revogado;
- wipe em voo também por expiração e por troca depois do claim;
- precedência explícita das recusas;
- varredura do ponto de mint em todo o runtime, recusando imports opacos;
- testes de não renovação, de prazo desde o início do mint, dos cinco bytes `PGDMP`, de contêineres forjados por protótipo e de estado terminal fixo.

Uma rodada final de 34 mutantes no módulo revisado matou 32. Os dois sobreviventes são equivalentes: o `isProxy` sobre `database` é redundante com o brand intrínseco, e entregar a vista interna é equivalente porque o wipe e as medições usam intrínsecos capturados.

## 6. Limites

- **Não prova origem autenticada.** `planManagedRestore` e o mint são exportados e puros, e qualquer importador com plano e bytes coerentes pode cunhar. A capacidade garante vínculo, prazo, uso único e descarte. A origem depende do único ponto de mint revisado dentro do inspector, depois da autenticação completa. O teste de chamadores é só um alarme para uso literal.
- A expiração limita autoridade, não residência: sem descarte no `finally` do dono, bytes expirados só são zerados no próximo acesso ao módulo.
- Depois de entregue, a vista pode ser copiada pelo consumidor ou ter o `ArrayBuffer` transferido; essas cópias saem do lifetime da capacidade. O streaming atual copia com `Buffer.from` antes da próxima leitura e não zera suas cópias (proposta 2).
- Process-local: não há serialização, exportação nem renovação.
- O teste de inércia substitui as entradas assíncronas de `fs`, processo e rede antes da importação, e as síncronas de `fs` e os timers só depois, porque o carregador ESM lê o código-fonte de forma síncrona.
- Os testes usam relógio real sem timers (`spin` síncrono). As esperas no sentido da expiração não oscilam, porque o tempo só avança. As janelas em que a capacidade precisa continuar viva têm folga de 150 a 300 ms, e o mint de 16 MiB tem 1 s. Ainda assim, um runner muito carregado no CI pode oscilar.
- A varredura do ponto de mint leva cerca de 5 s neste checkout dentro do OneDrive.
- Testes sintéticos não certificam Supabase, archive real, ACL, `pg_restore`, CI ou aceite hospedado.

## 7. Checklist de Root

- [ ] Conferir base `41b30fd`, SHA-HEAD anunciado e diff de exatamente três paths novos.
- [ ] Repetir `node --test tests/scripts/restore-managed-snapshot-capability.test.mjs` e os testes de plano, streaming, inspector e adaptadores em worktree próprio, em Node 24.
- [ ] Combinar os gatilhos antes do push: todos os workflows principais disparam em `push` e `pull_request`, inclusive em PR draft, e a Vercel também. Acompanhar os resultados somente por metadados próprios; resultado local não é CI verde.
- [ ] Revisar a proposta da seção 4 e decidir o ponto de mint, o lifetime real e onde extrair os fatos do archive.
- [ ] Após integrar, executar a inspeção real única prevista na seção 4 do handoff e registrar evidência no SHA executado.

## 8. Arquivos

| Arquivo | Bytes | SHA-256 do blob em `975d345` |
| --- | ---: | --- |
| [`scripts/operations/restore-managed-snapshot-capability.mjs`](../../scripts/operations/restore-managed-snapshot-capability.mjs) | 10.144 | `3e077ac851173deb2a4999390e485b694a5ef9bab5de85b47702a3f2c75c90d5` |
| [`tests/scripts/restore-managed-snapshot-capability.test.mjs`](../../tests/scripts/restore-managed-snapshot-capability.test.mjs) | 41.101 | `73170176cc69fb910f2601dbdc8082e6f7a49949842512965df7f58c15e8a87a` |
| `docs/implementation/frente-a-snapshot-capability.md` | — | conferir pelo commit seguinte (não é autorreferente) |
