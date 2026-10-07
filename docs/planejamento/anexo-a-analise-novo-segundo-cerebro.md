# Anexo A — Análise do repositório `novo-segundo-cerebro` (Q4 = a)

**O que é:** a tentativa anterior de reconstrução (`kauanbarateli/novo-segundo-cerebro`, 4 commits, 16→31/08/2026, parada há ~3 semanas). Quatro partes: (1) **workspace de design system** extraído do legado com validador; (2) **planejamento** — `brainstorming.md` (699 linhas), glossário `CONTEXT.md` (12 termos) e 5 ADRs, produzidos numa sessão de `/grill-with-docs`; (3) ferramentas de agentes (26 skills + 4 papéis Codex); (4) **bootstrap Next.js** que fecha só o "ticket #1" (fundação visual/tema) — em branch **não mesclada** na main. Não existe domínio, banco, auth, Núcleo, CI. Stack igual à do legado (Next ^15.1.6, React 19, **Tailwind ^3.4** — não é v4).

## 1. Os 5 ADRs (verificados contra o legado; a validar na rodada 2)

| ADR | Decisão | Motivo essencial | Consequência aceita |
|---|---|---|---|
| **0001** Usuário é a unidade de isolamento | Sem workspace/tenant: todo dado pertence a exatamente um Usuário (o padrão `auth.uid() = user_id` do legado, 71 ocorrências) | Produto rigorosamente pessoal; workspace custaria `tenant_id` + participação em ~41 tabelas para caso que não existe | Compartilhamento futuro (cofre a dois, finanças familiares) = migração "cara e conhecida"; **reabrir ANTES de qualquer feature compartilhada** |
| **0002** Núcleo é a única porta | Regras em `src/core/` (TS que não conhece Next/HTTP/Supabase); Actions/API/Plataforma externa são cascas; nenhum Canal toca o banco por fora | O legado pôs a regra em 6.467 linhas de actions (1.703 só no Financeiro), alcançáveis só por submit React; plataforma externa com service role desligaria a RLS inteira | Fronteira **verificada em CI por dependency-cruiser** ("sem isso a decisão se dissolve em semanas"); app único, não monorepo |
| **0003** Entitlement ≠ Preferência | Direito (derivado do Plano) e escolha de exibição em tabelas separadas; usuário edita só a Preferência | `user_modules` do legado mistura os dois; `enabled=false` fica ambíguo; direito editável pelo usuário é falha de segurança | Uma tabela + um resolvedor a mais; a UI consulta os dois; o ADR existe para impedir a "simplificação" de unificar |
| **0004** Toda escrita emite Evento de domínio | Com estado anterior, posterior e Canal; na 1ª entrega, só a auditoria consome | Auditoria é obrigatória; gravar como evento custa quase nada agora e é o gancho de API/notificações/mobile | Tabela sem consumidor "parece código morto; não é e não deve ser removida" |
| **0005** Sem IA dentro do app | Nada de chatbot/LLM embutido; IA vive numa Plataforma externa que entra pela API | As seções de IA do brainstorming multiplicariam o escopo e acoplariam a um provedor; ADRs 0002–0004 já dão tudo de que a IA precisará | Seções 8–10 do brainstorming ficam sem contrapartida no código, de propósito; IA futura entra como Canal |

## 2. Glossário (`CONTEXT.md`) — 12 termos

Usuário · Plano · Funcionalidade · Entitlement · Preferência · Núcleo · Canal · Plataforma externa · Evento de domínio · Captura · Vínculo · Cofre (definições e termos a evitar no arquivo original). **Lacunas mapeadas para a rodada 2:** "Tarefa" usada como termo sem verbete; faltam Hábito, Projeto, Evento de calendário, os termos do Financeiro, Conhecimento/Nota/Página, Drive/Arquivo; "integração" está em *Avoid* mas nada nomeia Google/Gmail; "Caixa de entrada" ambígua (módulo Gmail no brainstorming × caixa da Captura no legado).

## 3. `brainstorming.md` — o que acrescenta ao que já sabíamos

Módulos previstos: Calendário (3–4 contas Google por plano), Tarefas, Financeiro, Hábitos, Cofre, **Gmail** (buscar/filtrar/contexto), integrações e IA (revogada pelo ADR-0005). Planos de exemplo (Basic/X/Premium) — **conflita com D-011 (sem cobrança)**; resolução proposta no doc 02. Trata Notas/Projetos/Documentos/Metas como **futuros** — embora o legado já tenha Conhecimento/Projetos/Drive prontos; tensão levada à Q-R2.1. Banco: "continua Supabase", refinado na sessão para **projeto novo com schema limpo** (bate com D-007/D-008). A mensagem do commit fala em "16 decisões e tickets #1–#16" no GitHub Issues — **não verificáveis** (a CLI `gh` da máquina está autenticada na conta errada; pendência já registrada no anexo B §4).

## 4. Workspace `design-system/` — o pacote mais valioso

- **Fidelidade conferida:** snapshot do commit `ffdf064` (que ainda é o HEAD do legado); 22 snapshots de runtime, 5 ativos de marca e docs **idênticos byte a byte**; `node validate.mjs` = **36 verificações, 0 falhas** (JSON×CSS nos 2 temas, contraste ≥4.5:1 de 9 tokens × 4 fundos × 2 temas, hashes da marca, links).
- **Conteúdo:** `tokens/tokens.json` + `tokens.css` (79 vars `:root` + 35 `.dark` — **acrescenta 44 variáveis não-cor** que o legado só tinha no config) + `tailwind.preset.ts` (Tailwind 3) · `brand/` (SVGs + manifest com SHA-256 + doc de uso e 47 ícones) · `components/README.md` (matriz de 16 componentes com medidas e contratos de a11y) · `patterns/` (layout com a aritmética da sidebar, inventário de 17 telas, acessibilidade medida, movimento/tom) · `reference/` (source-map, auditoria com 9 divergências, checklist de adoção) · disciplina **OBSERVADO / INFERIDO / RECOMENDADO** com a regra "nenhuma skill autoriza inventar token".
- **Diferenças/pendências achadas na conferência:** preset perdeu `toast-out` (contra a própria auditoria); `alvo-44` renomeada para `sb-target-44` (snapshots ainda usam o nome velho); não portados: `.eyebrow`, scrollbar fina, CSS do editor TipTap; ganhou escala `zIndex` nomeada (resolve o caos de z-index do legado); `preview/index.html` tem valores fora de token (descartar); `reference/legacy/` é histórico que "não prevalece".

## 5. Bootstrap (branch `1-bootstrap-…`, não mesclada)

Só a fundação de tema — e boa: alternador **Claro/Escuro/Sistema** (melhor que o do legado, que não tinha "sistema"), script anti-flash preparado para hash de CSP, 12 testes unitários + 4 e2e (cor computada nos 2 temas, persistência, classe no `domcontentloaded`), `globals.css` **importando** `design-system/tokens/tokens.css` sem copiar, eslint flat config (pronto p/ Next 16), fixes reais de ambiente (localStorage no Node 25 + jsdom). Perdeu `noImplicitOverride`; sem headers de segurança/CSP; alias `@design-system/*` declarado e não usado; `/` é página de verificação de tokens (temporária por definição).

## 6. Veredito de aproveitamento (incorporado aos docs 02/04/05)

**Como está:** ADRs, glossário (ampliando), tokens+brand+patterns+auditoria+validador, fundação de tema com testes, correções de ambiente, brainstorming como fonte de requisitos.
**Adaptado:** package.json (voltar depcruise/knip/zod/supabase; decidir Tailwind 3→4), tsconfig/next.config (restaurar `noImplicitOverride`, headers, CSP), snapshots de `ui/*` como referência de porte (com `sb-target-44`, zIndex nomeado, devolver `.eyebrow`/scrollbar/`toast-out`), shell reescrito sobre Entitlement∩Preferência, `screens.md` filtrado pelo escopo novo, AGENTS.md ganhando as regras de arquitetura.
**Descartar:** `reference/legacy/`, `preview/index.html` (ajustando o validate), `figma-spec.md` (até existir Figma).
**Inconsistências a corrigir no aproveitamento:** hash da skill de DS divergente no lock; skill de DS só em `.agents/`; caminhos desatualizados em `brainstorming.md:17` e `.codex/config.toml`.

**Não verificado:** tickets #1–#16 e as 8 decisões restantes da sessão (GitHub inacessível ao `gh` atual); se typecheck/build/e2e passam hoje; versões resolvidas do lock.
