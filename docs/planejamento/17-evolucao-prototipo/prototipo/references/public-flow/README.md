# Fontes de Termos e Privacidade

Consulta remota somente leitura em 20/10/2026 ao repositório [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro).

## Fonte selecionada

[PR #70 — feat: adiciona páginas legais e guia de preparação do produto](https://github.com/kauanbarateli/Segundo-Cerebro/pull/70), aberto como draft, não incorporado. Branch `codex/paginas-legais-e-checklist-20261018`, head `b67f58ac3973fcef5f45daa23f36cdf84432a3fb`.

O texto está em [src/lib/legal/documents.ts](https://github.com/kauanbarateli/Segundo-Cerebro/blob/b67f58ac3973fcef5f45daa23f36cdf84432a3fb/src/lib/legal/documents.ts), versão **0.2 · revisão do uso atual**, atualizada em 18/10/2026. São 13 seções de Termos e 14 de Privacidade. Metadados, resumo, avisos, parágrafos, itens e referências foram preservados. O estado draft não comprova aprovação jurídica final.

A comparação remota mostra esse head 22 commits à frente de `main` (`f3d18960a41076e99aa60dcc9f6b46967970ebb5`), sem commits atrás. A branch principal ainda não contém o documento legal. Por isso o PR #70 é a fonte pertinente para reproduzir a leitura solicitada. Os cinco arquivos de `conheca-source/` vêm do mesmo head, incluindo os links legais acrescentados ao rodapé.

## Oferta mensal e limites da minuta

[PR #69 — docs: planeja contratação Asaas e onboarding do MVP](https://github.com/kauanbarateli/Segundo-Cerebro/pull/69), também aberto/draft, head `3433c49b9e0e59546ed564222f3c3de814e71098`, registra **R$ 29,90/mês**. É a base do PR #70 e continua sendo planejamento.

Os textos legais dizem que a contratação permanece futura, que a página não autoriza cobrança e que o checkout ainda não está disponível. A interface do protótipo pode demonstrar a oferta pedida pelo usuário, mantendo o aviso de simulação e os textos originais. Não reinterpretar o aviso como autorização para vender nem reescrever cláusulas para fazê-las parecer um contrato de assinatura ativa.

Cancelamento comum, arrependimento, retenção comercial e qualificação de fornecedores têm limites próprios no texto. A demonstração não comprova implantação ou liberação de produção. Os avisos `notice` e as referências `links` devem aparecer na interface.

## Artefatos

- `fontes.json`: PRs, estados, heads, versão, paths, blob SHAs, URLs imutáveis, justificativa e conflitos.
- `termos.md` e `privacidade.md`: transcrições legíveis completas, sem edição do teor.
- `source-pr70/`: documento TS original, páginas, renderizador e documentos de procedência/publicação.
- `source-pr69/`: planejamento comercial de referência.
- `conheca-source/`: landing-page.tsx, landing.css, landing-header.tsx, content.ts e product-shot.tsx do head selecionado.
- `../../legal-content.js`: módulo isolado `window.App.legalContent={terms,privacy}`.

Nenhum arquivo do checkout foi editado. Nenhum PR, serviço, deploy ou publicação foi alterado.

