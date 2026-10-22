# SPEC-08 — Aplicar as evoluções integrais do protótipo ao produto

Consolidar o layout e as interações criados até21/10/2026 sobre o produto existente, preservando dados e contratos reais. A fundação anterior entrou pelo PR#48 e a issue#46 está fechada; esta spec trata o delta posterior.

## Pacote de execução

[README](https://github.com/kauanbarateli/Segundo-Cerebro/blob/codex/planejamento-prototipo-integral-20261021/docs/planejamento/17-evolucao-prototipo/README.md), [mapa de lacunas](https://github.com/kauanbarateli/Segundo-Cerebro/blob/codex/planejamento-prototipo-integral-20261021/docs/planejamento/17-evolucao-prototipo/02-mapa-de-lacunas.md), [decisões/contratos](https://github.com/kauanbarateli/Segundo-Cerebro/blob/codex/planejamento-prototipo-integral-20261021/docs/planejamento/17-evolucao-prototipo/03-decisoes-e-contratos.md), [ordem e dependências](https://github.com/kauanbarateli/Segundo-Cerebro/blob/codex/planejamento-prototipo-integral-20261021/docs/planejamento/17-evolucao-prototipo/04-execucao-e-issues.md), [referências](https://github.com/kauanbarateli/Segundo-Cerebro/blob/codex/planejamento-prototipo-integral-20261021/docs/planejamento/17-evolucao-prototipo/05-referencias-e-design.md), [aceite](https://github.com/kauanbarateli/Segundo-Cerebro/blob/codex/planejamento-prototipo-integral-20261021/docs/planejamento/17-evolucao-prototipo/06-aceite-e-validacao.md), [prompt](https://github.com/kauanbarateli/Segundo-Cerebro/blob/codex/planejamento-prototipo-integral-20261021/docs/planejamento/17-evolucao-prototipo/07-prompt-execucao.md).

Snapshot integral de303arquivos +55capturas atuais, fontes/licenças/ativos/estados e manifesto/verificador. Base consultada: main f3d18960a41076e99aa60dcc9f6b46967970ebb5. PR69 comercial e PR70 legal foram considerados; trabalho local da outra frente pode estar adiante e deve ser preservado.

## Escopo

Mídia privada e avatar superior; Início/Projetos com capas e hábitos com imagens; Kanban; Calendário em lista e participantes; Capturar formatado e promoção; hábitos com vigência e desempenho; painel/cartões/limites/recorrências/metas; convergência da landing/checkout/onboarding e validação cruzada.

Decisões confirmadas pelo mantenedor: aportes são **reservas virtuais na própria conta** e alterações de cadência **preservam o passado**. Nenhum transplante de motor demo para produção. Participantes usam foto autorizada quando disponível ou iniciais; Calendar Events não fornece retratos.

## Tickets

- [ ] #72 — T-047: Personalizar imagens privadas, avatar e composição do Início/Projetos
- [ ] #73 — T-048: Adicionar Kanban acessível sobre as tarefas existentes
- [ ] #74 — T-049: Evoluir calendário em lista com participantes e contexto lateral
- [ ] #75 — T-050: Persistir Capturar formatado e preservar promoção para Conhecimento
- [ ] #76 — T-051: Evoluir Hábitos com imagens, histórico de cadência e desempenho
- [ ] #77 — T-052: Aplicar painel financeiro, lançamentos e cartões sem regredir regras
- [ ] #78 — T-053: Expor limites mensais e recorrências finitas com pausa/retomada
- [ ] #79 — T-054: Criar metas com imagens e reservas virtuais por conta
- [ ] #80 — T-055: Convergir landing e onboarding para o protótipo atualizado
- [ ] #81 — T-056: Validar integração do novo protótipo e retomar testes #52/#53

## Coordenação e aceite

- Comercial/onboarding reutilizam #50–#68, especialmente #52/#53/#62–#65, sem criar sistemas duplicados.
- Preservar WIP/checkpoint da frente; após aplicar mudanças, medir RAM livre novamente e retomar testes#52/#53 com pelo menos1GB livre, um processo pesado/worker por vez.
- VercelPro foi informada pelo mantenedor: substitui impedimento histórico Hobby; checks/destino/migrations supervisionadas e aceite comercial permanecem.
- [ ] Todos os lotes atendem J1–J12, contratos, testes reais e matriz visual do pacote, com estados negativos e privacidade.
- [ ] Evidências do SHA implementado alimentam#44 e#68, preservando pendências próprias. Não fechar este épico pela publicação de planejamento.

**Disponível:** planejamento e referência. **Implementação/validação do delta:** pendentes por ticket. Este pacote não aplica banco, executa cobrança, testa o produto conectado ou faz deploy.
