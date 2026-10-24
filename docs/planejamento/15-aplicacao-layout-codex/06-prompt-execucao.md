# Prompt para a frente executora

Copie o texto abaixo. Os caminhos são relativos à raiz do repositório; todo o material está versionado. Se este planejamento ainda não estiver em `main`, obtenha a branch `codex/planejamento-layout-ds21` e registre o SHA usado como referência. Depois da incorporação, trabalhe sobre a base atual e reconcilie diferenças sem perder o pacote.

---

Continue a aplicação do layout final Codex no projeto **kauanbarateli/Segundo-Cerebro**, incluindo o onboarding simplificado do [PR de planejamento #47](https://github.com/kauanbarateli/Segundo-Cerebro/pull/47), seguindo a issue de execução [#46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46) e coordenando o aceite com [#44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44), [#2](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2), [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12), [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) e [#7](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7). Preserve o trabalho já realizado pela frente: inventarie o que está implementado e aplique os deltas, sem recomeçar lotes entregues.

Leia integralmente `AGENTS.md`, `CONTEXT.md`, os ADRs pertinentes e estes arquivos de `docs/planejamento/15-aplicacao-layout-codex/`, nesta ordem:

1. [README.md](README.md): precedência, como executar o snapshot e limites.
2. [01-referencias.md](01-referencias.md): originais, instruções das quatro coleções de skills e revisões fixadas.
3. [02-especificacao-visual.md](02-especificacao-visual.md): medidas, tokens, estados, responsividade e conciliação das diferenças com o DS.
4. [03-mapa-integracao.md](03-mapa-integracao.md): correspondência entre as 12 áreas, o onboarding e o código real, capacidades a preservar e testes existentes.
5. [04-plano-execucao.md](04-plano-execucao.md): lotes e dependências.
6. [05-aceite-validacao.md](05-aceite-validacao.md): matriz visual, seis jornadas existentes, jornada de onboarding e evidências exigidas.
7. [07-onboarding-simplificado.md](07-onboarding-simplificado.md): nove telas, copy, medidas, transições, rascunhos e diferenças entre demo e produção.
8. [capturas/README.md](capturas/README.md), [evidencias/README.md](evidencias/README.md), `prototipo/DESIGN.md`, `prototipo/PRODUCT.md`, `prototipo/.impeccable/surfaces/onboarding.md` e `prototipo/VALIDACAO.md`.

Abra `prototipo/index.html` via servidor local e percorra as 12 telas nos dois temas. Confira as nove imagens de `referencias/`, em especial `405324035233224479.jpg` para o calendário. Confira o manifesto com `node docs/planejamento/15-aplicacao-layout-codex/verificar-pacote.mjs` e registre a revisão de referência. O mapa foi inspecionado na base `61d03c7`; verifique mudanças posteriores e o trabalho paralelo do [PR #45](https://github.com/kauanbarateli/Segundo-Cerebro/pull/45) antes de tocar arquivos compartilhados.

Reproduza composição, hierarquia, navegação ativa, sidebar retrátil, calendário, modelos de tema e microinterações. As cores devem ser exatamente as de `design-system/tokens/tokens.json` (DS 2.1), usando o pipeline oficial. Não recupere as paletas antigas das imagens. Preserve Geist e a marca. Use os aliases locais e adaptações documentadas: fonte de campos ≥16 px, campos de 52 px, alvos ≥44 × 44 px, contraste e foco nos fundos reais, motion CSS de 120/180 ms e movimento reduzido conforme DS. Não altere tokens globais silenciosamente.

Implemente em React/Next e nos componentes existentes, mantendo persistência, contratos, isolamento por usuário, permissões, estado de envio, rotas profundas e rascunhos. Preserve TipTap/JSON/wiki-links/conflitos, as cinco abas e regras do Financeiro, hábitos completos, Cofre criptografado, Auth/Admin/PWA e sessões. O protótipo é referência visual: não transportar `window.App`, `innerHTML`, roteamento hash, localStorage demo, data fixa ou fuso Fortaleza para produção. Calendário mantém `src/core/tempo`, Google somente leitura e até duas contas; implementar Lista como apresentação/URL sem estender automaticamente o enum persistido. Compartilhar a apresentação das integrações em camada permitida, sem importação feature→feature nem ampliar entitlements.

Inclua o lote L3O: boas-vindas, sete passos opcionais (nome, agenda, hábito, projeto, tarefa, notas e outros espaços) e resumo. Reproduza a coluna de até 560 px, uma ação principal por tela, textos curtos, detalhes recolhidos, progresso discreto, opções de pular/pausar/retomar e resumo somente com escolhas. Confira as nove telas em claro/escuro no índice de capturas. Preserve o trabalho dos módulos e adapte os campos aos contratos reais; não copie limites, IDs ou a versão do estado demo como schema do produto.

Ofereça o onboarding após autenticação, sem bloquear usuários existentes ou rotas profundas. Documente persistência por usuário, retomada, validação antes de aplicar, falhas parciais e idempotência. Google usa o OAuth e o limite real de duas contas, com retorno seguro ao fluxo; a autorização externa pode ocorrer antes da confirmação final, diferentemente dos exemplos locais. Não criar Drive, upload ou guardar segredos no tutorial. Respeite vínculos reais entre tarefa, projeto e página e o estado atual das funcionalidades.

Siga os lotes L0–L5, incluindo L3O. Paralelize somente após estabilizar os contratos compartilhados. Use a Impeccable local e leia as referências complementares indicadas antes de aplicar critique/audit/distill/onboard/animate/polish; registre achados, modo e evidência. Não transforme este escopo visual em novas funcionalidades de Drive, IA, cobrança, colaboração ou grafo persistente. Não execute mudanças remotas de dados por necessidade de screenshot.

Entregue PR(s) de implementação com telas reais, capturas comparáveis nos dois temas e estados da sidebar, matriz mobile/intermediário/desktop, provas de teclado/foco/zoom/reduced motion e testes das seis jornadas existentes mais a de onboarding. Execute os gates pertinentes listados no documento 05 e separe implementado, validado e pendente. Os 31 testes e as capturas do tutorial local são referência do snapshot, não aceite da aplicação. Não encerre automaticamente #44 ou os épicos por concluir a camada visual; deixe a revisão final rastreável e não faça merge/deploy sem a autorização correspondente.
