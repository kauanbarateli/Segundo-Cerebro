# Entrega inicial em duas frentes — Segundo Cérebro

**Versão 2.0 · 31/10/2026 · Planejamento de execução, sem implementação nesta publicação.**

Este é o recorte vigente solicitado após a auditoria do Supabase. Primeiro: melhorias visuais e de navegação, cadastro somente por e-mail e senha, acesso gratuito, origem UTM simples, métricas de cadastro, feedback e atualizações. Depois: login Google, escrita no Calendar, ClickUp, ADM separado e exclusão permanente/automática.

**Comece aqui, e não pelo prompt do pacote anterior.** O conteúdo em `base-planejamento-completo/` é a versão 1.2 preservada integralmente para referência e rastreabilidade. Sua ordem de execução, cadastro Google inicial, jornada detalhada UTM, contador de teste e antecipação do ADM são substituídos pelo [recorte atual](01-escopo-e-decisoes.md). Não é uma autorização para executar tudo de uma vez.

## Documentos de execução

1. [Escopo e precedência](01-escopo-e-decisoes.md): o que entra agora, o que fica depois e o que foi simplificado.
2. [Duas frentes e dependências](02-frentes-e-dependencias.md): divisão de autoria, contratos e ordem.
3. [Cadastro, UTM e métricas](03-cadastro-utm-metricas.md): desenho ligado ao Auth e às permissões atuais.
4. [Mapa de código, conflitos e validação](04-codigo-validacao-operacao.md): arquivos de partida, sobreposições históricas e critérios de liberação.
5. [Issues publicadas](05-registro-de-tickets.md): números reais, escopo, fase e bloqueios.
6. [Dois prompts de execução](06-prompts-de-execucao.md): um para cada frente da primeira etapa.
7. [Providências por etapa](07-providencias-por-etapa.md): somente os acessos e preparativos necessários agora.
8. [Detalhamento visual](08-detalhamento-frente-a.md) e [detalhamento da fase posterior](09-detalhamento-fase2.md).
9. [Validação desta publicação](10-validacao-publicacao.md): integridade documental; não é teste do produto.

Cada issue tem sua [cópia individual](tickets/), critérios de aceite, validação e bloqueios. A fronteira de trabalho é formada pelas issues da fase 1 cujos bloqueios reais foram concluídos. Fase 2 é backlog posterior, com `needs-triage`; não iniciá-la automaticamente ao terminar a primeira etapa.

## Referências completas

- [Pacote anterior completo, 65 arquivos](base-planejamento-completo/README.md): diagnóstico, decisões, integração, dados, operação, referências e evidências.
- [Escopo original intacto](base-planejamento-completo/00-escopo-original.md) e [17 decisões respondidas](base-planejamento-completo/02-decisoes-confirmadas.md).
- [Auditoria Supabase](base-planejamento-completo/16-auditoria-supabase.md): 67 tabelas com RLS, diferença entre histórico e catálogo, patch PT409 e limites da leitura realizada.
- [Referências visuais copiadas e hashes](base-planejamento-completo/referencias/README.md).
- [Protótipo navegável completo](../17-evolucao-prototipo/prototipo/index.html), [capturas](../17-evolucao-prototipo/capturas/manifest.json), [convergência doc18](../18-convergencia-prototipo-20261025/README.md).
- [Design System](../../../DESIGN.md), [tokens DS 2.1](../../../design-system/tokens/tokens.json) e [skill to-tickets](../../../.agents/skills/to-tickets/SKILL.md).

Base observada: `bd35288404c493d1b03f7a1a0208f808cc2079a2`, PR #120 incorporado. Reconciliar a main novamente ao executar. Issues históricas ainda abertas não provam ausência de implementação; os novos tickets delimitam as diferenças solicitadas agora e preservam os aceites anteriores.

A publicação contém documentação e uma proteção de preview exclusivamente para sua branch no `vercel.json`. Nenhuma alteração de aplicação, migration, dado, segredo ou deploy é realizada pelo planejamento.
