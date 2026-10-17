# Handoff da Frente D — release após design estável — 17/10/2026

Data do checkpoint: 17/10/2026 UTC, 16/10 em Fortaleza. Repositório de implementação: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro). Main observado ao preparar este documento: `61d03c768071e6618136e648fc71c552e3db2043`. Conferir a base e o SHA da PR draft de consolidação antes de retomar; os WIPs locais ainda não publicados não pertencem automaticamente a esse commit.

Este é o handoff da construção offline, preparação do aceite visual e fechamento de release. O [handoff Auth](handoff-frente-auth-20261017.md) e o [checkpoint de backup/baseline](frente-b-backup-baseline-20261017.md) descrevem as outras frentes. Nenhum deles, isoladamente, atesta o MVP concluído.

## 1. Ordem aprovada e corte do MVP

A orientação mais recente do responsável é concluir primeiro as melhorias de interface e estabilizar o design; a rodada visual final e o aceite humano de produção vêm depois. Isso evita refazer capturas e auditorias a cada ajuste. Acessibilidade, as seis jornadas completas e os portões existentes continuam sendo critérios de saída. Durante a construção, corrigir regressões relevantes e executar os checks pertinentes à alteração; adiar a rodada final não autoriza desligar o CI nem incorporar defeitos conhecidos.

Drive continua retirado do MVP, sem lógica substituta definida. Não construir upload/pastas/lixeira/cota/download, apagar dados antigos ou remover a infraestrutura compartilhada de Capturar/Avatar. IA embarcada, cobrança, compartilhamento e grafo persistente de fase posterior não entram nesta retomada.

A [#36](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36) está **OPEN, pós-MVP e sem milestone**, por decisão expressa do responsável. Não bloqueia mais o aceite do MVP. A mitigação restrita da cadeia de lint e a auditoria completa obrigatória no CI permanecem ativas; não se trata de correção definitiva ou dispensa de segurança. Preservar seus critérios originais: [decisão de escopo](decisao-36-pos-mvp-20261017.md).

## 2. Fontes obrigatórias para assumir a frente

Ler nesta ordem:

1. `AGENTS.md` e `CONTEXT.md`, na raiz, e os ADRs aplicáveis à alteração.
2. [Índice do planejamento](../planejamento/00-indice.md), [tickets](../planejamento/13-tickets.md) e [roadmap, saída da Fase 1](../planejamento/12-roadmap.md).
3. [DS 2.1 e interações](../planejamento/14-prototipo-interacoes.md), [design system](../planejamento/04-design-system.md), `DESIGN.md`, `PRODUCT.md` e D-030/D-032 no [registro de decisões](../planejamento/registro-de-decisoes.md).
4. A skill local completa `.agents/skills/impeccable/SKILL.md` e as referências pertinentes, **antes de alterar a interface**.
5. [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12), [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35), [#2](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2) e [#7](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7), seus comentários e evidências. Os corpos históricos descrevem checkpoints próprios; não substituem o último resumo confirmado.
6. [Portões visuais](t005-visual-guards.md), [PWA e OP-006](t005-pwa.md), [relato de instalação](pwa-human-installation-20261013.md) e [tema entre aparelhos](t027-tema-entre-aparelhos-20261013.md).
7. Para a frente conectada, os dois handoffs citados na abertura e os runbooks [backup/restore](../operations/backup-restore-release.md) e [Calendário](../operations/google-calendar-release-verification.md).

O planejamento original está em `C:\Users\Kauan Sousa Barateli\OneDrive\Documentos\Kauan Barateli\Maestri\Pessoal\Novo  -- Segundo Cerebro`. As decisões conciliadas e versionadas no repositório prevalecem sobre instruções históricas substituídas. Os repositórios [segundo_cerebro](https://github.com/kauanbarateli/segundo_cerebro) e [novo-segundo-cerebro](https://github.com/kauanbarateli/novo-segundo-cerebro) são somente contexto.

## 3. Divisão de propriedade e passagem por PR

| Frente | Pode preparar e entregar | Quem confere o aceite |
| --- | --- | --- |
| Construção offline/visual | Ajustes descritos pelo responsável; componentes, responsividade, desempenho e acessibilidade; testes de domínio/contrato e fixtures locais pertinentes; documentação do comportamento. | Root revisa código, diff, critérios, evidências locais e CI do SHA da PR antes de incorporar. |
| Root/conexões | Correções que exigem Supabase/Vercel, ensaio de restore, qualificação do baseline, runners Auth, produção, rotina de backup e evidência conectada. Pode delegar código puro em paths separados. | Root conserva a autoridade de cada operação e registra seu resultado original, sem promover mocks a prova remota. |
| Aceite final | Responsável testa a interface estabilizada nos aparelhos e confirma as jornadas; o agente prepara o roteiro e corrige os problemas encontrados. | Responsável fornece o aceite humano; Root consolida a evidência e verifica cada critério antes de fechar issues. |

Trabalhar em checkout/worktree e branch próprios, preferindo os já adequados. Preservar os cinco WIPs históricos alheios e todo delta não atribuído. Nunca resetar, limpar ou mover alterações de outro agente. Reservar paths e comunicar dependências antes de editar o mesmo arquivo; compartilhar uma máquina não torna seguro rodar vários builds/Chromium/QA pesados ao mesmo tempo.

A entrega imediata desta pausa é **PR draft com o pacote local de Root, sem novo push em Main**. Publicação da branch/PR pode disparar push, pull_request e preview Vercel, inclusive em draft; acompanhar os runs pertinentes sem modificar gatilhos para ocultar falhas. Não presumir que a draft já foi incorporada. Nas próximas entregas, usar branch remota/PR com base e HEAD explícitos; commits e conteúdo publicado não incluem coautoria.

Cada entrega deve informar problema resolvido, arquivos e SHA exato, testes executados e não executados, limites, screenshots públicos quando pertinentes e critérios ainda pendentes. Resultado local pertence aos bytes executados; se a PR mudar, revisar o delta e atualizar a evidência afetada. Root acompanha o CI pelo SHA/run/tentativa próprios antes de integrar. Nenhum agente fecha automaticamente issues por texto de commit: usar `Refs`, preservando a decisão de fechamento.

## 4. Matriz de aceite preservada: #12 e #35

### #12 — T-005: PWA base e portões visuais

| Critério original | Como concluir sem repetir trabalho indevido |
| --- | --- |
| Installability e instalação real Android/iOS com capturas. | A substituição da antiga categoria Lighthouse pela verificação Chromium está documentada em OP-006; não exigir categoria removida. O responsável já informou instalação pelo Chrome no iPhone 11/iOS e A35/Android. Conservar esse fato. Faltam versões e registro com capturas; não inferir standalone/splash/safe areas/offline pelos relatos. Recolher somente a evidência ainda ausente, após a interface estabilizada. |
| SW precache do shell e navegação sem rede para `/offline`, sem tela branca. | Implementação e prova técnica histórica estão registradas. Verificar regressões no SHA final quando afetado; não cachear conteúdo pessoal para cumprir o teste. |
| `share_target` no manifest e rota-alvo com placeholder digno. | Preservar o critério já implementado e sua prova; não transformar isso em novo escopo de ingestão/Drive. |
| Três e2e visuais no CI, verdes; overflow plantado aponta o seletor culpado. | Preservar `tests/e2e/visual-guards.spec.ts` e a prova negativa. No candidato estável, conferir overflow em 320/390/768, alvos mínimos e o resultado hospedado do mesmo SHA. |
| Impeccable detect sem achados reais e relatório de audit anexado no fechamento. | Usar o engine/skill fixados do projeto e `npm run check:impeccable`; revisar os achados e fazer a auditoria visual final. Anexar relatório do candidato aprovado. Não atribuir relatório antigo ao novo visual. |

O acompanhamento também conserva teclado, leitor de tela real, foco e movimento reduzido. Viewport Chromium não é aparelho físico, leitor real nem aceite humano. A confirmação do tema desktop → celular já está registrada e #34 concluída; não reabrir esse trabalho sem regressão concreta.

### #35 — T-028: Hardening de release 1

| Critério original | Trabalho e prova que permanecem necessários |
| --- | --- |
| Vazamento cobre eventos **e** transações; nada fora da allowlist sai. | Revisar os controles existentes de Sentry, boundaries e scanner. Associar a prova negativa de segredo plantado aos canais e ao SHA efetivamente testados. Não enviar conteúdo pessoal para observabilidade. |
| Backup agendado fora de sincronização e restauração ensaiada num descartável, com registro; Cofre destrava. | O backup novo e seu verify separado já têm evidência própria, mas não provam rotina agendada ou restore. Root conclui baseline/privilégios, ensaio e aceites Auth/Storage/Cofre conforme seu handoff. Não aceitar diferença de migrations, SQL sintético, só contagem ou archive autenticado como equivalência do destino. |
| Script de asserções aponta zero desvios em produção. | O literal já tem prova histórica. Conservar o resultado e conferir sua validade para mudanças posteriores; qualquer nova consulta é read-only no projeto pessoal, com evidência própria e sem aplicar migrations por CI/deploy. |
| Seis jornadas do doc 05 §3 passam no desktop e iPhone real, com vídeo/registro. | Executar a matriz da seção 5 quando o design estabilizar. Android complementa, mas não substitui o iPhone exigido. Não trocar jornadas por uma captura por tela ou por smoke demo. |
| Issue de release fechada com o relatório Impeccable audit final. | Produzir o relatório do SHA/deploy final, reunir os outros quatro critérios e o aceite humano. Root fecha somente após conferir o conjunto; este documento mantém a issue aberta. |

Os controles de finalização dos runners Admin/Recovery pertencem ao fecho seguro da #35. Os estágios funcionais já comprovados e as issues funcionais fechadas não precisam ser reabertos por associação; falhas de quiescência/cleanup continuam sendo falhas no seu próprio canal. Build/CI geral verde não resolve outro workflow falho.

## 5. Rodada final após estabilização do design

Antes da rodada, registrar o candidato (PR/HEAD, deploy correspondente e URL), o conjunto de melhorias visuais acordado e o que ainda ficou fora. Evitar adicionar ajustes novos dentro do mesmo aceite sem atualizar o candidato e sua evidência.

1. Conferir os portões do projeto: lint/tipos/testes pertinentes, camadas, tokens/contraste, scanner, build e E2E visual/PWA, conforme workflows existentes. A publicação não é um PASS; obter a conclusão original do run correto. Executar em série na máquina quando necessário.
2. Auditar a interface final com Impeccable: claro/escuro/sistema, contraste sobre o fundo real, largura útil e overflow, alvos ≥44 × 44, campos ≥16 px, safe areas, feedback/erros/estados vazios e movimento reduzido. Preservar layout e identidade aprovados, Geist e tokens DS 2.1.
3. Validar teclado real, foco visível, ordem, skip link, rótulos e leitor de tela; registrar aparelho, sistema, navegador/leitor e resultado. Falha deve gerar item concreto com reprodução, correção e nova prova afetada.
4. Executar as seis jornadas abaixo no desktop e iPhone real. Registrar etapas, resultado, candidato e captura/vídeo sem segredos. Evitar senhas, kits, URLs assinadas, tokens ou conteúdo do Cofre nos anexos públicos.
5. Responsável confirma o aceite humano do candidato. Root confere #12/#35 e depois as histórias próprias de #2/#7; registra pendências residuais e só então decide os fechamentos.

| Jornada original do doc 05 §3 | Percurso que não pode desaparecer do aceite |
| --- | --- |
| Tive uma ideia. | Capturar em ≤5 s, chegar à caixa de entrada e organizar em tarefa/nota/lembrete com projeto e vínculos. Respeitar o escopo offline aprovado; a frase histórica de fila offline não autoriza implementar outbox de fase 2 nesta frente. |
| O que é hoje? | Início mobile reúne próximo movimento, três tarefas, agenda e hábitos; concluir, marcar hábito e abrir evento sem trocar de módulo. |
| Gastei / paguei. | Lançar em ≤3 toques pelo Início/atalho, cair na fatura correta e refletir no painel. |
| Onde está aquilo? | Busca global com contexto; abrir resultado e percorrer vínculos/backlinks. |
| Reunião de amanhã. | Evento Google com nota vinculada; abrir nota, capturar decisões e convertê-las em tarefas ligadas ao evento. |
| Preciso da senha do banco. | Cofre: desbloqueio com senha mestra, cópia com limpeza em 30 s e auto-lock. O humano opera os segredos; anexar somente o resultado permitido. |

Modelo mínimo de evidência por critério: **issue/literal → SHA/deploy → canal (local/CI/conectado/humano) → aparelho/ambiente → passos → resultado observado → link público sanitizado → pendência**. Resultado inconclusivo ou bloqueado permanece explícito, com o próximo passo; não equivale a sucesso.

## 6. Revisão dos épicos #2 e #7

A [#2 — Fundação visual e PWA](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2) exige conferir suas dez histórias, além dos filhos: abrir no navegador e instalado; tema sem flash entre aparelhos; barra inferior mobile com alvo/safe area; trilho desktop; áreas do escopo no shell; reduced-motion/reduced-transparency; teclado/leitor/foco/skip-link; offline digno; portões visuais/contraste; fronteiras de camadas. Não reintroduzir Drive pela frase histórica “todas as áreas”. Aplicar D-030/DS 2.1 em vez de reconstruir o DS 2.0 histórico. Os filhos já concluídos conservam a evidência; #12 continua seu portão final.

A [#7 — Fecho do MVP](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7) exige quatro histórias: Ctrl/Cmd+K encontra tarefas/notas/lançamentos/ações; perfil/tema/módulos/notificações nas Configurações; senha e sessões próprias seguras; observabilidade privada, backup agendado e checklist registrado. Preservar a prova de buscar → abrir em três módulos e de vazamento em eventos/transações. #33/#34 e demais filhos já fechados não devem ser reabertos por este handoff; conferir o readback atual e os limites das evidências. #35 e os próprios critérios do épico impedem fechamento automático.

## 7. Prompts de retomada completos

### Agente de construção offline e visual

```text
Retome a frente de construção offline/visual do repositório
https://github.com/kauanbarateli/Segundo-Cerebro
a partir da PR draft de consolidação indicada por Root, no SHA exato revisado.
Leia AGENTS.md, CONTEXT.md, docs/implementation/handoff-frente-release-20261017.md,
docs/planejamento/00-indice.md, 04-design-system.md, 05-arquitetura-de-produto.md,
12-roadmap.md, 13-tickets.md, 14-prototipo-interacoes.md, DESIGN.md, PRODUCT.md
e a skill .agents/skills/impeccable/SKILL.md completa, com referências pertinentes.
Leia as issues #12/#35 e os épicos #2/#7 no estado atual.

Confirme o escopo das melhorias visuais já descritas pelo responsável. Se ainda
não estiverem descritas, inventarie problemas observáveis e entregue uma proposta
concreta, sem presumir uma nova identidade ou redesenhar áreas por iniciativa.
Use checkout/worktree e branch próprios; preserve WIPs alheios e reserve paths.
Mantenha o layout aprovado, DS 2.1, Geist, responsividade, desempenho, semântica,
teclado/foco, contraste, movimento reduzido e alvos mínimos.

Implemente o que independe de produção com fixtures/adapters locais. Não use
Supabase/Vercel pessoais, profiles, arquivos privados, migrations remotas,
contas reais, cleanup de banco ou capturas de runs encerrados. Drive está fora
do MVP; #36 é manutenção pós-MVP OPEN e mantém mitigação/auditoria ativas.
Não remova nem relaxe gates para produzir PASS.

Faça checks pertinentes aos bytes alterados e entregue PR para Root revisar,
com base/HEAD, arquivos, provas, limitações e pendências. Não use coautoria
nem feche issues automaticamente. Rodada visual final e aceite humano só após
design estável; a11y e as seis jornadas permanecem obrigatórias.
Não execute builds/testes pesados em paralelo na máquina sem coordenar.
```

### Root: revisão e release conectada

```text
Retome a frente Root do Segundo Cérebro, começando pela PR draft de consolidação,
sem presumir integração. Leia AGENTS.md, CONTEXT.md e os handoffs:
docs/implementation/handoff-frente-release-20261017.md,
docs/implementation/handoff-frente-auth-20261017.md,
docs/implementation/frente-b-backup-baseline-20261017.md.
Confira HEAD/base, WIPs, issues #12/#35/#2/#7, PRs abertas e metadados do CI.

Revise as entregas offline por diff e SHA próprios antes de integrar. Preserve
os critérios originais, a primeira falha, deadlines e terminais reais. Prossiga
nos itens conectados pelo próximo passo concreto do handoff respectivo,
com código/preparo/QA/peer e destino já revisados antes de qualquer operação.
Não reutilize captura/operação encerrada nem janela antiga de quiescência.

O pessoal atual é rishenjoikgmfubmnfiu; o ensaio é jvwduowyavpaxssogadn.
BlackSheep/VOE/legado não são alvos. Preserve SSH e autenticações alheias.
Não reaplique 001–019, não resete nem aplique schema em CI/build/deploy.
Nenhuma migration está pendente neste checkpoint.

Após design estável, consolide PWA, acessibilidade, seis jornadas desktop/iPhone
e aceite humano, com SHA/deploy e canal de cada evidência. #36 fica OPEN
pós-MVP; Drive continua fora. Não declare aceite do MVP ou feche issues
antes de cumprir seus critérios próprios. A orientação imediata desta pausa
é publicar o pacote local em PR draft, sem novo push em Main.
```

Os prompts são instruções de retomada; este arquivo não executa os comandos, não ativa serviços e não concede um novo aceite conectado.

## 8. Estimativa e como reduzir retrabalho

Estimativa compartilhada por Root para o trabalho técnico restante: **12–20 horas efetivas**, condicional à ausência de novas divergências de restore/Auth. Não é promessa de conclusão em tempo corrido. Esperas por autorização, disponibilidade humana, aparelho, serviço ou nova proposta visual não entram nessas horas; alterações adicionais de design precisam de estimativa própria. Com disponibilidade e frentes independentes, a referência anterior de 2–4 dias é apenas uma hipótese de agenda.

Para acelerar: manter construção visual e correção técnica em branches independentes; reaproveitar provas válidas sem reexecutar históricos; entregar PRs pequenas com SHA e limites claros; corrigir o código antes da próxima operação conectada; reservar uma rodada final depois da estabilização visual; coordenar a QA pesada em série. Acelerar não significa remover jornadas, aceitar um baseline diferente ou considerar testes sintéticos como produção.

Documento criado por leitura de fontes e critérios públicos, sem testes, serviços, conexões operacionais ou acesso a arquivos privados. Nenhuma issue foi fechada para prepará-lo.
