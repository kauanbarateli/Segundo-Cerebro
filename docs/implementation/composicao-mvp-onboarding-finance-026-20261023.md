# Composição 026 — onboarding, landing e financeiro

Refs #71, #77, #78, #79, #80. Candidato de integração em 23/10/2026, sem merge, deploy ou instalação hospedada.

Base de aplicação: PR #113, d16e1dd350fcea7fc95bb6dcad03f9a8649b05d2. O transporte usa os blobs finais do financeiro 708cbc642d7f56a2d0102f0ec376ec547b974c2c e de Metas 0de769c6a137dfe76124c9d1a995d898b74210ed, sem importar merges históricos. A UI isolada da PR #116 ainda não integra esse candidato. A lista de paths, origens, tamanhos, hashes e exclusões permanece no manifesto público de preparação. A guard Vercel preserva todas as branches e acrescenta somente esta branch com false.

## SQL descartável explicitamente revisto

Os três helpers históricos de Financeiro continuam byte a byte na fronteira 001–025. O novo `finance-026-candidate-sql.ts` exige nomes, ordem, tamanhos e SHA-256 dos 26 arquivos canônicos derivados da base d16. Faltante, extra, alteração ou outra fronteira recusam antes de abrir SQL-in-WASM. A normalização permitida é somente CRLF para LF. Não há chave, URL, aplicação hospedada, reset, seed ou runner de migrations remotas.

Os compilers originais continuam verificando os bytes e limites das propostas inertes. A composição de teste aplica Budget antes de B2 e Metas; não repina prosrc, reescreve predicados ou usa função observada de outro banco. Os testes canônicos existentes conservam corpos, ataques, comparação de baseline e asserts; somente seus imports de criação descartável passam para o novo helper 026. Budget usa Budget; Séries usa Budget+B2; Metas usa Budget+B2+Metas.

O teste complementar verifica a cadeia exata, a recusa dos helpers históricos perante 026, os pontos de composição e as permissões privadas. Depois executa as assertions completas do Budget sob todas as extensões e exige retorno ao baseline vazio, incluindo dados, recibos, eventos, revisões e objetos temporários da fixture. Esses controles não substituem o catálogo completo, GoTrue/Storage hospedados ou corridas nativas.

## Estado da revisão

Peer estático independente conferiu 26/26 fontes e blobs, compiladores, recusas históricas e ordem de composição, sem bloqueador objetivo. Nenhum SQL ou teste dessa composição foi executado nessa revisão. O derivador original do Admin foi chamado apenas sobre arquivos públicos para obter o inventário candidato: 471 paths, com 67 declarados do backend já contidos na união. Não foi chamado o coletor completo nem provado o vínculo de blobs/dependências no CI. Uma primeira tentativa de resolução local falhou por recursão do hook e permaneceu preservada, sem ser convertida em PASS.

Pendente antes de promover o candidato: compor os três contratos/testes Admin preservando 026 e negativos Finance; revisar e executar lint/layers/secrets; CI integral próprio do SHA com lock, dois fusos, catálogo, SQL, build/PWA e navegador; conferir fontes e encerramento dos nativos. Resultados verdes das PRs separadas não certificam a união. A falha de porta de um original da PR #115 permanece registrada e não pode ser omitida.

## Rollout separado

As propostas Budget/B2/Metas permanecem DRAFT_ONLY/ROLLBACK. Não são migrations canônicas e não foram aplicadas na homologação, no Ensaio_restore ou em produção. Para homologação serão necessárias migrations novas revisadas, tipos/catálogo, gates de UI/canal e aceite conectado. Produção e merge continuam bloqueados. Checkout Asaas, abertura de vendas e Drive não entram nesta composição.
