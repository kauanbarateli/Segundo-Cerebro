# Corte com ledger observado: ensaio descartável

O cenário 24 parte dos bytes protegidos SHA `3d00f3b2f81edfff0dcd01b3837a11925ebdcb3ed542ebe8158e2a28e8d0a17c`, instala barreira em fixture isolada e gera um ledger sintético com a versão, nome e bytes da instalação observados. Testa recusa para hash incorreto e entrada posterior inesperada e, após restaurar a fixture, exercita em memória o corpo de corte com a condição de ledger original, validando a barreira antes e depois e o aparecimento das funções v2.

Somente para o container, as duas guardas fatais são retiradas em memória e a parte do catálogo de 38 funções/quatro tabelas é substituída por qualificação sintética, enquanto a guarda de ledger original é preservada. Os arquivos protegidos permanecem intactos, as conexões usam guard de instância e o runner exige isolamento de rede e limpeza. Alterações no ledger pertencem exclusivamente à fixture descartável.

Este ensaio não demonstra o SQL completo sobre o catálogo real, não prova drenagem, concorrência dos consumidores, rollback do corte ou transporte MCP, e não autoriza cortar no QA. A execução PG17 no GitHub ainda é necessária; os testes locais Node apenas verificam estrutura e recusas sintéticas.
