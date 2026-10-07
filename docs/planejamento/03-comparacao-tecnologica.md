# C — Comparação tecnológica (backend/dados)

**Pergunta:** onde vivem dados, autenticação, storage e realtime do novo Segundo Cérebro?
**Premissas decididas:** custo-alvo ~zero (D-014), ~10 usuários pessoais sem billing (D-011), novo projeto de banco em vez de reaproveitar o atual (Q2/D-007), sem migração de dados (D-008). Requisitos do produto que pesam na escolha: modelo **fortemente relacional** (Financeiro com fatura/parcelas/transferências; grafo de conhecimento com vínculos polimórficos), **RLS/isolamento por usuário** como fundação, Cofre **E2E no cliente** (agnóstico de backend), sincronização multi-dispositivo, PWA com push futuro.

> Preços e limites citados são **valores de referência de conhecimento geral** — conferir nos sites na contratação; nada aqui foi verificado ao vivo.

---

## 1. Candidatos e veredito por critério

| Critério | **Supabase** (novo projeto) | **Postgres gerenciado + backend próprio** (Neon/Railway + Better-Auth + R2/S3 + Drizzle) | **Firebase** (Firestore+Auth+Storage) | **Convex** | **PocketBase** (self-host) |
|---|---|---|---|---|---|
| Banco relacional (Financeiro, FKs, views, triggers) | ✅ Postgres puro | ✅ Postgres puro | ❌ NoSQL: fatura/parcelas/transferência viram desnormalização manual | ⚠️ documentos+relacionamentos próprios | ⚠️ SQLite (ok p/ 10 usuários, aperta depois) |
| Isolamento por usuário | ✅ **RLS nativa** — o time já domina (151 policies escritas e testadas no legado) | ⚠️ reimplementar no backend (toda query passa por código seu) | ⚠️ Security Rules — menos expressivas p/ este shape; sem views/joins | ⚠️ em código de função | ⚠️ regras próprias, mais simples |
| Autenticação | ✅ pronta (e-mail/senha, OAuth, TOTP, ban) | ❌ montar e operar (Better-Auth/Lucia + sessões + reset + MFA) | ✅ pronta e madura | ✅ integra Clerk/etc. | ✅ básica pronta |
| Storage + URLs assinadas | ✅ pronto (padrões do legado reutilizáveis; signed **upload** URLs resolvem o cookie httpOnly — doc 09) | ⚠️ R2/S3 direto (barato, mais fiação: presigned, limpeza, políticas) | ✅ pronto | ⚠️ file storage próprio | ✅ embutido |
| Realtime (sync entre dispositivos, fase futura) | ✅ nativo por tabela | ❌ construir (LISTEN/NOTIFY + WS) | ✅ nativo (é o forte) | ✅ nativo (é o forte) | ✅ subscriptions |
| Grafo (backlinks, vizinhança, profundidade) | ✅ CTE recursiva + índices; RPC | ✅ idem | ❌ N consultas por salto; sem recursão | ⚠️ possível, manual | ⚠️ SQL limitado via API |
| Aproveitamento do que o time já sabe | ✅✅ **852+ testes, 24 migrations, docs e lições escritas contra este modelo** | ⚠️ SQL aproveita; auth/storage/RLS recomeçam | ❌ quase nada aproveita | ❌ | ⚠️ pouco |
| Custo no cenário inicial (~10 usuários) | **R$ 0** (Free: ~500 MB banco, ~1 GB storage, 50k MAU; pausa após ~1 semana sem tráfego — os crons diários tendem a evitar) | ~R$ 0–5/mês (frees de Neon/R2), **mas custo em semanas de construção** | R$ 0 (Spark) — porém leituras cobradas moldam o design | R$ 0 (free tier) | ~US$ 3–6/mês de VPS + **operar você mesmo** (contradiz custo-zero de esforço) |
| Degrau seguinte de custo | US$ 25/mês (Pro: 8 GB, backups diários 7d, sem pausa) | US$ 19–39 somando peças | imprevisível (por leitura/egresso) | US$ 25/mês | VPS maior |
| Lock-in / portabilidade | ⚠️ **médio-baixo:** schema+RLS são Postgres puro (`pg_dump` sai inteiro); Auth exporta usuários com hash bcrypt; Storage tem protocolo S3-compatível p/ egresso | ✅ mínimo | ❌ **alto** (dados, rules e SDKs proprietários) | ❌ alto (queries TS proprietárias) | ✅ baixo (arquivo SQLite) |
| Operação/manutenção | ✅ gerenciado; migrations via CLI | ⚠️ vários fornecedores para orquestrar | ✅ gerenciado | ✅ gerenciado | ❌ backup/updates/uptime por sua conta |
| Adequação ao Cofre E2E | ✅ indiferente (bytes cifrados no cliente) — vale para todos | ✅ | ✅ | ✅ | ✅ |

## 2. Análise dos três principais

**Supabase (recomendado).** O produto é relacional até o osso e a *fundação de segurança inteira do legado* (RLS por dono, revokes, "RLS sem policy" para segredos) é conhecimento vivo do projeto — jogá-la fora é o maior custo escondido das alternativas. Os problemas encontrados no diagnóstico **não são do Supabase**: são de processo (migrations à mão, sem registro) e de modelagem pontual (bloqueio em tabela editável), e ambos têm correção estrutural planejada (docs 02/09). O free tier cobre ~10 usuários com folga (o maior consumidor será o Drive — 1 GB; a cota por usuário vira política de produto). Riscos aceitos e mitigação: pausa por inatividade (crons diários já geram tráfego; alarme de "projeto pausado" no e-mail), backup no Free é por conta própria (herdar e agendar o `backup.ps1`/equivalente em CI — doc 09), 2 projetos no Free (produção + um de teste/e2e — exatamente o que falta hoje para o e2e rodar no CI; alternativa: `supabase start` local no CI, custo zero).

**Postgres gerenciado + backend próprio.** É a rota de máxima portabilidade e controle — e a de maior custo de fundação: auth (sessões, reset, MFA, ban), storage assinado, camada de autorização substituindo RLS, realtime futuro… semanas de infraestrutura antes da primeira tela útil, para 10 usuários. Fica documentada como **rota de saída**: como o schema proposto é Postgres puro e o domínio fica isolado da SDK (doc 02), migrar para essa arquitetura depois é um exercício de troca de adaptadores, não de reescrita.

**Firebase.** Forte em realtime/auth/ops — mas o Firestore penaliza exatamente o que o Segundo Cérebro mais faz: agregações do Financeiro (somas por mês/fatura/categoria viram fan-out de leituras cobradas ou contadores desnormalizados a manter à mão), joins do grafo, views com `security_invoker`. Security Rules não expressam "RLS sem policy + service role" com a mesma nitidez. Lock-in alto e migração futura cara. **Descartado com convicção.**

**Convex / PocketBase (menções honestas).** Convex tem o melhor DX de sync do mercado, mas acopla o domínio às suas queries TS proprietárias — o oposto do "Núcleo portátil" (ADR-0002). PocketBase é encantador para app pessoal, mas single-node SQLite + operação própria brigam com multiusuário/backup gerenciado/custo-zero **de esforço**.

## 3. Recomendação

> **Supabase, em projeto novo**, com as disciplinas que o diagnóstico cobrou: migrations versionadas e aplicadas por pipeline (CLI, nunca SQL Editor à mão), tipos gerados (`supabase gen types`) como fonte, RLS herdando o padrão do legado + correções do doc 09, e2e contra Supabase local/de teste no CI, e camada de domínio isolada da SDK para preservar a rota de saída.

Frontend/hosting continuam **Next.js 15 + Vercel Hobby** (detalhado no doc 02): o legado provou o par, os dois crons cabem no Hobby (limite: 2 crons diários), e o uso é pessoal (o Hobby veta uso comercial — se um dia virar SaaS pago, D-011 muda e o plano sobe junto).

**Degraus de custo mapeados (para o registro):** R$ 0 (hoje) → Supabase Pro US$ 25 (quando: >500 MB de banco, >1 GB de arquivos, necessidade de backup gerenciado/PITR ou fim da tolerância à pausa) → Vercel Pro US$ 20 (quando: uso comercial, mais crons, ou funções mais longas) → Resend/e-mail com domínio próprio (~R$ 0, exige domínio) → Upstash/observabilidade conforme necessidade. Cenário 100 usuários ativos: ~US$ 45/mês; 1.000: ~US$ 70–120/mês (dominado por storage/egresso do Drive).

**Decisão final é do Kauan** — confirmação pedida na rodada 2 (Q-R2).
