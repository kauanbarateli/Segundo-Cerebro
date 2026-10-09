# I — Segurança e privacidade

**Princípio:** herdar a fundação que o diagnóstico classificou como forte (§6.2 do doc 01) e corrigir **na arquitetura** os três riscos altos e os médios — nenhum deles vira "ticket de melhoria futura"; ou entram na fundação, ou têm data.

---

## 1. O que se herda sem discussão (provado no legado)

RLS por dono em 100% das tabelas + `anon` fechado + padrão "RLS ligada sem policy + grants revogados" para segredos · toda Server Action começa com autenticação e a guarda de papel na primeira linha, com teste-varredura da ordem · AES-256-GCM + AAD por linha + `key_id`/versão para tokens de terceiros · state OAuth assinado com expiração e vínculo à sessão · cron com `timingSafeEqual`, falha fechada e "autorizar antes de parsear" · validação Zod com tetos + magic bytes em upload de imagem · Sentry por allowlist com teste de vazamento · login sem enumeração/open redirect · `getUser()` sempre; `getSession()` nunca · CSP com nonce · links externos validados.

## 2. Correções estruturais (o que muda em relação ao legado)

### 2.1 Sessão: cookies `httpOnly` + uploads por URL assinada de escrita
O legado deixou o cookie legível por JS **porque** o navegador falava direto com PostgREST/Storage. A nova arquitetura elimina a necessidade: toda leitura/escrita de dados passa por Server Components/Actions; uploads usam **signed upload URLs** geradas no servidor (o cliente recebe uma URL de uso único, nunca o JWT). Consequência: XSS deixa de capturar a sessão. É a mudança de maior alavancagem do documento.

**Nota operacional vigente — 07/10/2026:** a expressão histórica “uso único” acima não é uma garantia do Supabase. A documentação de [`createSignedUploadUrl`](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) garante validade de duas horas e envio sem autenticação adicional; não promete consumo único. O pipeline T-015 deverá tratar a URL como uma credencial temporária de escrita: caminho de staging exclusivo, sem sobrescrita, reserva e finalização idempotentes, validação/medição/re-encode no servidor e publicação de um objeto final que a URL de staging não possa alterar. Essa correção de premissa não atesta implementação de uploads. [Preparação e limites](../implementation/t015-uploads-preparation.md).

### 2.2 CSP em modo bloqueio desde o primeiro deploy
O mecanismo (nonce por requisição + hash de script de tema + testes que recalculam) está pronto no legado — herda-se **ligado** (`Content-Security-Policy`, não Report-Only), com `report-to` para o Sentry. Portão de CI: o teste de hash e um smoke que confere o header.

### 2.3 Moderação fora do alcance do usuário
`profiles.status` editável pelo dono foi o risco alto A2. No novo schema: tabela **`user_moderation`** separada (status, motivo, quem, quando) com RLS ligada e **nenhuma policy** (padrão-segredo — só service role). Bloquear = (1) ban no Auth + (2) **revogação imediata das sessões** (sign-out administrativo global) + (3) linha em `user_moderation`. Sem janela de JWT válido, sem PATCH possível, e `desbloquear` recusa o próprio id (fecha o agravante encontrado).

### 2.4 Auditoria append-only
`*_audit_events` nascem **sem policies de UPDATE/DELETE** (nem para o dono) e com escrita por trigger/RPC — o dono lê o próprio rastro, ninguém o edita. Vale para Cofre, Financeiro e admin (o admin já era assim; os outros dois eram o risco C-B2).

### 2.5 OAuth Google
Chave HMAC **própria e obrigatória** para o `state` (elimina a armadilha da chave vazia M1) · **PKCE** · gravar escopos **concedidos** (não os pedidos) · manter somente-leitura (escrita de eventos só entraria com decisão explícita futura, novo escopo e reconsentimento).

### 2.6 Rate limit persistente
Tabela `rate_limits` no Postgres com RPC atômica (janela deslizante) — sobrevive a cold start e vale entre instâncias, sem dependência nova (Upstash fica como upgrade documentado). Aplicado onde o legado não tinha: **login**, Cofre, uploads, rotas de API.

### 2.7 Autenticação de conta completa
Reset de senha por e-mail **no MVP** (era ausente) · troca de senha logado · TOTP (MFA do Supabase) oferecido nas Configurações (fase 2) · senha provisória criada pelo admin exige troca no primeiro login.

### 2.8 Observabilidade sem vazamento
Herdar allowlist + acrescentar `beforeSendTransaction` (o furo M5: transações saíam sem filtro) e corrigir o comentário/uso de `integrations` · barreiras de erro por segmento reportam ao Sentry (no legado só o global fazia) · logs de servidor sem PII (userId ok, conteúdo nunca).

### 2.9 Segredos e operação
`.env.local` **fora de qualquer pasta sincronizada** (alerta já dado; a fonte de verdade dos segredos passa a ser o cofre de env da Vercel + `.env` local em `%USERPROFILE%` não sincronizado) · rotação documentada com data (a infra de `key_id` herdada torna barato) · migrations aplicadas por pipeline com secret de CI — nunca SQL Editor à mão (mata a classe "não sei o que está aplicado") · varredura de segredos no bundle herdada do CI + ampliada (service role, `GOCSPX`, JWT).

## 3. Cofre — a área mais sensível (modelo a validar, Q-R2)

**Recomendação: manter o modelo E2E do legado** (Argon2id no cliente + AES-GCM; servidor só vê material cifrado; kit de recuperação em duas metades com prova byte a byte), que o diagnóstico apontou como o ponto alto do produto — **com estas evoluções**:

1. **AAD por item** (`user_id:item_id:versão`) — troca/rollback de payload entre itens passa a ser detectável (fecha C-B8).
2. **Chave de sessão não-extraível**: a chave de dados opera como `CryptoKey` `extractable:false` no uso diário; a exportável existe só dentro do fluxo de gerar kit (reduz o prêmio de um XSS).
3. Item que não decifra **aparece como "item ilegível"** com ação de diagnóstico — nunca some em silêncio.
4. Teto de payload validado no servidor; `logAudit` deixa de ser action de texto livre (enum + Zod).
5. Senha mestra: mínimo 10 + verificação de força; auto-lock herdado (5 min) + lock ao esconder a aba; limpeza de área de transferência após copiar (30 s).
6. **Consequência mantida e assinada pelo usuário na criação:** perdeu senha + kit → irrecuperável. É o preço do servidor cego, e o produto diz isso com todas as letras (tela de criação exige confirmar).
7. Reautenticação para abrir o Cofre continua sendo a senha mestra em si (não a senha de login) — sessões longas não abrem o Cofre sozinhas.

**Alternativa descartada (com motivo):** cofre recuperável pelo servidor (chave escrow) — simplifica recuperação, mas rebaixa o Cofre a "dados como os outros" e contradiz o requisito de privacidade máxima; o kit de recuperação já cobre o cenário de perda com responsabilidade do dono.

## 4. Privacidade (produto pessoal, mas multiusuário)

- Isolamento por usuário é a fundação (RLS); **admin vê metadados e agregados, nunca conteúdo** — o doc 10 define o telemetria-mínima (chaves de evento, nunca payload).
- Exportação dos próprios dados (JSON/CSV por módulo) e exclusão de conta completa (cascade + storage + Auth) entram como direitos do usuário na fase 2 — barato agora, caro depois.
- E-mails (semanal/notificações) só com opt-in por usuário (o legado enviava a todos sem opção — corrigido no desenho).
- Backups: cifrados em repouso no destino, fora de pastas sincronizadas, com ensaio de restauração semestral (herda o runbook e o rigor do `backup-e-restore.md`).

## 5. Portões de segurança no CI

1. Varredura de segredos no bundle (herdada, ampliada).
2. Teste de hash da CSP + smoke do header em bloqueio.
3. Varredura das actions: toda action de admin com `requireMaster()` primeiro; toda action de módulo com autenticação e rate-limit onde declarado (o padrão de teste-varredura do legado, generalizado).
4. `verificacao.sql` da nova era: script de asserções de RLS/grants **rodando contra o Supabase local no CI** — o que o legado tinha como script manual vira teste.
5. `npm audit` de produção (herdado).
