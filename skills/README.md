# Skills do projeto

As skills executáveis ficam espelhadas, com arquivos idênticos, em `.agents/skills/<nome>/` e `.claude/skills/<nome>/`. A duplicação preserva o uso nos dois ambientes de agentes do projeto. Toda inclusão, remoção ou atualização modifica ambos os diretórios e o [skills-lock.json](../skills-lock.json).

## Interface — Impeccable

Usar a [Impeccable local](../.agents/skills/impeccable/SKILL.md) para implementação e revisão da interface conforme solicitado pelo mantenedor. O diretório foi copiado integralmente da skill existente no planejamento, com referências, configurações de agentes, launchers e fontes JavaScript; não inclui executáveis baixados, caches ou `node_modules`.

- Origem: `.agents/skills/impeccable` da pasta de planejamento aprovada, consultada em 07/10/2026.
- Versão do `SKILL.md`: `metadata.version: 4.4.0`.
- Versão registrada no launcher: `scripts/VERSION: 0.1.6`. São metadados distintos; não presumir que um substitui o outro.
- Não há commit Git comprovado para esse snapshot local. Os hashes atuais do arquivo de entrada e da árvore completa estão no lock.
- Ajuste local rastreado no lock: corrigido o link de `reference/degraded/asset-producer.md` para `../component-review.md`; o caminho original repetia `reference/` e não resolvia. As duas cópias receberam a mesma correção.
- O launcher pode baixar um executável quando acionado. A cópia não o executa nem comprova detector/audit aprovado. Antes de uso, ler o `SKILL.md` e seguir as limitações do ambiente e o fallback ali documentado.

As regras visuais do [AGENTS.md](../AGENTS.md), o DS 2.1 e a evidência do planejamento prevalecem sobre defaults gerados pela ferramenta. `ultimate-design-system-master` não foi portada: a skill de interface adotada é Impeccable.

## Engenharia e produtividade — mattpocock/skills

Foram portadas as 25 skills que já estavam instaladas no repositório de preparação, incluindo seus arquivos auxiliares. A tabela é um índice; leia integralmente o `SKILL.md` selecionado para gatilhos e limitações de invocação.

| Skill | Finalidade |
|---|---|
| [ask-matt](../.agents/skills/ask-matt/SKILL.md) | Escolher um fluxo de trabalho |
| [code-review](../.agents/skills/code-review/SKILL.md) | Revisar diff contra padrões e especificação |
| [codebase-design](../.agents/skills/codebase-design/SKILL.md) | Desenhar fronteiras e contratos de módulos |
| [diagnosing-bugs](../.agents/skills/diagnosing-bugs/SKILL.md) | Investigar falhas e regressões |
| [domain-modeling](../.agents/skills/domain-modeling/SKILL.md) | Evoluir vocabulário e decisões de domínio |
| [grill-with-docs](../.agents/skills/grill-with-docs/SKILL.md) | Examinar decisões com documentação |
| [implement](../.agents/skills/implement/SKILL.md) | Executar especificações e tickets |
| [improve-codebase-architecture](../.agents/skills/improve-codebase-architecture/SKILL.md) | Analisar oportunidades de arquitetura |
| [prototype](../.agents/skills/prototype/SKILL.md) | Responder dúvidas com protótipos descartáveis |
| [research](../.agents/skills/research/SKILL.md) | Investigar fontes e registrar conclusões |
| [resolving-merge-conflicts](../.agents/skills/resolving-merge-conflicts/SKILL.md) | Resolver conflitos de integração |
| [setup-matt-pocock-skills](../.agents/skills/setup-matt-pocock-skills/SKILL.md) | Configurar as convenções de engenharia |
| [tdd](../.agents/skills/tdd/SKILL.md) | Validar comportamento por testes |
| [to-spec](../.agents/skills/to-spec/SKILL.md) | Estruturar uma especificação |
| [to-tickets](../.agents/skills/to-tickets/SKILL.md) | Dividir uma especificação em entregas verificáveis |
| [triage](../.agents/skills/triage/SKILL.md) | Classificar solicitações |
| [wayfinder](../.agents/skills/wayfinder/SKILL.md) | Explorar decisões por um mapa de tickets |
| [wizard](../.agents/skills/wizard/SKILL.md) | Preparar procedimentos interativos |
| [grill-me](../.agents/skills/grill-me/SKILL.md) | Examinar um plano por perguntas |
| [grilling](../.agents/skills/grilling/SKILL.md) | Testar premissas de uma decisão |
| [handoff](../.agents/skills/handoff/SKILL.md) | Preparar passagem de contexto |
| [teach](../.agents/skills/teach/SKILL.md) | Ensinar conceitos no contexto do projeto |
| [to-questionnaire](../.agents/skills/to-questionnaire/SKILL.md) | Organizar perguntas pendentes |
| [wait-what](../.agents/skills/wait-what/SKILL.md) | Reformular explicações |
| [writing-for-agents](../.agents/skills/writing-for-agents/SKILL.md) | Escrever instruções consumidas por agentes |

Origem declarada no legado: [mattpocock/skills](https://github.com/mattpocock/skills), plugin `mattpocock-skills` 1.2.3, licença MIT. O legado informa aquisição por snapshot ZIP sem commit upstream auditável. A âncora de importação desta entrega é o commit `20914ce61fefa268ab06fb52d6e0c27fad7e7143` de `kauanbarateli/novo-segundo-cerebro`; não equivale a um commit do upstream.

Foram preservadas as 18 skills de engenharia e as 7 de produtividade. `misc/`, `in-progress/`, `deprecated/` e a skill anterior de design system ficaram fora do porte. Os templates shell de `diagnosing-bugs` e `wizard` são texto de apoio; não foram executados.

## Convenções deste repositório

As escolhas de tracker, labels e domínio já estão registradas em [issue-tracker](../docs/agents/issue-tracker.md), [triage-labels](../docs/agents/triage-labels.md) e [domain](../docs/agents/domain.md). Consulte essas escolhas antes de repetir qualquer setup. Elas não atestam autenticação ou criação de recursos remotos.

As instruções do mantenedor e do [AGENTS.md](../AGENTS.md) prevalecem sobre as skills, incluindo migrations exclusivamente manuais, revisão das entregas de agentes e ausência de coautoria. Nenhum fluxo de skill amplia por si só a autorização para escrever em serviços externos.

## Integridade e atualização

O lock guarda para cada skill:

- `computedHash`: SHA-256 dos bytes instalados de `SKILL.md`, normalizados para UTF-8/LF;
- `treeHash`: SHA-256 de registros UTF-8, ordenados ordinalmente por caminho relativo com `/`, cada registro formado por `caminho + LF + sha256-do-arquivo-em-minúsculas + LF`;
- `upstreamRecordedHash`, quando existente: hash preservado do lock anterior, sem atribuir a ele um algoritmo não comprovado;
- origem, versão declarada e commit de importação quando verificável.

Na importação, foram comparados os bytes dos 133 arquivos de cada destino espelhado (26 skills) e de suas fontes; depois foi aplicada a correção de link documentada acima. Antes do primeiro commit, todos os arquivos de texto das duas árvores foram normalizados para UTF-8/LF, conforme `.gitattributes`, para que os hashes instalados continuem válidos em clones Linux e Windows. Em `impeccable/reference/extract.md`, `harden.md` e `optimize.md`, também foram removidos espaços finais e linhas vazias excedentes no fim do arquivo, sem mudança de conteúdo. Os hashes de arquivo e árvore foram recalculados após essas alterações; a procedência e os `upstreamRecordedHash` históricos foram preservados.

Links ilustrativos em templates de `domain-modeling` e `wayfinder` são exemplos, não dependências do projeto. Antes de atualizar: revisar gatilhos, instruções, scripts, acesso à rede e dependências; copiar somente fontes necessárias; normalizar texto para LF; recomputar hashes e confirmar que os dois destinos continuam idênticos. Manter executáveis baixados e caches fora do Git.
