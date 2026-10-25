# Captura de Projetos — primeiro fetch recusado na coorte6db

O diagnóstico acrescentado por este delta foi observado na coorte seguinte fa4; seu [resultado próprio](issue104-security-fa4-20261025.md) mantém a captura reprovada e a causa não comprovada. O texto abaixo conserva a preparação e os resultados originais de 6db.

**Observado:** a [execução de push40158827350](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40158827350), job121065846252, passou os testes da aplicação e falhou na captura posterior. Primeiro diagnóstico: REQUEST_FAILED / READINESS / FETCH. Não há URL ou causa identificada. Os dois processos próprios encerraram e a porta foi liberada; nenhum dos nove arquivos foi aceito.

O [recibo da #104](evidence/issue104-security-6db-20261025.json) conserva a coorte:19/20 runs e21/22 jobs SUCCESS, sem rerun. O original geral registra3618 unidades em cada fuso,2172 scripts e533 E2E aprovados. A ausência de PAGE_ERROR entre os primeiros códigos não prova ausência global desse erro. O mecanismo Serwist anterior e a nova falha não devem ser confundidos.

## Implementado no próximo lote

Somente o harness recebe um detalhe fechado da primeira requestfailed, depois de marcar a falha fatal. O snapshot síncrono do Playwright é projetado para sete campos: version, transport, scope, target, rsc, routerPrefetch e purposePrefetch. Não são emitidos URL, query, ID do projeto, cookies, outros headers ou texto livre do erro.

Transport aceita ABORTED, CONNECTION_REFUSED, OTHER ou UNKNOWN. Os sinais de headers usam YES/NO/UNKNOWN; só são classificados depois da política atual de GET/origem/caminho. PROJECT_PATH identifica apenas pathname exatamente /projetos, sem qualificar o parâmetro project. Leituras inesperadas ou excepcionais fecham em UNKNOWN.

O relay exige uma linha canônica limitada a256 caracteres, separa stdout/stderr, conserva a primeira observação e impede que os dois protocolos de diagnóstico contaminem os códigos legados. O relatório só associa esse detalhe ao processo de captura cuja primeira falha é REQUEST_FAILED. O novo módulo é conferido por hash no início e no fim; os quatro campos Source do recibo de imagens permanecem iguais.

**Todos os bloqueios continuam:** erro de página/requisição/HTTP, API, origem externa, método diferente de GET, sockets, Service Worker, popup, readiness, timeout e limpeza. ABORTED/RSC/prefetch são informações para investigar; nenhum deles passa a ser aceito. O aplicativo, dependências, workflows e layout não mudam neste delta.

## Validação e limites

Root executou em Node24.19.0, um processo por vez:17 novos grupos e45 existentes aprovados,33 controles do supervisor aprovados, sintaxe de cinco arquivos e lint dos mesmos cinco sem avisos. Puros usaram heap64MiB; lint128MiB. Não iniciou Next, navegador, SDK ou banco no notebook. A revisão independente foi estática e conferiu os Sources.

A primeira cópia de suporte perdeu um LF final e foi recusada antes da aplicação. V1 ficou preservada, sem execução. V2 passou a copiar bytes e conferir Root/before/after/Git; os quatro suportes ficaram exatos. O patch de cinco caminhos não alterou esses testes anteriores.

O próximo HEAD precisa de CI próprio no GitHub, inclusive para observar o novo detalhe e obter eventual artefato completo. A hipótese de RSC/prefetch vem dos Links da demonstração; os loaders de Projetos usam memória. Isso ainda não identifica a requisição que falhou. Não dispensar o gate, repetir o run encerrado ou promover imagens sem proveniência e revisão visual. Merge e produção continuam bloqueados.

[Evidência do delta](evidence/capture-requestfailed-6db-20261025.json).
