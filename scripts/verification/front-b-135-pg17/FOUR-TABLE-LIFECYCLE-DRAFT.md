# Ensaio descartável: extensão e recuperação da barreira

O cenário 25 parte dos arquivos protegidos pinados da extensão (`eb9cc8...`) e da recuperação (`e4d491...`). No container sem rede, instala a barreira sintética de duas tabelas, testa a extensão em rollback e commit, exige quatro triggers ALWAYS, tenta UPDATE de zero linhas em cada tabela e então aplica recuperação para duas usando versão/nome/hash sintéticos no ledger. Cada chamada passa pelo guard de instância; o runner exige limpeza e todos os 24 cenários anteriores.

Para a fixture, as guardas fatais são removidas somente em memória e o catálogo real das 38 funções e quatro tabelas é substituído por qualificação sintética. A verificação de ledger original é preservada; o statement da extensão no ledger e seu hash correspondem à composição sintética de ensaio. Não se conecta a QA nem altera os arquivos protegidos.

O ensaio não cobre catálogo hospedado, MCP, versão/statement futuro real, concorrência e drenagem, `TRUNCATE`, FK/cascatas, papéis/`SECURITY DEFINER`, transações externas, nem rollback da recuperação. Não valida corte com quatro triggers ou um thaw. Testes Node apenas checam composição e devem ser seguidos por execução PG17 no GitHub; não autorizam operação remota.
