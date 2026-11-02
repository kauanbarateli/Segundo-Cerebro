# Código atual, integração e validação

## Base e estado conhecido

Análise em 31/10/2026 sobre `bd35288404c493d1b03f7a1a0208f808cc2079a2`, main com PR #120 incorporado. Snapshot e auditoria não provam o estado futuro; cada frente faz fetch e reconcilia diferenças antes de editar.

O [doc16 da base](base-planejamento-completo/16-auditoria-supabase.md) é a evidência de banco: 67 tabelas esperadas com RLS, 357 rotinas, 33 políticas, 408 constraints, 191 índices e 98 triggers não internos. Há 27 arquivos de migrations e cinco registros no ledger. O release-catalog executado em leitura fez 2.512 checks e encontrou exatamente uma diferença, correspondente ao wrapper PT409 de onboarding já instalado. Preservar o patch; corrigir a representação formal/teste da release, não o erro de negócio que ele resolve.

Não aplicar migrations antigas ausentes do ledger por contagem. Não fazer reset, seed ou reparo cego. Antes de novas alterações remotas: prova de equivalência, dependências, plano aditivo, QA, backup/recuperação adequados e autorizações aplicáveis. Auditoria não inspecionou conteúdo privado, configuração completa de Auth/SMTP, backups/PITR ou funcionamento das telas.

## Mapa para a Frente A

Mapa completo e contratos de autoria no [doc08](08-detalhamento-frente-a.md#mapa-técnico-documental-e-autoria). Pontos principais:

| Fluxo | Arquivos existentes de partida |
|---|---|
| Landing/login | `src/components/features/conheca/`; `src/components/features/auth/`; `src/app/conheca/page.tsx`; `src/app/icon.svg` |
| Header/tema/overlays | `src/components/layout/workspace-shell.tsx`; `src/components/theme/`; `src/components/ui/dialog.tsx`, `focus-stack.ts` |
| Captura/conhecimento | `src/components/editor/document-editor.tsx`; `src/components/features/capturar/`; `src/components/features/conhecimento/` |
| Configurações/projetos | `src/components/features/configuracoes/`; `src/components/features/projetos/`; `src/components/layout/entity-image-editor.tsx` |
| Calendário | `src/components/features/calendario/calendar-workspace.tsx`, `calendar-list.tsx`, `calendar-aside.tsx`, `calendar-event-detail.tsx`, `calendar-people.tsx` |

## Mapa para a Frente B

| Área | Evidência / impacto |
|---|---|
| Auth | `src/lib/auth/service.ts`, `runtime.ts`, `flow-state.ts`; `src/app/auth/callback/route.ts` é recovery, não callback genérico de cadastro. Novo cadastro exige canal próprio. |
| Guards/SQL | `supabase/migrations/20261007151834_identity_foundation.sql` e camadas de autorização atuais; `has_feature` permite na ausência de veto. Admissão pública não pode depender só da UI. |
| Admin existente | `src/core/admin/`, `src/adapters/db/admin-runtime.ts`, `src/app/api/admin/route.ts`; preservar saga e acesso do Master. |
| Onboarding | `supabase/migrations/20261023061901_onboarding_foundation.sql`; origem atual aponta para `admin_operations`. Expandir discriminante/constraints para origem pública comprovada, sem operação Admin falsa. |
| Patch real | `supabase/operations/onboarding-conflict-code.sql`; conciliar com `supabase/tests/release-catalog.sql`. |
| Navegação/config | `src/lib/navigation/routes.ts` e pontos de composição do workspace; combinar autoria com A para novas rotas e disponibilidade. |
| Novos módulos | Criar features/ports/adapters conforme padrões atuais para admissão, atribuição, métricas e feedback; não há estruturas dedicadas encontradas no catálogo pesquisado. Atualizações começa como conteúdo versionado. |
| Contratos e tipos | Atualizar tipos de banco/contratos, catálogo release, SQL editor gerado e testes pertinentes quando migrations/rotinas mudarem; não editar só a tabela e deixar gates desatualizados. |

Os nomes finais de arquivos novos são decisão de implementação. As evidências da base não autorizam ler conteúdo de notas, finanças, Cofre ou dados pessoais de produção para testar.

## Relação com issues e PRs existentes

| Referência | Como tratar agora |
|---|---|
| #80 landing/onboarding | Sua convergência pertence ao PR #120. A01 acrescenta remoção de Princípios, tema/header/legais e comunicação gratuita. B01 acrescenta cadastro real; não reimplementar as nove etapas nem cadência. |
| #122 editor/Capturar | Preservar rail+documento, Reader/Edit, toolbar/schema, drafts/CAS. A03 expõe controles sob demanda; A04 adiciona captura contextual reutilizando o motor. |
| #125 Início/Configurações/navegação/Projetos | Preservar o que existe; A05 muda composição/densidade e cards específicos, A02 tema/painéis. Não reabrir Home/Drive/progresso sem delta identificado. |
| #74 calendário lista | Já fechada; A06 torna lista única e normaliza preferências/URLs. Não reabrir contrato já entregue nem antecipar escrita. |
| #71/#81/#44 | Aceites e épico anteriores permanecem intactos. Validar escopo novo sem declarar resolvidos aceites humanos ou pendências antigas. |
| #52/#53 e PRs #83/#84 | Contratos comerciais históricos. Não são bloqueadores do cadastro gratuito nem autorização para reintroduzir cobrança. |
| #126 Cofre | Fora do novo escopo. Smoke de overlay preserva proteção e não resolve automaticamente seu aceite. |
| PR #127 | Planejamento de aplicativo/offline/distribuição independente. Retirar o card de instalação não remove runtime nem cancela essa frente. |

Os comentários de pausa de 28/10 e os corpos de algumas issues antecedem o merge do PR #120; preservá-los como evidência da data. Novos tickets tratam deltas, sem fechar/reabrir/reescrever as issues anteriores por inferência. Se uma mudança posterior à base já satisfizer um aceite novo, registrar a prova e reduzir o diff.

## Gates proporcionais de implementação

Node segue `.nvmrc` e lockfile. Reaproveitar dependências existentes; evitar processo local pesado concorrente. Os comandos abaixo existem na base, mas só registrar PASS quando rodados no SHA candidato:

- `npm run typecheck`, `npm run check:layers`, `npm run check:design-system`, lint dos caminhos alterados e `npm run check:secrets`.
- Testes focados de comportamento alterado; E2E dos percursos completos em QA/fixture controlada. Não criar teste que replique classes CSS ou toda copy.
- Em dados/Auth: testes SQL/contratos, catálogo de release, `npm run check:sql-editor`, tipos do banco e negativos de grants/RLS/RPC; prova conectada de confirmação/recovery, bypass de Auth e isolamento. Não substituir integração real por mock.
- Build e CI completos nos gates exigidos pelo repositório. Caso runner/RAM impeça teste local, registrar pendência e executar no runner adequado; Vercel Pro não garante RAM local nem CI verde.

### Matriz visual A e novas telas B

320/390/768/1440 px, claro/escuro, sidebar expandida/recolhida quando aplicável, teclado, zoom 200%, reduced-motion, teclado virtual. Campos ≥16 px, alvos ≥44 px, contraste medido, foco visível/devolvido, nomes acessíveis. Um H1/ação primária por contexto, mensagens de falha/confirmação úteis. Estados vazio, loading, erro, conteúdo longo, sem imagem e muitos registros. Impeccable: ler skill do projeto, aplicar critique/audit/clarify/distill/polish conforme versão; não alterar tokens autorais para imitar outro produto.

### Matriz funcional B

Novo cadastro; e-mail existente; pendente pré-criado; email/link expirado; outro dispositivo; scanner de link; falha de rede após Auth antes de admissão; retry/reenvio; recovery legado; Auth direto sem intenção; metadata alterada; usuário banido; JWT revogado; usuário comum nas métricas; dois donos em feedback; escolha UTM negada/retirada/expirada; dados ausentes; bordas de período; conteúdo editorial sem dados privados; kill switch sem remover acesso legítimo.

### Aceite conjunto

Landing com CTA disponível → e-mail/senha → confirmação → onboarding opcional → dashboard; origem gravada uma vez e agregada apenas para Master; feedback recebido e próprio; atualizações autenticadas; tema preservado; captura sem perder contexto; calendário lista. Provar negativos via rotas/API/RPC diretas, não apenas ausência de botão. Sem checkout, Google login novo, escrita Calendar, ClickUp ou novo ADM.

## Liberação e reversão

Cadastro fechado até SMTP/redirects/gates aprovados. Migrations remotas são operações próprias: identificar projeto, backup, QA, plano e autorização antes de executar. Nunca apontar teste para produção por fallback. O cadastro tem kill switch server; UTM indisponível não bloqueia criação; recursos opcionais só aparecem quando reais. Preservar schema expandido em rollback e registrar compatibilidade das versões de aplicativo.

Para cada PR de execução: problema/resultado, issue, alterações, evidências por SHA, testes executados, pendências reais e reversão. A entrega deste planejamento não faz merge ou deploy. Somente a branch documental é incluída no mapa existente de preview desativado em `vercel.json`.
