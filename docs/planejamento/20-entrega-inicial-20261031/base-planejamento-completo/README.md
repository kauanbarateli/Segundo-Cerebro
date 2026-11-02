# Planejamento pós-MVP — Segundo Cérebro

**Versão 1.2 · 31/10/2026 · Planejamento consolidado para validação.** As 17 respostas foram incorporadas. O MCP pessoal foi configurado e a auditoria estrutural do Supabase foi executada em leitura. Nenhuma alteração de produto, schema, dados, issue, PR ou deploy foi realizada.

O pacote cobre a evolução visual e funcional solicitada, cadastro gratuito, Google/ClickUp, lixeira, feedback e o novo **ADM separado em `adm.segundocerebroapp.com.br`**, com usuários, liberação de módulos, métricas e jornada de aquisição.

## Auditoria Supabase concluída

O [doc 16](16-auditoria-supabase.md) traz o catálogo real, evidências e impactos na execução. Foram encontradas 67 tabelas com RLS e estruturas coerentes com o código. Antes de migrations novas, reconciliar os 27 arquivos do Git com os cinco registros do banco e incorporar formalmente o patch PT409 já instalado. A consulta de release fez 2.512 verificações e retornou uma divergência correspondente a esse patch; não é um aceite funcional completo.

## Leitura recomendada

1. [Plano executivo](05-plano-executivo.md) — 13 frentes, sequência, dependências, prioridades, esforço e critérios.
2. [Decisões confirmadas](02-decisoes-confirmadas.md) — 17 respostas, inclusive a ampliação administrativa.
3. [Backlog em CSV](14-backlog.csv) — divisão do trabalho; não são issues publicadas.
4. [Prompt de execução](13-prompt-de-execucao.md) — repasse para outra frente, após validação do plano.
5. [Providências do Kauan](15-providencias-do-mantenedor.md) — acessos e preparativos do titular, separados das tarefas técnicas e das configurações que dependem da implementação.

## Documentos completos

| Arquivo | Finalidade |
| --- | --- |
| [00 — Escopo original](00-escopo-original.md) | Cópia intacta do arquivo fornecido |
| [01 — Diagnóstico e cobertura](01-diagnostico-e-cobertura.md) | Estado do código e mapeamento dos requisitos |
| [02 — Decisões](02-decisoes-confirmadas.md) | Registro das respostas e precedência |
| [03 — Questionário histórico](03-lacunas-rodada-unica.md) | Rodada única respondida; não é lista de pendências |
| [04 — Fontes](04-fontes-e-rastreabilidade.md) | GitHub, SHA, skills, fontes oficiais e limites |
| [05 — Plano executivo](05-plano-executivo.md) | Frentes, etapas e dependências |
| [06 — Integrações e Google Cloud](06-integracoes-e-google-cloud.md) | Roteiro de configuração, Auth, Calendar, ClickUp e Apple posterior |
| [07 — Dados e segurança](07-dados-seguranca-e-retencao.md) | Modelos, permissões, migrations, lixeira e retenção |
| [08 — Plano visual e fluxos](08-plano-visual-e-fluxos.md) | Impeccable, telas, componentes, estados e responsividade |
| [09 — ADM separado](09-administracao-separada.md) | Arquitetura, telas, acesso e corte do Admin antigo |
| [10 — UTM, métricas e jornada](10-utm-metricas-e-jornada.md) | Verificação atual, coleta consentida, cronologia e uso |
| [11 — Testes e aceite](11-testes-e-criterios-de-aceite.md) | Cenários de validação por domínio e fluxo |
| [12 — Riscos e liberação](12-riscos-operacao-e-liberacao.md) | Pré-requisitos externos, gates e reversão |
| [13 — Prompt](13-prompt-de-execucao.md) | Instruções de repasse com referências |
| [14 — Backlog](14-backlog.csv) | Planejamento tabular para acompanhamento |
| [15 — Providências do mantenedor](15-providencias-do-mantenedor.md) | Checklist com acesso ao Supabase concluído e pendências restantes |
| [16 — Auditoria Supabase](16-auditoria-supabase.md) | Estrutura observada, reconciliação, segurança e deltas por frente |

## Resultado da verificação de UTM

**Código:** não foi encontrado coletor de UTM ou migration correspondente na main analisada. Atribuição aparece no planejamento histórico e na política como ainda não ativa.

**Banco:** catálogo inspecionado após autenticar o novo MCP. Não foram localizadas estruturas dedicadas de UTM/atribuição nos nomes de tabelas/colunas e corpos das rotinas pesquisadas. Isso não inspeciona conteúdo arbitrário de JSON nem sistemas externos. A coleta e a ficha cronológica continuam como implementação nova no doc 10; o doc 16 delimita a evidência.

## Arquivos de apoio

- [Vocabulário complementar](CONTEXT.md).
- [Seis referências visuais e proveniência](referencias/README.md), copiadas do protótipo sem alterações.
- [Minutas de decisões arquiteturais](anexos/decisoes-arquiteturais-propostas.md).
- [Consulta de catálogo somente leitura](anexos/verificar-utm-somente-leitura.sql), para uso futuro autorizado.
- [Registro da verificação UTM](evidencias/verificacao-utm.json).
- [Conferência do pacote](evidencias/validacao-pacote.json) — links locais, backlog, decisões e integridade das referências; não representa testes do aplicativo.
- [Manifesto SHA-256](manifesto.sha256) — integridade dos arquivos para transferência.
- `insumos-core.md`, `insumos-integracoes.md` e `insumos-visual.md` preservam o diagnóstico inicial. Suas perguntas/recomendações históricas não substituem o doc 02 e os planos finais.

## Como usar

Abra este arquivo em Obsidian, VS Code ou outro leitor Markdown. Os documentos usam links relativos e podem ser transferidos juntos. O diagrama usa Mermaid; as etapas também estão em texto. O CSV usa ponto e vírgula e UTF-8 para abrir em planilha.

Base reconferida: `bd35288404c493d1b03f7a1a0208f808cc2079a2` (PR #120 incorporado). Antes de executar, reconciliar mudanças posteriores. Recomendações técnicas estão marcadas para revisão do plano. Configurações de console, aprovação Google, banco e efeitos remotos exigem prova própria.

**Próximo marco:** validação deste pacote pelo mantenedor; depois, execução incremental F01–F13. Não é necessário repetir o questionário.
