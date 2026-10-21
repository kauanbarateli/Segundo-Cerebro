# Aplicação integral das evoluções do protótipo

Planejamento de execução, solicitado em **21/10/2026**. Este pacote transforma a entrega visual mais recente em trabalho verificável sobre o produto existente. **Não implementa as funcionalidades no runtime nem comprova homologação.**

## Comece aqui

1. Leia [base, escopo e precedência](01-base-e-escopo.md) e o [mapa de lacunas](02-mapa-de-lacunas.md).
2. Confira as [decisões confirmadas e contratos](03-decisoes-e-contratos.md).
3. Execute os lotes na [ordem de implementação](04-execucao-e-issues.md), usando as [referências visuais](05-referencias-e-design.md).
4. Registre os resultados segundo o [aceite e plano de testes](06-aceite-e-validacao.md).
5. O [prompt para a frente atual](07-prompt-execucao.md) inclui retomada das issues #52/#53, RAM e Vercel Pro.

Abra [`prototipo/index.html`](prototipo/index.html) localmente para navegar. Não é necessário build. Para servir por HTTP: `python -m http.server 41732 --bind 127.0.0.1 --directory docs/planejamento/17-evolucao-prototipo/prototipo`. Endereço: `http://127.0.0.1:41732/index.html`. Não inserir dados pessoais: integrações e cobrança são demonstrativas.

O snapshot conserva **303 arquivos** da entrega, com SHA-256 em [prototipo-origem.json](prototipo-origem.json). Inclui JS/CSS, imagens, fonte/licença, design system, referências e evidências históricas. As [capturas desta consolidação](capturas/README.md) são separadas dos registros anteriores. `node docs/planejamento/17-evolucao-prototipo/scripts/verify-package.mjs` verifica a integridade do pacote.

## Resultado esperado no produto

Mesma identidade DS 2.1 e funcionamento conectado: início personalizado; avatar, capas e imagens privadas; Lista/Kanban; calendário lateral em lista com participantes; captura formatada; hábitos com imagens, cadência histórica e análise; financeiro com cartões, planejamento e metas; landing enxuta, contratação real e onboarding simplificado.

O layout anterior já entrou por [PR #48](https://github.com/kauanbarateli/Segundo-Cerebro/pull/48), e a [issue #46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46) está fechada. O trabalho é evoluir essa base, sem recomeçar. Comercial/onboarding reutilizam [SPEC-07 #50](https://github.com/kauanbarateli/Segundo-Cerebro/issues/50), [PR #69](https://github.com/kauanbarateli/Segundo-Cerebro/pull/69) e fontes legais do [PR #70](https://github.com/kauanbarateli/Segundo-Cerebro/pull/70).

**Duas decisões confirmadas nesta conversa:** aportes são reservas virtuais dentro da conta, sem despesa nem redução do saldo bancário; alterações de frequência de hábitos preservam o passado. Elas prevalecem sobre simplificações divergentes do HTML de referência.

## Leitura técnica por área

- [Shell, mídia, Início, Projetos, Kanban, Calendário, Capturar e Conhecimento](auditoria-interface.md).
- [Hábitos, Financeiro, recorrências e metas](auditoria-financeiro-habitos.md).
- [Landing, checkout, onboarding, legais e coordenação](auditoria-comercial.md).

As auditorias apontam contratos, arquivos e testes reais da base consultada. `OBSERVADO` significa encontrado no código/documento; não é selo de validação. `RECOMENDADO` identifica a proposta de integração; nomes de campos novos não são APIs existentes.
