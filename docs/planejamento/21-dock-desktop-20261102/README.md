# Dock opcional no desktop — plano de execução

02/11/2026 · **Planejamento e referência visual; não implementado no aplicativo.**

A navegação padrão continua sendo a sidebar. A pessoa poderá escolher a dock refinada no protótipo exclusivamente em **Configurações → Aparência → Navegação no computador**. No celular, a navegação existente permanece intacta.

## Leitura e ordem

1. [Contrato, decisões e integração](01-contrato-e-integracao.md).
2. [Layout de Configurações e da dock](02-layout-e-interacoes.md).
3. [Lotes de execução e validação](03-execucao-e-aceite.md).
4. [Prompt completo para outra frente](04-prompt-execucao.md).
5. [Referência reproduzível, screenshots e limites](referencia/README.md).
6. [Validação documental desta publicação](05-validacao-publicacao.md).

## Origem e precedência

**Confirmado pelo mantenedor:** dock opcional; sidebar por padrão; alteração apenas em Configurações; aplicação somente no desktop; transportar o acabamento refinado com Impeccable.

**Recomendação técnica deste plano, não resposta presumida do mantenedor:** guardar a variante localmente neste navegador, sem sincronização entre contas/aparelhos, seguindo a preferência atual de recolhimento da sidebar. Usar a faixa a partir de 1051 CSS px e dispositivo com ponteiro preciso disponível. Os detalhes e alternativas estão no contrato. São os defaults de execução propostos; uma opção por persistência na conta requer revisão explícita do plano antes de alterar banco/API.

Este pacote acrescenta uma variante ao shell e não substitui o [doc20](../20-entrega-inicial-20261031/README.md), seus módulos, gates e regras de negócio. Na navegação dock desktop, este acabamento prevalece sobre a sidebar da referência anterior; nas demais áreas, a autoridade visual vigente permanece. Mobile da demonstração da dock **não faz parte da entrega**.

## Base observada, não congelada para execução

- Main consultada e obtida por fetch: `c6cc0065a9e1b70d84b27ca7f82848611ce61ac1`.
- GitHub confirma PR [#120](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120) incorporada; não retomar sua branch antiga como base.
- Issues [#129](https://github.com/kauanbarateli/Segundo-Cerebro/issues/129) e [#132](https://github.com/kauanbarateli/Segundo-Cerebro/issues/132) retornaram fechadas como concluídas. São contexto e áreas de sobreposição, não tickets a reabrir automaticamente.
- O protótipo dock foi preparado anteriormente sobre o snapshot doc17 do checkout `e04ee04`. Suas 11 opções demonstrativas não são o catálogo atual de rotas.
- Nova implementação: branch sugerida `codex/dock-desktop-opt-in`, a partir da main **reconferida**. Esta branch documental não deve ser usada para substituir a main.

## Limites e estado da entrega

- **Pronto neste pacote:** especificação, contratos propostos, mapa real de código, referência TSX/CSS, capturas claro/escuro, reconstituição do protótipo e prompt.
- **Validado no protótipo original:** 11 controles; tooltip; menu mobile demonstrativo e Escape; dock contida em 768 px; foco visível; movimento reduzido sem ampliação; zero pageerror no percurso Edge headless. Capturas inspecionadas em 1440×900 e 390×844.
- **Pendente na aplicação:** preferências, SSR, catálogo real, restauração da sidebar, Configurações, mobile sem mudanças, overflow com Admin/ações atuais, CSP, testes e aceite conectado.
- Não se transporta PASS do protótipo para produção. Nenhum módulo, migration, credencial, conta externa ou dado real é alterado por este plano.
- Publicar documentos não libera merge/deploy. A proteção da branch documental no `vercel.json` impede Preview automático; produção permanece bloqueada para esta demanda.
