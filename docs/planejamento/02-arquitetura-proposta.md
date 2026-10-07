# B — Arquitetura proposta

**Forma geral:** um **monolito modular** Next.js 15 (App Router) sobre Supabase, com o domínio isolado em `src/core/` (ADR-0002), publicado na Vercel como PWA (doc 07). Sem monorepo, sem microsserviço, sem fila — nada no horizonte de ~10 usuários paga essa conta, e os ADRs já reservam os ganchos do crescimento.

---

## 1. Stack (proposta a confirmar, Q-R2.2)

| Camada | Escolha | Nota |
|---|---|---|
| Framework | **Next.js 15.x** + React 19 + TS estrito | o que 850+ testes do legado provaram; eslint flat-config (herdado do bootstrap) já pronto p/ Next 16 |
| Estilo | **Tailwind 4** + tokens CSS do DS | mudança consciente vs legado (3.4): tokens em `@theme` casam com o `tokens.css` já extraído, e **container queries nativas** são a base do bento responsivo (doc 08 §2). Custo: portar o preset JS → `@theme` (uma vez; o validador continua conferindo JSON×CSS) |
| Dados/Auth/Storage | **Supabase (projeto novo)** | doc 03; migrations só por pipeline |
| Validação | Zod na borda (Actions/rotas), tipos do banco **gerados** | contratos do Núcleo em tipos próprios do domínio |
| Observabilidade | Sentry com a allowlist herdada + `beforeSendTransaction` (doc 09 §2.8) | |
| E-mail | Resend (opt-in, doc 09/10) | |
| Qualidade | Vitest + Playwright + **dependency-cruiser** (o guarda do ADR-0002) + knip + CI com os portões dos docs 08/09 | e2e roda no CI contra **Supabase local** |
| Hospedagem | Vercel Hobby (2 crons diários) | uso pessoal (D-011) respeita os termos do Hobby |

## 2. Os ADRs herdados viram estrutura (validação em bloco na Q-R2.3)

### 2.1 ADR-0002 — o Núcleo, na prática

```
src/
├── core/                      ← NÃO importa next/*, @supabase/*, react
│   ├── financeiro/            regras puras: competência, fatura derivada, plano do mês,
│   │                          horizontes de dívida, séries (a fusão D-006 vive AQUI)
│   ├── conhecimento/          extração de wiki-links, árvore, regras de vínculo
│   ├── habitos/  tarefas/  captura/  cofre(contratos)/  ...
│   └── shared/                dinheiro (centavos), tempo (fuso), ids, eventos
├── adapters/
│   ├── db/                    consultas Supabase por módulo (substitui o data.ts monolítico),
│   │                          tipadas pelo schema gerado; RPCs transacionais
│   ├── google/  clickup/  email/  push/
├── app/                       rotas; Server Actions FINAS: Zod → auth → rate-limit → core+adapter → evento
├── components/                ui/ (primitivos DS) · layout/ (shell) · features/ (por módulo)
└── lib/                       csp, guards, rate-limit, observabilidade (infra herdada)
```

- **A regra executável (dependency-cruiser, CI):** `core/` não importa framework nem SDK; `components/ui` não importa `features/`; `features/` de um módulo não importa `features/` de outro (a regra que faltava no legado); nada importa `adapters/db` fora de `core`-orquestradores/actions. Sem o portão, "a decisão se dissolve em semanas" (ADR-0002) — o portão entra no Ticket 01.
- **O que muda em relação ao legado:** as 6.467 linhas de regra dentro de Server Actions viram funções puras portáveis (junto com seus testes — a matemática de `credit.ts`/`finance.ts`/`habits.ts` já É pura e migra quase por cópia); o `data.ts` de 1.790 linhas vira um adapter por módulo.
- **O que NÃO muda:** Server Actions continuam sendo o canal do web app (o modelo de segurança delas está provado); a "API pública" (Canal da Plataforma externa) fica **desenhada e adiada** — rotas `/api/v1` finas sobre o mesmo `core`, com token pessoal; entra no roadmap, não no MVP.

### 2.2 ADR-0003 — Entitlement ≠ Preferência **sem billing** (conciliação com D-011)

D-011 tirou a cobrança; o ADR fica — barato e correto: tabela `entitlements` resolvida por um **Plano Pessoal implícito** (todo usuário ganha tudo por padrão; concessões/vetos individuais permitem beta e desligamento cirúrgico), e `user_modules` volta a ser SÓ Preferência (visibilidade/ordem). A UI consulta `entitlement ∩ preferência` — e as **Server Actions passam a conferir o entitlement** (fecha o achado "desligar módulo só esconde a tela"). Se um dia virar SaaS, cria-se a tabela `plans` e o resolvedor troca a fonte — nada na UI muda.

### 2.3 ADR-0004 — Eventos de domínio

Adotado **como escrito** (estado anterior, posterior e Canal), com duas exceções registradas: Cofre grava só metadados (payload é cifrado — padrão do legado) e a área ADM só lê agregados (doc 10). Implementação: helper `emitirEvento()` chamado pelos orquestradores do core dentro da mesma transação (RPC) — não por trigger, para o evento carregar o Canal e o before/after semântico. Retenção 90 dias (job herdado do padrão 0013). *(O doc 06 §4 foi alinhado a esta versão.)*

### 2.4 ADR-0001 e 0005

Isolamento por Usuário: é a fundação RLS herdada — nenhuma estrutura de tenant. IA fora do app: nenhuma concessão a LLM no Núcleo; a Plataforma externa (quando existir) entra pela API v1 como Canal autenticado.

## 3. Fluxos padrão (o contrato de toda feature)

**Leitura:** RSC → adapter do módulo (select tipado, colunas explícitas) → componente. **Erros de leitura aparecem** (error boundary por rota + `throw` no adapter — fecha o "tela vazia silenciosa").
**Escrita:** Action fina → Zod → `getUser()` → rate-limit → entitlement → orquestrador do core → adapter/RPC transacional → `emitirEvento()` → revalidate. Toda escrita composta é UMA RPC (doc 06 §2).
**Upload:** Action gera signed upload URL → cliente envia → Action registra medindo o tamanho real (padrão herdado) — sem JWT no navegador (doc 09 §2.1).

## 4. Autenticação e sessão

Supabase Auth (e-mail/senha; cadastro fechado; reset de senha no MVP; TOTP fase 2) com cookies **httpOnly** via `@supabase/ssr` — possível porque nenhum código de navegador fala com PostgREST/Storage (§3). Middleware herdado (nonce+CSP em bloqueio, guarda de sessão, isenções nominais de cron) + `getAppContext()` com a moderação da tabela separada (doc 09 §2.3).

## 5. Repositório e ambiente (Q-R2.10)

**Proposta:** repositório novo `kauanbarateli/segundo-cerebro` com raiz na pasta `Novo  -- Segundo Cerebro` — o app na raiz e este `docs/planejamento/` versionado junto (o planejamento vira história do produto). Aproveitamento por **cópia** a partir do `novo-segundo-cerebro` (workspace `design-system/`, fundação de tema, configs) e do legado (módulos puros com testes), citando origem nos commits. O repo `novo-segundo-cerebro` é arquivado como fonte. Skills mattpocock instaladas no novo repo + `CONTEXT.md`/`docs/adr/` desde o dia 1 (herdando e ampliando os validados) + `AGENTS.md` unindo as regras de design (evidence-first) às de arquitetura (este doc). Ambientes: produção (Vercel + Supabase novo) e Supabase **local** para dev/e2e/CI; segredos só no cofre da Vercel + `.env` fora de pasta sincronizada.

## 6. Escalabilidade honesta (10 → 100 → 1.000 usuários)

O que já nasce pronto: RLS por usuário, índices por dono, rollups de métricas, eventos com retenção, rate-limit persistente, storage com URL assinada. O que fica reservado e documentado: realtime (canal por usuário), fila (hoje: crons; se jobs crescerem → QStash/worker), cache de leitura (staleTimes do Next; depois: réplicas), API v1. O que se recusa por ora: microsserviços, monorepo, event sourcing, CRDT — cada um com o gatilho de reconsideração anotado no roadmap.
