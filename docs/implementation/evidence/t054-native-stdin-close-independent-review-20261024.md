# Peer independente — fechamento de stdin do processo nativo

24/10/2026. **Favorável estaticamente, sem bloqueador objetivo neste delta.** Somente leitura pública dos três WIPs Root; não editei produto/R7, executei Node/testes/SQL/rede ou publiquei. Este parecer não é resultado de CI nem qualificação nativa.

## Integridade e escopo

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| scripts/verification/auth-local-ci.mjs | 70525 | abb4a1d8e76f65f1281f78cdab29ce150f9b595f940fe45b13e936a1279dac4e |
| tests/scripts/bounded-process-stdin.test.mjs | 5825 | 91d3ca8fd4746a2f7f47a0bda4b4defbe822e50ba629a26d6de29f24e3f4766c |
| docs/implementation/t054-finance-goals-terminal-validation-20261024.md | 13251 | 305bfd2504e3852e0742254900ac6fd9c3277e0f5d3692c733b2c1fc84af5a51 |

Refiz independentemente a inversa literal do bloco de três linhas no helper, em memória, e calculei o objeto Git UTF-8 com seu header: reproduz EXATAMENTE o blob pai d803ca9b24caee7f82c909bba2aefb609a34af87. Portanto nenhuma mudança de spawn/env/observador/coleta/códigos/limites/prazos/cleanup está escondida fora desse fechamento. O diff documental é somente apêndice; o teste é novo. Git status observado tinha apenas esses três WIPs.

## Semântica examinada

Acesso a options.input continua único. Somente undefined, null ou STRING vazia vão a end() sem chunk. Demais valores seguem end(input), sem truthiness/coerção: texto, Buffer, Uint8Array e os binários vazios conservam identidade do argumento; 0/false/objetos também continuam no ramo original. Isso é verificável pelo código; a suíte nova não executa todos os tipos impróprios.

O teste usa Writable real para stdin e chama a implementação original de end via Reflect.apply; seu wrapper só observa argumentos e exige observador instalado. Não há emit manual de finish. Os callbacks reais de write/final determinam o caminho; PassThrough fornece os EOFs da fixture. O EventEmitter simula somente os terminais do filho e a dependência terminateGroup é sintética: não se prova processo ou grupo operacional com esses testes.

Os quatro controles escritos cobrem ausência/undefined/null/string vazia sem escrita de zero bytes; texto UTF-8/binário com bytes e identidade; binários vazios no ramo de um argumento; e _final com erro, que preserva finish0 mesmo quando os terminais simulados e grupo são positivos. O último caso explicita corretamente que o helper genérico NÃO certifica finish. Não transformar sua resolução genérica em aceite N.

strictRun permanece intacto: exige uma ocorrência de cada stdoutEnd, stderrEnd, exit, close e stdinFinish, códigos0, sinais null, ordem exit→close, sem terminal contraditório e grupo confirmado. needInput=false continua diagnóstico, não exceção ao requisito de finish. Não houve waiver, EOF fabricado, prazo maior ou conversão de erro para PASS.

## Evidência e limites

O diagnóstico bf1 observado informa git-head com stdinFinish0 e demais terminais/códigos/grupo positivos, needInput=false. Isso localiza uma observação faltante; NÃO prova EPIPE, corrida específica ou causa interna do stream. O apêndice mantém essa distinção. Não precisei abrir rede nem confirmei independentemente a implementação interna dos links Node ali citados; sua hipótese não é tratada como causalidade demonstrada neste peer.

Os resultados locais 37 controles e cinco regressões foram comunicados pela Root, antes de sua normalização restrita a LF; eu não os executei nem reclassifico como novos originais/CI. O próximo SHA continua exigindo seus próprios gates, especialmente o N real; nenhum confronto SQL é aceito por esta revisão.

## Impacto no grafo fechado

O path do helper é o mesmo; seu SHA muda. N, Admin nativo e Recovery importam esse helper compartilhado, e os controles Auth também o exercitam. Revalidar fechamento/inventário e relatórios por NOVO SHA/árvore; não herdar os hashes/terminais de bf1. Não rodei derivação de grafo/AST, não atualizei pins/contagens e não afirmei que o conjunto completo foi qualificado. O strictRun, template e controles N não estão entre os WIPs observados.

Sem alteração solicitada para aprovação estática. Permanecem gates Root/CI, revisão dos originais e preservação das falhas anteriores; merge/produção/restore continuam separados.
