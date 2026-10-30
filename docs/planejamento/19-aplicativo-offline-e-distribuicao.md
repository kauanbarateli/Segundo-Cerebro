# Q — Aplicativo: PWA, instalação online e instalação offline (planejamento)

**Estado:** planejamento de 30/10/2026, pedido pelo mantenedor. **Sem aprovação, issues, código, dependências, migrations ou ADR.** Cada macro só começa depois das decisões da seção 6.

**Diretriz do mantenedor:**
- O produto **continua sendo um web app (PWA)** enquanto as frentes avançam em paralelo.
- A instalação por arquivo vale **só para desktop** (Windows, Linux e Mac). Celular continua pelo PWA, e as lojas ficam para depois.
- **Um único código** gera o web app e os instaladores.
- **Menos trabalho acessório:** só os testes que protegem contra perda de dados, sem baterias extras de diagnóstico.

**Base observada:** `main` em `bd35288` (merge da PR #120); produção `rishenjoikgmfubmnfiu` com migrations 001–027.

**Legenda:** **OBSERVADO** = conferido no código ou no banco nesta data. **INFERIDO** = a confirmar no protótipo da semana 1. **RECOMENDADO** = proposta, depende de decisão. Prazos são estimativas INFERIDAS com execução por agentes e revisão do mantenedor.

---

## 1. Visão geral

| Macro | O que entrega | Para quem | Prazo (INFERIDO) |
|---|---|---|---|
| **M1 — PWA** | Web app instalável melhor: guia de instalação na `/conheca`, aviso de nova versão, indicador de conexão, base para o offline | Todos, computador e celular | Semanas 1–2 |
| **M2 — Instalação online** | Arquivo de instalação para Windows, Linux e Mac, que abre o app online | Desktop | Semanas 2–5 |
| **M3 — Instalação offline** | Trabalhar sem rede depois do login e sincronizar ao reconectar | PWA e instalador ao mesmo tempo | Semanas 2–12 |

**Por que um código só serve aos três (RECOMENDADO):**
- O instalador do M2 é uma casca **Electron** que abre o mesmo endereço de produção. A interface vem sempre da publicação web; o instalador só precisa ser atualizado quando a casca muda.
- O offline do M3 é construído **dentro do web app** (service worker, banco no navegador, fila de envio). Como o Electron usa o mesmo motor do Chrome, a casca herda o offline sem código duplicado. O instalador só acrescenta a chave guardada no cofre do sistema (INFERIDO; confirmar na semana 1).
- **Resultado:** a mesma melhoria vale para o navegador, o PWA instalado e o desktop, e prepara o celular para depois.

**Fora destes macros, para ganhar velocidade:**
- Lojas (Google Play, Microsoft Store, Apple).
- App nativo de celular.
- Financeiro com escrita offline e sincronização automática total (CRDT).
- Novas migrations na primeira versão.
- Testes extras de diagnóstico.

As lojas estão resumidas na seção 7.

---

## 2. Estado atual (OBSERVADO)

**PWA**
- **Manifesto** (`src/app/manifest.ts`): instalação em janela própria, ícones normais e adaptáveis, atalhos (Capturar, Tarefas, Financeiro), compartilhar para o Capturar e uma janela só. **Faltam** capturas de tela, categoria e cor de tema para o modo escuro (só existe a clara em `src/app/layout.tsx`).
- **iPhone e iPad:** 22 telas de abertura (`public/splash`, metadados em `layout.tsx`).
- **Service worker** (`src/app/sw.ts`, Serwist 9.5.13): guarda só o esqueleto público; navegação `NetworkOnly`; sem rede, mostra `/offline`. **Nada pessoal fica guardado, de propósito.** A troca de versão só ocorre quando as janelas antigas fecham, e a pessoa não é avisada.
- **Instalação:** botão "Instalar" e ajuda só em Configurações (`src/components/pwa/`). A própria ajuda diz que salvar offline "chegará em uma próxima etapa".
- **Conexão:** não há indicador de online ou offline nas telas.

**Dados**
- **O navegador nunca fala com o Supabase.** Tudo passa por 35 rotas `/api/*`, com cookies de sessão `httpOnly`.
- **Telas logadas:** são liberadas no servidor (`requireUser`, `authorizeWorkspaceFeature`) antes de abrir. **Sem rede, não abrem.**
- **Escrita:**
  - É um comando com `client_id`. O servidor executa o Núcleo TS, grava com revisão, recibo e evento na mesma transação.
  - Reenviar o mesmo comando não duplica.
  - Se os dados mudaram no meio, o servidor relê e refaz o comando, em até 3 tentativas (`capture-task-store.ts`, `finance-store.ts`, `projects-habits-store.ts`).
  - Toda escrita exige sessão ativa (`require_actor`).
  - Há limite de **30 escritas por minuto** por pessoa.

**Peças que já servem ao offline**
- **Duas implementações da `ClientApplication`:** a demonstração roda o Núcleo inteiro no navegador; a outra é conectada ao servidor (`src/lib/demo/`).
- **Diário de comandos** no navegador (`command-journal.ts`), hoje com **um envio pendente por vez**.
- **Diários de Metas e Séries**, rascunhos do Capturar e tela de conflito em Capturar e Conhecimento.
- **Cofre** cifrado no próprio aparelho, com a senha-mestra.

---

## 3. M1 — PWA

**Objetivo:** melhorar o web app que já está em uso e deixá-lo pronto para receber o offline, sem mudar como os dados funcionam hoje.

| # | Entrega | O que muda | Esforço |
|---|---|---|---|
| 1.1 | **Guia de instalação no topo da `/conheca`** | Novo bloco antes dos capítulos. Detecta o sistema e mostra o caminho certo: botão "Instalar" (Chrome/Edge), "Adicionar ao Dock" (Safari no Mac), "Adicionar à Tela de Início" (iPhone), link para o instalador quando o M2 existir e "Usar no navegador". Reaproveita `install-provider.tsx` e `install-help.tsx` | 3–4 dias |
| 1.2 | **Manifesto completo** | Capturas de tela, categoria e descrição para a janela de instalação mais rica; cor de tema do modo escuro | 1 dia |
| 1.3 | **Aviso de nova versão** | Quando houver versão nova, mostrar "Nova versão disponível — atualizar". Importante para o M3, que vai depender de versão compatível | 1–2 dias |
| 1.4 | **Indicador de conexão** | Selo discreto de "sem conexão" no shell; botões que exigem rede ficam desativados com explicação, em vez de falhar | 1–2 dias |
| 1.5 | **Página offline melhor** | Mantém a página atual, mas explica o que estará disponível offline quando o M3 chegar | 0,5 dia |
| 1.6 | **Pedido de armazenamento persistente** | `navigator.storage.persist()` após o login, para o navegador não apagar dados guardados. Base do M3 | 0,5 dia |

**Regras que continuam:** precedência visual do protótipo (D-080/D-084), alvos de 44 px, foco, teclado e movimento reduzido. O bloco da `/conheca` é uma decisão visual a registrar.

**Limites do PWA (para saber, não para resolver agora):**
- **Firefox:** no computador não instala.
- **Safari:** pode apagar dados de sites pouco usados; apps na Tela de Início se comportam diferente, a testar no aparelho.
- **Chave do aparelho:** a chave de proteção fica no armazenamento do navegador, mais fraca que o cofre do sistema.

**Pronto quando:** a `/conheca` orienta a instalação nos principais sistemas; nova versão é avisada; a falta de conexão é visível.

---

## 4. M2 — Instalação online (desktop)

**Objetivo:** a pessoa baixa um arquivo, instala e abre o Segundo Cérebro como app do computador. Nesta etapa ele precisa de internet, como o PWA.

| # | Entrega | O que muda | Esforço |
|---|---|---|---|
| 2.1 | **Casca Electron no mesmo repositório** | Nova pasta (por exemplo, `desktop/`) com o processo principal. A janela abre `https://www.segundocerebroapp.com.br`, com uma instância só, menu, isolamento de contexto e sem acesso a Node na página. **O servidor Next não vai no instalador**, porque usa segredos | 3–5 dias |
| 2.2 | **Login e sessão** | Os cookies de sessão ficam guardados pela casca entre aberturas. **Login do Google Calendar:** o Google bloqueia login dentro de apps embutidos, então a conexão abre o navegador do sistema e volta ao app por um endereço próprio (`segundocerebro://`). Exige ajuste no callback `/api/calendar/oauth/callback` e novo endereço autorizado no Google Cloud | 3–4 dias |
| 2.3 | **Instaladores** | **Windows:** `.exe` (NSIS). **Mac:** `.dmg`. **Linux:** `.AppImage` e `.deb` (`.rpm` opcional) | 2–3 dias |
| 2.4 | **Assinatura** | **Mac:** assinatura e notarização obrigatórias para abrir sem bloqueio; exigem a conta de desenvolvedor Apple (cerca de US$ 99/ano). **Windows:** certificado OV (US$ 150–500/ano); sem ele, o Windows mostra "aplicativo não reconhecido". Mesmo assinado, o aviso só some após semanas de downloads. **Linux:** checksum e GPG, sem custo | 2–3 dias + prazo de emissão do certificado |
| 2.5 | **Atualização automática da casca** | Atualizador assinado, consultando onde ficam os instaladores. Como a interface vem do site, a casca raramente muda | 1–2 dias |
| 2.6 | **Build único no CI** | Workflow que, numa tag de versão, gera os três instaladores em runners Windows, Mac e Linux. Usa segredos de assinatura do GitHub e **nunca aplica migrations** | 2–3 dias |
| 2.7 | **Download na `/conheca`** | Liga o guia do M1 aos arquivos, com versão e checksum. **Hospedagem:** o repositório é privado, então os arquivos precisam de local público (repositório só de releases ou bucket público dedicado) | 1–2 dias |
| 2.8 | **Segurança da casca** | Revisar a CSP (`src/lib/security/csp.ts`) para a origem da casca; bloquear navegação para fora do domínio, abrindo links externos no navegador | 1 dia |

**Pronto quando:** instalar, abrir, entrar e usar funcionam no Windows, no Mac e no Linux; a casca se atualiza sozinha; o download está na `/conheca`.

---

## 5. M3 — Instalação offline

**Objetivo:** depois do login, a pessoa trabalha sem rede nas abas combinadas, e tudo sobe ao reconectar. É construído no web app e vale também para o PWA e o instalador.

### 5.1 Escopo por aba (combinado com o mantenedor)

| Aba | Sem rede | Ao reconectar |
|---|---|---|
| **Capturar (anotações)** | Ler, criar e editar | Envia a fila; conflito usa a tela que já existe |
| **Imagens nas anotações** | Adicionar; ficam guardadas no aparelho | Sobem antes da anotação que as usa (reserva → envio → processamento no servidor → vínculo) |
| **Arquivos e Drive** | Bloqueado: "Conecte-se à internet para enviar arquivos" | — (o Drive está fora do MVP por D-032) |
| **Agenda** | Só leitura do último carregamento, com "sincronizado em 30/10 às 14:32" | Recarrega |
| **Caderno (Conhecimento)** | Ler, criar e editar | Envia a fila; conflito de versão do documento com escolha explícita |
| **Cofre** | Abrir com a senha-mestra, ler e criar itens. Trocar a senha-mestra e recuperar só online | Envia os itens novos |
| **Demais abas** (Tarefas, Hábitos, Projetos, Financeiro) | Só leitura do último carregamento (RECOMENDADO) | Recarrega |
| **Onboarding, Google, conta, sessões** | Só online | — |

### 5.2 O que precisa ser construído

| # | Entrega | O que muda | Esforço |
|---|---|---|---|
| 3.1 | **Telas que abrem sem servidor** | Uma rota de aplicação montada no navegador, guardada pelo service worker, que desenha as telas com os dados locais. A autorização continua no servidor, em cada `/api/*`. O service worker passa a guardar esse shell. **É a mudança de arquitetura mais delicada e vira ADR antes do código** | 1,5–2 semanas |
| 3.2 | **Banco local cifrado** | IndexedDB com os dados das abas liberadas, cifrado com uma chave AES não exportável do navegador. **No instalador**, a chave fica protegida pelo cofre do sistema (Credential Manager, Keychain, chaveiro do Linux) | 1 semana |
| 3.3 | **Chave do aparelho e sessão longa** | A pessoa entra uma vez com senha. A sessão fica guardada e a chave local é criada sem a pessoa ver. Offline, ela abre os dados direto, ou com PIN se decidido. Ao reconectar, a sessão é renovada sem pedir a senha. Revogar o aparelho em "Sessões", trocar a senha ou excluir a conta apaga os dados locais na próxima conexão. **O prazo máximo da sessão** precisa ser configurado no Supabase (conferir o que o plano atual permite) | 1 semana |
| 3.4 | **Descida dos dados** | Ao entrar e ao reconectar, baixa o retrato de cada aba (rotas atuais) e só baixa de novo quando a revisão mudou | 1 semana |
| 3.5 | **Fila de envio** | Ampliar o diário de comandos para **várias entradas**, com estado por entrada (pendente, enviando, confirmada, rejeitada, conflito). Reenvia pelas mesmas rotas de hoje, em ordem, respeitando 30 por minuto. Dispara ao reconectar, ao abrir e periodicamente | 1,5 semana |
| 3.6 | **Abas** | Capturar e Agenda primeiro; depois imagens; depois Caderno; depois Cofre (ordem da seção 8) | 5–6 semanas no total |
| 3.7 | **Privacidade** | Atualizar a política: o que fica no aparelho, como é apagado, o que acontece ao perder o computador | 1–2 dias |

**Sem mudanças no banco na primeira versão (INFERIDO).** As rotas, recibos, revisões e eventos atuais bastam. Melhorias como limite de envio próprio para sincronização ou registro de aparelhos ficam para depois, sob a OP-009. Qualquer migration futura normaliza CRLF→LF nas travas, pela lição de 30/10.

### 5.3 Testes (só o essencial)

- **Mantidos:** o CI atual verde em cada entrega.
- **Novos, só onde há risco de perder ou duplicar dado:**
  - A fila não perde nem duplica comandos com queda de rede no meio do envio.
  - Conflito em Capturar e Caderno chega à tela de escolha.
  - Sessão revogada bloqueia o envio e apaga os dados locais.
  - Um fluxo E2E sem rede: entrar, ficar offline, criar anotação, reconectar e ver no servidor.
- **Aceite humano** (aparelhos reais e #44) pelo mantenedor, no fim de cada macro.

**Pronto quando:** as abas da tabela 5.1 funcionam sem rede depois do login e os testes acima passam.

---

## 6. Decisões do mantenedor (antes da semana 1)

1. **Casca:** confirmar Electron (RECOMENDADO: mesmo motor nos três sistemas e herda o offline do web app).
2. **Compras:** conta Apple (necessária para o Mac abrir sem bloqueio) e certificado OV do Windows agora, ou começar sem o certificado aceitando o aviso.
3. **Hospedagem dos instaladores:** repositório público de releases ou bucket público.
4. **Prazo da sessão no aparelho:** até revogar, ou um teto de dias sem conectar.
5. **Abrir offline:** direto ou com PIN.
6. **Cofre offline:** confirmar leitura e criação; troca de senha só online.
7. **Demais abas:** confirmar só leitura offline.

---

## 7. Depois dos três macros (só registro)

- **Microsoft Store:** o PWA empacotado em MSIX, com conta individual gratuita; a loja assina ([Windows Developer Blog](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/), [Microsoft Learn](https://learn.microsoft.com/microsoft-edge/progressive-web-apps-chromium/how-to/microsoft-store)). Pode dispensar o certificado OV no Windows.
- **Google Play:** TWA a partir do PWA. Contas pessoais novas exigem teste fechado com 12 testadores por 14 dias ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)). Cobrança alternativa disponível no Brasil ([Google Play Help](https://support.google.com/googleplay/answer/11174377)).
- **Apple (iPhone, iPad, Mac App Store):**
  - Não aceita PWA.
  - **Pacote:** exige app nativo (Capacitor). O service worker não funciona dentro do app embrulhado ([WebKit bug 206741](https://bugs.webkit.org/show_bug.cgi?id=206741)).
  - **Regras da loja:** funcionalidade mínima (4.2) e exclusão de conta no app ([Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app)).
  - **Cobrança no Brasil:** desde 2026, acordo com o CADE permite pagamento externo com comissões próprias ([TecMundo](https://www.tecmundo.com.br/mercado/413975-apple-oficializa-lojas-externas-no-brasil-e-outros-meios-de-pagamento-na-app-store.htm)).
- **Antes de qualquer loja:** decidir como a assinatura será vendida dentro dos apps.

Regras consultadas em 30/10/2026; reconferir antes de decidir.

---

## 8. Cronograma de execução mais rápida

Três frentes em paralelo, com execução por agentes e revisão do mantenedor a cada entrega. Estimativa otimista de **12 semanas** para os três macros; realista de 14 a 16, por depender da emissão do certificado, da revisão e do resultado do protótipo.

| Semana | M1 — PWA | M2 — Instalação online | M3 — Instalação offline |
|---|---|---|---|
| **1** | Guia na `/conheca` (1.1), manifesto (1.2) | Decisões e compras (seção 6); casca Electron mínima (2.1) | **Protótipo:** Capturar offline no navegador e dentro da casca, para medir tamanho dos dados, sincronização e se a casca herda o offline |
| **2** | Aviso de versão (1.3), indicador de conexão (1.4), página offline (1.5), armazenamento persistente (1.6). **M1 pronto** | Login, sessão e Google pelo navegador do sistema (2.2) | ADR do offline; início das telas sem servidor (3.1) |
| **3** | — | Instaladores (2.3) e build no CI (2.6) | Telas sem servidor (3.1) |
| **4** | — | Assinatura (2.4), atualizador (2.5), segurança da casca (2.8) | Banco local cifrado (3.2) e chave do aparelho (3.3) |
| **5** | — | Download na `/conheca` (2.7); aceite nos três sistemas. **M2 pronto** | Descida dos dados (3.4) |
| **6–7** | — | (Casca mantida; a interface atualiza pela web) | Fila de envio (3.5); **Capturar e Agenda offline** |
| **8–9** | — | — | **Imagens** na fila; bloqueio de arquivos; só leitura das demais abas |
| **10–11** | — | — | **Caderno** offline com conflito de versão |
| **12** | — | Instalador recebe a chave no cofre do sistema (3.2) | **Cofre** offline; privacidade (3.7); testes essenciais (5.3); aceite. **M3 pronto** |

**Marcos visíveis para as pessoas:**
- **Semana 2:** PWA melhorado e guia de instalação no ar.
- **Semana 5:** app de desktop para baixar (online).
- **Semana 7:** anotações e agenda funcionando offline, no PWA e no desktop.
- **Semana 12:** Caderno, imagens e Cofre offline.

**O que pode atrasar:**
- **Emissão do certificado OV:** pode levar dias ou semanas. Começar o processo na semana 1.
- **Protótipo da semana 1 negativo:** se a casca não herdar o offline do service worker, o M3 precisa de um bundle local no instalador, e a etapa ganha de 2 a 3 semanas.
- **Revisão do mantenedor:** cada macro termina com aceite humano.

---

## Referências

- **No repositório:**
  - PWA: `src/app/manifest.ts`, `src/app/sw.ts`, `src/app/offline/page.tsx`, `src/components/pwa/`, `src/app/layout.tsx`.
  - Cliente: `src/lib/demo/demo-provider.tsx`, `src/lib/demo/connected-application.ts`, `src/lib/demo/command-journal.ts`.
  - Escrita: `src/adapters/db/capture-task-store.ts`.
  - Segurança: `src/lib/auth/cookie-policy.ts`, `src/lib/security/csp.ts`.
  - Planejamento: [doc 07](07-estrategia-web-app.md), [ADRs](../adr/), [registro de 30/10](../implementation/retomada-aceites-20261029.md).
- **Externas** (30/10/2026):
  - Login Google em webviews: [Google Developers Blog](https://developers.googleblog.com/en/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/).
  - Assinatura no Windows: [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [Artifact Signing FAQ](https://learn.microsoft.com/en-us/azure/artifact-signing/faq).
  - Links das lojas: seção 7.
