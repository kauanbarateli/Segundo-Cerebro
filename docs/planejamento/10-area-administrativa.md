# J — Área administrativa

**O que existe hoje:** gestão de contas correta e bem protegida (4 camadas), mas **zero visão estratégica** — nenhuma métrica de uso é coletada. Este documento desenha a área ADM como painel de produto, mantendo a regra de ouro herdada: **o master vê metadados e agregados, nunca conteúdo** (notas, valores, Cofre).

**Acesso:** exclusivo do papel `master` (semeado para o Kauan por variável de ambiente/seed — não mais e-mail hardcoded em migration). O papel `admin` do legado, que não concedia nada, **não existe** na nova versão até haver uma segunda pessoa administrando (decisão registrada; reintroduzir é uma migration pequena).

---

## 1. Coleta: eventos próprios, sem ferramenta externa (recomendação, Q-R2)

| Opção | Prós | Contras |
|---|---|---|
| **Eventos próprios no Postgres** ← recomendo | custo zero; dado fica em casa (privacidade); consulta SQL livre; aproveita RLS/infra; o "evento de domínio" (ADR-0004 do `novo-segundo-cerebro`) já aponta para cá | construir ~2 fatias (coleta + painel); sem funis prontos |
| Plausible/Umami (analytics leve) | pronto, bonito, privacy-friendly | US$ 9+/mês ou self-host (fere custo-zero); só pageviews — não vê actions; dado fora de casa |
| PostHog (produto completo) | funis/retention prontos, free tier generoso | peso de SDK no cliente; dado pessoal num terceiro; excesso para 10 usuários |

### O modelo mínimo que responde às perguntas do prompt (§15)

- **`usage_events`** (curta vida, 90 dias): `user_id`, `event_key` (enum fechado: `module_open`, `action`, `session_start`, `install`, `error_boundary`), `module_key`, `action_key?`, `device_class` (desktop/mobile/tablet — derivado no servidor), `occurred_at`. **Sem payload de conteúdo, sem URL completa, sem IP.** Escrita: helper `track()` no layout de cada módulo (server-side, 1 insert não bloqueante) e nas actions relevantes (uma linha por sucesso).
- **`usage_daily`** (permanente): rollup por `dia × user × module × device_class` com contagens — alimentado por cron diário (o mesmo padrão de cron autenticado herdado). Painéis leem SÓ o rollup (barato e sem PII fina).
- Erros/performance continuam no Sentry (link direto do painel).

## 2. As telas da área ADM

| Tela | Conteúdo | Fonte |
|---|---|---|
| **Visão geral** | usuários ativos (dia/semana/mês), novos no período, instalações PWA, sessões por dispositivo (desktop×mobile×tablet), tendência 12 semanas | `usage_daily` |
| **Módulos** | ranking de módulos mais/menos usados; % de usuários que usam cada um; módulos ligados×usados de fato (o gap "liguei e não uso" orienta o roadmap) | `usage_daily` + `user_modules` |
| **Produto** | funil da Captura (criadas → organizadas → viradas em tarefa), taxa de retorno semanal, recursos recém-lançados: adoção nas 4 semanas | `usage_daily` + contagens agregadas por RPC (`count(*)` — nunca linhas) |
| **Usuários** | lista com metadados (e-mail, criado em, último acesso, módulos ativos, storage usado), criar usuário, **bloquear/desbloquear** (modelo corrigido do doc 09 §2.3), trocar papel, reset de senha forçado | Auth admin + `user_moderation` |
| **Sistema** | últimos crons (sync/e-mail/rollup) com status, e-mails enviados na semana, tamanho do banco/storage por usuário, versão em produção, saúde dos backups (data do último) | `metric_email_deliveries` herdada + novas tabelas de execução de cron |
| **Auditoria** | trilha administrativa (append-only) com filtro por ator/ação/alvo — a tela que faltava no legado | `admin_audit_events` |

## 3. Regras de privacidade da área (invariantes)

1. Nenhuma query da área ADM seleciona colunas de conteúdo — as RPCs de agregação devolvem números; teste-varredura garante que actions do admin não tocam tabelas de conteúdo fora da lista permitida (o padrão `guards.test.ts` herdado, apontado para um novo alvo).
2. `usage_events` não guarda título, texto, valor, URL com parâmetros — o enum fechado de `event_key`/`action_key` é a garantia estrutural (não dá para logar o que não existe no enum).
3. O usuário comum vê em Configurações **o que é coletado** (a lista acima, em português) — transparência barata que evita a sensação de vigilância num produto que guarda a vida da pessoa.
4. Dados de uso ficam DENTRO do banco do produto, sob o mesmo backup e a mesma exclusão de conta (apagar a conta apaga também seus eventos).

## 4. Fases

- **MVP:** telas Usuários (com o bloqueio corrigido) + Auditoria. É o mínimo para operar multiusuário com segurança.
- **Fase 2:** `usage_events`/`usage_daily` + Visão geral + Módulos + Sistema.
- **Futuro:** funis de Produto, retenção por coorte, comparação entre versões.
