# Transporte dos navegadores do CI — 21/10/2026

Estado desta entrega: **implementado localmente; validação dinâmica pendente no GitHub**. Nenhum Node, npm, Docker, navegador, compilador ou PostgreSQL foi executado localmente para preparar este delta. Não há alteração de versão, lockfile, configuração dos testes, retries, deadlines ou orçamento dos jobs.

## Problema observado e limite da correção

No SHA `08803f65f75cbf49162f0c899902347d7917de68`, o CI push original `39681583693` passou instalação npm, auditoria com zero vulnerabilidades, tipos, lint, 1.816 testes em cada fuso, 1.743 testes de scripts e build. A etapa `Instalar Chromium` falhou ao obter Chrome for Testing `153.0.8010.12` / revisão Playwright `1243`: `ERR_TLS_CERT_ALTNAME_INVALID`, host `cdn.playwright.dev`, certificado com `*.azureedge.net`. O E2E dessa push foi ignorado por consequência; não representa um resultado de testes do produto.

O CI PR original `39681592176`, no merge `cb97f84efde1b31dd0ddffe9ed7c8b9cc4a66ad7`, passou 294 E2E e os demais gates. Isso permanece evidência daquele merge, não uma validação antecipada deste transporte. A falha separada de quiescência no Admin PR não é explicada nem corrigida por este documento.

### Ownership do checkout no primeiro ensaio do container

**OBSERVADO:** no SHA `bef3e71`, o CI push original `39689062882` (job `119530404441`) e o CI PR original `39689068781` falharam na etapa `Baseline visual`, antes do preflight: `fatal: detected dubious ownership in repository at '/__w/Segundo-Cerebro/Segundo-Cerebro'`. A confiança configurada pelo checkout no seu HOME temporário não estava disponível ao Bash das etapas seguintes. Esse resultado não é um aceite dos navegadores, do build ou do E2E.

O complemento configura `git config --global --add safe.directory "$GITHUB_WORKSPACE"` imediatamente após `actions/checkout@v7` e antes do fetch histórico. A configuração pertence ao usuário do container efêmero e autoriza somente o caminho exato entregue pelo runner. Não usa `*`, prefixo de diretório, `chown`, alteração de permissões ou confiança em outros repositórios. Um teste de contrato recusa a ausência, wildcard e qualquer segunda declaração de `safe.directory`; os gates originais continuam obrigatórios.

**IMPLEMENTADO, NÃO VALIDADO DINAMICAMENTE:** esta correção ainda exige os runs originais do próximo SHA. A leitura dos demais passos confirma Bash, seleção explícita de Node e Python/venv, cache do Playwright e instalação somente das bibliotecas; não comprova antecipadamente a compatibilidade de fontes, bibliotecas ou cenários no container.

### Formato estrito da versão no segundo ensaio

**OBSERVADO:** no SHA `36a4fb5823fce4d452116e6bcb095562a365a1f9`, os dois CIs passaram checkout, ownership, fetch histórico e npm. O preflight recusou com `VERSION_REFUSED` nos jobs `119535056684` e `119535081777`. O relatório fechado não continha stdout/stderr nem identificava o componente, portanto não demonstrava versão divergente, espaço terminal ou texto em stderr.

**FONTE PRIMÁRIA:** no [Chromium 153 exato, Chrome imprime produto, versão e canal](https://raw.githubusercontent.com/chromium/chromium/153.0.8010.12/chrome/app/chrome_main_delegate.cc#L378-L382); um canal vazio deixa um espaço ASCII antes do LF. O [headless-shell imprime dois campos](https://raw.githubusercontent.com/chromium/chromium/153.0.8010.12/headless/app/headless_shell.cc#L232-L235). O qualificador existente de 157 já reconhecia explicitamente a variante com um espaço. Ele baixa 157 separadamente do Google; compartilhar a imagem MCR como ambiente não prova que seu cache contém 157.

O parser novo aceita somente zero ou um espaço ASCII terminal, mantendo a versão **exata 153.0.8010.12** e a correspondência da linha inteira. Dois espaços, tab, linhas extras, CR isolado, outra versão, UTF-8 inválido ou qualquer stderr continuam recusados. Não usa `trim`, não altera SDK/revisões/digests nem introduz outro transporte ou navegador. Esse formato é sustentado pela fonte primária; a causa específica do CI36 continua não observada até o próximo ensaio.

Em eventual nova recusa de versão, a CLI pode emitir somente `versionDiagnostic` fechado: `component` (`full`/`headless`), `reason` (`type`/`utf8`/`stderr`/`format`/`mismatch`) e `stdoutBytes`/`stderrBytes` (inteiro 0–4096 ou null). Não exporta versão extraída, texto, erro bruto, paths ou conteúdo dos streams. A projeção recusa campos/valores extras e accessors; testes com canários cobrem ambos os componentes. Esse diagnóstico não concede aceite nem muda o resultado de falha.

## Origem oficial e versões preservadas

Fontes conferidas em 21/10/2026, com TLS normal e somente metadados JSON na máquina local:

- [NPM `playwright-core@1.63.0`](https://registry.npmjs.org/playwright-core/1.63.0): `gitHead` `1b025d7e20a026371cd5f98ba0cdce48892737c8`, integridade da distribuição registrada no lockfile existente.
- [Catálogo oficial 1.63](https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/packages/playwright-core/browsers.json): Chrome e headless-shell `153.0.8010.12`, revisão `1243`; FFmpeg `1011`.
- [Dockerfile Noble oficial 1.63](https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/utils/docker/Dockerfile.noble): Ubuntu Noble, Node 24, cache `/ms-playwright`; instalar Chromium inclui também headless-shell e FFmpeg.
- [Manifesto MCR do tag 1.63 Noble](https://mcr.microsoft.com/v2/playwright/manifests/v1.63.0-noble): índice `sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`; sua entrada `linux/amd64` é `sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7`.
- [Manifesto amd64 fixado](https://mcr.microsoft.com/v2/playwright/manifests/sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7): 1.644 bytes, SHA-256 igual ao digest do endereço e config `sha256:2c1f4e0fd6450f43ddb46d60c2a6df30855a8588e165b1f2559fb0eda8d7ff35`. São os mesmos pins já presentes no preparador NoStore.

O job usa o manifesto amd64 imutável, não um tag flutuante nem uma imagem nova. Não há imagem customizada, mirror particular, cache externo de binários ou desativação de TLS.

## CI geral

O job `foundation` continua no runner Ubuntu 24.04, mas suas etapas passam a executar na imagem oficial fixada. `--ipc=host` segue a configuração recomendada pelo [Playwright para Chromium em Docker](https://playwright.dev/docs/docker). O shell é explicitamente Bash porque o [padrão do GitHub para jobs em container é `sh`](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/run-jobs-in-a-container).

`actions/setup-node@v7` continua lendo `.nvmrc`; a imagem não substitui essa seleção. Python 3 e `python3-venv` são instalados explicitamente antes da validação SQL: sua presença não era garantida pelo Dockerfile. A aplicação Next e o navegador continuam no mesmo job, com os mesmos endereços locais e configuração Playwright.

`check-ci-browser-runtime.mjs` é somente leitura e não instala binários. Antes dos gates e antes/depois de `install-deps chromium`, exige:

1. GitHub Actions do repositório pessoal, Linux amd64, Node 24, SHA válido, workspace real e `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`; recusa overrides de download, TLS e validação das bibliotecas.
2. `.docker-info` com os **dois campos reais** publicados por [`writeDockerVersion`/`dockerVersion` de 1.63](https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/packages/playwright-core/src/server/registry/dependencies.ts): `driverVersion` e `dockerImageName`, exatamente `1.63.0` e `mcr.microsoft.com/playwright:v1.63.0-noble`. Não presume campo de digest nesse arquivo.
3. Os três pacotes instalados `playwright`, `playwright-core`, `@playwright/test` em 1.63.0 e suas entradas canônicas no catálogo de navegadores.
4. Diretórios reais, markers `INSTALLATION_COMPLETE` vazios e arquivos executáveis regulares, sem symlinks ou redirecionamento de caminho:
   - `chromium-1243/chrome-linux64/chrome`;
   - `chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`;
   - `ffmpeg-1011/ffmpeg-linux`.
5. Hash SHA-256 e tamanho por streaming, com descritor aberto sem seguir symlink, reconferência de inode/modo/tamanho e hashes estáveis antes/depois da leitura da versão. Os hashes são proveniência observada do cache da imagem fixada, não novos pins autorais independentes da imagem.
6. Os dois `--version` com versão exata 153.0.8010.12, processo sem shell, ambiente estéril, 10 segundos, 4 KiB por stream e término por `SIGKILL` no limite. Falhas não exportam stdout, stderr ou erro bruto. FFmpeg é verificado como artefato da revisão 1011; não se inventa uma versão comercial equivalente à revisão Playwright.

O JSON de sucesso é fechado, inclui `applicationAccepted:false`, SHA do checkout, `declaredImage` e os três hashes/tamanhos. `declaredImage` identifica o pin do workflow; não finge ter inspecionado Docker de dentro do container. A obtenção/verificação OCI é responsabilidade do runner GitHub ao criar o job pelo digest. O guard não executa fora do ambiente autorizado e sua CLI não aceita argumentos de substituição.

O comando de bootstrap passa a `install-deps chromium`: mantém bibliotecas e fontes do navegador, mas **não tem caminho de download de Chrome**. Cache ausente ou incompatível falha no preflight; não há fallback para CDN ou navegador alternativo. Nenhum `channel`, `executablePath`, headless, número de workers ou regra de teste foi alterado. O teste visual que seleciona `channel: "chromium"` continua usando Chrome completo; os demais conservam sua seleção de headless-shell.

## Admin e recuperação: bibliotecas sem bootstrap inútil

Somente os workflows `admin-browser-local-ci.yml` e `auth-recovery-local-ci.yml` trocam `install --with-deps chromium` por `install-deps chromium` no host Ubuntu. Não passam a usar a imagem do job geral.

Suas orquestrações já chamam `prepareQualifiedChromium` antes de criar fixtures; as configurações verificam o binário e passam `executablePath` explicitamente, e os specs conferem `browser.version()`. Permanecem Chrome qualificado `157.0.8103.6`, seus hashes, driver 1.63, ambientes estéreis, serviços descartáveis, autoridade, negativos, deadlines, cleanup e descarte. Retira-se apenas a obtenção de 153 que esses lançadores não utilizavam.

O workflow `auth-local-ci.yml` já não tinha esse download externo; está intocado. A preparação interna e o lançamento qualificado dele também permanecem iguais.

## Validação preparada e aceite pendente

O novo teste `tests/scripts/ci-browser-runtime.test.mjs` executa o guard real com portas de I/O determinísticas. Cobre ausência, symlinks e aliases de caminho, metadata malformada/UTF-8/tamanho, SDK e revisões divergentes, markers, modos/bytes mutáveis, falha ao fechar arquivo, output de versão inválido, limites/ambiente do subprocesso e falhas de timeout/processo com erros fechados. Os testes de workflow preservam os gates originais e a seleção qualificada dos workflows nativos.

Comandos preparados, **não executados localmente**:

```text
node --test tests/scripts/ci-browser-runtime.test.mjs
npx eslint --max-warnings=0 scripts/verification/check-ci-browser-runtime.mjs tests/scripts/ci-browser-runtime.test.mjs
```

O aceite exige os runs originais do novo SHA no GitHub: preflight `BOUND`, auditoria, SQL descartável, tipos, lint, unidades nos dois fusos, contratos de scripts, camadas, contraste, Impeccable, build, E2E e artefatos visuais reais; e os workflows nativos com seus casos e cleanup próprios. Não herdar o verde de um SHA anterior nem promover PGlite a aceite do banco hospedado.

O container altera o ambiente de bibliotecas/fontes e a inicialização da imagem. Os portões visuais reais devem validar esse ambiente; a escolha da imagem não é aceite antecipado de aparência. Os prazos dos testes e critérios de aceite permanecem preservados, inclusive quando ocorrer falha operacional. Não houve aplicação de migration, acesso a projetos pessoais, merge, deploy, execução de cron ou alteração de plano.

## Limite global do job: cancelamento original e correção

**OBSERVADO em `8b5233925499e304098638a47dedca15e0e824af`:** 17 runs originais terminaram, com 16 `success` e um `cancelled`, todos na tentativa 1. O [CI push 39692683846](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39692683846), job `119542448215`, começou às 23:19:43 UTC e terminou às 23:34:50 UTC. Sua annotation original registra `The job has exceeded the maximum execution time of 15m0s`.

Nesse job, todos os gates de execução constam `success`: preflight BOUND 153/FFmpeg 1011, auditoria zero, SQL, tipos/lint, 1.818 unidades por fuso, 1.782 scripts sem falha/skip, camadas, contraste, Impeccable, build e fronteira Auth. Os 294 E2E passaram em 7,6 minutos, com resumo às 23:34:43 UTC; o upload terminou às 23:34:46 UTC. Mesmo assim, o resultado global é cancelado e **não concede aceite do CI**. Pós-cache e pós-setup-node ficaram `skipped`; o [CI PR 39692688862](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39692688862) terminou `success` com seus resultados próprios. Não houve rerun ou cancelamento iniciado pelos agentes.

**Correção preparada:** o envelope global de `foundation` passa de 15 para 20 minutos, com margem para imagem/bootstrap, suíte completa, artefatos e pós-ações. Não modifica o prazo de qualquer teste, transporte, request, subprocesso, SQL ou quiescência nativa; o Admin conserva o mesmo limite absoluto de 15 segundos. Também não altera workers, retries, versões, testes, comandos ou gates. Não há `continue-on-error`, exclusão de negativos ou repetição do run cancelado.

A mudança exige revisão independente e um novo SHA com todos os seus runs originais. O cancelamento de 8b permanece registrado; a correção do orçamento, isoladamente, não autoriza merge ou deploy.
