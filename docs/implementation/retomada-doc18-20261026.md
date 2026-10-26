# Retomada do doc18 — 26/10/2026

Base conferida localmente e no GitHub: `6cd4442de901ae66e525715c4a90b32fea5f0de1`, PR #120 em rascunho, branch `codex/mvp-goals-terminal-20261023`. D-084 autoriza implementação e validação; merge e deploy continuam bloqueados. O [doc18](../planejamento/18-convergencia-prototipo-20261025/README.md) e o protótipo do doc17 orientam o resultado. Os pacotes congelados da pausa são preservados.

## Frentes e propriedade de arquivos

| Frente | Escopo inicial | Paths reservados |
|---|---|---|
| Root — integração | #81: Typecheck, foco Metas, revisão, CI; depois contratos #62–65 e Gallery | `tests/core/onboarding-frequency.test.ts`, `financeiro/goals/goal-editor.tsx`, teste/fixture de upload de Metas, documentação de execução |
| Conteúdo/Tarefas | #122 antes de #123 | `features/capturar`, `features/conhecimento`, `features/tarefas`, editor compartilhado em `components/editor` e testes correspondentes |
| Financeiro | #124: navegação, hierarquia e apresentação | workspace, panels, CSS financeiro, `finance-route.ts` e seus testes; não altera o editor/upload de Metas |
| Jornada/Moldura | #125: Início, Configurações, Projetos, navegação e Ajuda | shell/navigation, Home, Settings, Projects; apresentação contextual da rota Drive, sem apagar dados/infraestrutura |

Checkout de execução compartilhado por propriedade de arquivos; somente Root realiza stage/commit/push depois da revisão. O checkout humano com WIPs continua preservado. Um processo local pesado por vez; suites completas, SQL e builds ficam no GitHub. Novos paths compartilhados exigem coordenação antes de editar.

## Primeiro delta — Typecheck e foco de Metas

**Typecheck:** `it.each` recebia arrays de dias como tuplas de argumentos, causando TS2345 e testando elementos isolados em lugar da lista. A tabela agora contém objetos `{ weekdays }`, preservando seis casos negativos, inclusive duplicação `[1, 1]`, tipo string e boolean. Nenhuma regra do domínio foi relaxada.

**Foco:** reprodução local real de navegador confirmou a falha da preparação em `finance-goals-image-upload.spec.ts:137`: o alerta era renderizado, mas permanecia inativo. O cenário de falha na finalização passou na mesma rodada. O editor agendava foco em `requestAnimationFrame`, sem garantir que React já tivesse montado o alerta. O foco agora ocorre em `useLayoutEffect` depois do commit, condicionado a alerta visível e ausência de revisão ativa; as verificações existentes de tentativa/sessão/formulário continuam antes de publicar erros.

Regressão acrescentada aos dois cenários: interromper novos callbacks de frame antes da submissão não impede o foco do alerta. O teste também conserva a consulta sem reenvio e a ausência de conteúdo pessoal no diagnóstico.

### Evidência local e limites

- Node `v24.19.0`.
- Frequência do onboarding: 40 testes passaram em um worker.
- Foco de Metas: quatro testes passaram, incluindo finalização, preparação e duas negativas de resposta tardia após edição/ocultação.
- A reprodução usa transporte sintético e Chromium headless já instalado, sem Supabase/Vercel ou leitura de dados reais. Não é aceite conectado.
- A primeira tentativa de Vitest falhou no diretório temporário do sandbox; TMP/TEMP próprios da execução resolveram o transporte. A primeira tentativa de navegador não encontrou seu runtime no perfil do sandbox; foi usado o cache pessoal já instalado, sem download.
- `node_modules` local apresenta Vitest 4.1.11, anterior ao 4.1.12 fixado no manifesto. O runner fará `npm ci` para validar a instalação exata; os resultados locais são focados, sem promoção a aceite hospedado.
- Na base 6cd4442, a consulta de CI encontrou os dois runs gerais falhos em Typecheck (40264888892 e 40264885434). Os resultados do novo SHA devem ser acompanhados separadamente.

## Validação pendente

CI do SHA corrigido, suites completas de navegador/contratos, revisão das entregas visuais, comparação equivalente com o protótipo e qualificação de homologação. Deltas em desenvolvimento não são critérios concluídos. Não liberar merge ou deploy a partir de testes focados ou checks de uma fonte anterior.
