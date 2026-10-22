# Integração da análise mensal e do seletor de competência — 21/10/2026

Refs #77, #71 e #81. Esta é uma fatia parcial, sem encerramento dessas issues ou abertura de contratação. O Financeiro conserva seus contratos de competência, centavos, máscaras e autorização.

## Procedência e revisão

Entrega autoral F77-A: commit `b79c27eccc315d277d2ebf81dac5d0de654a26bb`, árvore `dcbe9be81c514177c0b97cfb050967dfc75554ae`, sobre `b5e7e8547abb0f81db9f99b53bb043cec4a85dc9`. Root verificou os 19 paths por blob Git, tamanho e SHA256 contra o manifesto fornecido, sem ler `.env` ou dados pessoais. O manifesto conferido está no diretório de trabalho ignorado, separado da evidência versionada.

O pacote conserva somente os três deltas financeiros de `58de215931944245ca08d2e01cdbc2c2f87edcc5`, `90e2bd150f78d9262c578c628f64a43a5d493009` e `bdf8afa0bdc1e84d7815157fead4622d32064633`. Não transplanta a base antiga da PR #86. Os detalhes da seleção e das correções autorais estão em [T-052](t052-finance-period-picker-spec08.md).

Leitores independentes conferiram Core, datas/URL, navegação, React, CSS e testes. Os oráculos econômicos anteriores, incluindo faturas, parcelas, rateio, saldos, eventos, recibos e isolamento, permanecem. O helper E2E usa botões reais para abrir, percorrer anos e selecionar meses; não injeta estado ou input oculto.

## Reconciliação Root

O checkout próprio de revisão incorpora a ancestralidade `995368e772371d2c73c596bc84d660a15a910971`, preservando a correção responsiva de Hábitos e o diagnóstico passivo de Auth. Resultados desses antecessores não certificam o delta financeiro.

Antes de publicar esta fatia, Root confirmou o encerramento dos 18 runs originais de995368e, todos success, sem rerun ou cancelamento. CI push39647315677 e PR39647326098 aprovaram 1.761 contratos de scripts e329 E2Es cada. Recovery push39647315840/PR39647325636 e Admin navegador39647315815/39647325828 terminaram com requisições/inspeções pendentes zero, escrita incerta falsa e infraestrutura removida. O merge executado da PR foi `967caff5d9702fd11866a690a96162ad679dd555`. Isso valida o diagnóstico naquele SHA; não demonstra eliminação da falha intermitente anterior nem concede aceite hospedado.

Root fechou uma lacuna da projeção temporal preservada: mês, ocorrência e competência do cartão agora exigem ano civil0001–9999 antes das helpers existentes. Não há refatoração compartilhada ou erro com valores de entrada. Foram preparados cinco positivos nos anos0001/0004/0099/0100/9999 e nove negativos nos limites0000/10000, mantendo centavos, dias do mês e totais exatos.

Root acrescentou 16 anexos ao E2E existente, sem reduzir seus oráculos:

- `financeiro-analise-{light,dark}-{320,390,768,1280}`: região da análise, com tabela aberta/focada e altura/contenção conferidas antes da imagem.
- `financeiro-periodo-{light,dark}-{320,390,768,1440}`: viewport, com popup aberto, alvos/posição conferidos e Escape/retorno de foco ainda exigidos depois da imagem.

Os enquadramentos são diferentes e seus nomes os distinguem. Os valores são sintéticos. Anexo produzido não significa que o restante do teste passou, nem certifica máscara posterior, zoom nativo, aparelhos reais ou persistência hospedada. A inspeção gráfica ocorrerá em um lote, com no máximo uma correção e confirmação, conforme Impeccable.

## Validação e pendências

Somente Git, leitura, hashes e edição leve nesta máquina de 8 GiB. Nenhum Node/npm, compilador, lint, testes, build, browser ou banco local foi executado. A revisão estática e `git diff --check` não recebem PASS dinâmico. O runner original Node24 executará os testes e gates pertinentes, com resultados vinculados ao SHA publicado.

A cadeia permanece em 21 migrations (001–020 e Hábitos), sem alteração SQL nesta fatia. Tipos, SQL Editor e catálogo existentes não serão regenerados sem divergência real. Os derivadores originais de fontes devem observar os novos imports no GitHub; nenhum número será elevado por suposição ou gate relaxado. O workflow adicional apenas publica candidatos observados e mantém seus próprios diagnósticos; não substitui os checks originais.

Publicação ocorrerá em PR de rascunho empilhada sobre Hábitos. Deploy automático da branch `codex/ci-finance-period-20261021` está desativado antes do primeiro push. Sem merge, deploy, aplicação remota, reset ou seed. Calendar reservada continua ausente; a coordenação de schema/código e rollback compatível pertence ao candidato de release completo.

Ainda faltam as outras fatias da #77 (metadados de cartões, conta padrão, drawer e lançamento rápido), além dos aceites correspondentes. Não transferir para elas o escopo deste seletor ou dos deltas mensais preservados.

## Rodada8be467e — inventários observados e tipagem do teste

As 17 execuções automáticas desta rodada terminaram:10 success/7 failure, sem cancelamento ou rerun. O qualificador Chromium não foi acionado pelo filtro de paths da PR, pois o delta financeiro não alterava seus insumos. Seus gatilhos originais não foram editados. O diagnóstico adicional aprovou unidades nos dois fusos, camadas e tokens/contraste; scripts tiveram1.756 pass/5 fail, todos nos coletores/igualdades de fontes abaixo. Os CI gerais pararam na tipagem; build e E2E deste SHA não receberam PASS.

CI push39649350125 e PR39649448967 recusaram Typecheck em `finance.spec.ts:314`: o callback de Locator.evaluate recebe HTMLElement|SVGElement, e `.click()` não existe no segundo tipo. Root acrescentou a guarda explícita HTMLButtonElement antes de alterar o histórico e invocar o clique síncrono. O teste continua exercitando a closure antiga antes de React renderizar; não usa cast, input oculto, atraso ou nova navegação.

Recovery push39649350076 e Admin navegador push39649350021 recusaram nos controles puros, antes dos serviços. O relatório registra SOURCE_REFUSED e, no Admin, actual411/expected405. Não atribuir essas recusas ao login, PKCE ou à quiescência intermitente da rodada anterior; esses casos conectados não executaram ali.

O workflow adicional39649350132 produziu o artefato12367694472, ZIP SHA256 `4d680ed96973cedb68731639141388914d92a7d0e2a1aa22d57ca92544e3c01a`. Root conferiu o digest e a identidade8be467e antes de ler os metadados. Os derivadores originais observaram AdminBrowser411, Recovery223, Drive257 e Fundação42. NativeAdmin60 e Avatar57 são listas declaradas nesse artefato, sem nova derivação independente. Catálogo PGlite observado1350/ok/zero desvios não equivale aos1.353 checks de PostgreSQL17 nativo.

Revisor independente comparou AdminBrowser com o relatório fechado995: exatamente seis adições, sem perdas/substituições/duplicatas — gráfico `.css/.tsx`, picker `.css/.tsx`, `finance-period.ts` e Core `monthly-timeline.ts`. Recovery acrescenta somente o Core. Drive acrescenta esse Core frente ao candidato anterior256, sem atribuir aceite nativo a essa comparação.

Root preparou somente as igualdades necessárias:405→411,222→223 e256→257, com tipos/fixtures e o conjunto Drive sem relay255→256. Dependências61/60/50, NativeAdmin60, Fundação42 e Avatar57 permanecem. A mudança literal do contrato Admin exige recompor seu pin transitivo:19354 bytes, SHA256 `dc19f3fcb625b5b7c6ef86d343110da0c57b2e9d7963bec1fefd49d59b7df901`. A presença de caminhos, igualdade exata dos conjuntos, controles negativos e todos os gates originais continuam ativos. Os checks do próximo SHA precisam executar; nenhuma recusa recebeu PASS por esta reconciliação.
