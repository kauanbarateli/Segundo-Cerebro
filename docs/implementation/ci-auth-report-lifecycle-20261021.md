# Diagnóstico fechado do relatório Auth — 21/10/2026

Refs #35 e PR #99. Base da investigação: `68194718a20948b10ec08cf591c0b01d6eab1be5`. O resultado ainda não é correção de uma causa nativa demonstrada.

## Evidência e limite

Os originais Auth push `39711883840` e PR `39711889277` falharam no primeiro cenário, com `BROWSER_REPORT_REFUSED`, `report:null` e namespace `namespace-start/COMMAND_FAILED`. Os dois cenários seguintes não rodaram. Foram aplicadas 22 migrations e conferidos 1.428 checks somente no banco descartável do runner. Limpeza de namespace/stack/diretórios não prova que fixtures de um cenário sem relatório foram criadas ou removidas.

A fonte de Auth/config/spec/runner permaneceu byte-idêntica entre o head b5 anterior e681. O merge de teste `1041ed0` da PR #99 tem a mesma árvore de681. Não há evidência que atribua a recusa a CSS, infraestrutura ou timeout. O leitor colapsava lstat, política do arquivo, leitura, UTF-8, JSON, schema e fechamento no mesmo código público; o reporter nulo também não fornecia fatos fechados do ciclo original Playwright.

## Diagnóstico implementado, com validação dinâmica pendente

O leitor preserva `reportReadDiagnostic` com quatro campos fechados: `version`, `component`, `phase` e `classification`. As fases distinguem lstat, política da entrada, realpath, open, stat do descritor aberto, read, limite de bytes, UTF-8, JSON, schema e close; as classes de IO usam somente o `code` próprio de dado e categorias permitidas. Proxy/accessors são recusados antes de callbacks/reflexão. Não publica mensagem, stack, cause, caminho, bytes ou conteúdo do relatório. O contexto privado não substitui `BROWSER_REPORT_REFUSED`, não reclassifica namespace `COMMAND_FAILED` e não prova ausência de execução. Um `close()` posterior conserva a primeira fase/classe e o buffer próprio é zerado.

O reporter dedicado observa somente callbacks do Playwright original. Ignora todos os argumentos, inclusive erros, stdout/stderr e objetos de teste; registra apenas nomes de callbacks, contadores, fase, ordem e overflow, limitados a 64 eventos. Declara o canal terminal ocupado para impedir o acréscimo de reporter padrão e não imprime conteúdo. Não retorna status ou Promise ao Playwright.

`onEnd` escreve uma única vez `auth-local-playwright-lifecycle.json`, no mesmo diretório privado e canônico do próprio caso, com criação exclusiva/NOFOLLOW/0600 sob diretório700 do owner conferido. Não cria diretórios, substitui arquivo existente ou abre o relatório principal. O contrato é puro; importar ou construir o reporter não inicia processo, banco ou escrita. Seu snapshot é observação diagnóstica, sem autoridade de aceite, proveniência ou término nativo. O ramo overflow recusa contradições explícitas de fase, contagem, teste ativo e prefixo já selado; não inventa o sufixo que não foi guardado.

O parent lê esse sidecar separadamente, com limite de 4 KiB, e o publica como `browserLifecycleDiagnostic` fechado ou null. Ausência, invalidez ou falha do diagnóstico não cura a falha original nem substitui o relatório de aceite. Callback observado não equivale a término de navegador, EOF ou limpeza. A aceitação continua exigindo os mesmos relatórios principais, namespace natural, componentes, limpeza e ausência de falha.

O seam de IO é limitado ao leitor testável e a portas próprias validadas. A chamada operacional permanece com os dois argumentos originais e FS nativo; nenhum seam é oferecido por ambiente, CLI ou admissão do namespace.

## Validação necessária

O único path novo no fechamento transitivo dos outros runners é `auth-local-lifecycle-contract.mjs`, importado pelo parent já existente e sem dependência externa. As listas explícitas de Admin nativo, Avatar e Captura incluem esse contrato; os coletores de Foundation/Admin navegador/Recovery seguem o import. Derivação nominal antes do CI: Foundation44, Avatar59, Captura67, Admin nativo62, Admin navegador418 e Recovery228. O coletor histórico Drive fica coerente em262, sem ativar sua entrega. Reporter e sua QA não foram acrescentados ao inventário de runners que não os executam.

Guards, declarações, QA e o pin derivado do contrato Admin no probe foram reconciliados. Um negativo do coletor original recusa a omissão do novo contrato. Contagens de dependências, os demais pins, 22 migrations e 1.428 checks permanecem; cardinalidades derivadas não são contagens observadas do novo CI.

Revisão Root e independente, integridade de blobs/inventários e `git diff --check`; QA preparada sobre o leitor original e arquivos públicos sintéticos, primeira recusa/close posterior, UTF-8/JSON/schema/limite/IO, Proxy/accessors e canários. Os 24 controles preparados do ciclo cobrem callbacks da máquina original, repetições/ordem/overflow, erros hostis não lidos, import/construção inertes, escopo exclusivo do arquivo e ausência de autoridade de aceite. A revisão cruzada fechou contradições explícitas no ramo overflow antes da publicação. Testes preparados ainda não foram executados.

Nenhum runtime local na máquina de 8 GiB. Testes, lint, tipos, scanner, build, E2Es e nativos serão executados somente nos originais do novo SHA no GitHub. Até lá, código preparado e testes escritos não recebem PASS. Não repetir/cancelar runs antigos, ampliar aceites, mudar prazos internos ou baixar artefatos privados para encontrar texto de erro.

A ampliação separada do orçamento global CI20→30 está fundamentada no cancelamento original por20m da PR681; não altera os limites do Auth ou Playwright. Produção c46, Cron e catálogo019 continuam preservados; migrations020–022 não são aplicadas por esta entrega.
