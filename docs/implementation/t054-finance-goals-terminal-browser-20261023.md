# M2-B — captura e reconhecimento terminal no navegador

Draft local sobre `01ae6a7c62b8d2dbe9e295b7702d329f64ec5313`, sem rollout. Contrato Root M2 e plano `880257b7e28d6de383a870be026fd1e57424c01a4e2025d3ffb11a3332a7f6e0`. Sem TSX, SQL, SDK servidor, montagem na interface ou escrita financeira nesta entrega.

FinanceGoalsClient ganha capacidade terminal agrupada opcional; a implementação browser fornece status e settle. Ports V1 sem capacidade recusam com unavailable; não há fallback para execute/reconcile. O wire terminal dedicado é `{ok:true,result:GoalTerminalReply}` com protocolo 2, sem binding V1 externo. Reconcile V1 e o decoder V1 do reader permanecem com seus contratos.

O módulo browser captura o GoalCommand completo pelo decoder Core antes de await, usa assinatura original e WebCrypto SHA-256 UTF-8, sem `node:crypto` ou segundo canonicalizador. Bytes/resultado do digest são copiados e conferidos; ausência, rejeição ou mutação recusam sem hash alternativo. O timeout finito abrange a ação local e não causa retry. Digest ocorre antes do WebLock. Owner/epoch/liveness/fence são conferidos antes/depois dos awaits; continuação tardia não pode enviar ou limpar. Dispose apenas aborta a instância; logout continua explícito no canal existente.

DTO/decoder puro e scanner bruto são dependências da frente M2-S, consumidas por import sem cópia nesta autoria: finance-goals-terminal-contract.ts (`7a3c86e8c81c8942b67744c53ac0fcfc3c8007bdac6a438450d900d6faf68c25`) e finance-goals-json.ts (`33f690d4e0e964a89cfd0db773e02a7f4d8d7238fb3b50bc6d018c64f59b5feb`). Root precisa compor esses bytes antes de Typecheck/CI. Não há placeholder permissivo. O reader terminal usa limites 6/64, UTF-8/EOF/quota e origem/path/no-store existentes.

Prova positiva é nominal, criada apenas pelo caminho de resposta terminal validada; não há construtor de prova por DTO/booleano da UI. O transporte injetado é configuração confiável do client (ou fake explícito em teste), não uma alegação de proteção contra JavaScript comprometido. A prova conserva dono/epoch/corpo/result original privados. Journal e controller podem inspecionar; uma única tentativa de escrita consome a prova, mesmo se o readback falhar. Nova recuperação exige nova resposta positiva.

Sob a mesma lease: B físico divergente recusa antes de ack/metadata. Positivo A → remover/readback ack antigo → gravar/readback `reconfirmRequired: true` → remover A se existir → reler ausência e fence. Null físico depois de clear parcial pode concluir com NOVO positivo A; null/erro/uncertain por si não libera nada. O corpo lógico held A permanece no controller até prova e readback final com dono/epoch corretos, `pending: null` e `reconfirmRequired: true`. Antes do settle com A físico, phase uncertain é persistida antes do POST. Status não chama settle nem execute.

Após positivo o controller descarta a prévia antiga, exige primeira página atual bem-sucedida e ação humana de acknowledge antes de preparar outro UUID. Na remontagem com capacidade terminal e `reconfirmRequired: true`, o mesmo bloqueio é reconstruído, sem reaproveitar a leitura de outra instância. Esta fatia não monta botão de encerramento nem resolve M2-U. A seleção local de imagem e a incerteza de upload continuam separadas.

## Validação

Suítes novas escritas para captura/aliases/digest, reader/duplicatas/quota/timeout, prova nominal, clear parcial com efeito+falha, B/epoch/quota/readback, optional port, confirmed original, necessidade de revisão e duplo clique. Dados sintéticos; nenhum segredo/recurso hospedado.

**Nenhum Node, lint, Typecheck, Vitest, SQL, browser ou serviço executado nesta autoria.** Root executará checks após composição/peer. Comandos propostos: `npx vitest run tests/lib/finance-goals-terminal-browser.test.ts tests/lib/finance-goals-terminal-journal.test.ts tests/core/finance-goals-terminal-controller.test.ts`, regressões V1 de journal/client/controller, `npm run typecheck`, `npm run check:layers`, lint e check-secrets. Corridas nativas commit↔settle, recuperação dos fences, SDK/Auth/HTTP reais e M2-U continuam gates de ativação, sem merge/deploy autorizado por esta entrega.
