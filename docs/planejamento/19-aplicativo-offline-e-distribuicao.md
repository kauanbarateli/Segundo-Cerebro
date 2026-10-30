# Q — Aplicativo instalável, offline e distribuição em lojas (estudo)

**Estado:** estudo de planejamento de 30/10/2026, pedido pelo mantenedor. **Sem aprovação, issues, código, dependências, migrations ou ADR.** Nada aqui autoriza execução; cada fase depende das decisões da seção 12.

**Base observada:** `main` em `bd35288` (merge da PR #120). Produção `rishenjoikgmfubmnfiu` com migrations 001–027, catálogo com 2.512 verificações sem desvios e publicação `dpl_9sE2Ph3xcT8Wc4jik4ihP2BLsUP5` em `www.segundocerebroapp.com.br` ([registro](../implementation/retomada-aceites-20261029.md)).

**Legenda:** **OBSERVADO** = conferido no código, no banco ou no painel nesta data. **INFERIDO** = dedução a confirmar em spike. **RECOMENDADO** = proposta deste estudo, depende de decisão. Prazos são estimativas INFERIDAS para um desenvolvedor com apoio de agentes, sem contar a espera de revisão das lojas.

---

## 0. Resumo

1. **É possível**, mas são dois projetos de tamanhos muito diferentes:
   - **Instalador para Windows e Linux com o app online dentro:** complexidade média, de 3 a 6 semanas, mais o custo de assinatura no Windows.
   - **App que funciona offline e sincroniza ao reconectar:** complexidade muito alta, vários meses, com risco real de dados se a sincronização errar.
2. **A base atual ajuda mais do que parece** (OBSERVADO):
   - O Núcleo (`src/core/`) é TypeScript puro, sem framework, e já roda no navegador no modo demonstração.
   - O cliente tem uma interface `ClientApplication` com duas implementações: demonstração local em memória e conectada ao servidor.
   - Toda escrita já é um comando com `client_id` idempotente, revisão por módulo, recibo e evento de domínio. Quando a revisão está desatualizada, o servidor relê e reexecuta o comando.
   - Capturar e Conhecimento já têm tela de conflito.
3. **O que pesa** (OBSERVADO): o navegador nunca fala com o Supabase, as páginas protegidas são autorizadas no servidor, o service worker não guarda nada pessoal, toda escrita exige sessão ativa, há limite de 30 escritas por minuto, as imagens são processadas no servidor, e Google, onboarding e cobrança dependem de rede.
4. **RECOMENDADO:**
   - **Modelo:** offline por **fila de comandos** (nível N3, seção 3), módulo a módulo, começando por Capturar e Tarefas. A leitura offline vem de snapshots cifrados no aparelho.
   - **Financeiro:** por último e possivelmente só leitura.
   - **Não adotar:** "local-first" completo com CRDT.
5. **Lojas:**
   - **Viáveis com pouco código:** Google Play (TWA ou Capacitor) e Microsoft Store (PWA empacotado em MSIX, a loja assina e a conta individual é gratuita).
   - **Exige app nativo de verdade:** Apple (iPhone, iPad e Mac). Lá o service worker não funciona dentro do app embrulhado, e o offline depende de armazenamento nativo.
   - **Cobrança:** é a primeira coisa a decidir antes de qualquer loja. As regras de Google e Apple para assinatura digital no Brasil mudaram em 2026.

---

## 1. Pedido e escopo

O que o mantenedor pediu, nesta conversa:

1. Uma **orientação de instalação no começo da `/conheca`**, mudando a dinâmica de entrada no produto.
2. **Arquivos de instalação para Windows e Linux** baixados pela própria página, que instalam o app "normalmente".
3. Um **app que funcione offline** no Windows e no Linux e que, ao reconectar, envie os dados da pessoa para o banco.
4. **Publicação futura** na Google Play, na loja da Apple (iPhone e Mac) e para desktop.

**Fora deste documento:** criação de issues, código, dependências, migrations, mudança em `vercel.json`, contratação de contas de loja ou certificados, e alteração do escopo comercial (ADR-0009, ADR-0010).

---

## 2. O que existe hoje (OBSERVADO)

### 2.1 Distribuição e PWA

| Peça | Estado | Onde |
|---|---|---|
| Manifesto | `standalone`, ícones comuns e maskable, atalhos (Capturar, Tarefas, Financeiro), `share_target` POST multipart, `launch_handler` | `src/app/manifest.ts` |
| Service worker | Serwist 9.5.13. Faz precache do shell público, navegação `NetworkOnly` e fallback para `/offline`. **Nenhuma API, RSC, URL assinada ou página pessoal vai para cache** | `src/app/sw.ts` |
| Instalação | `beforeinstallprompt` e ajuda de instalação, usados em Configurações | `src/components/pwa/install-provider.tsx`, `install-help.tsx` |
| Página offline | Existe, sem dados | `src/app/offline/page.tsx` |
| Deploy da `main` | `vercel.json` com `git.deploymentEnabled.main=false`: a produção é publicada manualmente | `vercel.json` |
| Domínio de produção | Alias `www.segundocerebroapp.com.br` atribuído manualmente; não acompanha novas implantações sozinho | painel Vercel |
| Instalação relatada | Chrome no iPhone 11 (iOS) e no A35 (Android), relato humano de 13/10 | issue #12 |

### 2.2 Caminho dos dados

```
Navegador ──fetch──▶ /api/* (35 rotas Next) ──▶ runtime/adapters (src/adapters/db, 63 arquivos)
                                                  │  Núcleo TS executa o caso de uso
                                                  ▼
                                   RPC Supabase (service_role) ──▶ 374 definições de função SQL
```

- **O navegador nunca acessa o Supabase.** Só existe `createServerClient` (`src/lib/auth/clients.ts`, `middleware-session.ts`). Os cookies de sessão são `httpOnly`, `sameSite=lax`, `path=/` (`src/lib/auth/cookie-policy.ts`).
- **As páginas autenticadas são protegidas no servidor.** O layout chama `requireUser()` e cada página chama `authorizeWorkspaceFeature()` antes de renderizar (`src/app/(workspace)/layout.tsx` e `*/page.tsx`). Os dados vêm depois, pelo cliente, por `/api/*`.
- **Volume no banco:** 27 migrations com 374 definições de função. Grande parte das invariantes atômicas e da proteção de isolamento vive em plpgsql.

### 2.3 Como uma escrita acontece hoje

Exemplo de Capturar e Tarefas (`src/adapters/db/capture-task-store.ts`); Financeiro e Projetos/Hábitos seguem o mesmo desenho:

1. O servidor lê o **snapshot completo do módulo** daquele Usuário, com revisão monotônica, entidades, eventos e recibos (`*_snapshot`, sem paginação silenciosa).
2. O **Núcleo TS** executa o caso de uso sobre esse snapshot e calcula mudanças, eventos e recibo.
3. O servidor chama `*_commit` com `expectedRevision`. O SQL confere o recibo por `(usuário, comando, client_id)`, confere a revisão e grava mudanças, eventos e recibo **na mesma transação** (ADR-0004).
4. Se a revisão mudou (`stale`), o servidor **relê o snapshot e reexecuta o comando**, até 3 tentativas (`capture-task-store.ts:217`, `finance-store.ts:81`, `projects-habits-store.ts:64`).
5. Toda RPC passa por `app_private.require_actor(p_user, p_session)`. **A sessão do Auth precisa estar ativa** e sem troca de senha obrigatória.
6. Há limite de **30 escritas por minuto por Usuário** no escopo `capture_task_write`, compartilhado por Capturar, Tarefas e Financeiro, e mais 30 no escopo `identity_write`. Ao estourar, o servidor devolve `retry_after_ms`.
7. **Entitlements** são conferidos no SQL por Funcionalidade (por exemplo, `file_guard`).

### 2.4 O que já existe no cliente e serve ao offline

| Peça | O que faz | Onde |
|---|---|---|
| `ClientApplication` | Interface única da UI, com duas implementações: demonstração (`createDemoApplication`) e conectada (`createConnectedApplication`) | `src/lib/demo/demo-provider.tsx`, `connected-application.ts` |
| Adaptador em memória | `UnitOfWork` completo com entidades, eventos e recibos idempotentes, usado na demo e como harness de contrato | `src/adapters/memory/index.ts` |
| Diário de comandos | `localStorage` v1. Guarda só o DTO de domínio, com época de sessão e limites de 256 KiB e 600 KiB. **Aceita um envio pendente por vez** (`PENDING`) e detecta troca de sessão (`SESSION_CHANGED`) | `src/lib/demo/command-journal.ts` |
| Diários de Metas e Séries | Intenções pendentes com Web Locks, época, reconfirmação e prova terminal | `src/lib/finance-goals-journal.ts`, `finance-series-journal.ts` |
| Rascunhos | Rascunho local por Usuário em Capturar; preferência de apresentação em Tarefas | `capture-view.tsx`, `tasks-workspace.tsx` |
| Tela de conflito | Escolha explícita entre a versão do servidor e o rascunho, com releitura validada | Capturar e Conhecimento (PR #120) |
| Cofre | Criptografia no cliente (Argon2 em worker, `hash-wasm`); o servidor guarda só cifra e revisões | `src/core/cofre`, `src/adapters/crypto` |

### 2.5 O que depende do servidor por natureza

| Área | Por quê |
|---|---|
| Imagens e anexos | Reserva de upload, processamento com `sharp` (rotação, EXIF, dimensões) no servidor, buckets privados, URLs assinadas que expiram (`files-processor.ts`) |
| Google Calendar | OAuth e tokens cifrados no servidor (`GOOGLE_CALENDAR_TOKEN_KEY`), sincronização por cron, somente leitura (ADR-0008) |
| Onboarding | Rodadas, intenções e recibos no servidor, retenção de 720 h por `pg_cron` |
| Busca global e Atividade | RPCs `global_search` e `activity_page` |
| Admin, sessões próprias, troca de senha | Exigem autoridade do servidor |
| Cobrança (futura) | Asaas e webhooks (ADR-0009, ADR-0010) |
| Entitlements | Concedidos e revogados só pelo servidor (CONTEXT.md) |

### 2.6 Decisões vigentes que afetam este estudo

- **Doc 07** (estratégia web + app): o PWA é o único artefato nas fases 1–2. A ordem do offline já prevista é: outbox de captura em IndexedDB, leitura do último estado e edição offline só se a dor existir. **CRDT fica fora.** Capacitor é a rota futura para o nativo.
- **ADR-0001:** o Usuário é a unidade de isolamento; dado no aparelho continua sendo de um único Usuário.
- **ADR-0002:** o Núcleo é a única porta para os dados; nenhum atalho do cliente direto para tabelas.
- **ADR-0003:** Entitlement e Preferência são separados.
- **ADR-0004:** toda escrita emite evento na mesma transação. Uma escrita offline só vira fato quando o servidor a aceitar.
- **ADR-0005:** sem IA dentro do app.
- **ADR-0006:** Financeiro com séries finitas.
- **ADR-0008:** Google Calendar somente leitura.
- **ADR-0011:** Metas com reservas virtuais.
- **ADR-0012:** cadência de Hábitos com vigência.
- **AGENTS.md:** CI, build e deploy nunca aplicam migrations; migrations seguem a OP-009, com aplicação supervisionada e registro; segredos fora do Git.

### 2.7 Lições operacionais de 30/10 que valem para este projeto

- **SQL Editor e quebras de linha:** o editor converte o texto colado para CRLF, e as funções históricas de produção têm CRLF. Travas que fazem hash ou procuram trecho multilinha no texto bruto recusam funções íntegras. Toda migration futura deste projeto deve normalizar CRLF→LF nas travas ([registro](../implementation/retomada-aceites-20261029.md)).
- **Supabase no plano atual:** a proteção contra senhas vazadas exige o plano Pro. Um app instalável e mais exposto aumenta o peso desse risco.
- **Produção é publicada manualmente** (deploy da `main` desligado e alias de domínio manual). Um canal de atualização de app precisa conversar com esse fluxo.

---

## 3. Níveis de offline

| Nível | O que a pessoa tem | Custo | Recomendação |
|---|---|---|---|
| **N0** | App online instalável (PWA) | Já existe | Manter |
| **N1** | Abre sem rede e mostra aviso honesto | Já existe parcialmente (`/offline`) | Melhorar o aviso |
| **N2** | Lê o último estado sincronizado, sem escrever | Médio | **Fazer** para os módulos principais |
| **N3** | Escreve offline em fila; sincroniza ao reconectar; conflitos explícitos | Alto, por módulo | **Fazer** em Capturar e Tarefas primeiro |
| **N4** | Banco local como fonte primária, sincronização bidirecional contínua, merge por campo ou CRDT | Muito alto | **Não fazer** (contraria o doc 07 e o ADR-0004) |

A pergunta do mantenedor ("funciona offline e envia ao reconectar") corresponde a **N2 + N3**.

---

## 4. Arquitetura recomendada para o offline (N2 + N3)

### 4.1 Visão geral

```
                 ┌──────────────── aparelho ────────────────┐
UI (React) ───▶ OfflineApplication (3ª implementação de ClientApplication)
                 │  leitura: snapshot local cifrado por módulo
                 │  escrita: Núcleo TS local → resultado provisório
                 │           + entrada na fila (comando, client_id, revisão base)
                 └──────── sincronizador ────────┘
                        │ desce: *_snapshot / *_revision        (servidor → aparelho)
                        │ sobe: mesmos comandos de /api/*       (aparelho → servidor)
                        ▼
                  servidor atual (Núcleo + RPC + eventos + recibos)
```

Princípio: **o servidor continua sendo a fonte da verdade.** O aparelho guarda uma cópia de leitura e uma fila de intenções. Nada que esteja só no aparelho é tratado como fato.

### 4.2 Terceira implementação de `ClientApplication` (RECOMENDADO)

- **`OfflineApplication`:** mesma interface que a UI já usa, combinando três peças:
  - **Núcleo:** os casos de uso do Núcleo, como na demo.
  - **Repositório local:** um repositório persistente, no lugar do adaptador em memória.
  - **Sincronizador:** fala com a implementação conectada.
- **Vantagem:** as telas não mudam de contrato. O trabalho fica no adaptador local, na fila e no sincronizador.
- **O adaptador em memória vira oráculo de teste:** a mesma sequência de comandos deve produzir o mesmo estado no adaptador local e no servidor.

### 4.3 Armazenamento local e criptografia

| Ambiente | Armazenamento | Chave |
|---|---|---|
| Navegador e PWA | IndexedDB | Chave AES-GCM não exportável (WebCrypto) guardada no próprio IndexedDB; protege contra leitura casual do disco, não contra malware |
| Desktop (Tauri ou Electron) | SQLite no diretório do app | Chaveiro do sistema (Credential Manager no Windows, Secret Service no Linux) |
| Mobile nativo (Capacitor) | SQLite por plugin | Keychain (iOS) ou Keystore (Android), com biometria opcional |

- **Minimização:** guardar só os módulos que a pessoa liga para uso offline.
- **Limpeza:** apagar tudo ao sair da conta, ao revogar a sessão ou ao trocar de Usuário.
- **Escopo:** o diário atual (`command-journal.ts`) já limita o que é guardado ("só o DTO de domínio, nunca cabeçalhos, cookies, credenciais ou URLs de upload"). A regra deve continuar.
- **Cofre:** o conteúdo já é cifra. A senha-mestra **nunca** vai para o armazenamento local.

### 4.4 Descida de dados (servidor → aparelho)

1. **Primeira carga:** baixar o snapshot completo de cada módulo habilitado (`capture_task_snapshot`, `finance_snapshot`, `projects_habits_snapshot`, `knowledge_snapshot` e outros) pelas rotas `/api/*`, com a sessão ativa.
2. **Atualização barata:** comparar a revisão local com `*_revision`; só baixar de novo quando mudou.
3. **Crescimento:** o snapshot é completo e hoje inclui eventos e recibos. Para contas com anos de dados, isso cresce. **INFERIDO:** em algum momento será preciso um **feed incremental** a partir de `public.domain_events`, que já tem índice `(user_id, occurred_at, id)` e guarda `before` e `after`. Isso exige migration nova (seção 8).
4. **Limites do feed:** o Cofre emite só metadados e o onboarding é apagado na retenção. O feed não substitui o snapshot desses módulos.

### 4.5 Subida (fila de comandos)

- **O que a fila guarda:** a intenção, não diferenças de tabela. Cada entrada leva comando, entrada validada, `client_id`, revisão base, Usuário e época de sessão.
- **Reenvio:** pelas **mesmas rotas `/api/*`**. O servidor reexecuta o Núcleo sobre o estado atual, revalida no SQL, emite eventos e grava recibo. **O ADR-0004 continua intacto.**
- **Idempotência:** já existe. Reenviar o mesmo `client_id` devolve o recibo, sem duplicar (`replayed`).
- **Ordem:** FIFO por módulo. Um comando que depende de outro, como "criar tarefa" seguido de "concluir tarefa", espera o anterior.
- **Ritmo:** respeitar o limite de 30 por minuto e o `retry_after_ms`. Uma fila de 200 itens leva no mínimo cerca de 7 minutos. INFERIDO: avaliar um escopo de limite próprio para sincronização ou uma rota em lote (seção 8).
- **Mudança necessária no diário atual:** hoje ele aceita **um envio pendente por vez**. A fila offline precisa de várias entradas, com estado por entrada (pendente, enviando, confirmada, rejeitada, conflito).
- **Gatilhos:** reconexão (`online`), abertura do app, intervalo periódico. Background Sync não existe em todos os navegadores e não deve ser o único gatilho.

### 4.6 Conflitos

| Classe | Exemplo | Tratamento |
|---|---|---|
| Reenvio duplicado | Rede caiu depois do commit | Recibo idempotente devolve o resultado (já existe) |
| Revisão do módulo mudou, comando ainda válido | Outro aparelho criou uma tarefa | O servidor relê e reexecuta (já existe, até 3 tentativas) |
| Conflito semântico | Editar uma tarefa apagada em outro aparelho; documento com versão diferente | Fila de conflitos por módulo, com escolha explícita, no modelo da tela de Capturar |
| Invariante de dinheiro | Reserva de Meta acima do disponível; série alterada | **Rejeitar e explicar.** Nunca mesclar valores automaticamente |
| Direito revogado | Entitlement retirado enquanto offline | Rejeitar com mensagem própria; manter o rascunho exportável |

### 4.7 Sessão e autenticação offline

- **Primeiro uso exige rede.** É preciso entrar online pelo menos uma vez para baixar os dados e criar a chave local.
- **Toda RPC exige sessão ativa** (`require_actor`). Se a sessão expirou ou foi revogada em "Sessões" enquanto o aparelho estava offline, a fila **só sobe depois de um novo login**.
- **Troca de conta no aparelho:** como já ocorre no diário (`SESSION_CHANGED`), a fila de outro Usuário nunca sobe com a sessão atual.
- **Desbloqueio local (RECOMENDADO):** PIN ou biometria do sistema para abrir os dados offline, com prazo máximo sem rede (por exemplo, 7 a 30 dias). Depois disso, os dados ficam bloqueados até o login online. O valor é decisão do mantenedor.
- **Sessão revogada ao reconectar:** a política proposta é bloquear e oferecer exportação do que ficou na fila antes de apagar. Decisão do mantenedor.

### 4.8 Entitlements e Preferências offline

- **Guardados com validade.** Offline, a UI usa a última cópia; o servidor reconfere tudo no reenvio.
- **Preferências** (tema, ordem, valores ocultos) podem ser locais e sincronizadas como comando comum.

### 4.9 Arquivos e imagens

- **Offline:** a imagem fica no aparelho como Blob cifrado, ligada ao comando na fila.
- **Ao reconectar:**
  1. Reservar o upload.
  2. Enviar os bytes.
  3. Aguardar o processamento com `sharp` no servidor.
  4. Só então enviar o comando que referencia o arquivo.
  O protocolo de reserva e observação de upload já existe (`files/uploads`, `files/uploads/observe`).
- **Leitura offline:** as URLs assinadas expiram, então não servem de cache. É preciso guardar os bytes cifrados localmente, com teto de espaço.
- **Tamanho:** limites de anexo e de pixels já existem no Núcleo (`core/drive`). A fila precisa de um teto total configurável.

### 4.10 Cofre

- **Leitura offline é viável:** os itens são cifrados no cliente e o desbloqueio com a senha-mestra (Argon2) roda localmente.
- **Escrita offline: RECOMENDADO adiar.** Envolve revisões do Cofre, troca de senha, kit de recuperação e conflito sobre segredos. O risco de perda é alto e o ganho é pequeno.

### 4.11 Busca, Atividade e Início

- **Busca offline:** índice local sobre os snapshots baixados (INFERIDO: busca simples por título e texto no cliente), com aviso de que a busca completa exige rede.
- **Atividade:** só o que já foi baixado.
- **Início:** depende dos módulos que estiverem disponíveis offline.

### 4.12 Matriz por módulo

| Módulo | Leitura offline (N2) | Escrita offline (N3) | Complexidade | Observações |
|---|---|---|---|---|
| Capturar | Sim | **Sim, primeiro** | Média | Já tem rascunho, diário e tela de conflito; anexos exigem fila de upload |
| Tarefas | Sim | **Sim, primeiro** | Média | Mesmo snapshot de Capturar (`capture_task_*`) |
| Projetos | Sim | Sim, segunda leva | Média | Progresso derivado das tarefas, sem estado próprio |
| Hábitos | Sim | Sim, segunda leva | Média–alta | Cadência com vigência (ADR-0012) e marcações por dia; fuso horário |
| Conhecimento | Sim | Sim, segunda leva | Alta | Documentos ricos, links wiki, promoção de Capturar; documentos até 600 KiB |
| Financeiro (lançamentos) | Sim | Avaliar | Alta | Competência, faturas, parcelas; o servidor é a autoridade de valores |
| Séries e Metas | Sim | **Não recomendado** | Muito alta | Protocolo v2 com canonicalização no servidor, reservas virtuais, prova terminal |
| Calendário | Sim (cópia) | Não | Baixa | Google somente leitura e exige rede para atualizar |
| Cofre | Sim | Não (por ora) | Alta | Ver 4.10 |
| Configurações | Preferências locais | Preferências sim; sessões e senha não | Baixa | Sessões, senha e exclusão exigem rede |
| Onboarding | Não | Não | — | Rodadas e Google exigem servidor |
| Admin, cobrança, busca global | Não | Não | — | Exigem servidor |

### 4.13 Regras duplicadas entre cliente e servidor

- **OBSERVADO:** a maior parte das regras de comando está no Núcleo TS, que hoje roda no servidor, e o SQL revalida invariantes e aplica de forma atômica. Rodar o mesmo Núcleo no aparelho dá resultados coerentes para a maioria dos comandos.
- **Risco:** regras que só existem no SQL ou no protocolo de Metas e Séries não rodam no aparelho. O resultado local deve ser marcado como **provisório** até a confirmação do servidor.
- **Teste obrigatório (RECOMENDADO):** a mesma sequência aleatória de comandos aplicada ao adaptador local e ao servidor descartável do CI deve terminar no mesmo estado.

### 4.14 Versões do cliente e compatibilidade

- **Clientes antigos continuam existindo:** um app instalado pode ficar semanas sem atualizar e reenviar comandos de uma versão anterior.
- **O que é preciso (RECOMENDADO):**
  - **Versão nos comandos:** versão de protocolo, como Metas e Séries já fazem com a v2.
  - **Aceitação explícita:** uma janela de versões aceitas pelo servidor.
  - **Bloqueio de cliente:** uma "versão mínima suportada", com mensagem para atualizar.
- **Migração da fila local** quando o formato mudar, com teste.

### 4.15 O ponto arquitetural mais difícil: telas renderizadas no servidor

- **OBSERVADO:** as páginas autenticadas passam por `requireUser()` e `authorizeWorkspaceFeature()` no servidor antes de existir HTML. Sem rede, não há como chegar à tela.
- **Opções:**
  1. **Shell de aplicação estático (RECOMENDADO):** uma rota cliente sem autorização no servidor, guardada pelo service worker, que monta as telas a partir dos dados locais e só pede ao servidor quando houver rede. A autorização real continua no servidor, em cada `/api/*` e RPC.
  2. **Bundle cliente separado:** exportar a interface como app estático para os empacotadores nativos, falando com a mesma API remota. Duplica o pipeline de build.
- **Em ambos os casos:**
  - O service worker deixa de ser `NetworkOnly` para o shell autenticado.
  - O fechamento de fontes do CI (contagem fixa de arquivos), o portão de camadas e a CSP precisam ser atualizados.
- **Arquitetura e segurança:** é a mudança que mais toca as regras do `AGENTS.md`. Deve virar ADR antes de qualquer código.

---

## 5. Plataformas e empacotamento

### 5.1 Desktop (Windows e Linux)

| Opção | Tamanho típico | Motor | Prós | Contras |
|---|---|---|---|---|
| PWA instalada pelo navegador | — | Chrome/Edge | Sem build extra; já existe | Não é um arquivo para baixar; Firefox no desktop não instala |
| **Tauri** | 5–15 MB | WebView2 (Windows) e WebKitGTK (Linux) | Leve, SQLite e chaveiro por plugins, atualizador assinado | Diferenças de motor entre Windows e Linux exigem teste duplo; ecossistema em Rust |
| **Electron** | 80–150 MB | Chromium embutido | Comportamento igual nos dois sistemas; empacotamento maduro; build para a Mac App Store | Pesado; atualizações de segurança do Chromium por conta do projeto |

- **Regras que valem para qualquer casca:**
  - **O servidor Next não vai dentro do instalador.** Ele usa `SUPABASE_SECRET_KEY` e outros segredos que nunca podem sair do servidor. A casca carrega o app remoto (online) ou o shell estático da seção 4.15 (offline).
  - **Login do Google:** o Google bloqueia autorização dentro de webview embutido (`disallowed_useragent`, política de 2021). O fluxo precisa abrir o navegador do sistema e voltar ao app por link profundo ou endereço local ([Google Developers Blog](https://developers.googleblog.com/en/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/)). Isso pede novos redirect URIs no Google Cloud e revisão do callback `/api/calendar/oauth/callback`.
  - **CSP e cookies:** a política atual (`src/lib/security/csp.ts`, `frame-ancestors 'none'`, `connect-src` restrito) e os cookies `sameSite=lax` precisam ser revisados para a origem da casca.
- **RECOMENDADO:** Tauri se o tamanho importar e houver disposição para testar dois motores; Electron se a prioridade for previsibilidade e também a Mac App Store.

### 5.2 Instaladores e assinatura

**Windows**
- **Formatos:** `.msi`, `.exe` (NSIS) ou `.msix`.
- **Sem assinatura:** o SmartScreen mostra "aplicativo não reconhecido".
- **Azure Artifact Signing:** o serviço de assinatura gerenciada da Microsoft custa a partir de cerca de US$ 10 por mês, mas **pessoas físicas só nos EUA e no Canadá**. No Brasil, uma pessoa física precisaria de certificado OV de autoridade certificadora; a própria Microsoft cita faixas entre US$ 150 e 500 por ano.
- **Mesmo assinado, o aviso não some na hora:** a reputação no SmartScreen leva semanas de downloads ([Microsoft Learn, opções de assinatura](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options); [FAQ do Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/faq)).
- **Alternativa sem certificado:** publicar o MSIX pela Microsoft Store, que assina o pacote (seção 6.2).

**Linux**
- **Formatos:**
  - `.AppImage`: um arquivo, basta dar permissão de execução.
  - `.deb` (Debian/Ubuntu) e `.rpm` (Fedora): instalam por duplo clique ou pelo gerenciador de pacotes.
  - Flatpak (Flathub) e Snap: lojas e atualização centralizada.
- **Assinatura:** GPG para repositórios e checksums.
- **RECOMENDADO:** evitar o padrão `curl … | sh`.

### 5.3 Atualização automática

- **Atualizador próprio:** Tauri e Electron trazem atualizador com assinatura própria. A chave privada de assinatura vai para o cofre de segredos, **nunca para o Git** (AGENTS.md).
- **Release sem migration:** o pipeline de release fica separado do deploy web e **nunca aplica migrations**.
- **Versão:** liga com o versionamento de protocolo da seção 4.14.

### 5.4 Onde ficam os instaladores

- O repositório é privado, então GitHub Releases dele não serve como download público.
- **Opções:** repositório público só de releases, bucket público dedicado (separado dos buckets privados de dados), ou as próprias lojas.
- **Toda versão publicada** com checksum SHA-256 e notas de versão.

### 5.5 Guia de instalação no topo da `/conheca`

- **Bloco de abertura (RECOMENDADO):**
  - Detecta sistema e navegador e oferece o caminho certo:
    - Windows: baixar instalador ou Microsoft Store.
    - Linux: AppImage, `.deb`, `.rpm` ou Flathub.
    - Android: Google Play ou instalar o PWA.
    - iPhone: App Store ou "Adicionar à Tela de Início".
    - Mac: download ou Mac App Store.
  - Mostra "Usar no navegador" como opção sempre visível.
- **Reaproveitar** `install-provider.tsx` e `install-help.tsx`.
- **Impactos que precisam de planejamento próprio:**
  - Spec E2E da landing (`tests/e2e/conheca.spec.ts`).
  - Portões de acessibilidade (alvos de 44 px, foco, teclado, movimento reduzido).
  - Revisão Impeccable e conteúdo legal (termos e privacidade).
  - A precedência visual do protótipo (D-080/D-084). O desenho do bloco é uma decisão visual a registrar, sem redesenho silencioso.
- **Detecção de sistema por `userAgent` é aproximada:** a escolha manual tem de estar sempre disponível.

### 5.6 Mudança na dinâmica de entrada

1. **Fluxo proposto:** instalar → abrir o app → **entrar com rede** → onboarding (rodadas no servidor) → download inicial dos dados → uso offline.
2. **O onboarding de nove telas continua online.** Ele usa rodadas, intenções e retenção no servidor, e a conexão Google.
3. **A primeira abertura sem rede** mostra uma tela clara ("conecte-se uma vez para começar"), nunca um app vazio que parece funcionar.

---

## 6. Lojas

Consultado em 30/10/2026. As políticas mudam; reconferir no painel de cada loja antes de decidir.

### 6.1 Google Play

- **Pacote:**
  - **TWA (Trusted Web Activity):** o PWA abre em tela cheia pelo Chrome. Ferramentas como Bubblewrap e PWABuilder geram o `.aab`.
  - **Capacitor:** necessário se o offline usar SQLite nativo.
- **Requisitos:**
  - `/.well-known/assetlinks.json` no domínio (rota pública nova; conferir middleware e CSP).
  - Manifesto com capturas de tela e categoria (hoje não tem).
  - Política de privacidade e formulário de segurança de dados.
  - Nível de API alvo atualizado.
- **Conta pessoal criada depois de 13/11/2023:** teste fechado com **12 testadores por 14 dias seguidos** antes de pedir produção. Contas de organização estão isentas. Fontes de terceiros; a página oficial é a [resposta 14151465 da ajuda do Play Console](https://support.google.com/googleplay/android-developer/answer/14151465) ([resumo de terceiros](https://ontest.app/blog/google-play-12-testers-14-days-requirement-explained)).
- **Cobrança:** a ajuda do Google lista o **Brasil** entre os países com **sistema de cobrança alternativo** para conteúdo digital, com taxa de serviço ainda cobrada ([Google Play Help](https://support.google.com/googleplay/answer/11174377)). Os detalhes de cobrança dentro do app no Brasil precisam ser conferidos na política do Play Console.

### 6.2 Microsoft Store

- **Conta individual gratuita** desde setembro de 2025 ([Windows Developer Blog](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/)).
- **Pacote:** o PWABuilder gera o MSIX a partir do PWA ([Microsoft Edge docs](https://learn.microsoft.com/microsoft-edge/progressive-web-apps-chromium/how-to/microsoft-store)). **A loja assina o pacote**, sem certificado próprio, e cuida das atualizações ([Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path)).
- **RECOMENDADO** como primeiro canal oficial no Windows: resolve o SmartScreen sem custo.

### 6.3 Apple App Store (iPhone e iPad)

- **A Apple não publica PWA.** É preciso um app nativo, por exemplo Capacitor com o bundle web dentro, compilado no Xcode. Isso exige um Mac ou um runner de macOS no CI.
- **Service worker não funciona dentro do app embrulhado:** WKWebView em apps como Capacitor não implementa service workers para conteúdo local ([WebKit bug 206741](https://bugs.webkit.org/show_bug.cgi?id=206741), confirmar o status atual). Consequência: o offline no iPhone depende de **SQLite nativo e bundle local**, não do service worker. Reforça a arquitetura da seção 4 sobre a `ClientApplication`.
- **Revisão:**
  - **4.2 (funcionalidade mínima)** costuma recusar apps que são só um site. Precisam de valor nativo: notificações, extensão de compartilhamento, biometria no Cofre, widgets.
  - **5.1.1(v):** se o app permite criar conta, precisa permitir **excluí-la dentro do app** ([Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app)).
  - Login com Google pode exigir uma opção equivalente de privacidade (4.8).
- **Cobrança no Brasil:** desde 2026, por acordo com o CADE, a Apple permite pagamento alternativo e link para checkout externo no Brasil, com comissões próprias (por exemplo, 15% ou 10% para link externo, conforme o programa). O acordo vale por três anos ([TecMundo](https://www.tecmundo.com.br/mercado/413975-apple-oficializa-lojas-externas-no-brasil-e-outros-meios-de-pagamento-na-app-store.htm); [Appcharge](https://appcharge.com/blog/apple-brazil-framework-is-now-live-what-publishers-need-to-know)). Conferir os termos vigentes no App Store Connect.
- **Programa de desenvolvedor:** cerca de US$ 99 por ano.

### 6.4 Mac App Store

- **Opção 1:** Electron com build MAS (sandbox, notarização e perfis de provisionamento).
- **Opção 2:** o próprio app do iPad rodando em Macs com Apple Silicon.
- Valem as mesmas regras de revisão da 6.3.

### 6.5 Linux

- Flathub e Snap Store como canais oficiais, além do download direto.

### 6.6 Resumo das lojas

| Loja | Pacote | Conta | Assinatura | Esforço técnico (INFERIDO) | Risco principal |
|---|---|---|---|---|---|
| Microsoft Store | MSIX via PWABuilder | Individual gratuita | Pela loja | 2–5 dias | Certificação da loja |
| Google Play | TWA ou Capacitor | Taxa única | Chave de upload própria | 3–8 dias + 14 dias de teste fechado | Política de cobrança; testadores |
| Download direto Windows | MSI/NSIS/MSIX | — | OV própria (US$ 150–500/ano) | Junto da casca (seção 10) | SmartScreen até ganhar reputação |
| Download direto Linux | AppImage/deb/rpm | — | GPG | Junto da casca | Testar distros |
| Flathub/Snap | Flatpak/Snap | Gratuita | Pela loja | 2–5 dias | Revisão do manifesto |
| Apple iOS/iPadOS | Capacitor + Xcode | ~US$ 99/ano | Apple | 3–6 semanas | 4.2 (app só de site), cobrança |
| Mac App Store | Electron MAS ou app do iPad | Mesma conta Apple | Apple + notarização | 1–3 semanas além da casca | Sandbox, 4.2 |

---

## 7. Segurança, privacidade e conformidade

1. **Dados pessoais no aparelho:** cifrar em repouso (4.3) e tratar computador compartilhado, perda e roubo.
2. **LGPD:**
   - Atualizar a política de privacidade: dados ficam no aparelho e por quanto tempo.
   - A exclusão da conta precisa apagar os dados locais na próxima conexão.
   - Exportação antes de apagar.
3. **Revogação:** sessões revogadas em "Sessões" bloqueiam a fila e os dados locais.
4. **Isolamento (ADR-0001):** a fila e o armazenamento são por Usuário; troca de conta apaga ou isola.
5. **Logs e telemetria:** nunca com conteúdo; o Cofre segue só com metadados (ADR-0004).
6. **Chaves de assinatura** (Windows, atualizador, Android e Apple) ficam fora do Git e de pastas sincronizadas (AGENTS.md).
7. **Dependências novas** (Tauri ou Electron, plugins SQLite, Capacitor) passam pelo fluxo de candidatos de dependência que já existe no CI (`dependency-candidates.yml`).
8. **Superfície maior:**
   - Um app instalado e offline aumenta o valor de um ataque à conta.
   - A proteção contra senhas vazadas do Auth exige o plano Pro do Supabase.
   - **RECOMENDADO:** reavaliar o plano antes de abrir os instaladores ao público.

---

## 8. Mudanças prováveis no servidor (futuras, sob a OP-009)

Nenhuma é feita agora. Cada uma seria migration versionada, revisada e aplicada sob supervisão, sem CI, com travas que normalizam CRLF (2.7).

| Mudança | Para quê |
|---|---|
| Feed incremental por Usuário a partir de `domain_events` | Descer só o que mudou (4.4) |
| Registro de aparelhos ligado às sessões | Ver e revogar aparelhos offline; apagar dados locais na reconexão |
| Versão mínima de cliente e versão de protocolo por comando | Compatibilidade de filas antigas (4.14) |
| Rota em lote com resultado por comando | Subir a fila com menos chamadas, sem virar "uma transação gigante" (ADR-0010 já rejeita várias chamadas como uma transação) |
| Escopo de limite de taxa para sincronização | Não travar a sincronização com o limite de uso interativo (2.3) |
| Upload retomável | Anexos grandes em conexões instáveis |
| `/.well-known/assetlinks.json` e afins | Google Play (6.1); não exige migration, mas exige rota pública e revisão da CSP |

---

## 9. Testes e evidências

- **Offline no navegador:** Playwright com `context.setOffline`, filas com várias entradas, reconexão, reabertura e troca de conta.
- **Equivalência:** sequências aleatórias de comandos no adaptador local e no servidor descartável do CI terminam no mesmo estado (4.13).
- **Conflitos:** dois aparelhos simulados, revisões cruzadas, entidade apagada, Entitlement revogado e sessão revogada.
- **Limite de taxa:** fila longa respeitando `retry_after_ms`.
- **Instaladores:** smoke test em runners Windows e Linux (instalar, abrir, entrar, desinstalar).
- **Lojas:** checklist por loja e evidência da revisão.
- **Contratos do repositório:** fechamento de fontes (contagem fixa), portão de camadas (`.dependency-cruiser.cjs`), catálogo de release e scanner de segredos precisam ser atualizados junto, nunca afrouxados.
- **Aceites humanos:** aparelhos reais, zoom, leitor de tela e #44 continuam obrigatórios e passam a incluir o app instalado.

---

## 10. Fases, esforço e critérios de saída (RECOMENDADO)

| Fase | Conteúdo | Esforço (INFERIDO) | Sai quando |
|---|---|---|---|
| **F0** Decisões e spike | Decisões da seção 12; ADR do offline por fila; spike de `OfflineApplication` para Capturar no navegador com IndexedDB | 1–2 semanas | Spike mede tamanho de snapshot, tempo de sincronização e conflitos reais |
| **F1** Instalação e PWA pronto para loja | Guia no topo da `/conheca`; manifesto com capturas e categoria; `assetlinks.json` | ~1 semana | E2E da landing e portões verdes; aceite visual |
| **F2** Leitura offline (N2) | Snapshots cifrados de Capturar, Tarefas, Projetos e Hábitos; shell estático (4.15); aviso de dado desatualizado | 2–4 semanas | Abrir sem rede e ler o último estado, com aviso honesto |
| **F3** Escrita offline (N3) de Capturar e Tarefas | Fila com várias entradas, ritmo, conflitos, anexos em fila | 4–8 semanas | Teste de equivalência e matriz de conflitos verdes |
| **F4** Desktop Windows e Linux | Casca, instaladores, atualizador, assinatura, download na `/conheca` | 3–6 semanas + certificado | Instalar, abrir, entrar e sincronizar nos dois sistemas |
| **F5** Microsoft Store e Google Play | MSIX via PWABuilder; TWA ou Capacitor; teste fechado | 1–3 semanas + revisão + 14 dias | Publicado em teste fechado e aprovado |
| **F6** Escrita offline dos demais módulos simples | Projetos, Hábitos, Conhecimento | 4–8 semanas | Mesmos critérios da F3 por módulo |
| **F7** Apple (iPhone, iPad e Mac) | Capacitor com SQLite nativo; recursos nativos para a 4.2; exclusão de conta no app; decisão de cobrança | 4–8 semanas + revisão | Aprovado na App Store |
| **F8** Financeiro | Leitura sempre; escrita só de lançamentos simples, se aprovada | 6–12 semanas, ou só leitura | Decisão explícita do mantenedor |

**Total:** algo entre 6 e 12 meses para o conjunto completo, com incerteza alta. **A F0 existe justamente para medir antes de comprometer o resto.** F1, F4 e F5 entregam valor (instalação e lojas) sem esperar o offline completo.

---

## 11. Riscos principais

| Risco | Impacto | Mitigação |
|---|---|---|
| Sincronização corromper ou perder dado | Muito alto | Fila de intenções, servidor como fonte, idempotência existente, teste de equivalência, nada automático em dinheiro |
| Regras divergentes entre aparelho e servidor | Alto | Mesmo Núcleo TS; resultado local "provisório"; módulos com regra só no servidor ficam só leitura |
| Sessão expirada travando a fila | Médio | Desbloqueio local + novo login antes de subir; aviso claro |
| Limite de 30 escritas/min | Médio | Ritmo com `retry_after_ms`; escopo próprio ou rota em lote (seção 8) |
| Login Google dentro da casca | Médio | Navegador do sistema + retorno por link profundo |
| SmartScreen sem reputação | Médio | Microsoft Store como canal principal; certificado OV no download direto |
| Recusa da Apple (4.2) | Alto | Recursos nativos reais; deixar a Apple para depois do offline |
| Política de cobrança das lojas | Alto | Decidir antes; conferir termos do Brasil vigentes |
| Clientes antigos com filas antigas | Médio | Versão de protocolo e versão mínima |
| Manutenção de vários pacotes e canais | Médio | Um só código de interface; pipeline de release separado do deploy web |
| Contratos do CI (contagem de fontes, camadas) | Baixo–médio | Atualizar junto, com revisão |

---

## 12. Decisões do mantenedor (antes da F0)

1. **Nível de offline:** só leitura (N2) ou leitura e escrita (N3)? Quais módulos entram e em que ordem?
2. **Casca de desktop:** Tauri ou Electron?
3. **Prazo máximo offline** e desbloqueio local (PIN, biometria, nenhum).
4. **Sessão revogada ou conta excluída enquanto offline:** apagar na reconexão? Oferecer exportação antes?
5. **Conflito entre aparelhos:** sempre escolha explícita do Usuário, ou "último a gravar vence" nos campos simples?
6. **Cofre offline:** só leitura ou nada?
7. **Financeiro offline:** só leitura, ou escrita de lançamentos simples?
8. **Cobrança nas lojas:** vender dentro dos apps, com link externo ou só pelo site? Define Google e Apple.
9. **Conta de desenvolvedor:** pessoal ou de empresa? Afeta o teste de 14 dias no Play, a assinatura no Windows e a verificação da Apple.
10. **Assinatura no Windows:** certificado OV agora, ou começar pela Microsoft Store?
11. **Onde hospedar os instaladores** do download direto.
12. **Plano do Supabase:** subir para o Pro antes de abrir os instaladores ao público?
13. **Ordem das lojas:** a sugestão é Microsoft → Google → Apple.

---

## 13. Próximos passos e o que este documento não faz

- **Não faz:** não cria issues, código, dependências, migrations, ADR, contas de loja ou certificados.
- **Depois das decisões da seção 12 (RECOMENDADO):**
  1. Registrar as decisões no [registro de decisões](registro-de-decisoes.md).
  2. Escrever o ADR "Aplicativo offline por fila de comandos, servidor como fonte".
  3. Abrir o spike da F0 como ticket próprio.
  4. Detalhar F1–F8 em tickets no padrão do [doc 13](13-tickets.md), com critérios de aceite e evidências exigidas.

---

## Referências

**No repositório (OBSERVADO em `bd35288`)**

- PWA: `src/app/manifest.ts`, `src/app/sw.ts`, `src/app/offline/page.tsx`, `src/components/pwa/`
- Cliente: `src/lib/demo/demo-provider.tsx`, `src/lib/demo/connected-application.ts`, `src/lib/demo/command-journal.ts`, `src/lib/finance-goals-journal.ts`, `src/lib/finance-series-journal.ts`
- Núcleo e adaptadores: `src/core/`, `src/adapters/memory/index.ts`, `src/adapters/db/capture-task-store.ts`, `finance-store.ts`, `projects-habits-store.ts`, `files-processor.ts`, `google-calendar-security.ts`
- Autenticação e segurança: `src/lib/auth/clients.ts`, `src/lib/auth/cookie-policy.ts`, `src/lib/security/csp.ts`, `src/app/(workspace)/layout.tsx`
- Banco: `supabase/migrations/20261007151834_identity_foundation.sql` (`require_actor`), `20261007210519_capture_task_transactions.sql` (limite de taxa, índice de eventos)
- Planejamento: [doc 07](07-estrategia-web-app.md), [ADRs](../adr/), [CONTEXT.md](../../CONTEXT.md), [AGENTS.md](../../AGENTS.md)

**Externas (consultadas em 30/10/2026; reconferir antes de decidir)**

- Google OAuth em webviews: [Google Developers Blog](https://developers.googleblog.com/en/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/)
- Google Play, teste fechado: [Play Console Help 14151465](https://support.google.com/googleplay/android-developer/answer/14151465), [resumo](https://ontest.app/blog/google-play-12-testers-14-days-requirement-explained)
- Google Play, cobrança alternativa: [Google Play Help 11174377](https://support.google.com/googleplay/answer/11174377)
- Microsoft Store, conta gratuita: [Windows Developer Blog](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/)
- Microsoft Store, PWA: [Microsoft Edge docs](https://learn.microsoft.com/microsoft-edge/progressive-web-apps-chromium/how-to/microsoft-store), [canais de distribuição](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path)
- Assinatura no Windows: [opções](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [Artifact Signing FAQ](https://learn.microsoft.com/en-us/azure/artifact-signing/faq)
- Apple, exclusão de conta: [Apple Developer](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- Apple no Brasil (CADE): [TecMundo](https://www.tecmundo.com.br/mercado/413975-apple-oficializa-lojas-externas-no-brasil-e-outros-meios-de-pagamento-na-app-store.htm), [Appcharge](https://appcharge.com/blog/apple-brazil-framework-is-now-live-what-publishers-need-to-know)
- Service worker em WKWebView: [WebKit bug 206741](https://bugs.webkit.org/show_bug.cgi?id=206741)
