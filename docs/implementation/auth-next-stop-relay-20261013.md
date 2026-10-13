# Fecho dos runners Admin e Recovery — 13/10/2026

A nova integração permite ao worker pedir a parada do processo Next original durante o fecho, quando restam somente GETs estáticos canônicos. O pedido atravessa o reporter mínimo e o stdout original do CLI; o parent continua responsável pela única Promise de parada. Isso elimina a dependência circular entre o encerramento do servidor de desenvolvimento e a espera pelos requests. A execução real ainda precisa comprovar o efeito; as falhas globais históricas permanecem falhas.

A autoridade exige os 12 pins públicos de middleware/configuração/Next e ausência de Pages/instrumentation antes de iniciar infraestrutura ou fixtures. Cada Request e cada linha do registro são as referências originais. Auth, API, HMR, RSC, outros métodos/origens e queries não permitidas não recebem essa autoridade. Uma troca de linha exige Request previamente capturado e referência da linha anterior; o peer encontrou e corrigiu a aceitação de uma referência ausente antes da integração.

O prazo absoluto de 15 segundos, as barreiras de UI/SDK/SQL, o veto de efeito desconhecido e a primeira falha são preservados. O pedido, seu frame, o sinal de parada e o fechamento do grupo não removem requests: somente `requestfinished` e `requestfailed` originais podem fazê-lo. O finally aguarda a mesma Promise original; não inicia uma segunda parada. Não foi removido nenhum veto de limpeza, apagado fixture inconclusivo ou aumentado o prazo das jornadas.

## Revisão e integração

Autor e peer revisaram os 18 caminhos do freeze v2; cada um passou 20/20 testes novos e 5/5 focados nos chamadores originais. Root leu os deltas de integração, repetiu 20/20 no candidato e verificou os 14 baselines da Main e os hashes dos 18 arquivos antes de copiar. Não houve mudança no código de produção, dependências ou migrations.

Na Main, Root passou **203/203 controles** dos quatro arquivos `auth-local-ci`, `admin-browser-local-ci`, `auth-recovery-local` e `next-stop-relay`, mais **98/98** do arquivo `admin-browser-support`, em execuções separadas sem skips. O escopo atual totaliza 301 testes, incluindo as verificações de coletor e SDK antes recusadas na junction do checkout isolado. Tipos, lint dos 29 arquivos integrados de Auth/restore e a verificação de segredos passaram. Os 16 FAIL do ensaio do autor no freeze v1 continuam registrados como históricos próprios; os resultados novos são da Main com dependências próprias. Nenhum teste hermético concede PASS de navegador ou serviço hospedado. [Evidência da integração](evidence/auth-next-stop-main-20261013.json).

Contagens do inventário aprovado: Admin **352 fontes Git + 60 dependências**; Recovery **196 + 60**. A execução usa seu `GITHUB_SHA` real, sem binding fixo a um commit anterior. A #35 conserva o aceite de execução nativa e de limpeza integral pendente até observar os novos runs.
