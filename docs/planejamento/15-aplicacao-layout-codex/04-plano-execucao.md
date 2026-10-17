# Plano de execução do layout Codex

**Status: planejamento; nenhuma interface de produção foi implementada por este pacote.** Base examinada: [`61d03c7`](https://github.com/kauanbarateli/Segundo-Cerebro/tree/61d03c7). O [PR #45](https://github.com/kauanbarateli/Segundo-Cerebro/pull/45) é paralelo e não foi incorporado. A execução será rastreada em **[#46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46)**, com aceite da [frente D #44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44).

O resultado esperado é aplicar a composição final do [protótipo](prototipo/index.html) à aplicação Next/React, conservando suas regras, dados, integrações e fluxos reais. O [mapa de integração](03-mapa-integracao.md) identifica os arquivos por superfície; [aceite e validação](05-aceite-validacao.md) define a evidência necessária para concluir o trabalho.

## 1. Ordem de leitura e autoridade

1. [AGENTS.md](../../../AGENTS.md), [CONTEXT.md](../../../CONTEXT.md), [decisões operacionais](../../implementation/decisoes-operacionais.md) e ADRs pertinentes.
2. Este pacote e os documentos do protótipo: [DESIGN](prototipo/DESIGN.md), [PRODUCT](prototipo/PRODUCT.md), [DIAGNOSTICO](prototipo/DIAGNOSTICO.md), [VALIDACAO](prototipo/VALIDACAO.md). Abrir o protótipo; screenshots isolados não descrevem as interações.
3. [DS 2.1 em tokens](../../../design-system/tokens/tokens.json), [guia do DS](../../../design-system/README.md), [doc 14](../14-prototipo-interacoes.md), [doc 04](../04-design-system.md) e [jornadas do doc 05](../05-arquitetura-de-produto.md#3-jornadas-âncora-critério-de-aceite-do-produto-inteiro).
4. As instruções originais das skills e referências documentadas no pacote e no DESIGN. O [Impeccable local](../../../.agents/skills/impeccable/SKILL.md) é a entrada exigida pelo repositório; ler integralmente antes de implementar.

As cores oficiais do DS 2.1 prevalecem sobre imagens e capturas anteriores à correção final. Composição, lateral, calendário, espaçamento e microinterações finais são o alvo visual novo. Registrar diferenças geométricas/tipográficas em relação ao doc 14 como OBSERVADO, INFERIDO ou RECOMENDADO; não apresentar uma proposta nova como token já vigente. Regras de produção prevalecem sobre simplificações da demonstração.

## 2. Decisões de integração antes do primeiro lote visual

| Tema | Decisão de execução | Limite e evidência |
|---|---|---|
| Agrupamento da lateral | Usar Meu dia/Meu contexto/Vida pessoal na organização padrão. A ordem e visibilidade personalizadas da conta continuam prioritárias; compor a navegação a partir de `getVisibleRoutes(policy)`. | Definir/testar comportamento quando a pessoa move módulos entre grupos; não perder preferências existentes nem transformar ocultar em revogar direito. |
| Persistência de recolhimento | Guardar somente preferência de apresentação no navegador, com fallback em memória. | Não reutilizar estado/chaves de dados do protótipo nem adicionar migration para este controle. Tema/lateral não remontam editores. |
| Integrações | A página `/integracoes` atual é vazia; a gestão Google real está no Calendário. Extrair/compor apresentação compartilhada em camada permitida, mantendo contratos existentes. | Sem importação feature→feature, duplicação de contas ou novo OAuth. Conciliar explicitamente permissões `integracoes` e `calendario`; API continua validando no servidor. |
| Calendário Lista | Adicionar a opção de apresentação com URL e janela mensal, reaproveitando eventos/filtros atuais. | `CalendarView` hoje é day/week/month. Não ampliar silenciosamente `default_calendar_view` persistido; sua eventual extensão é mudança de contrato separada. |
| Fuso e datas | Usar `FUSO_DO_APP` e helpers de `src/core/tempo`, hoje São Paulo. Datas do seed ficam no harness. | Fortaleza e 17/10/2026 do protótipo não se tornam regra do produto. Manter término exclusivo de dia inteiro e IDs Google. |
| Ações não idênticas à demo | Reaproveitar comandos reais para notas/tarefas/vínculos. Promover Captura escolhe Caderno e mantém origem. | Não substituir TipTap, finanças fundidas, pausas de hábitos ou criptografia por funções locais do protótipo. Registrar qualquer lacuna funcional como pendência vinculada. |
| Medidas de UI | Mapear os valores finais para os componentes/tokens existentes e registrar as mudanças aprovadas. | Não copiar `refinements.css` como segunda cascata global nem alterar cores oficiais para acomodar medidas. |

Estas decisões orientam trabalho autorizado; não são uma autorização genérica para alterar modelo de dados, autenticação ou integrações. Divergência material encontrada na base atual deve ser registrada em [#46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46) com a solução proposta e impacto no aceite.

## 3. Lotes e dependências

| Lote | Trabalho e arquivos de entrada | Dependência | Saída revisável |
|---|---|---|---|
| L0 · Preparação | Confirmar base/branch, ler instruções, abrir protótipo final, inventariar diferenças da base atual e PR #45; executar critique/audit inicial e priorizar achados por impacto; registrar decisões da seção 2. | Nenhuma | Inventário de referência, decisões e matriz de testes; nenhuma mudança de domínio por suposição. |
| L1 · Tokens e primitivas | `design-system/`, `src/components/ui/`, `src/app/design-system/`, `src/app/globals.css`. Escala, superfície, campos/botões/ícones, foco, estados, motion e modelos de tema. | L0 | Showcase claro/escuro atualizado e contratos preservados; geração/validação do DS, testes de UI/tema. |
| L2 · Shell e navegação | `src/components/layout/workspace-shell.*`, `navigation-icon.tsx`, `command-palette.*`, `src/components/theme/`, `src/lib/navigation/`, `src/lib/theme.ts`. | L1 | Sidebar persistente, cabeçalho/mobile, dicas/ativos, tema e busca; evidência de teclado, sem perda de rascunho/remontagem. |
| L3A · Trabalho e conhecimento | Início, Capturar, Tarefas, Conhecimento e Projetos nos caminhos do mapa. | L2 | Layout aplicado aos fluxos reais, TipTap/origem/vínculos/promoção preservados; verificações das jornadas 1, 2 e 4. |
| L3B · Agenda e integrações | Calendário, timeline/projeções, Lista, filtros, drawer e apresentação compartilhada Google/Integrações. | L2 e decisões Lista/Integrações | Visual comparável à referência principal, períodos/URL, estados de conexão e nota de reunião preservados; jornada 5. |
| L3C · Vida pessoal | Hábitos, Financeiro, Cofre, Configurações e Atividade. | L2 | Todos os controles existentes sob a nova linguagem, privacidade/segurança intactas; jornadas 2, 3 e 6. |
| L4 · Compatibilidade | Auth, Admin, sessões, PWA, Ajuda, erros e landing diante das mudanças compartilhadas. | L1/L2; convergência L3 | Nenhuma capacidade removida por não estar no protótipo; política, tokens e layout continuam compatíveis. |
| L5 · Convergência e aceite | Diagnóstico/critique, audit, polish; testes, capturas e revisão final de diffs. | L3A/B/C + L4 | Relatório por commit/ambiente, checklist do aceite, CI confirmada e pendências explícitas para #44. |

L3A/L3B/L3C podem rodar em paralelo após L2 estabilizar. Atribuir um dono aos tokens, primitivas e shell; equipes de módulo não alteram CSS global simultaneamente. Dentro de L3A, conhecimento/editor e listas podem ser divididos por arquivo, preservando o contrato comum de vínculos. Calendário e Integrações devem permanecer na mesma frente de composição para evitar estado duplicado. Cada integração exige revisão do diff e evidência antes de seguir ao próximo lote.

Não exigir que um único PR gigante contenha toda a implementação: [#46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46) pode acompanhar PRs por lote, com referência recíproca e sem encerrar #44 antes do aceite completo. A aprovação do PR deste pacote aprova o plano/referência, não atesta a execução dos lotes.

## 4. Escopo preservado em todos os lotes

- Monolito modular: UI não importa feature; feature não importa outra; Núcleo não importa React/Next/SDK; infraestrutura de banco permanece fora do browser. Rodar o portão de dependências.
- Usuário como unidade de isolamento; Entitlement e Preferência separados; guardas no servidor e nas chamadas diretas; dados e rascunhos limpos ao trocar/encerrar sessão.
- Auth real, telas de recuperação/troca de senha, logout POST, avatar privado, sessões próprias e Admin com privilégios continuam presentes.
- Google somente leitura, até duas contas, fontes reais, reautorização/revogação pendente, sync por período, vínculos e lembretes existentes.
- TipTap/JSON, conflito/versionamento, rascunhos, árvore/cadernos, backlinks, lixeira/restauro e origem de promoção continuam funcionais.
- Centavos inteiros, modelo financeiro fundido e cinco abas; ciclos/fatura/transferências/estados/orçamentos existentes não são reduzidos ao demo.
- Cadências, pausas globais/individuais, sequência e histórico de hábitos; criptografia cliente, recuperação e ciclo de bloqueio/cópia do Cofre.
- PWA, safe areas, compartilhar/capturar, offline de escopo vigente; sem inventar outbox/sincronização a partir da persistência local do protótipo.
- Estado de rede real: skeleton, erro, retry, resultado desconhecido e confirmação do mesmo comando; feedback de sucesso somente após confirmação pertinente.

Ficam fora da execução visual: reintrodução do Drive no MVP, grafo persistente, IA, colaboração, cobrança, Open Finance, escrita Google, Gmail/ClickUp e Web Push. Estruturas/dados históricos não são apagados. Nenhum passo do plano exige reset/seed, migrations remotas, deploy ou acesso a contas pessoais para criar evidência visual.

## 5. Rastreabilidade com issues

| Referência | Uso no trabalho |
|---|---|
| [#46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46) | Implementação nova deste layout; registrar lotes, decisões, PRs, evidência e pendências. |
| [#44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44) | Aceite da frente D; resultado independente do merge deste planejamento. |
| [#2](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2), [#7](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7), [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12), [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) | Pais abertos de contexto/coordenação. Ler conteúdo vigente e ligar os lotes pertinentes; não encerrar automaticamente por alteração de aparência. |
| [#9](https://github.com/kauanbarateli/Segundo-Cerebro/issues/9), [#10](https://github.com/kauanbarateli/Segundo-Cerebro/issues/10), [#11](https://github.com/kauanbarateli/Segundo-Cerebro/issues/11) | Históricos fechados de base visual; consultar contratos e evidências, não presumir trabalho pendente. |
| [#22](https://github.com/kauanbarateli/Segundo-Cerebro/issues/22), [#23](https://github.com/kauanbarateli/Segundo-Cerebro/issues/23), [#26](https://github.com/kauanbarateli/Segundo-Cerebro/issues/26), [#27](https://github.com/kauanbarateli/Segundo-Cerebro/issues/27), [#28](https://github.com/kauanbarateli/Segundo-Cerebro/issues/28) | Históricos fechados dos fluxos já existentes; conservar as regressões cobertas por seus harnesses. |
| [#30](https://github.com/kauanbarateli/Segundo-Cerebro/issues/30), [#31](https://github.com/kauanbarateli/Segundo-Cerebro/issues/31), [#32](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32), [#33](https://github.com/kauanbarateli/Segundo-Cerebro/issues/33), [#34](https://github.com/kauanbarateli/Segundo-Cerebro/issues/34), [#37](https://github.com/kauanbarateli/Segundo-Cerebro/issues/37) | Históricos fechados de capacidades/validações. Ausência da tela no demo não autoriza remover a capacidade. |
| [PR #45](https://github.com/kauanbarateli/Segundo-Cerebro/pull/45) | Frente paralela não incorporada à análise; reavaliar base e colisões de arquivos antes de implementar. |

Os estados acima são o retrato consultado durante a consolidação, não uma promessa de que permanecerão iguais. Verificar estado atual antes de atualizar issues. Não usar `Closes #44` nem fechar os pais no PR de planejamento.

## 6. Entrega de cada lote

Cada PR de execução deve informar problema/resultado, arquivos/contratos alterados, referências visuais usadas, regressões protegidas, testes realmente executados e pendências. Referenciar o commit das capturas e os estados relevantes, incluindo claro/escuro e responsividade. Uma captura bonita com fixtures não comprova persistência, isolamento ou integração real; o relatório separa essas evidências conforme [05-aceite-validacao](05-aceite-validacao.md).
