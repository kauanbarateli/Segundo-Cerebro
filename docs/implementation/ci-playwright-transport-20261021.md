# Transporte dos navegadores do CI — 21/10/2026

Estado desta entrega: **implementado localmente; validação dinâmica pendente no GitHub**. Nenhum Node, npm, Docker, navegador, compilador ou PostgreSQL foi executado localmente para preparar este delta. Não há alteração de versão, lockfile, configuração dos testes, retries, deadlines ou orçamento dos jobs.

## Problema observado e limite da correção

No SHA `08803f65f75cbf49162f0c899902347d7917de68`, o CI push original `39681583693` passou instalação npm, auditoria com zero vulnerabilidades, tipos, lint, 1.816 testes em cada fuso, 1.743 testes de scripts e build. A etapa `Instalar Chromium` falhou ao obter Chrome for Testing `153.0.8010.12` / revisão Playwright `1243`: `ERR_TLS_CERT_ALTNAME_INVALID`, host `cdn.playwright.dev`, certificado com `*.azureedge.net`. O E2E dessa push foi ignorado por consequência; não representa um resultado de testes do produto.

O CI PR original `39681592176`, no merge `cb97f84efde1b31dd0ddffe9ed7c8b9cc4a66ad7`, passou 294 E2E e os demais gates. Isso permanece evidência daquele merge, não uma validação antecipada deste transporte. A falha separada de quiescência no Admin PR não é explicada nem corrigida por este documento.

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

O container altera o ambiente de bibliotecas/fontes e a inicialização da imagem. Os portões visuais reais devem validar esse ambiente; a escolha da imagem não é aceite antecipado de aparência. Os orçamentos e critérios existentes permanecem preservados, inclusive quando ocorrer falha operacional. Não houve aplicação de migration, acesso a projetos pessoais, merge, deploy, execução de cron ou alteração de plano.
