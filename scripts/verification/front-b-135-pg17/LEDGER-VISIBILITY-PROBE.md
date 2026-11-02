# Sonda do ledger em PostgreSQL descartável

O runner executa os bytes fixados de `probe.fail.sql.txt` com 0, 1 e 2 linhas em uma tabela sintética. Cada cenário usa um container PG17 separado, sem rede, com identificação, guardas e limpeza do runner. Os erros esperados são capturados dentro de um bloco de teste, que falha caso o código ou a mensagem não sejam os esperados.

Este ensaio apenas verifica sintaxe e ramificações do SQL em PostgreSQL. Não executa `apply_migration`, não simula o transporte MCP, não prova atomicidade, ordem de ledger, isolamento ou comportamento do Supabase hospedado, e não autoriza aplicar a sonda em QA. Os 19 cenários anteriores continuam obrigatórios para o recibo.
