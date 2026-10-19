# Auth/Admin da PR #70 — correção de integridade das fontes

Autorização: D-076, em 19/10/2026. Base diagnosticada: `eb2fa91b40df6028cf8a2b7d9fe4b2cdc4cc18cf`, branch `codex/paginas-legais-e-checklist-20261018`, [PR draft #70](https://github.com/kauanbarateli/Segundo-Cerebro/pull/70). D-075 continua vigente: Hobby, deploy adiado, sem merge em main. `vercel.json` não é alterado.

## Causas comprovadas

No [Recovery 39193011771](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39193011771), cinco dos 70 controles puros falharam com `SOURCE_REFUSED`. O [Admin navegador 39192967799](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39192967799) também falhou em controles puros, incluindo `369 !== 366`. A [Fundação 39193011575](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39193011575) repetiu esses bloqueios. Os cenários reais de navegador desses dois workflows não chegaram a executar; não atribuir essa falha a SMTP, credenciais, banco pessoal ou ao plano de hospedagem.

1. **Pin do middleware anterior às páginas legais:** o relay exigia 1.809 bytes/SHA-256 `f57cf49d860aa695cac1e16d29a3ec8db8eb7b87c57bc8f5471f68b495ad9c66`. A inclusão de `/privacidade` e `/termos-de-servico` em `e76f323` resulta em 1.847 bytes/SHA-256 `156e39172b77003b3ac9b6f08803b64ed39a126d31d44c6ffe40d761f9f6dd3c`. Comparação do delta confirmou que o matcher de exclusão de assets e as demais regras permanecem iguais. A recusa pelo pin antigo era correta.
2. **Manifesto Admin incompleto:** a seção legal de Configurações acrescentou três imports ao fechamento finito: `src/components/features/configuracoes/settings-legal-section.tsx`, `src/components/ui/legal-links.tsx` e `src/components/ui/legal-links.css`. A derivação real passou de 366 a 369 fontes Git, preservando 60 dependências. A declaração TypeScript ainda dizia 352; ela também precisava concordar com o contrato real. Recovery permanece com 201 fontes Git/60 dependências.

## Correção revisada

- Atualizar somente o pin exato do middleware, preservando os hashes das dependências Next e todas as qualificações fechadas.
- Provar a qualificação pelo acesso real e limitado aos arquivos públicos, manter o matcher estático literal e recusar páginas legais, Auth e API como autoridade de asset.
- Corrigir tamanho das fixtures negativas de tipo de arquivo/symlink para que exercitem seu predicado alvo, em vez de falhar prematuramente por tamanho antigo.
- Atualizar manifesto/declaracão Admin para 369/60; exigir os três imports conhecidos e recusar o universo antigo incompleto, preservando recusa a duplicatas, hashes/paths inválidos e fontes ausentes.

Não houve alteração do middleware, da aplicação, da allowlist de requisições, dos deadlines, dos specs de navegador, do protocolo de cleanup ou dos workflows. Não se limpou mapa de pendências, fabricou terminal, ignorou erro ou substituiu confirmação individual por descarte da infraestrutura. Os testes continuam exigindo os efeitos e settlements originais. Nenhum serviço pessoal ou perfil privado foi acessado.

## Validação

Root revisou os dois deltas independentes e ocupa um único processo pesado por vez, em Node 24. O relatório de fechamento da PR identifica o SHA corrigido e os runs novos; não transfere o PASS de outro commit ou confunde controles sintéticos com a stack real descartável do CI. As falhas históricas da #43 permanecem até os aceites completos da issue serem demonstrados.

O primeiro lote local executou 233 controles: 232 passaram e a asserção restante ainda fixava 366 no teste binário do coletor. Ela foi corrigida para 369; essa tentativa não é registrada como PASS. O teste do relay passou 25/25. A conferência posterior e o CI devem ser registrados com seus resultados próprios, mantendo falhas visíveis.

Revisões cruzadas independentes, somente leitura, confirmaram o delta de três imports, a identidade exata do middleware e a preservação dos gates. O coletor mantém caminhos canônicos, limites, Git blob, SHA-256, versões pinadas e 60 dependências únicas; a atualização não substitui eventos terminais nem autoriza apagar pendências. O portão TypeScript específico `tests/scripts/admin-browser.types.mts` passou. O teste binário corrigido passou 1/1 isolado antes da repetição do lote integrado.

**Lote final local: 258/258 controles PASS**, zero falhas/skips, arquivos de relay, Admin suporte/CI e Recovery, com `--test-concurrency=1`. Lint dos cinco arquivos de código/declaracão alterados passou com zero warnings. Artefato TAP ignorado: `work/ci-auth-admin-pr70-20261019/pure-controls.tap`. Nenhum build ou teste conectado pessoal foi necessário para a mudança de manifesto; os cenários reais Linux/Supabase descartável permanecem nos workflows originais para conferência do novo SHA. Nenhum resultado hospedado é antecipado por este PASS local.
