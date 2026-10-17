# Prompt para a frente executora

Copie o texto abaixo. Os caminhos são relativos à raiz do repositório; todo o material está versionado. Se este planejamento ainda não estiver em `main`, obtenha a branch `codex/planejamento-layout-ds21` e registre o SHA usado como referência. Depois da incorporação, trabalhe sobre a base atual e reconcilie diferenças sem perder o pacote.

---

Implemente o layout final Codex no projeto **kauanbarateli/Segundo-Cerebro**, seguindo a issue de execução [#46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46) e coordenando o aceite com [#44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44), [#2](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2), [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12), [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) e [#7](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7).

Leia integralmente `AGENTS.md`, `CONTEXT.md`, os ADRs pertinentes e estes arquivos de `docs/planejamento/15-aplicacao-layout-codex/`, nesta ordem:

1. [README.md](README.md): precedência, como executar o snapshot e limites.
2. [01-referencias.md](01-referencias.md): originais, instruções das quatro coleções de skills e revisões fixadas.
3. [02-especificacao-visual.md](02-especificacao-visual.md): medidas, tokens, estados, responsividade e conciliação das diferenças com o DS.
4. [03-mapa-integracao.md](03-mapa-integracao.md): correspondência entre as 12 telas e o código real, capacidades a preservar e testes existentes.
5. [04-plano-execucao.md](04-plano-execucao.md): lotes e dependências.
6. [05-aceite-validacao.md](05-aceite-validacao.md): matriz visual, seis jornadas e evidências exigidas.
7. [capturas/README.md](capturas/README.md), [evidencias/README.md](evidencias/README.md), `prototipo/DESIGN.md`, `prototipo/PRODUCT.md` e `prototipo/VALIDACAO.md`.

Abra `prototipo/index.html` via servidor local e percorra as 12 telas nos dois temas. Confira as nove imagens de `referencias/`, em especial `405324035233224479.jpg` para o calendário. Confira o manifesto com `node docs/planejamento/15-aplicacao-layout-codex/verificar-pacote.mjs` e registre a revisão de referência. O mapa foi inspecionado na base `61d03c7`; verifique mudanças posteriores e o trabalho paralelo do [PR #45](https://github.com/kauanbarateli/Segundo-Cerebro/pull/45) antes de tocar arquivos compartilhados.

Reproduza composição, hierarquia, navegação ativa, sidebar retrátil, calendário, modelos de tema e microinterações. As cores devem ser exatamente as de `design-system/tokens/tokens.json` (DS 2.1), usando o pipeline oficial. Não recupere as paletas antigas das imagens. Preserve Geist e a marca. Use os aliases locais e adaptações documentadas: fonte de campos ≥16 px, campos de 52 px, alvos ≥44 × 44 px, contraste e foco nos fundos reais, motion CSS de 120/180 ms e movimento reduzido conforme DS. Não altere tokens globais silenciosamente.

Implemente em React/Next e nos componentes existentes, mantendo persistência, contratos, isolamento por usuário, permissões, estado de envio, rotas profundas e rascunhos. Preserve TipTap/JSON/wiki-links/conflitos, as cinco abas e regras do Financeiro, hábitos completos, Cofre criptografado, Auth/Admin/PWA e sessões. O protótipo é referência visual: não transportar `window.App`, `innerHTML`, roteamento hash, localStorage demo, data fixa ou fuso Fortaleza para produção. Calendário mantém `src/core/tempo`, Google somente leitura e até duas contas; implementar Lista como apresentação/URL sem estender automaticamente o enum persistido. Compartilhar a apresentação das integrações em camada permitida, sem importação feature→feature nem ampliar entitlements.

Siga os lotes L0–L5. Paralelize somente após estabilizar os contratos compartilhados. Use a Impeccable local e leia as referências complementares indicadas antes de aplicar critique/audit/animate/polish; registre achados, modo e evidência. Não transforme este escopo visual em novas funcionalidades de Drive, IA, cobrança, colaboração ou grafo persistente. Não execute mudanças remotas de dados por necessidade de screenshot.

Entregue PR(s) de implementação com telas reais, capturas comparáveis nos dois temas e estados da sidebar, matriz mobile/intermediário/desktop, provas de teclado/foco/zoom/reduced motion e testes das seis jornadas. Execute os gates pertinentes listados no documento 05 e separe implementado, validado e pendente. Não use as provas do snapshot como aceite da aplicação. Não encerre automaticamente #44 ou os épicos por concluir a camada visual; deixe a revisão final rastreável e não faça merge/deploy sem a autorização correspondente.
