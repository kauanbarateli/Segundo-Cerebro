# T028 — backlinks e Relacionado em lote

O critério da [issue #28](https://github.com/kauanbarateli/Segundo-Cerebro/issues/28) exige leitura em lote, com ausência de N+1 demonstrada pela contagem de consultas no adapter. O [teste de contrato](../../tests/adapters/knowledge-batch-query.test.ts) mantém a rota GET, runtime, gateway, store, projeções do Núcleo e SDK instalado reais; substitui somente Auth/configuração e o transporte de rede. O transporte falso recusa chamadas fora de `knowledge_snapshot`.

As massas têm 1 e 150 backlinks/vínculos ativos, com 17 e 613 registros no snapshot. Cada GET de página ou Relacionado faz exatamente uma RPC, independentemente da massa. Os DTOs completos precisam corresponder aos IDs, títulos, destinos e vínculos esperados. Referências arquivadas, na lixeira ou em outro destino, vínculos excluídos e destinos indisponíveis não podem aparecer. Uma consulta adicional por registro ou um resultado vazio/truncado falha o teste.

A raiz conferiu o diff e executou os quatro arquivos de regressão: 33 testes aprovados, incluindo os dois casos novos. TypeScript e lint passaram, e duas revisões independentes aprovaram o recorte. A execução no CI desta entrega permanece pendente até o push e a confirmação do resultado próprio.

A contagem demonstra o contrato de chamadas no adapter/SDK. Não mede instruções internas do PostgreSQL nem certifica desempenho hospedado, RLS, editor ou interface real. Os demais critérios da issue continuam abertos.
