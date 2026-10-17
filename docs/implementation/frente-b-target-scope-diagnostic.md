# Diagnóstico nominal de recusa B4 do alvo

A nova inspeção target-only v2 relatada por Root foi encerrada na etapa de planejamento: snapshot, dump CUSTOM e listagem nativa haviam concluído; B4 recusou com RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED. O diagnóstico de categoria estava ausente. Nenhum import foi executado. A captura e os preparos v1/v2 permanecem encerrados; esta entrega não lê o TOC privado nem repete as operações.

O delta acrescenta somente diagnóstico ao helper local unsupported(row) de planManagedTargetBaseline. Todas as cinco chamadas existentes fornecem a mesma row já validada pelo parser verbose. O erro conserva o mesmo código e os mesmos predicados. Nenhum tipo, schema, ACL, DDL, customização ou metadado de banco antes recusado passa a ser aceito.

O WeakMap unsupportedToc existente recebe exatamente reason, knownKind, scopeCategory e tailShape, congelados. reason é scope_classification para os descritores do enum conhecido, ou unknown_descriptor; knownKind é um descritor daquele enum ou null; scopeCategory deriva exclusivamente de scopeCategory(row.schema); tailShape é valid. Não são retidos nome, tag, owner, ID, OID, dependências, SQL ou trecho do TOC. O getter nominal managedTocUnsupportedDiagnostic já valida esse contrato; códigos ou campos forjados, cópias de erro, getters e proxies não o reproduzem.

A projeção PowerShell dos preparos anteriores já aceita os mesmos quatro campos e enums. O preparo novo v3 altera apenas selfpath e pin público do planner; seu teste muda somente nome do arquivo e pin do preparo. Os preparos encerrados não são editados. GateExecute=false e ReviewedCommit=null continuam padrão.

A QA RAM acrescenta vetores recusados de DEFAULT ACL e DDL em public/app_private, SCHEMA global, descritor conhecido fora do conjunto B4, metadados de banco fora do escopo e customização de projeto. Confere campos exatos, imutabilidade, ausência de canários e proveniência nominal sem ampliar aceitação. O descritor desconhecido continua sendo recusado pelo parser original com RESTORE_TOC_UNSUPPORTED.

Uma próxima inspeção precisará de revisão e execução própria de Root em fonte/preparo novos, com os mesmos gates de alvo isolado e nenhum arquivo de origem. Os quatro enums, se observados futuramente, explicarão a categoria recusada; não demonstrarão que a categoria pode ser liberada. Mudar o perfil B4 exige decisão separada e evidência própria.


Validação própria: a primeira QA teve14/15 PASS; um novo owner artificial em letras maiúsculas era recusado antes de B4 pela gramática verbose já existente. Ajustada somente a fixture para um owner válido em letras minúsculas, a suíte passou15/15, zero skips/falhas, em196ms, e ESLint dos dois arquivos passou com zero warnings. O módulo não foi relaxado para aceitar aquela fixture. Fonte, testes e doc não executam SQL nem conectam ao alvo.