# Sonda intencionalmente falha do ledger #218

**Preparação apenas. Não foi executada remotamente.** A sonda não cria objetos nem altera dados no SQL de diagnóstico. Entretanto, `apply_migration` pode gravar uma entrada no ledger fora do SQL: isso é uma mutação possível, mesmo quando o diagnóstico retorna erro. A execução posterior requer autorização específica, em QA ou projeto descartável identificado, nunca produção. Não testar na migration de quarentena real. Não confundir este ato com autorização de quarentena.

Nome exato para o argumento `name`: `sc218_ledger_probe_20261102_5e81f9ab`. O argumento `query` deve ser **exatamente** o conteúdo de `probe.fail.sql.txt`, sem remover nem acrescentar comandos. O nome é fixo no SQL; se já existir, pare: não altere o nome casualmente nem repita o ato. A identidade e SHA-256 dos bytes enviados devem ser conferidos e registrados antes da execução. A API atribui a versão, que não pode ser prevista.

## Verificações e ato futuro

1. Confirme externamente o projeto pelo identificador do endpoint e pela conexão autorizada; `current_database()` não identifica de forma única um projeto Supabase. Confirme que se trata de ambiente descartável adequado ou QA, nunca produção. Não inspecione nem registre segredos.
2. Execute `inspect.readonly.sql.txt` por conexão independente, registre horário, nome do projeto, papel, existência/permissão do ledger e linhas encontradas. O ledger precisa existir e ser legível, sem linhas com o nome fixo. Erro, permissão insuficiente, mais de zero linhas ou identidade incerta: interromper. Controle concorrência operacionalmente: nenhum outro operador ou automação pode usar esse nome durante a janela; a consulta não impõe exclusividade.
3. Somente depois de autorização específica, chame uma vez `apply_migration` com o nome e SQL exatos. Capture status, SQLSTATE e mensagem devolvidos, sem segredos. O SQL deve falhar: sucesso, timeout, mensagem genérica, erro de privilégio ou de parsing são inconclusivos; não repita automaticamente. A API pode mascarar SQLSTATE/mensagem ou executá-lo em contexto distinto do esperado.
4. Execute de novo a inspeção por conexão independente e registre todas as versões e hashes retornados para o nome exato. Se existir entrada, compare seu hash com o SHA-256 dos bytes da consulta. Não apague, edite ou repare o ledger; não repita a chamada. Uma linha residual ou resultado inesperado exige reconciliação separada. Uma ausência imediata é apenas fotografia: uma escrita tardia, outra transação ou falha de transporte pode mudar o resultado. Refaça a leitura depois da janela operacional estabelecida, sem tratar o prazo como prova absoluta.

## Interpretação restrita

- `P2182` + `SC218_PROBE_ROW_VISIBLE`: a linha com esse nome estava visível **à consulta dentro do SQL naquele instante**. A pré-inspeção e a exclusividade do nome são necessárias para atribuí-la ao ato; não provam por si mesmas sua origem nem a ordem de commit. Confira o ledger após o erro.
- `P2181` + `SC218_PROBE_ROW_NOT_VISIBLE`: nenhuma linha com esse nome estava visível à consulta naquele instante. Isso não exclui inserção posterior pelo transporte, outra transação ou escrita após a resposta.
- `P2183`, qualquer outro erro, estado/mensagem mascarado, sucesso ou timeout: inconclusivo. Uma linha inesperada no pré-check invalida a atribuição, mesmo se o SQL reportar `P2182`.

O resultado não prova atomicidade entre execução e ledger, comportamento sob queda de rede, rollback de outros comandos, isolamento dos escritores ou comportamento futuro do serviço. Não autoriza remover guardas da quarentena nem reparar o ledger. Os dois casos de resposta são deliberadamente erros; a inspeção posterior não deve ser pulada.

## Testes locais

`node --test scripts/verification/front-b-218-ledger-probe/probe.test.mjs` verifica estrutura dos arquivos e classificação sintética dos marcadores. Não executa PostgreSQL, Supabase ou o transporte, nem prova as garantias acima.
