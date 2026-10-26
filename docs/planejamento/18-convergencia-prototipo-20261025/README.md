# Convergência ao protótipo — plano único de retomada

**Execução retomada em 26/10/2026 (D-084):** o mantenedor autorizou implementar este plano em quatro frentes. O [registro de execução](../../implementation/retomada-doc18-20261026.md) atualiza a pausa descrita pela auditoria histórica abaixo. Merge e deploy permanecem bloqueados.

**Auditoria histórica de 25–26/10/2026:** o pacote inicial investigou, documentou e organizou issues, sem implementar correções naquele momento. A retomada D-084 autorizou posteriormente implementação e validação; o registro de execução informa o estado atual. Merge e produção continuam bloqueados. O protótipo define o resultado visual; a análise determina como chegar a ele preservando as regras reais.

## Comece por estes cinco documentos

1. [Diagnóstico técnico e reconciliação do handoff](01-diagnostico.md).
2. [Comparação por superfície e evidência visual](02-comparacao.md).
3. [Mapa de implementação, branches, ordem e prompts](03-execucao.md).
4. [Decisões, adaptações e perguntas abertas](04-decisoes.md).
5. [Publicação, validações e limitações](05-publicacao.md).

O [inventário](inventario.md) relaciona todas as issues, PRs e branches observadas. Os corpos anteriores das issues revisadas ficam em [histórico](historico-issues/README.md); as issues remotas passam a ser a referência de execução por tarefa. Este pacote complementa o [handoff congelado da PR #120](../../implementation/handoff-retomada-20261025-pausa-mvp.md), sem reescrever seus arquivos, hashes ou evidências.

## Bases históricas da auditoria

| Fonte | Identidade e uso |
|---|---|
| Código candidato / PR #120 | `ad24a6b3ffbf720f9991a791e580bae82dfe68ce`, árvore `f3b48b1e0a9e47fe066f022a76478b4f88772d7b`; branch `codex/mvp-goals-terminal-20261023`. Referência das linhas de código nesta análise. |
| Protótipo indicado pelo mantenedor | D: → Prótotipos/Protótipo - Codex. **303 arquivos comuns idênticos por SHA-256** ao [snapshot navegável do doc17](../17-evolucao-prototipo/prototipo/index.html); os dois adicionais são prompts Markdown. [Proveniência](evidencias/proveniencia.json). |
| Chat de origem | “Construa protótipo do Segundo Cérebo”, thread `01a147d5-e165-7752-a3b0-d81b3eb08e8f`, consultado nesta auditoria. O snapshot em GitHub evita depender desse chat ou de D: na retomada. |
| Preview inspecionado | Source `3403a5aa1901c166e6cfc1206848bfdc1c34957a`, deployment `dpl_5SAkeYyRFkWYRSaStkfrQHJjL1N4`, READY confirmado pela Vercel. [Abrir Preview](https://segundo-cerebro-of-git-codex-homo-efc4bb-kauanbarateli-projects.vercel.app). Pode exigir login Vercel e conta de homologação; a URL é mutável. |
| main | `336e1b7c2a2f5efba871eb0ad461b04bba065c41`. Não contém automaticamente toda entrega da candidata. |
| CI da candidata | 22 runs concluídos, **20 success / 2 failure**. Os dois gerais pararam em Typecheck; não chegaram ao E2E/Gallery. Ver diagnóstico. |

## Resultado principal

O produto possui persistência e contratos reais para os módulos. As diferenças levantadas na auditoria já receberam implementação de composição: Capturar/Conhecimento, filtros de Tarefas, Financeiro, Configurações, páginas recentes do Início, landing de três capítulos, chips do onboarding e revelação protegida no Cofre. A continuidade é requalificar o candidato final, corrigir diferenças efetivamente demonstradas e completar os aceites restantes; não reconstruir essas superfícies a partir da lista histórica. Calendário, Hábitos, mídia privada, séries e Metas continuam aproveitados.

O fechamento técnico de #72–79 não comprova fidelidade integral ao protótipo. As correções novas são rastreadas separadamente, sem reabrir ou invalidar os motores já entregues. A existência de CSS/testes também não equivale a aceite humano.

## Estado de execução — checkpoint de 26/10

As observações ad24/Preview3403 são a **auditoria histórica**, não uma lista de interfaces ainda por construir. A implementação e os aceites pertencem às fontes abaixo; não há aceite geral por herança.

| Recorte | Implementado / validado | Pendente |
|---|---|---|
| Conteúdo/editor | Trilho e retorno mobile, Reader antes de Editar e toolbar implementados. Preview3a confirmou foco na validação, HTTPS seguro, save/reload de captura e página, imagem e leitura sem editor; [prova](../../implementation/evidence/doc18-editor-fixes-3a-20261026.json). | CAS em duas abas, falhas reais de rede, controles restantes da toolbar, zoom e aparelhos físicos; não refazer o Reader. |
| Tarefas e Financeiro | Abas, filtros/ordem e quatro áreas financeiras implementados; correções e provas por Source no [registro](../../implementation/retomada-doc18-20261026.md). Motor e dados preservados. | Requalificar a candidata final e os estados não cobertos, sem reabrir o motor por diferenças históricas. |
| Jornada/moldura | Páginas recentes reais, theme cards/painéis, bottomnav, tarefas contextuais, Ajuda e retirada da oferta Drive implementados. O [checkpoint c028](../../implementation/retomada-doc18-20261026.md#landing-v2-incorporada-à-candidata--2610-07h-de-fortaleza) teve 23/23 checks e capturas demo revisadas em recortes próprios. | Aceite integrado da fonte final, zoom e aparelho físico; instalação PWA relatada não certifica todo o redesign. |
| Onboarding/Cofre | Chips de cadência, nove telas e detalhes secundários acessíveis implementados; revelar/ocultar no Cofre com máscara e limpeza de apresentação implementado. | Provas finais específicas #80/#126/#62–65; não repetir implementação nem tratar componente sintético como sessão real do Cofre. |
| Landing | UI V2 de três capítulos/tabs aplicada; Gallery17, Entrada8 e Projetos4 incorporados com proveniência própria. | OG3 ainda sem captura qualificada; revisão final e aceites de navegador/aparelho não cobertos. |
| Contratos / integração | Retenção nativa R01–R07 e Metas12+3+8 têm provas separadas; também passaram nos runs eb008. D00 passou no diagnóstico; o comparador foi corrigido e o CI de PR eb008 passou. | Push eb008 recusou a primeira OG; recuperação PR ficou NOT_RUN por erro pré-stack. O conflito conectado3a motivou correção da moldura; novos checks/Preview são necessários. MainHTTP e retenção autônoma hospedada seguem separados. |

**Fontes:** Preview3a = 3a9239f0f40147e645cef67cd4f55bb90edf9145; D00 = d00c5f6210a7fda12cc046157f563728eb18dd8f; correção Link = eb008335aa244556352e53173dbae668b387c9f4. Os resultados eb008 foram conferidos separadamente (21/23runs), sem herança de D00. O [registro cronológico](../../implementation/retomada-doc18-20261026.md) e a [observação CAS real](../../implementation/doc18-conflito-conectado-20261026.md) conservam candidatos, hashes, runs e limites. Merge e produção continuam bloqueados.

## Hierarquia e escopo

1. Protótipo visual atual: layout, hierarquia, navegação, identidade e interações representadas.
2. Requisitos funcionais, segurança, isolamento e acessibilidade preservados.
3. Arquitetura existente reutilizada onde adequada.
4. Documentação/issues/handoff atualizados para orientar o resultado, não redefini-lo.

D-077 mantém MVP operacional + redesign + onboarding + landing; checkout Asaas e abertura de vendas ficam posteriores. D-032 exclui a entrega Drive, preservando infraestrutura compartilhada. D-078 transfere restore para pós-lançamento. Referência visual não autoriza reintroduzir essas entregas nem substituir cifra real por demonstração.

**Não aplicar novamente** patches de cadência, G4, Gallery ou UI V2 já incorporados. A landing de três capítulos e as tabs Projetos/Kanban foram implementadas e comparadas nos recortes registrados. Os oito rasters Entrada e quatro de Projetos, capturados e qualificados no Source76, integram a candidata0310/be07 com recibos próprios. A OG histórica ainda aguarda captura e qualificação dos três membros no build que contém essas entradas. O [registro de execução](../../implementation/retomada-doc18-20261026.md) separa implementação, validação e pendências; não há aceite de produção por herança. Root fixa o SHA da candidata antes de distribuir os paths conforme o [plano](03-execucao.md).


## Correções delimitadas no GitHub

- [#122 — Convergir Capturar, Conhecimento e editor ao protótipo](https://github.com/kauanbarateli/Segundo-Cerebro/issues/122)
- [#123 — Alinhar abas, filtros e ordenação de Tarefas ao protótipo](https://github.com/kauanbarateli/Segundo-Cerebro/issues/123)
- [#124 — Convergir a apresentação do Financeiro preservando o motor validado](https://github.com/kauanbarateli/Segundo-Cerebro/issues/124)
- [#125 — Alinhar Início, Configurações, navegação e ações de Projetos](https://github.com/kauanbarateli/Segundo-Cerebro/issues/125)
- [#126 — Revelar e ocultar campos no detalhe do Cofre com proteção de sessão](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126)

Contratos existentes: #62–65. Landing/onboarding visual: #80. Integração: #81. Aceite humano: #44; PWA: #12. Épico: [SPEC-08 #71](https://github.com/kauanbarateli/Segundo-Cerebro/issues/71).
