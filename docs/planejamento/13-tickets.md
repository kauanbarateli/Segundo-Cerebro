# M — Specs e tickets executáveis (metodologia Matt Pocock, D-024)

**Baseline visual vigente — D-030, 29/09/2026:** o [doc 14](14-prototipo-interacoes.md) especifica os layouts e comportamentos simulados de Capturar, grafo, busca, perfil e organização de notas na Home. As notas de correspondência abaixo orientam o porte, sem marcar tickets concluídos: HTML/localStorage não substituem adapters, banco, autenticação, upload ou testes de produção. D-027 mantém grafo persistente na fase 2. Os resultados de validação desta demonstração são registrados somente no doc 14 §11.

**Como usar este arquivo:** cada SPEC vira **uma issue** (o "épico"), cada T-0NN vira **uma issue** ligada à sua spec, tudo com label `ready-for-agent`, no milestone indicado, publicado **em ordem de dependência** (bloqueadores primeiro) com as **dependências nativas de issue do GitHub** (procedimento operacional: `novo-segundo-cerebro/docs/agents/issue-tracker.md`; pré-requisitos: doc 12 §"Antes do primeiro ticket"). Execução: sempre pela **fronteira** — qualquer ticket sem bloqueador aberto; um ticket por sessão de agent, contexto limpo entre eles; cada implementação dirige `/tdd` nos seams acordados na spec e fecha com `/code-review`.

**Convenções dos tickets (R8/D-024):** comportamento fim-a-fim do ponto de vista do usuário; áreas nomeadas pelo vocabulário do produto (nunca caminhos de arquivo); referências `doc NN §x` apontam para este planejamento, que será versionado no mesmo repositório. "Portar do legado/workspace" significa copiar com adaptação citando a origem no commit — os dois repositórios-fonte são somente-leitura.

**Ordem de publicação:** SPEC-01…06, depois T-001…T-028 na numeração (ela já respeita os bloqueios).

---

## SPEC-01 — Fundação visual e PWA (Milestone M0)

**Problem Statement.** Hoje não existe onde construir: não há repositório do novo produto, e o Design System 2.0 (decisões D-012/D-013/D-025) existe só como planejamento. Sem uma fundação visual navegável e verificada por portões automáticos, cada módulo inventaria a própria aparência — exatamente a deriva que fragmentou a tipografia do legado em 14 tamanhos.

**Solution.** Um app Next.js instalável (PWA) com o DS 2.0 inteiro de pé — tokens com Geist, tema claro/escuro/sistema, primitivos, shell bento com trilho em pílula e barra inferior — navegável entre todas as rotas do produto (vazias, mas reais), com CI que barra regressão visual, de acessibilidade e de arquitetura desde o primeiro commit.

**User Stories.**
1. Como usuário, quero abrir o app no navegador e no celular instalado, para que ele pareça e se comporte como um aplicativo meu.
2. Como usuário, quero alternar entre claro/escuro/sistema sem piscar na primeira pintura, para que o tema respeite minha escolha em qualquer aparelho.
3. Como usuário de celular, quero navegar pela barra inferior com alvos de 44px e safe-area, para alcançar tudo com o polegar.
4. Como usuário de desktop, quero um trilho lateral em pílula com os módulos, para navegar sem ocupar a tela.
5. Como usuário, quero ver todas as áreas do produto no shell (mesmo vazias), para entender o mapa do sistema desde o primeiro dia.
6. Como usuário com sensibilidade a movimento, quero que o app respeite `prefers-reduced-motion` e `prefers-reduced-transparency`, para usá-lo sem desconforto.
7. Como usuário de teclado/leitor de tela, quero foco visível, skip-link e rótulos em tudo, para operar sem mouse.
8. Como usuário sem rede, quero uma página offline digna em vez de erro do navegador.
9. Como dono do produto, quero portões de CI (transbordo 320/390/768, alvos mínimos, detect/audit da Impeccable, contraste do validador), para que regressões visuais não entrem despercebidas.
10. Como desenvolvedor, quero o contrato de camadas ativo desde já, para o ADR-0002 não se dissolver.

**Implementation Decisions.** Stack D-018 (Next 15, Tailwind 4 com tokens via `@theme`, Vercel); tokens/validador/`brand` portados do workspace do `novo-segundo-cerebro` e recalibrados para o DS 2.0 (doc 04 §1: raios bento, tokens de vidro com fallback, superfícies inversas, zIndex nomeado, Geist D-025 com `tabular-nums`); fundação de tema portada do bootstrap (3 estados, script anti-flash pronto para hash de CSP); shell com navegação = intersecção Entitlement∩Preferência **mockada** nesta fase (contrato do ADR-0003 desde já); PWA base do doc 07 §2.1–2.2 (manifest com share_target declarado, SW precache, `/offline`); Impeccable instalada no repo (`init` gera `PRODUCT.md`; `DESIGN.md` nasce do doc 04); skills mattpocock instaladas e `CONTEXT.md`+ADRs herdados (D-019).

**Testing Decisions.** Bom teste aqui é o que trava invariante visual/estrutural sem acoplar a implementação: e2e Playwright de transbordo com culpado nomeado (portado do legado, ampliado p/ 320/768), e2e de alvo ≥44px nas rotas densas, teste do script de tema (12 casos portados), validador do DS no CI (JSON×CSS×contraste), teste-guarda de regras (`dvh` nunca `vh`; classe Tailwind nunca em runtime; sem `text-*` cru fora da escala), dependency-cruiser como teste. Seams: o DOM renderizado por rota (e2e) e os arquivos de token (validador) — nunca detalhes de componente.

**Out of Scope.** Qualquer dado (mock ou real) além do necessário para o shell; autenticação; conteúdo das telas de módulo; push; outbox offline.

**Further Notes.** Ordem interna: T-001 → T-002 → T-003 → {T-004, T-006} → T-005.

### T-001 · Repositório, esqueleto e portões mínimos — `M0`
**Parent:** SPEC-01.
**What to build:** o repositório do produto nasce na pasta decidida (D-026) com um app Next 15 + Tailwind 4 que compila, uma página inicial provisória, e o CI verde executando typecheck, lint, testes, build e o contrato de camadas; as skills de engenharia e os docs de domínio (CONTEXT.md, ADRs 0001–0005 com as conciliações D-019) já dentro do repo; o planejamento (`docs/planejamento/`) versionado.
**Acceptance criteria:**
- [ ] `git clone` + install + dev sobem a página inicial sem variáveis de ambiente
- [ ] CI roda os cinco portões e falha se qualquer um falhar (provado com um commit sabotado revertido)
- [ ] dependency-cruiser barra import de framework/SDK dentro do Núcleo (regra ativa, ainda que o Núcleo esteja vazio)
- [ ] `CONTEXT.md` + 5 ADRs presentes; `AGENTS.md` une regras de design (evidence-first) e de arquitetura
- [ ] labels de triagem e milestones criados no GitHub
**Blocked by:** None (can start immediately).

### T-002 · Tokens DS 2.0 + tema em três estados — `M0`
**Parent:** SPEC-01.
**What to build:** a pessoa abre o app e vê a página de verificação do DS 2.0 renderizada com os tokens novos (neutros quentes, superfícies inversas, semânticas em dois degraus, raios bento, Geist com numerais tabulares) e alterna claro/escuro/sistema sem flash; o validador do DS roda no CI e reprova contraste abaixo do piso.
**Acceptance criteria:**
- [ ] Tokens definidos uma vez (fonte única) e consumidos pelo Tailwind 4 via `@theme`; nenhuma cor crua fora dos tokens
- [ ] Alternador claro/escuro/sistema portado, com persistência e acompanhamento do SO no modo sistema; sem flash na primeira pintura (e2e portado prova)
- [ ] Geist servida self-hosted com fallback; `tabular-nums` aplicado a valores de exemplo
- [ ] Validador (JSON×CSS×contraste nos 4 fundos×2 temas) verde no CI; um token sabotado o reprova
- [ ] Página de verificação exibe superfícies, tintas, semânticas, escala tipográfica nomeada e raios
**Blocked by:** T-001.

### T-003 · Primitivos nível 1 — `M0`
**Parent:** SPEC-01.
**What to build:** os blocos com que qualquer tela se constrói: botão (com estado de carregamento), cartão bento (variantes clara/inversa/tinted), pílula/badge com ponto semântico, campo de formulário (≥16px), ícones e logotipo portados — todos com os seis estados de interação e demonstrados na página de verificação nos dois temas.
**Acceptance criteria:**
- [ ] Botão: variantes primária/secundária/fantasma/perigo, tamanhos, `loading` embutido (nunca mais rótulo trocado à mão), disabled por token
- [ ] Cartão bento com os raios/elevações do doc 04; superfície inversa com dupla de contraste medida
- [ ] Campo compartilhado único (a lição do `inputCls` paralelo do legado: proibido por lint/teste-guarda)
- [ ] Todos os controles com foco visível, `sb-target-44` onde o desenho é menor, e os 6 estados
- [ ] Ícones (47) e logotipo "2" tokenizado portados; `.eyebrow`, scrollbar fina e `toast-out` devolvidos ao porte
**Blocked by:** T-002.

### T-004 · Shell navegável (trilho + barra + cabeçalho) — `M0`
**Referência visual D-030:** doc 14 §§2/8/9: contexto da seção à esquerda, busca compacta, tema, foto ilustrativa à direita e popover de conta; alturas alinhadas, nomes acessíveis no trilho e viewport/safe-area. O avatar real e seus uploads seguem T-027.
**Parent:** SPEC-01.
**What to build:** a moldura do produto: trilho lateral em pílula no desktop (recolhível, com a aritmética de largura conferida), barra inferior no celular (4 módulos + "Mais", safe-area, ações de conta incluídas — logout nunca mais inacessível), cabeçalho com marca, tema e a casca da paleta de comandos; todas as rotas da taxonomia D-016 existem como páginas vazias navegáveis com skip-link e títulos corretos; a navegação lê a intersecção Entitlement∩Preferência de um provedor mockado.
**Acceptance criteria:**
- [ ] Navegar por TODAS as rotas nos três formatos (320, 768, 1280) sem transbordo; DOM na ordem mobile
- [ ] Recolher/expandir o trilho devolve exatamente a largura ao conteúdo (as duas contas verificadas)
- [ ] "Mais" da barra inferior lista o excedente + Ajuda + Sair (sempre alcançáveis)
- [ ] Skip-link funcional; Tab percorre na ordem visual em 1280px
- [ ] Desligar um módulo no provedor mock o remove da navegação E a rota responde de acordo (contrato do ADR-0003 na casca)
**Blocked by:** T-003.

### T-005 · PWA base + portões visuais de CI — `M0`
**Parent:** SPEC-01.
**What to build:** o app instala (desktop/Android/iOS) com ícones maskable e splash, abre em janela própria com atalhos de manifest, mostra `/offline` digna sem rede, e o CI ganha os portões visuais: e2e de transbordo 320/390/768 varrendo todas as rotas com culpado nomeado, e2e de alvo mínimo, e `impeccable detect`/`audit` como verificação.
**Acceptance criteria:**
- [ ] Lighthouse reconhece a PWA instalável; instalação testada em Android e iOS reais (registro com capturas)
- [ ] SW faz precache do shell; derrubar a rede e navegar → `/offline` explica o estado (sem tela branca)
- [ ] share_target declarado no manifest (rota-alvo responde com placeholder digno até M2)
- [ ] Os três e2e visuais no CI, verdes; um transbordo plantado é apontado com o seletor culpado
- [ ] `npx impeccable detect` zero achados reais; relatório do `audit` anexado à issue no fechamento
**Blocked by:** T-004.

### T-006 · Primitivos nível 2 (superfícies e dados) — `M0`
**Parent:** SPEC-01.
**What to build:** o segundo anel de componentes com que os módulos operam: diálogo unificado (modal + confirmação com TODO o rigor de foco), drawer lateral/tela-cheia, bottom sheet, toast v2 (dispensável, pausa no hover, ação "Desfazer"), switch, tabela-de-dados com ordenação/paginação e seu par de cartões mobile, tooltip acessível, moldura de gráfico com resumo acessível, barra de progresso, seção recolhível e navegação interna de página — demonstrados na página de verificação nos dois temas.
**Acceptance criteria:**
- [ ] Diálogo único: armadilha de foco aninhada, Esc fecha só o topo, devolve foco, trava rolagem; a variante destrutiva herda tudo
- [ ] Drawer (desktop) ↔ tela cheia (mobile) com o mesmo conteúdo; bottom sheet com `dvh`
- [ ] Toast com botão de dispensar, pausa no hover e slot de ação (base do soft delete futuro)
- [ ] DataTable e cartões consomem O MESMO array ordenado/filtrado (teste prova)
- [ ] Switch único substitui as 4 implementações do legado; todos os itens com os 6 estados e teclado completo
**Blocked by:** T-003.

---

## SPEC-02 — Fundação funcional com mocks (Milestone M1)

**Problem Statement.** O prompt de reconstrução exige (§18) ver o produto inteiro navegável e funcional ANTES de banco/integrações — mas sem uma camada de dados trocável, "funcional com mocks" vira retrabalho quando a persistência chegar.

**Solution.** O Núcleo (ADR-0002) nasce agora: regras puras portadas do legado com seus testes, contratos de dados por módulo, e adapters em memória que as telas consomem — de modo que M2/M3 troquem o adapter e NENHUMA tela mude. As telas principais operam de verdade sobre dados de exemplo.

**User Stories.**
1. Como usuário, quero usar o produto inteiro com dados de exemplo, para sentir o fluxo antes de existir banco.
2. Como usuário, quero capturar algo e vê-lo na caixa de entrada, convertê-lo em tarefa e encontrá-lo em Tarefas — tudo na sessão.
3. Como usuário, quero ver o Início bento com meu dia (tarefas, agenda, hábitos, pulso financeiro) montado dos exemplos.
4. Como usuário, quero criar/editar tarefa com TODOS os campos (status incluído) e ver a lista e os filtros reagirem.
5. Como usuário, quero passear pelas cinco telas do Financeiro com números de exemplo que fecham entre si.
6. Como usuário, quero estados de vazio/erro/carregamento dignos em toda tela, para nunca encarar uma tela branca muda.
7. Como desenvolvedor, quero as regras de dinheiro/tempo/hábitos como funções puras testadas, para a matemática não depender de tela nem de banco.
8. Como desenvolvedor, quero o dependency-cruiser reprovando import de SDK no Núcleo, para a arquitetura ser lei e não intenção.

**Implementation Decisions.** Núcleo por domínio com contratos em tipos próprios; adapters em memória com a MESMA interface dos futuros adapters de banco (doc 02 §2.1/§3); portes com teste: dinheiro em centavos, fuso (`tempo`), hábitos (cadências/sequência), competência de cartão + fatura derivada + parcelas (a parte pura da fusão D-006); massa de dados de exemplo única e coerente entre módulos (o mesmo universo aparece no Início, em Tarefas e no Financeiro); formulários com o padrão Drawer/BottomSheet; erro de leitura APARECE (boundary por rota).

**Testing Decisions.** Os testes portados vêm JUNTO com as funções (são a especificação viva); testes de contrato dos adapters mock (mesma suíte rodará contra o adapter real em M2/M3 — o seam é a interface do adapter); e2e curto por jornada mock (capturar→converter→ver em tarefas). Proibido testar detalhe de componente; o seam de UI é a rota.

**Out of Scope.** Persistência, auth, RLS; Conhecimento com editor (chega em M3 — aqui é casca com árvore mock); qualquer integração externa.

**Further Notes.** Ordem interna: T-007 primeiro; T-008 depois de T-004/T-006/T-007; T-009/T-010/T-011 em paralelo após T-006/T-007; T-012 fecha.

### T-007 · Núcleo: regras puras portadas + contratos — `M1`
**Parent:** SPEC-02.
**What to build:** o coração sem interface: módulos do Núcleo (captura, tarefas, hábitos, financeiro, tempo, dinheiro) com tipos de domínio, regras portadas do legado COM os testes originais adaptados, e as interfaces de adapter que M1 implementa em memória e M2/M3 em banco; o contrato de camadas reprova violações.
**Acceptance criteria:**
- [ ] Regras de tempo/fuso portadas com a suíte inteira verde também sob `TZ=UTC`
- [ ] Competência de cartão, fatura derivada (5 estados) e rateio de parcelas portados com seus testes; a exceção do cartão expressa em UM lugar
- [ ] Cadências/sequência/taxa de hábitos portadas com os 37 casos
- [ ] Interfaces de adapter por módulo publicadas; adapter em memória de referência com suíte de contrato
- [ ] Núcleo sem nenhum import de framework/SDK (portão prova)
**Blocked by:** T-001.

### T-008 · Início bento com dados de exemplo — `M1`
**Referência visual D-030:** doc 14 §9: manter a hierarquia do dia, títulos legíveis em duas linhas e caixa de entrada ligada à mesma coleção de Capturar. Indicador de organização = notas ativas organizadas / total de notas ativas, sem percentual arbitrário. As ações e fixtures exatamente demonstradas no HTML estão discriminadas no doc 14; os critérios abaixo continuam exigindo fonte única para todo o dia.
**Parent:** SPEC-02.
**What to build:** a tela-panorama real: Em foco, Tarefas de hoje (3/5 responsivo), Agenda, Hábitos de hoje e pulso financeiro compacto, montados do universo de exemplo via adapters, na ordem mobile correta, com todos os blocos interativos (concluir tarefa, marcar hábito) refletindo na sessão.
**Acceptance criteria:**
- [ ] A 390px o essencial cabe em ≤2,5 telas de rolagem; ordem DOM = ordem de importância
- [ ] Concluir tarefa/hábito no Início atualiza os contadores na hora (mesma fonte mock)
- [ ] "Hoje" respeita o fuso do app (teste com `TZ=UTC` prova que não vaza UTC)
- [ ] Bloco de módulo desligado (mock) não aparece nem é buscado
- [ ] Estados vazios de cada bloco com CTA correto
**Blocked by:** T-004, T-006, T-007.

### T-009 · Capturar ponta a ponta (mock) — `M1`
**Referência visual D-030:** doc 14 §§2–7: escrita de 340px/300px, metadados recolhidos, biblioteca, salvar/rascunho, vínculos explícitos, sugestões wiki e backlinks. Conservar uma identidade ao organizar em Conhecimento e preservar origem ao converter. Grafo local nesta referência é demonstração de interação para a fase 2; “Anexar exemplo” é apenas nome e não satisfaz os critérios de imagem/upload abaixo. O HTML não implementa isolamento/limpeza por usuário no logout real.
**Parent:** SPEC-02.
**What to build:** o fluxo de entrada completo sobre o adapter mock: compositor com 4 tipos + imagens (pipeline de re-encode portado, armazenamento em memória), rascunho local por usuário, caixa de entrada com filtro, detalhe com navegação ←/→, conversão em tarefa (idempotente por `client_id` já no contrato) e arquivamento.
**Acceptance criteria:**
- [ ] Capturar → aparece na caixa → converter → aparece em Tarefas (e2e mock)
- [ ] Colar/arrastar/escolher imagem funciona com prévia; remoção de EXIF preservada do porte
- [ ] Rascunho sobrevive a recarregar a página e some no "logout" mock
- [ ] Adicionar a primeira imagem TEM gatilho visível no mobile (fecha o achado do diagnóstico)
- [ ] `client_id` idempotente provado no contrato do adapter (reenvio não duplica)
**Blocked by:** T-006, T-007.

### T-010 · Tarefas ponta a ponta (mock) — `M1`
**Parent:** SPEC-02.
**What to build:** lista (DataTable) e cartões mobile do mesmo array, filtros por categoria dinâmica + busca sem acento, formulário em Drawer com TODOS os campos — **status incluído** —, concluir/reabrir/arquivar/excluir disponíveis igualmente no desktop e no mobile.
**Acceptance criteria:**
- [ ] Editar uma tarefa concluída e salvar NÃO altera o status (o defeito do legado tem teste de regressão)
- [ ] Filtros vêm das categorias do universo mock (nunca nomes fixos no código)
- [ ] Todas as ações de item existem no mobile (menu do cartão)
- [ ] Data/hora digitadas voltam idênticas (suíte de fuso na borda do formulário)
- [ ] Vazio-por-filtro ≠ vazio-real (mensagens distintas)
**Blocked by:** T-006, T-007.

### T-011 · Financeiro em cinco telas (mock) — `M1`
**Parent:** SPEC-02.
**What to build:** a casca funcional do módulo prioritário sobre o Núcleo fundido: shell com abas na URL, Painel básico (patrimônio, a-pagar, indicadores com números de exemplo que FECHAM), Lançamentos com busca/filtros/paginação/ordenação na URL e par tabela↔cartões, Contas com cartão + trilha do ciclo + fatura derivada dos exemplos, Categorias; máscara "ocultar valores"; formulários em Drawer.
**Acceptance criteria:**
- [ ] Aba/mês/filtros/página sobrevivem a recarregar e a compartilhar a URL
- [ ] Fatura derivada mostra os 5 estados a partir do universo mock (datas manipuladas nos testes)
- [ ] Soma do Painel = soma dos Lançamentos do recorte (coerência provada por teste sobre o mock)
- [ ] "Ocultar valores" mascara TUDO com comprimento fixo e nunca vai para a URL
- [ ] Zero biblioteca de gráfico (regra herdada); rosca/linhas em SVG próprio com resumo acessível
**Blocked by:** T-006, T-007.

### T-012 · Demais cascas navegáveis com estados dignos — `M1`
**Parent:** SPEC-02.
**What to build:** Conhecimento (lista de cadernos/árvore mock, SEM editor ainda), Calendário (grades dia/semana/mês com eventos de exemplo, mês com versão mobile em lista), Hábitos (hoje + mapa de calor + pausas COM tela, sobre o Núcleo), Drive (pastas/arquivos mock com lixeira), Projetos (lista + tela do projeto com seções), Cofre (telas de criar/desbloquear como maquete de fluxo, sem cripto), Configurações (perfil/módulos=preferência mock/tema) — cada uma com skeleton com a geometria real, vazio e erro com retry.
**Acceptance criteria:**
- [ ] Toda rota tem skeleton próprio (nada do esqueleto genérico único do legado)
- [ ] Erro de leitura plantado no adapter mock APARECE como erro com "Tentar de novo" (nunca lista vazia)
- [ ] Mês do calendário legível no mobile sem rolagem horizontal de página
- [ ] Hábitos: marcar dia passado e registrar pausa existem na tela (fecha o gap do legado)
- [ ] Navegação interna de página (chips) nas telas longas de Configurações
**Blocked by:** T-004, T-006, T-007.

---

## SPEC-03 — Identidade, segurança e primeiras persistências (Milestone M2)

**Problem Statement.** Tudo até aqui é de uma pessoa só e evapora ao recarregar. O legado ensinou onde a fundação de segurança acerta (RLS por dono, guardas na primeira linha) e onde fura (bloqueio reversível pelo bloqueado, CSP inerte, cookie legível, migrations sem registro).

**Solution.** O projeto Supabase novo nasce com o pipeline disciplinado (doc 06 §6), o esquema de identidade com moderação inalcançável pelo dono, auth com cookies httpOnly + CSP em bloqueio, rate-limit persistente e eventos de domínio — e os três primeiros módulos (Capturar, Tarefas, Início) trocam o adapter mock pelo real sem mudar tela.

**User Stories.**
1. Como usuário, quero entrar com e-mail/senha e recuperar a senha sozinho, para nunca depender do admin para voltar.
2. Como usuário, quero que minhas capturas e tarefas persistam entre aparelhos, para o cérebro ser um só.
3. Como usuário, quero que NINGUÉM (nem outro usuário, nem sessão anônima) alcance meus dados, com prova automatizada.
4. Como dono, quero bloquear uma conta e ela cair NA HORA, sem janela de sessão válida e sem autodesbloqueio possível.
5. Como dono, quero auditoria administrativa e eventos de domínio que ninguém edita, para confiar no rastro.
6. Como desenvolvedor, quero migrations aplicadas só por pipeline com verificação executável, para nunca mais perguntar "o que está aplicado?".
7. Como usuário, quero limites de tentativa no login e nas escritas, para força bruta não ser um caminho.

**Implementation Decisions.** Esquema de identidade do doc 06 §1 (com `user_moderation` sem policy — doc 09 §2.3, e auditorias append-only §2.4); cookies httpOnly viáveis porque nenhum código de navegador fala com o banco/storage (uploads por URL assinada de escrita chegam em M3 com o Drive); CSP em bloqueio com o mecanismo herdado; rate-limit em tabela + RPC atômica; eventos ADR-0004 emitidos pelos orquestradores; tipos gerados no CI; Supabase local no CI para e2e e para o script de asserções de RLS/grants; cadastro público fechado + admin cria contas com troca de senha forçada.

**Testing Decisions.** A suíte de contrato dos adapters (de M1) roda contra o adapter real — mesma suíte, seam idêntico; script executável de RLS (dois usuários simulados, `anon` fechado, grants efetivos) como teste de CI; teste-varredura das actions (auth primeiro, rate-limit onde declarado, `requireMaster` no admin); e2e de bloqueio (sessão viva cai; PATCH direto recusado).

**Out of Scope.** Financeiro/Conhecimento/Drive/Cofre persistentes (M3); push; métricas de uso (fase 2); TOTP.

### T-013 · Supabase novo + pipeline + esquema de identidade — `M2`
**Parent:** SPEC-03.
**What to build:** o banco de verdade: projeto criado, CLI ligada, migrations transacionais aplicadas por pipeline de CI (nunca à mão), com o esquema de identidade completo (perfil, preferências, papéis, moderação separada, entitlements com Plano Pessoal implícito, eventos de domínio, rate-limit) todo sob RLS por dono, tipos gerados versionados, e o script de asserções rodando no CI contra Supabase local.
**Acceptance criteria:**
- [ ] Pipeline aplica migrations no local (CI) e no remoto (aprovação manual); reaplicar é no-op provado
- [ ] Script de asserções: RLS ligada em 100% das tabelas, `anon` sem grants, moderação/eventos sem policy de escrita do dono
- [ ] `user_moderation` inalcançável por `authenticated` (tentativa direta recusada em teste)
- [ ] Tipos gerados no CI; divergência do commitado reprova
- [ ] Seed sem dados pessoais; master semeado por variável (não e-mail hardcoded)
**Blocked by:** T-001.

### T-014 · Auth completa + CSP em bloqueio + rate-limit — `M2`
**Parent:** SPEC-03.
**What to build:** entrar/sair/recuperar senha/trocar senha com cookies httpOnly, middleware com CSP em **modo bloqueio** (nonce + hash do script de tema, testados), guardas de sessão e de módulo (entitlement real), rate-limit persistente aplicado a login e escritas, headers de segurança, e o e2e passando contra Supabase local no CI — o portão que o legado nunca teve.
**Acceptance criteria:**
- [ ] Fluxos entrar/esqueci-a-senha/trocar senha completos por e-mail; erro de login sem enumeração
- [ ] Cookie de sessão httpOnly+secure; nenhuma leitura de JWT por JavaScript no bundle (varredura)
- [ ] Header `Content-Security-Policy` (não Report-Only) com teste de hash; tema não pisca
- [ ] 6 tentativas de login em 1 minuto → bloqueado com mensagem digna (janela provada por teste da RPC)
- [ ] e2e roda no CI contra Supabase local, incluindo o fluxo de login
**Blocked by:** T-013.

### T-015 · Capturar + Tarefas persistentes (troca de adapter) — `M2`
**Parent:** SPEC-03.
**What to build:** os dois módulos de entrada trocam o adapter mock pelo real: esquema de capturas/tarefas/categorias com RLS e triggers de integridade, conversão captura→tarefa como RPC transacional idempotente, imagens de captura no bucket com URL assinada de escrita, e as MESMAS telas de M1 operando com persistência — sem mudança de componente.
**Acceptance criteria:**
- [ ] Diff das telas ≈ zero (a troca é no provedor de adapter); suíte de contrato de M1 verde contra o real
- [ ] Capturar no celular e ver no desktop (e2e em dois contextos)
- [ ] Conversão idempotente provada (repetir a RPC não duplica); `client_id` único por usuário
- [ ] Upload de imagem por URL assinada de escrita; tamanho real medido no servidor; EXIF removido
- [ ] Erro de RLS plantado aparece como ERRO na tela (nunca lista vazia)
**Blocked by:** T-009, T-010, T-014.

### T-016 · Início real + eventos de domínio — `M2`
**Parent:** SPEC-03.
**What to build:** o Início passa a montar o dia dos dados reais (tarefas/capturas persistidas; blocos de módulos ainda-mock claramente marcados), e toda escrita dos módulos reais emite Evento de domínio (antes/depois/canal) legível pelo dono numa tela simples de atividade.
**Acceptance criteria:**
- [ ] Blocos de tarefas/capturas/organização do dia vêm do banco; fuso correto sob `TZ=UTC`
- [ ] Toda escrita de Capturar/Tarefas gera evento com canal `web` e diff coerente (teste de orquestrador)
- [ ] Eventos são append-only (tentativa de UPDATE/DELETE pelo dono recusada)
- [ ] Tela "Atividade" lista os próprios eventos com paginação
- [ ] Módulo desligado (preferência real) não é consultado (sem requisição — provado por spy no adapter)
**Blocked by:** T-008, T-015.

### T-017 · Admin básico com bloqueio correto — `M2`
**Parent:** SPEC-03.
**What to build:** a área do master: listar contas (metadados), criar usuário com senha provisória de troca forçada, bloquear/desbloquear no modelo de três passos (ban no Auth + revogação de sessões + moderação), trocar papel com as salvaguardas, e a trilha administrativa com tela — tudo atrás das quatro camadas herdadas.
**Acceptance criteria:**
- [ ] Bloquear derruba a sessão VIVA do alvo no ato (e2e com dois contextos)
- [ ] O bloqueado não consegue se reativar por chamada direta (teste de API) — a coluna não está ao alcance dele
- [ ] Desbloquear recusa o próprio id; último master não pode ser rebaixado/bloqueado
- [ ] Toda action do admin com `requireMaster` primeiro (teste-varredura)
- [ ] Primeira entrada com senha provisória exige troca antes de qualquer rota
**Blocked by:** T-014.

---

## SPEC-04 — Financeiro fundido e persistente (Milestone M3)

**Problem Statement.** O Financeiro é o módulo prioritário do produto e hoje existe como DOIS modelos divergentes (main × v2 do legado). A fusão D-006 está especificada no doc 06 §2 — falta materializá-la sem perder nenhuma das garantias que cada lado conquistou.

**Solution.** Esquema fundido + RPCs transacionais + a massa de regressão com valores à mão portada ANTES das telas; então as cinco telas de M1 trocam o adapter e ganham as capacidades reais: fatura derivada com pagamento parcial, séries finitas, soft delete com Desfazer, transferências atômicas.

**User Stories.**
1. Como usuário, quero registrar um gasto em ≤3 toques do Início, para o registro não ser burocracia.
2. Como usuário, quero que compra no cartão caia na fatura certa automaticamente e a dívida exista desde a compra.
3. Como usuário, quero pagar fatura parcialmente e ver o restante como dívida honesta.
4. Como usuário, quero parcelar e criar recorrências finitas, com as ocorrências visíveis e canceláveis dali em diante.
5. Como usuário, quero excluir um lançamento e poder DESFAZER, para errar sem medo.
6. Como usuário, quero transferências que nunca viram receita/despesa fantasma — nem quando eu apagar uma conta.
7. Como usuário, quero buscar/filtrar/paginar lançamentos com a URL compartilhável.
8. Como usuário, quero o Painel batendo com a lista, sempre — dois números diferentes para a mesma pergunta é defeito.

**Implementation Decisions.** Doc 06 §2 na íntegra: `is_paid` como coluna gerada de `paid_cents`; exceção do cartão em UM gatilho; `serie_tipo` (recusada de novo a tabela de recorrência — registrar em ADR novo do repo); status da v2 com somas contando só confirmado/conciliado e `deleted_at is null`; RPCs `transfer`/`pay_statement`/`create_series`/`close_account`; competência pelo mês da fatura (D2 herdada). Telas: as de M1 com Drawer, toasts com Desfazer (8s), selo "Fatura de <mês>".

**Testing Decisions.** A **massa de regressão controlada** (18+ lançamentos com valores calculados à mão) porta primeiro e vira o portão do módulo: os números da main (pagamento parcial, horizontes) E os da v2 (plano do mês, estorno) têm de passar sobre o modelo fundido; testes de RPC (atomicidade provada por falha no meio); suíte de contrato do adapter. Seams: as RPCs e o adapter — nunca a tela.

**Out of Scope.** Orçamentos/plano do mês na UI, gráficos interativos completos, recorrência na UI (fase 2 — o schema já suporta); anexos e importação (fase 3).

### T-018 · Esquema fundido + RPCs + massa de regressão — `M3`
**Parent:** SPEC-04.
**What to build:** o banco do Financeiro fundido inteiro (contas/cartões, categorias, etiquetas, lançamentos com o modelo D-006, orçamentos), as quatro RPCs transacionais, e a massa de regressão portada dos dois lados passando sobre o modelo novo — antes de qualquer tela tocar nisso.
**Acceptance criteria:**
- [ ] Massa da main (paid_cents/horizontes) e da v2 (plano/estorno/status) verdes sobre o esquema fundido
- [ ] `is_paid` gerada; escrever nela diretamente falha (teste)
- [ ] Exceção do cartão num único gatilho; compra em cartão nasce paga e a dívida salta desde a compra (números provados)
- [ ] `transfer` e `pay_statement` atômicas (falha simulada no meio não deixa perna órfã)
- [ ] `close_account` preserva as pernas da outra conta (o defeito do legado tem teste)
**Blocked by:** T-013.

### T-019 · Contas, cartão e fatura reais — `M3`
**Parent:** SPEC-04.
**What to build:** a tela de Contas de M1 sobre dados reais: criar/editar/arquivar contas e cartões, trilha do ciclo da fatura, os 5 estados derivados, pagamento total E parcial pela RPC, juros/IOF do rotativo como lançamento na fatura seguinte — com o Painel refletindo tudo.
**Acceptance criteria:**
- [ ] Fatura muda de estado pela passagem do tempo simulada (derivação, nunca gravação)
- [ ] Pagamento parcial: restante aparece como dívida; view de saldos bate com a soma manual da massa
- [ ] Rotativo lança juros na fatura seguinte sem `transfer_group_id`
- [ ] Arquivar conta preserva histórico e transferências (e2e)
- [ ] Órfãos de `statement_month` têm aviso com ação (herdado e melhorado)
**Blocked by:** T-011, T-018.

### T-020 · Lançamentos reais + transferências + Desfazer — `M3`
**Parent:** SPEC-04.
**What to build:** a tela de Lançamentos de M1 sobre o banco: criar/editar/duplicar com séries (parcelamento e recorrência finita), transferências, exclusão lógica com toast "Desfazer" e restauração, busca/filtros/paginação/ordenação reais na URL, alerta de duplicidade não bloqueante — e o Painel + Início refletindo o recorte.
**Acceptance criteria:**
- [ ] Série de 12 parcelas: soma das parcelas = total (rateio na última); encerrar recorrência apaga só futuras não pagas
- [ ] Excluir → Desfazer em 8s restaura idêntico (evento de domínio registra os dois)
- [ ] Filtros/busca/página na URL sobrevivem a recarregar; resumo do conjunto filtrado correto
- [ ] Duplicidade provável avisa sem bloquear e sem vazar valor mascarado
- [ ] Painel, lista e Início mostram o MESMO número para o mesmo recorte (teste de coerência)
**Blocked by:** T-019.

---

## SPEC-05 — Conhecimento, arquivos e vida diária (Milestone M3)

**Problem Statement.** O que faz o produto ser um "segundo cérebro" — notas conectadas, arquivos, projetos, hábitos, segredos e a agenda — ainda opera em mock ou casca.

**Solution.** Os módulos restantes trocam para persistência real, com as evoluções decididas: Conhecimento com wiki-links/backlinks/lixeira (D-027), vínculo polimórfico único e clicável, Drive com lixeira de verdade e uploads assinados, Hábitos completos, Cofre E2E com as 7 evoluções (D-021), Calendário Google com as correções de OAuth.

**User Stories.**
1. Como usuário, quero escrever notas em blocos com `[[links]]` que criam páginas e backlinks automáticos, para o conhecimento se conectar sozinho.
2. Como usuário, quero ver "o que aponta para cá" em qualquer página e navegar pelos vínculos de qualquer item.
3. Como usuário, quero lixeira em páginas E pastas, para excluir sem terror.
4. Como usuário, quero meus arquivos com upload por arrastar, mover entre pastas e baixar com segurança.
5. Como usuário, quero projetos agrupando tarefas/capturas/cadernos/pastas com "criar aqui" e "vincular existente".
6. Como usuário, quero hábitos com pausas e marcação de dias passados, com a sequência calculada certa.
7. Como usuário, quero o Cofre onde só EU abro — com kit de recuperação que provou a si mesmo — e itens ilegíveis visíveis, nunca sumidos.
8. Como usuário, quero minhas 2 agendas Google lendo certo (multi-dia incluso), com lembrete de reunião.

**Implementation Decisions.** `links` polimórfica + `page_refs` (doc 06 §3); editor TipTap portado com lazy load, concorrência otimista e a validação de documento herdadas; Drive por URLs assinadas de escrita/leitura (a peça que fecha httpOnly); Hábitos sobre o Núcleo de M1; Cofre: porte + AAD por item, chave de sessão não-extraível, teto de payload, `logAudit` tipado, clipboard 30s, aviso assinado de irrecuperabilidade (doc 09 §3); Google: fluxo herdado + PKCE + chave HMAC própria + escopos concedidos + janela com refetch + mês mobile (doc 09 §2.5, doc 08 §5).

**Testing Decisions.** Extração de wiki-links como função pura com suíte própria; suíte de contrato dos adapters; testes de cripto do Cofre portados + novos de AAD; e2e por jornada (nota→link→backlink; upload→mover→lixeira→restaurar; conectar Google mock/fixture → eventos na grade). Seam do editor: o documento salvo e o texto derivado — nunca o DOM interno do TipTap.

**Out of Scope.** Grafo visual (fase 2 — D-027); prévia de arquivos; templates de página; escrita no Google.

### T-021 · Conhecimento real: editor + wiki-links + backlinks + lixeira — `M3`
**Referência visual D-030:** doc 14 §§6/9: notas conectadas de Conhecimento e Capturar compartilham o mesmo registro na demonstração; não duplicar texto/backlinks ao portar. Renomear preserva relações, arquivar não apaga arestas e backlinks abrem a origem. O HTML deixa `[[destino inexistente]]` pendente até a criação manual; a criação de página por interação prevista abaixo permanece trabalho de produção, assim como TipTap e concorrência.
**Parent:** SPEC-05.
**What to build:** cadernos e páginas persistentes com o editor portado; digitar `[[` sugere páginas e cria as inexistentes ao confirmar; salvar extrai referências e alimenta backlinks; painel "Relacionado" clicável em página/tarefa/captura/evento sobre a tabela única de vínculos; lixeira de páginas e cadernos com restauração.
**Acceptance criteria:**
- [ ] `[[página nova]]` cria a página no clique e o backlink aparece nela (e2e)
- [ ] Renomear página não quebra referências (referência por id, alias atualizável)
- [ ] Backlinks e "Relacionado" listam em lote (sem N+1 — provado por contagem de queries no adapter)
- [ ] Conflito de edição concorrente detectado e oferecendo escolha (padrão herdado)
- [ ] Excluir → lixeira → restaurar devolve árvore e vínculos intactos
**Blocked by:** T-012, T-013.

### T-022 · Drive real com uploads assinados — `M3`
**Parent:** SPEC-05.
**What to build:** arquivos e pastas persistentes: upload por botão/arrastar via URL assinada de escrita com registro medido no servidor, mover arquivo E pasta, lixeira unificada com restauração (pastas incluídas — o delete definitivo do legado morre), destaque, download por URL curta, cota por política exibida.
**Acceptance criteria:**
- [ ] Upload nunca expõe credencial no navegador (varredura de bundle + rede no e2e)
- [ ] Tamanho/tipo validados no servidor; executável recusado
- [ ] Excluir pasta → lixeira com conteúdo; restaurar devolve a árvore
- [ ] Mover pasta com proteção de ciclo (herdada) e tela
- [ ] Uso exibido bate com a soma dos registros (teste)
**Blocked by:** T-012, T-014.

### T-023 · Projetos + Hábitos reais — `M3`
**Parent:** SPEC-05.
**What to build:** Projetos persistentes ("coluna no contêiner", criar-aqui, vincular/desvincular, soft delete com restauração e itens navegáveis) e Hábitos persistentes completos (3 cadências, hoje, mapa de calor, pausas e dia passado com tela, sequência correta além da janela carregada).
**Acceptance criteria:**
- [ ] Trigger de "projeto vivo do mesmo dono" ativo; apagar projeto não toca itens; restaurar devolve tudo
- [ ] Cadernos/pastas/capturas abrem A PARTIR do projeto (fecha o gap)
- [ ] Sequência de hábito atravessa a janela de exibição sem mentir (caso de 100+ dias em teste)
- [ ] Pausa geral e por hábito refletem no cálculo e no mapa
- [ ] Marcar dia passado respeita teto de futuro e fuso
**Blocked by:** T-012, T-015.

### T-024 · Cofre E2E com as sete evoluções — `M3`
**Parent:** SPEC-05.
**What to build:** o Cofre real: criar com senha mestra (aviso assinado de irrecuperabilidade), kit em duas metades com autoverificação byte a byte, desbloquear/auto-lock, CRUD cifrado com AAD por item, chave de sessão não-extraível, itens ilegíveis visíveis com diagnóstico, copiar com limpeza de clipboard, recuperação por kit trocando a senha.
**Acceptance criteria:**
- [ ] Servidor nunca vê claro (inspeção de payloads no adapter/testes); RLS-sem-policy nas chaves
- [ ] Trocar payload entre itens no banco é DETECTADO na leitura (AAD) e exibido como ilegível
- [ ] Chave de sessão não-extraível (tentativa de export falha em teste)
- [ ] Kit: gerar→provar→recuperar num navegador limpo (e2e); kit antigo continua válido após troca de senha (comportamento documentado na tela)
- [ ] Auto-lock por inatividade e ao ocultar a aba; clipboard limpo em 30s
**Blocked by:** T-012, T-014.

### T-025 · Calendário Google real — `M3`
**Parent:** SPEC-05.
**What to build:** conectar até 2 contas Google (OAuth com PKCE, state com chave própria, escopos concedidos gravados), sincronização incremental com janela que se estende ao navegar, grades com multi-dia correto em todas as visões e mês mobile em lista, filtro por conta respeitado em TODO lugar (Início e lembretes inclusos), lembrete de reunião herdado, sync diário por cron autenticado.
**Acceptance criteria:**
- [ ] Fluxo OAuth completo com PKCE; token cifrado com AAD; desconectar revoga e apaga
- [ ] Evento de 3 dias aparece nos 3 dias em dia/semana/mês (fixture prova)
- [ ] Navegar para além da janela busca mais (sem recarregar a página)
- [ ] Calendário desmarcado some do Início e dos lembretes (o vazamento do legado tem teste)
- [ ] Cron de sync autenticado, com registro de execução visível no admin
**Blocked by:** T-012, T-014.

---

## SPEC-06 — Fecho do MVP (Milestone M4)

**Problem Statement.** Com os módulos de pé, faltam as costuras que transformam features num produto: achar qualquer coisa, configurar a própria conta, e operar com confiança (observabilidade, backups, checklist final).

**Solution.** Busca global pela paleta de comandos, Configurações completas, e o hardening de release — fechando os critérios de saída da Fase 1 (doc 12).

**User Stories.**
1. Como usuário, quero apertar Ctrl/Cmd+K e encontrar tarefas, notas, lançamentos, arquivos e ações, para navegar pelo que penso, não por menus.
2. Como usuário, quero configurar perfil, tema (persistido na conta), módulos visíveis e notificações num lugar só.
3. Como usuário, quero trocar minha senha e ver minhas sessões com segurança.
4. Como dono, quero erros reportados com privacidade, backups agendados e um checklist de release executado e registrado.

**Implementation Decisions.** Busca por módulo nos adapters (full-text onde há `search_vector`; prefixo/`ilike` no resto) unificada na paleta com ranking simples e ações; tema como preferência de conta (a coluna que o legado nunca ligou) com fallback local; Sentry com allowlist + `beforeSendTransaction` + boundaries reportando; backup do banco agendado (runbook herdado adaptado, destino fora de sincronização, ensaio de restauração registrado).

**Testing Decisions.** e2e da paleta (buscar→abrir em 3 módulos); teste de vazamento do Sentry (planta segredo, afirma ausência — herdado e ampliado para transações); checklist manual da Fase 1 como issue-modelo preenchida.

**Out of Scope.** Métricas de uso do admin (fase 2); push; exportação de dados (fase 2).

### T-026 · Busca global + paleta de comandos — `M4`
**Referência visual D-030:** doc 14 §8: diálogo com foco inicial, retorno de foco, navegação por setas/Enter/Esc, resultados agrupados, contagem anunciada, busca sem acento e estado vazio. O HTML pesquisa notas/tarefas/projetos e atalhos; os sete tipos, ranking e orçamento de desempenho abaixo continuam obrigatórios para a entrega real.
**Parent:** SPEC-06.
**What to build:** a paleta real: Ctrl/Cmd+K (e botão no mobile) busca em tarefas, capturas, páginas, lançamentos, arquivos, projetos e hábitos, com resultados agrupados, atalhos de ação (nova captura/tarefa) e navegação por teclado completa.
**Acceptance criteria:**
- [ ] Resultado abre o item certo nos 7 tipos (e2e em 3)
- [ ] Busca sem acento e com ranking estável; vazio com sugestão de escopo
- [ ] Teclado: setas/Enter/Esc; foco devolvido; leitor de tela anuncia contagens
- [ ] Tempo de resposta aceitável com massa grande semeada (orçamento definido no ticket)
- [ ] Ações rápidas registram evento de domínio com canal correto
**Blocked by:** T-015, T-020, T-021.

### T-027 · Configurações completas — `M4`
**Referência visual D-030:** doc 14 §8: foto e menu superior ilustram acesso a Configurações/Sair. O retrato embutido é ilustrativo, sem upload ou autenticação; não substitui o pipeline de avatar e os controles reais de conta deste ticket.
**Parent:** SPEC-06.
**What to build:** a central da conta: perfil com avatar (re-encode + URL assinada), tema persistido na conta (sincroniza entre aparelhos, com o local como fallback offline), módulos = Preferência real com reordenação, notificações do lembrete, troca de senha, e a tela "meus dados" apontando exportação como fase 2.
**Acceptance criteria:**
- [ ] Tema escolhido no desktop aparece no celular ao entrar (preferência de conta)
- [ ] Reordenar módulos muda trilho/barra na hora; essencial não desligável (servidor recusa)
- [ ] Avatar: upload assinado, re-encode, remoção
- [ ] Troca de senha exige a atual; sessões antigas derrubadas
- [ ] Painéis com navegação interna e recolhíveis no mobile (padrão herdado)
**Blocked by:** T-014, T-022.

### T-028 · Hardening de release 1 — `M4`
**Parent:** SPEC-06.
**What to build:** o fecho operacional: Sentry com allowlist ampliada às transações e boundaries reportando, varredura de segredos ampliada no CI, backup agendado com ensaio de restauração REGISTRADO, revisão das políticas RLS pelo script contra produção (somente leitura), e o checklist manual da Fase 1 (Tab/leitor/reduced-motion/iPhone real/jornadas-âncora) executado e anexado.
**Acceptance criteria:**
- [ ] Teste de vazamento cobre eventos E transações; nenhum campo fora da allowlist sai
- [ ] Backup roda agendado para destino não sincronizado; restauração ensaiada num projeto descartável com registro (Cofre destrava = critério herdado)
- [ ] Script de asserções aponta zero desvios em produção
- [ ] As 6 jornadas-âncora do doc 05 §3 passam no desktop e no iPhone real (vídeo/registro)
- [ ] Issue de release fechada com o relatório do `impeccable audit` final
**Blocked by:** T-016, T-017, T-020, T-023, T-024, T-025, T-026, T-027.

---

## Fase 2+ (não quebrada em tickets — por regra)

As specs da Fase 2 (outbox offline, share/push, orçamentos+plano do mês, grafo visual, métricas do admin, ClickUp validado, exportação, opt-in do e-mail, TOTP) e das fases seguintes estão nomeadas no [doc 12](12-roadmap.md) e serão transformadas em spec+tickets **quando chegar a vez**, com `/to-spec`/`/to-tickets` sobre este planejamento — quebrar agora seria especular contra a regra da metodologia.
