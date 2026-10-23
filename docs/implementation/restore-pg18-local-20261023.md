# Diagnóstico local público do PostgreSQL18 — 23/10/2026

Refs #35. Pacote incremental sobre a PR #103, fonte `0259d0cd78acc6286cf2c452c6d4cec7b330b05d`. Não foi incorporado à homologação de UI: essa árvore não contém os três módulos públicos necessários ao controlador.

## Implementado

Launcher PowerShell com preflight antes de Node,34 leases de leitura e conferência dos30 arquivos pinados da instalação local permitida. Wrapper chama diretamente o controlador público original, sem importar restore, perfis, chaves ou archives. Mantém dois inputs sintéticos,45s por caso/90s por lote, terminais e primeira falha. Não fabrica metadados GitHub, binding de ZIP ou autoridade de restore. O cleanup é não recursivo; filho inconclusivo impede sua declaração de sucesso.

Os quatro paths da proposta foram conferidos por manifesto/patch e peer independente. Pins, protocolo privado, controlador original e workflow EDB permanecem intactos. Um step adicional no CI geral faz lint explícito dos novos módulos, pois fixtures são ignoradas pelo lint geral. Os testes em tests/scripts entram na descoberta normal; nenhum teste existente foi removido.

## Validado

Root executou somente a QA pura em Node24, com heap limitado a96MiB: **33 testes aprovados, zero falhas, cancelamentos ou skips** (17 novos e16 originais importados). Não houve execução PostgreSQL, leitura privada ou acesso de rede nesse teste. AST do launcher e apply/check passaram. Isso não comprova carregamento de DLLs ou cleanup nativo Windows.

## Pendente

CI próprio deste novo SHA, incluindo o lint explícito; depois, decisão de Root sobre uma operação local pública finita e sem banco. Qualificação de origem/alvo, A2/A1, inspeção privada, stream, Storage e aceites Auth/Cofre/dados continuam separados. As duas falhas Windows da fonte0259, anteriores aos casos nativos, permanecem registradas: a instalação local não equivale ao ZIP EDB recusado.

Nenhum restore será executado por um PASS sintético. `restoreAccepted=false` continua obrigatório no diagnóstico público. Produção e merge/deploy de produção permanecem bloqueados; sem reaplicar migrations ou usar bancos legados/VOE/BlackSheep.
