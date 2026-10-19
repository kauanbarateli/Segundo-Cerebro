# Auth/Admin da PR #70 — correção de integridade das fontes

Autorização: D-076, em 19/10/2026. Base diagnosticada: `eb2fa91b40df6028cf8a2b7d9fe4b2cdc4cc18cf`, branch `codex/paginas-legais-e-checklist-20261018`, [PR draft #70](https://github.com/kauanbarateli/Segundo-Cerebro/pull/70). D-075 continua vigente: Hobby, deploy adiado, sem merge em main. `vercel.json` não é alterado.

## Causas comprovadas

No [Recovery 39193011771](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39193011771), cinco dos 70 controles puros falharam com `SOURCE_REFUSED`. O [Admin navegador 39192967799](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39192967799) também falhou em controles puros, incluindo `369 !== 366`. A [Fundação 39193011575](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39193011575) repetiu esses bloqueios. Os cenários reais de navegador desses dois workflows não chegaram a executar; não atribuir essa falha a SMTP, credenciais, banco pessoal ou ao plano de hospedagem.

1. **Pin do middleware anterior às páginas legais:** o relay exigia 1.809 bytes/SHA-256 `f57cf49d860aa695cac1e16d29a3ec8db8eb7b87c57bc8f5471f68b495ad9c66`. A inclusão de `/privacidade` e `/termos-de-servico` em `e76f323` resulta em 1.847 bytes/SHA-256 `156e39172b77003b3ac9b6f08803b64ed39a126d31d44c6ffe40d761f9f6dd3c`. Comparação do delta confirmou que o matcher de exclusão de assets e as demais regras permanecem iguais. A recusa pelo pin antigo era correta.
2. **Manifesto Admin incompleto:** a seção legal de Configurações acrescentou três imports ao fechamento finito: `src/components/features/configuracoes/settings-legal-section.tsx`, `src/components/ui/legal-links.tsx` e `src/components/ui/legal-links.css`. A derivação real passou de 366 a 369 fontes Git, preservando 60 dependências. A declaração TypeScript ainda dizia 352; ela também precisava concordar com o contrato real. Recovery permanece com 201 fontes Git/60 dependências.

## Correção revisada

- Atualizar somente o pin exato do middleware, preservando os hashes das dependências Next e todas as qualificações fechadas.
- Provar a qualificação pelo acesso real e limitado aos arquivos públicos, manter o matcher estático literal e recusar páginas legais, Auth e API como autoridade de asset.
- Corrigir tamanho das fixtures negativas de tipo de arquivo/symlink para que exercitem seu predicado alvo, em vez de falhar prematuramente por tamanho antigo.
- Atualizar manifesto/declaracão Admin para 369/60; exigir os três imports conhecidos e recusar o universo antigo incompleto, preservando recusa a duplicatas, hashes/paths inválidos e fontes ausentes.

Não houve alteração do middleware, da aplicação, da allowlist de requisições, dos deadlines, dos specs de navegador, do protocolo de cleanup ou dos workflows. Não se limpou mapa de pendências, fabricou terminal, ignorou erro ou substituiu confirmação individual por descarte da infraestrutura. Os testes continuam exigindo os efeitos e settlements originais. Nenhum serviço pessoal ou perfil privado foi acessado.

## Validação

Root revisou os dois deltas independentes e ocupa um único processo pesado por vez, em Node 24. O relatório de fechamento da PR identifica o SHA corrigido e os runs novos; não transfere o PASS de outro commit ou confunde controles sintéticos com a stack real descartável do CI. As falhas históricas da #43 permanecem até os aceites completos da issue serem demonstrados.

O primeiro lote local executou 233 controles: 232 passaram e a asserção restante ainda fixava 366 no teste binário do coletor. Ela foi corrigida para 369; essa tentativa não é registrada como PASS. O teste do relay passou 25/25. A conferência posterior e o CI devem ser registrados com seus resultados próprios, mantendo falhas visíveis.

Revisões cruzadas independentes, somente leitura, confirmaram o delta de três imports, a identidade exata do middleware e a preservação dos gates. O coletor mantém caminhos canônicos, limites, Git blob, SHA-256, versões pinadas e 60 dependências únicas; a atualização não substitui eventos terminais nem autoriza apagar pendências. O portão TypeScript específico `tests/scripts/admin-browser.types.mts` passou. O teste binário corrigido passou 1/1 isolado antes da repetição do lote integrado.

**Lote final local: 258/258 controles PASS**, zero falhas/skips, arquivos de relay, Admin suporte/CI e Recovery, com `--test-concurrency=1`. Lint dos cinco arquivos de código/declaracão alterados passou com zero warnings. Artefato TAP ignorado: `work/ci-auth-admin-pr70-20261019/pure-controls.tap`. Nenhum build ou teste conectado pessoal foi necessário para a mudança de manifesto; os cenários reais Linux/Supabase descartável permanecem nos workflows originais para conferência do novo SHA. Nenhum resultado hospedado é antecipado por este PASS local.

## Resultado real de `b3b5c85` e próxima correção

Os controles puros de ambos os workflows passaram. O SHA do head é `b3b5c85089da87c132e0cfbe53e3b056de422984`; os relatórios do evento `pull_request` identificam corretamente o merge sintético `bef73869a37e53bf76c6a5612f00e16850a6ea88`, conferido nos metadados da PR. Isso não representa merge na branch base.

- [Recovery 39194385354 / job 117873863425](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39194385354): os sete estágios funcionais chegaram a `credentials-changed`. A falha real foi `QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING`, fase `full`, com três requisições originais pendentes e zero inspeções pendentes. O diagnóstico do relay foi `EMITTED / NONE`; o settlement posterior do parent não prova término dessas requisições. O caso manteve `writeOutcomeUncertain=false`, mas o agregado ficou `true`, sem certificado de limpeza.
- [Admin 39194385412 / job 117873863861](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39194385412): `BLOCK_LIVE_BROWSER` chegou a `actor-intact` e falhou com `QUIESCENCE_HTTP_DETAILS_MIXED_PENDING`, fase `after-blank`, duas requisições originais pendentes e zero inspeções pendentes. Origem `fixtures`, classes/recursos mistos. O relay recusou a autoridade estática: `INELIGIBLE / STATIC_AUTHORITY_MISSING`. O segundo caso não executou. Escrita incerta e ausência de certificado de limpeza permanecem.

Nos dois casos, as observações fechadas mostraram `exact-server-request`, `no-terminal-observed`, `publicTerminal=not-observed`, `managerEntry=same-request`, `sessionRegistered=registered` e `Fetch.continueRequest` resolvido. ACK de transporte não é terminal. Nenhuma ausência de cleanup foi reinterpretada como PASS.

**Hipótese em investigação:** os specs usam `domcontentloaded` e a presença do formulário como prontidão para novas navegações/ações; isso não prova que as leituras finitas do documento anterior terminaram. A origem inicial das pendências é compatível com abandono precoce, mas não comprova essa causa. A correção proposta aguarda `load` com o mesmo timeout de navegação e terminais originais das leituras finitas antes de trocar de documento, sem `networkidle`, novas requisições, descarte de entradas ou alteração do deadline final de 15 segundos. O HMR exato só é separado nessa prontidão transitória; a quiescência final continua incluindo-o.

**Alternativa não promovida a correção:** fechar ativamente o contexto antes do drain. A revisão do código instalado Playwright 1.63.0 mostrou que `context.close()`/`page.close()` podem remover sessões sem emitir os terminais necessários. A evidência histórica do probe não executou esse fator e não demonstra eficácia. Não aceitar a resolução do close como substituto dos eventos originais nem importar o probe diagnóstico nos specs para forçar sucesso.

Auth local, Admin backend, Fundação Supabase, Captura e Avatar passaram nos eventos `push` e `pull_request` desse head. O CI geral passou os contratos, typecheck, lint e build; os E2E terminaram com **291 PASS / 3 FAIL** no [run 39194385633](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39194385633). A regra de bloqueio Vercel da branch continua preservada.

### Expectativas antigas do CI geral

As três falhas adicionais são expectativas anteriores às entregas aprovadas, corrigidas nos próprios testes, sem alteração de interface:

1. `/conheca` exigia zero links fora das âncoras. D-065 aprovou os links legais; o teste passa a exigir exatamente `/privacidade`, `/termos-de-servico` e `/configuracoes`, preservando a proibição de checkout/formulários e destinos comerciais nesta entrega.
2. A navegação mobile de Configurações exigia apenas seis itens. O teste inclui `Privacidade e termos` como seção estática adicional, exercita sua âncora por teclado e os dois destinos legais, sem inventar comportamento recolhível. Os seis painéis anteriores e a conferência de ausência de escritas continuam.
3. O comparador visual recusou `PRODUCT.md`, atualizado em `15df12d` pelo planejamento D-034/D-064. A revisão confirmou somente três alterações de texto de produto; o blob Git tem 5.583 bytes/SHA-256 `de22bc82a696ff491b34463abac104b42708621bcc49c0ada668c0d73d021939`. Uma qualificação explícita `planning` permite exclusivamente esse documento/hash na árvore corrente C. B/P, CSS, tokens, capturas, medições e limiares permanecem inalterados. Negativos recusam esse hash em B/P, outro path ou formato/hash alterado. Isso destrava o ensaio; não antecipa aceite das 36 cenas visuais.

### Prontidão transitória implementada e revisão

Admin e Recovery aguardam `load` nas navegações reais, com os mesmos 30 segundos (`reload` de Recovery mantém 15 segundos). Antes de navegações/ações e depois dos oráculos correspondentes, a prontidão lê os mapas de Requests e handlers originais. Não conta sua própria Promise ou um waiter de resposta já armado como uma leitura pendente. O preflight da visão de sessões ocorre antes de armar seu waiter de 20 segundos.

Cada espera tem limite absoluto próprio de até 15 segundos, relógio monotônico e reconferência do mapa após o poll retornar. Um GET/handler novo nessa continuação recusa a transição; um terminal no limite ou depois dele não aprova. O HMR canônico permanece no mapa e é omitido somente dessa projeção transitória. POSTs/efeitos desconhecidos vetam a transição; os GETs de verificação/callback de Recovery continuam sendo leituras finitas obrigatórias, com tratamento de incerteza após efeito observado. Falhas posteriores a POST ou verificação observados preservam o primeiro erro e a incerteza aplicável.

Os initializers de fechamento final não foram alterados. Continuam com o deadline original de 15 segundos, toda a IO original, observadores vivos e cleanup condicionado às provas individuais. Nenhum `close`, ACK, terminal fabricado, exclusão manual de Request ou destruição da stack concede sucesso. Source counts permanecem Admin 369/60 e Recovery 201/60, sem novo módulo no fechamento finito. Revisão independente dos oito arquivos de código/teste não encontrou bloqueador no delta; isso não é evidência nativa de navegador.

### Verificações locais da prontidão e dos contratos

Node 24.19.0, processos sequenciais:

- **274/274 controles PASS**, zero falhas/skips: relay, Admin suporte/CI e Recovery. TAP ignorado em `work/ci-auth-admin-pr70-20261019/controls-final.tap`. Inclui 16 controles novos (sete Admin e nove Recovery), que compilam os helpers/listeners reais por AST e usam portas RAM explícitas.
- Lote focal de transições/fechamento: 35/35 PASS. Reconferência focal posterior de Recovery: 8/8 PASS. São subconjuntos sobrepostos; não somá-los ao total de 274.
- Qualificação visual: 26/26 testes unitários PASS no arquivo `visual-ref-css-order.test.ts`. A primeira tentativa não iniciou testes por `EPERM` ao renomear cache no TEMP do sandbox; a repetição usou TEMP/TMP em pasta ignorada do workspace e passou. Nenhum baseline foi atualizado.
- Typecheck integral, ESLint dos oito arquivos alterados com zero warnings, `git diff --check` e scanner de 1.663 arquivos versionáveis PASS. Nenhum valor secreto foi impresso.

Os três E2E gerais corrigidos e os cenários reais Auth/Admin precisam do novo run Linux para seu próprio SHA. Este lote local não certifica Supabase hospedado, SMTP pessoal, Vercel ou cleanup real do navegador. Publicação continua somente para revisão na mesma PR draft, sem merge, deploy ou alteração do Hobby.
