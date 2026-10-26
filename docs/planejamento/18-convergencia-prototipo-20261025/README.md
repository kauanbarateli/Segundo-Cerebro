# Convergência ao protótipo — plano único de retomada

**Execução retomada em 26/10/2026 (D-084):** o mantenedor autorizou implementar este plano em quatro frentes. O [registro de execução](../../implementation/retomada-doc18-20261026.md) atualiza a pausa descrita pela auditoria histórica abaixo. Merge e deploy permanecem bloqueados.

Auditoria de 25–26/10/2026. **Esta entrega investiga, documenta e organiza issues; não implementa correções.** A execução permanece pausada. Merge e produção continuam bloqueados. O protótipo define o resultado visual; a análise determina como chegar a ele preservando as regras reais.

## Comece por estes cinco documentos

1. [Diagnóstico técnico e reconciliação do handoff](01-diagnostico.md).
2. [Comparação por superfície e evidência visual](02-comparacao.md).
3. [Mapa de implementação, branches, ordem e prompts](03-execucao.md).
4. [Decisões, adaptações e perguntas abertas](04-decisoes.md).
5. [Publicação, validações e limitações](05-publicacao.md).

O [inventário](inventario.md) relaciona todas as issues, PRs e branches observadas. Os corpos anteriores das issues revisadas ficam em [histórico](historico-issues/README.md); as issues remotas passam a ser a referência de execução por tarefa. Este pacote complementa o [handoff congelado da PR #120](../../implementation/handoff-retomada-20261025-pausa-mvp.md), sem reescrever seus arquivos, hashes ou evidências.

## Bases fixadas

| Fonte | Identidade e uso |
|---|---|
| Código candidato / PR #120 | `ad24a6b3ffbf720f9991a791e580bae82dfe68ce`, árvore `f3b48b1e0a9e47fe066f022a76478b4f88772d7b`; branch `codex/mvp-goals-terminal-20261023`. Referência das linhas de código nesta análise. |
| Protótipo indicado pelo mantenedor | D: → Prótotipos/Protótipo - Codex. **303 arquivos comuns idênticos por SHA-256** ao [snapshot navegável do doc17](../17-evolucao-prototipo/prototipo/index.html); os dois adicionais são prompts Markdown. [Proveniência](evidencias/proveniencia.json). |
| Chat de origem | “Construa protótipo do Segundo Cérebo”, thread `01a147d5-e165-7752-a3b0-d81b3eb08e8f`, consultado nesta auditoria. O snapshot em GitHub evita depender desse chat ou de D: na retomada. |
| Preview inspecionado | Source `3403a5aa1901c166e6cfc1206848bfdc1c34957a`, deployment `dpl_5SAkeYyRFkWYRSaStkfrQHJjL1N4`, READY confirmado pela Vercel. [Abrir Preview](https://segundo-cerebro-of-git-codex-homo-efc4bb-kauanbarateli-projects.vercel.app). Pode exigir login Vercel e conta de homologação; a URL é mutável. |
| main | `336e1b7c2a2f5efba871eb0ad461b04bba065c41`. Não contém automaticamente toda entrega da candidata. |
| CI da candidata | 22 runs concluídos, **20 success / 2 failure**. Os dois gerais pararam em Typecheck; não chegaram ao E2E/Gallery. Ver diagnóstico. |

## Resultado principal

O produto possui persistência e contratos reais para os módulos. Não é necessário reconstruí-lo. As maiores diferenças são **composição de Capturar/Conhecimento, filtros de Tarefas, hierarquia do Financeiro, Configurações, bloco recente do Início e landing curta**. Onboarding já tem as nove telas; faltam qualificação e acabamento específicos. Calendário, Hábitos, mídia privada, séries e Metas devem ser aproveitados.

O fechamento técnico de #72–79 não comprova fidelidade integral ao protótipo. As correções novas são rastreadas separadamente, sem reabrir ou invalidar os motores já entregues. A existência de CSS/testes também não equivale a aceite humano.

## Hierarquia e escopo

1. Protótipo visual atual: layout, hierarquia, navegação, identidade e interações representadas.
2. Requisitos funcionais, segurança, isolamento e acessibilidade preservados.
3. Arquitetura existente reutilizada onde adequada.
4. Documentação/issues/handoff atualizados para orientar o resultado, não redefini-lo.

D-077 mantém MVP operacional + redesign + onboarding + landing; checkout Asaas e abertura de vendas ficam posteriores. D-032 exclui a entrega Drive, preservando infraestrutura compartilhada. D-078 transfere restore para pós-lançamento. Referência visual não autoriza reintroduzir essas entregas nem substituir cifra real por demonstração.

**Não aplicar novamente** patches de cadência, G4 ou Gallery já incorporados em ad24. UI V2 da landing continua pendente e depende de imagens reais. Antes de executar, a Root fixa o novo SHA da candidata e distribui os paths conforme o [plano](03-execucao.md).


## Correções delimitadas no GitHub

- [#122 — Convergir Capturar, Conhecimento e editor ao protótipo](https://github.com/kauanbarateli/Segundo-Cerebro/issues/122)
- [#123 — Alinhar abas, filtros e ordenação de Tarefas ao protótipo](https://github.com/kauanbarateli/Segundo-Cerebro/issues/123)
- [#124 — Convergir a apresentação do Financeiro preservando o motor validado](https://github.com/kauanbarateli/Segundo-Cerebro/issues/124)
- [#125 — Alinhar Início, Configurações, navegação e ações de Projetos](https://github.com/kauanbarateli/Segundo-Cerebro/issues/125)
- [#126 — Revelar e ocultar campos no detalhe do Cofre com proteção de sessão](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126)

Contratos existentes: #62–65. Landing/onboarding visual: #80. Integração: #81. Aceite humano: #44; PWA: #12. Épico: [SPEC-08 #71](https://github.com/kauanbarateli/Segundo-Cerebro/issues/71).
