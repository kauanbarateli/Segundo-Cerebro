# K — Estratégia de MVP (essencial · importante · futuro)

**Corte aprovado em 23/09/2026:** taxonomia D-016 e escopo D-023. ClickUp segue D-017: mantido na fase 2 por presunção declarada não contestada, reversível antes do ticket correspondente.

**Revisão visual de 29/09/2026 (D-030):** o [doc 14](14-prototipo-interacoes.md) antecipa escrita conectada, grafo local, busca e perfil no HTML com dados simulados. Isso não promove grafo persistente ao MVP nem considera concluídos os tickets de produção. A tabela abaixo mantém D-027 e a ordem aprovada.

**Critério do corte:** o MVP é o menor produto que substitui o app atual no dia a dia do Kauan — captura, dia (tarefas+agenda), dinheiro e segredos — com a fundação (visual, dados, segurança, PWA-base) que não se troca depois. A estratégia 80/20 do prompt governa a ORDEM (fundação visual navegável com mocks → persistência real), não o corte de escopo.

| Módulo | **MVP (essencial)** | **Fase 2 (importante)** | **Futuro** |
|---|---|---|---|
| Fundação | DS novo aplicado, shell (trilho/barra), tema claro+escuro, manifest+SW básico, `/offline`, CI completo (portões dos docs 08/09), Supabase novo com migrations por pipeline | outbox offline de captura, push (VAPID), instalação guiada | wrapper Capacitor, realtime |
| Início | bento com: Em foco, Tarefas de hoje, Agenda, Hábitos de hoje, resumo financeiro compacto (ordem mobile da v2) | métricas do cérebro, links do perfil | modos do dia personalizáveis |
| Capturar | compositor (4 tipos) + imagens (pipeline herdado) + caixa de entrada + conversão em tarefa + `client_id` idempotente | outbox offline, share target, lembrete COM data/aviso | e-mail-para-capturar, clipper |
| Tarefas | CRUD com **status no formulário** (fecha o defeito), filtros por categoria dinâmica, busca, datas no fuso (suíte herdada), ações completas no mobile | Kanban (sincronizado de verdade), etiquetas | subtarefas, repetição de tarefa |
| Conhecimento | cadernos/páginas/árvore + editor TipTap (lazy) + busca full-text + **wiki-links `[[...]]` + backlinks + painel "Relacionado"** + lixeira (a que faltava) | **grafo visual (vizinhança)**, trechos na busca | grafo global com filtros, templates de página |
| Calendário | 2 contas Google somente-leitura (fluxo herdado c/ correções doc 09 §2.5), dia/semana/mês responsivos, janela com refetch | lembrete por push, multi-dia correto em todas as visões | escrita de eventos (novo escopo OAuth), CalDAV |
| Drive | pastas/arquivos/upload assinado/lixeira **de verdade** (pastas incluídas), mover com tela | prévia de imagem/PDF, busca, cota por política | versões de arquivo |
| Projetos | CRUD + vincular/desvincular + tela do projeto | restaurar apagados, navegação para todos os tipos vinculados | metas/prazos de projeto |
| Financeiro | **modelo fundido inteiro no schema** (doc 06 §2); telas: Painel básico, Lançamentos (busca/filtros/URL/paginação da v2), Contas+cartão com fatura derivada e **pagamento parcial**, Categorias, transferências; máscara de valores | Orçamentos + plano do mês, gráficos interativos completos, recorrência na UI (`serie_tipo`), duplicar/desfazer refinados | anexos em lançamento, importação OFX/CSV, multi-moeda |
| Hábitos | 3 cadências + hoje + mapa de calor + **pausas e dia passado COM tela** (fecha o gap) | leitura/estatísticas avançadas | metas compostas |
| Cofre | modelo E2E completo com as evoluções do doc 09 §3 (é pequeno, crítico e já resolvido) | gerador de senha, TOTP das contas guardadas | compartilhamento seguro |
| Vínculos/Grafo | tabela `links` polimórfica + "Relacionado" clicável em tarefa/captura/evento/página | contagens + grafo de vizinhança (com Conhecimento F2) | grafo global |
| ClickUp *(D-017, reversível)* | — | portar a integração (9 operações) e **finalmente validar contra a API real** | escrita ampliada se fizer falta |
| Configurações | perfil, avatar, módulos, tema persistido (fecha a coluna órfã), **reset/troca de senha** | notificações/push, links sociais, exportar meus dados | TOTP login (MFA) |
| Admin | usuários + bloqueio corrigido + auditoria (doc 10 MVP) | métricas de uso (eventos+rollup+painéis) | funis/coortes |
| E-mail semanal | — | opt-in + domínio próprio + multiusuário correto | digest configurável |

**Porta de corte se o MVP pesar** (ordem de sacrifício sem quebrar o produto): Hábitos → Drive → Projetos saem do MVP antes de qualquer coisa do quarteto Capturar/Tarefas/Financeiro/Cofre. Calendário fica (o valor diário é alto e o código herdado reduz o custo).

**Validação de escopo:** separação aprovada em D-023; tickets no doc 13. As evidências do protótipo pertencem ao doc 14 §11 e não substituem os critérios de aceite dos adapters, persistência, upload, segurança ou implantação.
