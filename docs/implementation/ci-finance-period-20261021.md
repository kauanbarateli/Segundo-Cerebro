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
