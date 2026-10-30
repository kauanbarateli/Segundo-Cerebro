# Adendo Root — bloqueios N conhecidos na pausa

Inspeção estática de24/10/2026, sem executar o runner ou qualquer teste. O parecer independente anterior permanece íntegro e descreve o conhecimento naquele momento. Este adendo acrescenta uma incompatibilidade objetiva verificada ao preparar o handoff.

1. **Versão Node:** a fonte Git `70c5dd5:.nvmrc`, blob `a45fd52cc5891570d6299fab38643103c3955474`, contém `24`. O workflow usa `node-version-file: .nvmrc`, mas o runner novo, linha139, exige que esse texto seja igual a `process.versions.node`, que contém a versão completa. Portanto `24` não será igual a `24.x.y`; o gate recusará ENVIRONMENT_REFUSED antes de coletar as fontes. Corrigir a validação para respeitar a política já selecionada pelo arquivo e registrar a versão integral observada; não mudar .nvmrc ou pin de ferramenta para acomodar um erro do teste sem revisão. Acrescentar negativo/positivo pertinente e revalidar. Nenhuma correção foi feita durante a pausa.
2. **Grafo atual:** a allowlist do bundle omite `src/lib/finance-goals-terminal-contract.ts`, importado/reexportado pelo canonical atual. Declarar somente esse módulo puro, sem HTTP/browser/journal/WASM. Esse achado já consta do peer.

Os onze payloads originais, hashes e Sources históricos permanecem preservados. O código70c não recebeu o runner/workflow, e os26 controles/doze confrontos continuam não executados. Reabrir o pacote com ambos os bloqueios e nova revisão, sem apresentar o parecer anterior como aprovação irrestrita da composição.
