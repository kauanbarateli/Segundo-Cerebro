# Capturas do snapshot final

A matriz original das 12 áreas foi gerada em 17/10/2026 no navegador integrado Chromium, servindo a pasta `prototipo/` deste pacote via HTTP local. Estado inicial fictício, data demonstrativa 17/10/2026, sem login ou conexão real. Capturas desktop com viewport solicitado de 1440 × 1000; mobile com 390 × 844. Barras de rolagem podem reduzir a largura útil capturada. Imagens sem sufixo `viewport` são de página inteira: elementos fixos continuam na posição do viewport inicial, não são uma sobreposição em toda a página.

## Todas as 12 telas — lateral expandida

| Tela | Claro | Escuro |
|---|---|---|
| Início | [Claro](inicio-claro-expandida.png) | [Escuro](inicio-escuro-expandida.png) |
| Capturar | [Claro](capturar-claro-expandida.png) | [Escuro](capturar-escuro-expandida.png) |
| Tarefas | [Claro](tarefas-claro-expandida.png) | [Escuro](tarefas-escuro-expandida.png) |
| Calendário | [Claro](calendario-claro-expandida.png) | [Escuro](calendario-escuro-expandida.png) |
| Conhecimento | [Claro](conhecimento-claro-expandida.png) | [Escuro](conhecimento-escuro-expandida.png) |
| Projetos | [Claro](projetos-claro-expandida.png) | [Escuro](projetos-escuro-expandida.png) |
| Hábitos | [Claro](habitos-claro-expandida.png) | [Escuro](habitos-escuro-expandida.png) |
| Financeiro | [Claro](financeiro-claro-expandida.png) | [Escuro](financeiro-escuro-expandida.png) |
| Cofre | [Claro](cofre-claro-expandida.png) | [Escuro](cofre-escuro-expandida.png) |
| Atividade | [Claro](atividade-claro-expandida.png) | [Escuro](atividade-escuro-expandida.png) |
| Integrações | [Claro](integracoes-claro-expandida.png) | [Escuro](integracoes-escuro-expandida.png) |
| Configurações | [Claro](configuracoes-claro-expandida.png) | [Escuro](configuracoes-escuro-expandida.png) |

## Lateral recolhida e mobile

- [calendario-claro-mobile-390.png](calendario-claro-mobile-390.png)
- [calendario-claro-recolhida.png](calendario-claro-recolhida.png)
- [calendario-escuro-mobile-390.png](calendario-escuro-mobile-390.png)
- [calendario-escuro-recolhida.png](calendario-escuro-recolhida.png)
- [inicio-claro-mobile-390-viewport.png](inicio-claro-mobile-390-viewport.png)
- [inicio-claro-mobile-390.png](inicio-claro-mobile-390.png)
- [inicio-claro-recolhida.png](inicio-claro-recolhida.png)
- [inicio-escuro-mobile-390.png](inicio-escuro-mobile-390.png)
- [inicio-escuro-recolhida.png](inicio-escuro-recolhida.png)
- [sidebar-claro-mobile-390-viewport.png](sidebar-claro-mobile-390-viewport.png)
- [sidebar-claro-mobile-390.png](sidebar-claro-mobile-390.png)

## Uso e limites

Compare primeiro Início e Calendário nos dois temas e nos dois estados de lateral; confira depois as 12 superfícies. Os controles de tema e navegação foram operados pela interface para obter estas capturas. Foram revisadas visualmente amostras de Início claro, Calendário escuro recolhido, agenda mobile e menu mobile. A matriz inteira foi registrada; isso não equivale a uma nova auditoria funcional completa de cada tela.

As imagens e o código representam a mesma paleta DS 2.1. Não usar capturas de revisões anteriores com fundo azulado/rosa. As provas de produção, leitor de tela, zoom, dispositivos físicos e jornadas conectadas continuam pendentes da implementação, conforme [aceite](../05-aceite-validacao.md).

## Onboarding simplificado — referência por etapa

Série adicional capturada em 17/10/2026 no fuso de Fortaleza (18/10 em UTC), em Microsoft Edge 155.0.4283.45 isolado, sem perfil pessoal, usando o protótipo local por `file://` offline. Não acessou contas ou serviços reais. A fonte é funcionalmente idêntica à cópia atual de `prototipo/`; a normalização de linhas e os hashes antes/depois da cópia estão nos [metadados](../evidencias/onboarding-simplificado/capturas.json).

As 18 imagens de desktop usam viewport 1280 × 900, detalhes recolhidos e dados fictícios inseridos pela interface. Movimento reduzido e animações de captura desativadas estabilizam o enquadramento; essa série não comprova fluidez das transições. As evidências anteriores de comportamento e movimento estão no [índice](../evidencias/README.md).

| Tela | Claro | Escuro |
|---|---|---|
| Boas-vindas | [Claro](onboarding/boas-vindas-claro.png) | [Escuro](onboarding/boas-vindas-escuro.png) |
| 1. Seu nome | [Claro](onboarding/nome-claro.png) | [Escuro](onboarding/nome-escuro.png) |
| 2. Sua agenda | [Claro](onboarding/agenda-claro.png) | [Escuro](onboarding/agenda-escuro.png) |
| 3. Um hábito | [Claro](onboarding/habito-claro.png) | [Escuro](onboarding/habito-escuro.png) |
| 4. Um projeto | [Claro](onboarding/projeto-claro.png) | [Escuro](onboarding/projeto-escuro.png) |
| 5. Uma tarefa | [Claro](onboarding/tarefa-claro.png) | [Escuro](onboarding/tarefa-escuro.png) |
| 6. Suas notas | [Claro](onboarding/notas-claro.png) | [Escuro](onboarding/notas-escuro.png) |
| 7. Outros espaços | [Claro](onboarding/outros-espacos-claro.png) | [Escuro](onboarding/outros-espacos-escuro.png) |
| Resumo personalizado | [Claro](onboarding/resumo-claro.png) | [Escuro](onboarding/resumo-escuro.png) |

Mobile da mesma série: [nome claro em 320 × 780](onboarding/nome-mobile-320-claro.png) e [resumo escuro em 390 × 844](onboarding/resumo-mobile-390-escuro.png). Projeto claro, hábito escuro e as duas telas móveis foram inspecionados visualmente; a série não é uma nova auditoria integral do produto.

### Estados complementares do refinamento local

Capturas preservadas da validação anterior do mesmo onboarding simplificado, em Edge isolado. Desktop 1280 × 900; mobile 390 × 844 ou 320 × 780, conforme o nome e o [relatório de medições](../evidencias/onboarding-simplificado/navegador.json).

- Abertura: [claro](onboarding/preview-onboarding-claro.png), [escuro](onboarding/preview-onboarding-escuro.png).
- Nome: [desktop](onboarding/profile-desktop-light.png), [390 px](onboarding/profile-390-light.png).
- [Agenda](onboarding/calendar-desktop-light.png), [hábito adicionado](onboarding/habit-added-desktop.png), [tarefa](onboarding/task-desktop-light.png), [notas](onboarding/knowledge-desktop-light.png) e [outros espaços](onboarding/other-desktop-dark.png).
- Resumo: [desktop escuro](onboarding/summary-desktop-dark.png), [320 px claro](onboarding/summary-320-light.png), [390 px](onboarding/preview-onboarding-mobile.png).

A especificação [07-onboarding-simplificado.md](../07-onboarding-simplificado.md) define a adaptação à aplicação real. Contas fictícias, quantidades e nomes dos exemplos não são conteúdo de produção; as apresentações de Arquivos e Cofre respeitam o corte vigente do produto.
