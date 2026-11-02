# Corridas da escolha de origem no cadastro pendente

O runner #204 prepara quatro cenários **não executados nesta alteração**: retirada antes/depois da reserva e antes/depois da conclusão. Cada cenário usa duas conexões PostgreSQL 17 no container sem rede, observa `pg_blocking_pids` entre PIDs e nomes de aplicação vinculados, confirma ambos os commits e exige que ambas as sessões e o container sejam encerrados antes do recibo. São preservados os 15 cenários anteriores, os pins, nonce/system identifier, isolamento, limites e limpeza; não há alteração de workflow.

As funções `draft_completion_context` e `draft_reserve_completion` vêm da mesma foundation 028 pinada pelo runner; `draft_confirm_complete`, `draft_finish_fenced` e as duas wrappers legadas são extraídas por marcadores únicos dessa mesma fonte. A cadeia de retirada vem da fixture legada previamente qualificada, e as candidatas de retirada e de reserva/conclusão são lidas pelos hashes completos `02ef5708f3d9bf74d4ecc7d1946461503eb20d6f4cbadd9b6fb98d7ac85ccdff` e `7d34cef6d839dca2bbc71b37f62cb8818693ba3e06e203989c7e353f0088ac84`. Guardas são removidas somente em memória após conferir bytes e contexto, nunca dos arquivos. O cenário usa as duas versões de wrappers novas reais, não um modelo que substitui suas decisões.

Usuário, sessão, moderação, intenção, onboarding, ledger implícito de eventos e prova de senha são dados/tabelas sintéticos. A prova é inserida diretamente, sem simular ou comprovar operação Auth externa; os metadados e o schema não reproduzem o catálogo QA completo. Para a conclusão, a fixture marca artificialmente o fence como `password_acknowledged`; isso não comprova a prova do provedor, seu TTL real nem o transporte MCP.

- Reserva primeiro: a retirada espera e depois remove a origem e marca o fence.
- Retirada primeiro: a reserva antiga espera e recebe `stale`, sem fence ou origem.
- Conclusão primeiro: a origem muda da intenção para o registro admitido com nova revisão; a retirada antiga espera e recebe `stale`, preservando a nova revisão.
- Retirada primeiro: a conclusão espera e admite a conta sem origem, preservando o fence de retirada.

Cada resultado e estado final deve coincidir exatamente. Os testes unitários locais exercitam derivação, pins, identificadores, recusa por falta de espera e limpeza, com portas simuladas; não comprovam execução PostgreSQL. Mesmo depois de um eventual run verde, permanecem necessárias as corridas de reconsentimento/expiração, sessão revogada, erros e respostas incertas, recuperação do checkpoint, preparação da migração com catálogo real, drenagem de chamadas antigas e validação Auth em QA. Nenhum resultado autoriza abrir o cadastro ou aplicar SQL remoto.
