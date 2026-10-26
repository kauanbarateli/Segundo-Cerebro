# Gallery — sete paths externos

Base ce7be472aad4213e3d567a699abb7463f43cd8fe/tree496e6f8b9087ce01a1d751aa4aacbc094f1f5690. Cinco before-files conferidos byte/Gitblob com esse Source; dois paths novos. `change.patch` aplica e reverte em checks somente leitura com whitespace=error-all. Nenhum arquivo do Root foi editado.

Implementado neste pacote: `--only galeria` no gerador, duas cenas fechadas, oito variantes e 17 membros; entry Gallery fino, mesma execução física do supervisor de Projetos e staging Source-bound fora do checkout. Gallery roda antes de Projetos no workflow geral existente, somente push da branch Root. As etapas de captura/upload de Projetos são textualmente idênticas à base, assim como env allowlist, childEnv, identidade de processo/launch/cleanup, port checks, deadline de captura, geometria/validação e contrato pure de Projetos. Nenhuma cópia de supervisor, pacote, lock, workflow novo ou UI/assets acrescentados.

Calendário usa `/calendario?view=list&date=2026-09-23`. `src/lib/demo/fixtures.ts:12,85` fixa DEMO_NOW e três eventos nesse dia; a Lista precisa renderizar ao menos um deles na data fixa, sem criar registros. Kanban usa `/tarefas` e o botão real; a preferência muda somente a apresentação. Scroll horizontal mobile permanece à esquerda, com colunas reais, sem CSS de compressão.

Os controles escritos importam funções produtivas puras e serializam a função real de readiness. Há 17 grupos novos em `landing-capture-gallery.test.mjs`, além da ampliação do caso de parsing existente. Cobrem Source/scene/records/geometry/EXIF, recusa de erros/loading/fontes/imagens, políticas GET/API/WS/SW, staging nominal, entrypoint e ligação real ao supervisor. `static-preservation.json` registra exclusivamente comparações PowerShell/texto. Não confundir esses controles com captura/browser executado.

Validação executada pelo autor: Git blobs antes, comparações estáticas de preservação e apply/reverse-check sem whitespace (exit0). **Não executado:** Node, sintaxe JavaScript, puros, lint, SDK, Next, browser, build, rede ou captura. Root executará os checks; CI/browser real e aceite gráfico continuam pendentes.

Sugestão de checks Root, sobre os after-files em cópia externa coerente com a base (ou após integração revisada):

```powershell
node --check scripts/landing/capture-policy.mjs
node --check scripts/landing/capturar-telas.mjs
node --check scripts/landing/capture-project-ci.mjs
node --check scripts/landing/capture-gallery-ci.mjs
node --check tests/scripts/landing-capture-gallery.test.mjs
node --check tests/scripts/landing-capture-policy.test.mjs
node --test --test-reporter=tap tests/scripts/landing-capture-policy.test.mjs tests/scripts/landing-capture-gallery.test.mjs tests/scripts/landing-capture-project-prefetch.test.mjs tests/scripts/landing-capture-service-worker.test.mjs
node scripts/landing/capture-project-ci.mjs --check-contract
node scripts/landing/capture-gallery-ci.mjs --check-contract
```

Esses comandos não foram executados pelo autor. Manter os checks gerais existentes do repositório. A importação dos módulos de política/supervisor/entry para os puros usa somente Node; o gerador que importa Playwright/sharp não é importado pelos testes. Para uma cópia mínima, incluir também os módulos existentes `capture-pageerror-diagnostic.mjs` e `capture-requestfailed-diagnostic.mjs` e os dois testes de regressão mencionados; o teste de cola lê a YAML e o gerador como texto.

O job GitHub mantém 40min; Gallery tem 6min, Next ready45s, SSR10s/4MiB por rota, captura total180s, streams512KiB e cleanup existentes. Sem retries. Cada imagem<=8MiB, sidecar<=128KiB, recibo<=256KiB. O staging é `RUNNER_TEMP/landing-gallery-<sha>-<tree>`, criado uma vez após os filhos fecharem; cópia exclusiva dos 17 membros com hashes. Um staging parcial de falha não é uploadado por este workflow.

O recibo batch é `landing-gallery-capture.json`. Os WebPs/sidecars usam os oito nomes já combinados com o autor UI, sob futura `src/components/features/conheca/telas/`; o destino futuro sugerido do recibo é `docs/implementation/evidence/landing-gallery-capture.json`. Esta proposta não incorpora arquivos de imagem nem aponta UI a eles. Source do recibo tem exatamente sha/tree/generatorSha256/policySha256; scene/estado ficam nos novos records/sidecars. Hosted/produção=false. EXIF ASCII identifica captura demo real, cena/tema/formato e Source, e é conferido tanto no gerador (sharp já existente) quanto no chunk WebP do supervisor.

Depois do CI, Root deverá selecionar somente os 17 membros do artefato próprio `landing-gallery-<sha>-<tree>`, qualificar Source/policy/hashes/recibo e revisar visualmente os oito pixels. Só então incorporar os bytes e integrar UI. SUCCESS não é aceite gráfico; capturas de protótipo HTML, preço e checkout ficam fora. Restore está pós-lançamento e não é tarefa deste pacote.
