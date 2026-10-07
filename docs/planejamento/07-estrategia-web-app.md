# G — Estratégia Web App + Aplicativo instalável

**Ponto de partida honesto:** o legado não tem NADA de distribuição — sem manifest, sem service worker, sem safe-area na main (diagnóstico §7.2/§9). A v2 introduziu safe-area e `AvisoDeOffline`. Tudo o mais aqui é construção nova, desenhada desde o início (não adaptação posterior).

**Decisão de forma:** **PWA instalável como único artefato** nas fases 1–2 (navegador + instalado em desktop/Android/iOS), com a arquitetura preparada para um wrapper nativo futuro (Capacitor) **sem reescrita**. Um app nativo dedicado não se justifica com ~10 usuários e um dev — mas nenhuma decisão abaixo o impede.

---

## 1. A experiência-alvo por dispositivo

| Contexto | Experiência |
|---|---|
| Navegador desktop | app completo; atalho `Ctrl/Cmd+K` (command palette) e `C` para capturar |
| PWA desktop instalada | janela própria, `shortcuts` do manifest ("Capturar", "Tarefas", "Financeiro"), badge de notificações |
| Android (PWA instalada) | ícone + splash, **share target** (compartilhar texto/URL/imagem de outro app → cai na Captura), push nativo Web Push |
| iOS (adicionado à tela inicial) | standalone com safe-areas; push Web Push (iOS 16.4+, só instalado); **sem** share target (limitação da plataforma — mitigação: atalho dos Atalhos do iOS chamando `/capturar?texto=`) |
| Tablet | mesma PWA, layout da faixa `md`/`lg` (doc 08) |
| TV/futuros | nada específico agora; tokens de escala e navegação por foco ficam possíveis pela disciplina do doc 08 |

## 2. Peças técnicas

### 2.1 Manifest + instalação
`manifest.ts` do Next com: nome/ícones maskable (marca "2"), `display: standalone`, `theme_color`/`background_color` por tema, `shortcuts` (Capturar, Tarefas, Financeiro), `share_target` (POST multipart → rota de captura, aceita `text/url/title` e imagens), `launch_handler: { client_mode: "focus-existing" }` (compartilhar de novo não abre segunda instância). iOS: `apple-mobile-web-app-*` + splash. Convite de instalação discreto dentro de Configurações (nunca modal na cara — antipadrão).

### 2.2 Service worker — Serwist (sucessor mantido do next-pwa)
Estratégias por camada, começando conservador:
- **Precache:** shell estático (JS/CSS/fontes/ícones) — app abre instantâneo e sobrevive offline de rede.
- **Páginas (RSC/HTML):** `NetworkFirst` com fallback ao último snapshot visitado + página `/offline` própria. Sem tentar cachear dado como verdade: o **servidor é a fonte**; o cache é cortesia de leitura.
- **Imagens/arquivos assinados:** `StaleWhileRevalidate` com teto (URLs assinadas expiram — cache por pouco tempo).
- **Nunca** cachear rotas de API, actions ou nada autenticado de escrita.

### 2.3 Offline de verdade: a Captura primeiro
O requisito real do §10/§11 do prompt é "a informação entra AGORA". Prioridade de offline por valor:
1. **Fase 2 — Outbox de captura:** compositor de captura funciona offline; itens ficam em IndexedDB (fila `outbox` com id local, payload, anexos como Blob) e sincronizam ao voltar a rede (Background Sync onde houver; retry ao abrir, senão). Idempotência por `client_id` UUID na tabela (`unique (user_id, client_id)`) — reenvio nunca duplica. O rascunho local por usuário do legado (padrão preservado) já é meio caminho.
2. **Fase 2 — Leitura do último estado:** listas visitadas legíveis offline (cache §2.2) com o `AvisoDeOffline` da v2 herdado (a tela diz o que é: leitura de snapshot).
3. **Futuro (se a dor existir):** edição offline de notas com fila própria; CRDT/merge fino **não** entra no plano — o mecanismo de concorrência otimista por `updated_at` com tela de conflito (que o editor do legado já tem) cobre o caso de 1 pessoa em 2 dispositivos.

**Conflitos:** regra geral last-write-wins por campo `updated_at` + concorrência otimista nas superfícies de edição longa (editor) — padrão já provado no legado; documentado por módulo no doc 06.

### 2.4 Notificações
- **Web Push (VAPID)** com as tabelas que o legado já desenhou e nunca usou (`push_subscriptions`, `notification_deliveries` — agora nascem com tela e rota de envio). Envio pelo servidor (rota cron/evento) com dedupe pelo UNIQUE que já foi pensado.
- Casos: lembrete de reunião (substitui o mecanismo client-side do legado quando instalado; o client-side permanece como fallback aberto), lembrete de captura ("você tem N por organizar" — opcional e desligável), vencimento de fatura (Financeiro).
- iOS: só com app instalado (16.4+); a UI de Configurações declara isso em vez de falhar em silêncio.

### 2.5 Captura rápida em todas as portas
- **Command palette (`Ctrl/Cmd+K`)** global: capturar, navegar, buscar (é também a resposta ao achado "power user sem atalhos" da crítica Impeccable).
- Botão flutuante/aba fixa **Capturar** na barra mobile (posição de polegar).
- **Share target** Android/desktop (§2.1) e Atalho iOS.
- E-mail-para-capturar e clipper de navegador: **futuro**, listados no roadmap como candidatos, não compromissos.

### 2.6 Wrapper nativo (rota futura, não bloqueante)
Se um dia precisar de: share extension iOS, widgets, biometria nativa para o Cofre → **Capacitor** embrulhando a mesma PWA (mesmo bundle, plugins nativos pontuais). Pré-requisitos que JÁ ficam prontos por este plano: UI 100% responsiva, nenhuma dependência de API exclusiva de desktop, auth por cookies httpOnly compatível com webview, tokens de safe-area.

## 3. Sincronização multi-dispositivo
Fonte única no servidor (Supabase) + revalidação do Next por navegação/ação — suficiente para 1 pessoa em N dispositivos. **Realtime** (canal por usuário para invalidar listas abertas quando outro dispositivo escreve) fica como melhoria da fase 3: a arquitetura de dados não precisa mudar para ligá-lo (é o motivo de manter Supabase — doc 03).

## 4. O que precisa estar verdadeiro desde o Ticket 01 (para nada disso ser retrofit)
1. Tokens de **safe-area** e altura da barra mobile no DS (herdar da v2).
2. `manifest.ts` + ícones maskable + `/offline` já na fundação visual.
3. `client_id` idempotente no schema de capturas desde a primeira migration.
4. Nenhum componente assumindo ponteiro/hover como único caminho (doc 08).
5. CSP com `worker-src 'self'`/`manifest-src 'self'` (o legado já reservou — herdar).

## 5. Estado da demonstração HTML — 29/09/2026

O [doc 14](14-prototipo-interacoes.md) especifica a experiência implementada sem backend. Busca por botão/`Ctrl/Cmd+K`, salvamento por botão/`Ctrl/Cmd+Enter`, vínculos, grafo e rascunhos são locais. A chave `sb-proto-connected-v1` guarda notas, rascunhos, registro ativo e conclusão da tarefa em foco (`homeDone`) em `localStorage`; input usa atraso de 350ms, e mudanças de nota/visibilidade guardam snapshots. Se armazenamento falhar, a UI declara sessão em memória. Tema continua em chave separada.

Não há manifest, service worker, outbox, upload, autenticação ou sincronização neste HTML. Sair da demonstração abre a tela Login sem representar uma revogação de sessão real. O protótipo não comprova o atalho `C`, share target, push ou limpeza de dados por usuário. O §2 e T-009 continuam regendo essas entregas de produção. A foto ilustrativa está embutida; Geist depende da folha Google Fonts existente, com fallback de sistema. Veja doc 14 §§5/8/10 para persistência, atalhos e limites exatos.
