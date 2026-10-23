# T-052 / #77 — composição Financeiro E6

Refs #77. Parte de #71. Autoria local na branch codex/finance-e6-20261022, base 53b8e5e6a7da293f6729c96eaa6f8dc1aea62a7b / árvore 8e0078f5c21a1cabcd40660a5349ead787d470ac. A Root informou posteriormente a incorporação da mesma árvore à main 0b004ebe7536476dda9a6b6be4c97f2bd0f9fc99. Esta autoria não executou rebase, stage, commit, push, merge, deploy, SQL ou serviços.

## Referência e composição

**OBSERVADO:** issue #77 e comentários, pacote17 (doc03, auditoria Financeiro/Hábitos), capturas financeiro-1440-light.png e financeiro-390-dark.png e as fatias T052 presentes na base. O produto já tem análise por competência, tabela acessível, seletor de período, cinco URLs, estados, orçamentos, transferências e editores persistentes.

**INFERIDO por leitura da base:** faltavam composição principal/coluna cartões, entrada rápida, três recentes e detalhe do cartão em Fatura/Compras/Configurações. Metas e evolução do planejamento continuam em #78/#79 congeladas; não se mostram fotografias, aportes ou saldos fictícios para preencher a coluna.

**RECOMENDADO e implementado:** transportar esses elementos sobre consultas/comandos existentes. A ordem do DOM é área principal (posição atual, entrada, análise, orçamento por categoria e recentes), coluna de cartões e análises adicionais. A coluna desce quando não há largura. As cinco rotas antigas permanecem visíveis e conservam rótulos/queries, inclusive Categorias/Etiquetas e Orçamentos. Não se esconde uma capacidade antiga para imitar as quatro abas da demonstração.

Impeccable local lida integralmente; referências operate, audit, harden, craft-floor e polish, PRODUCT/DESIGN consultadas. Launcher/detector não executados pela restrição humana de zero runtime; contexto obtido diretamente dos materiais versionados. A leitura React e Supabase/Postgres é estática. O leitor recusou as páginas oficiais Supabase Markdown por content-type; as versões HTML oficiais de changelog/tabelas foram consultadas. Nenhuma conexão pessoal foi operada.

## Implementado

- Coluna Meus cartões com fatura da competência, vencimento, vazio, adicionar e caminho para Contas. Total usa projeções existentes; dívida de todo o histórico e fatura do período continuam identificadas separadamente.
- Entrada rápida Entrada/Saída, descrição, valor e conta. Revisar lançamento abre o editor existente com esses quatro campos. Não cria registro, não presume pagamento e não inventa categoria/competência. Cancelar conserva o rascunho. A criação exige o submit explícito do editor, seus validadores, client_id, recibo e evento.
- Três recentes no recorte existente; Ver todos, histórico, tabela, paginação, filtros, duplicidade, lixeira e vínculos de pares/grupos preservados.
- Drawer com tabs e setas/Home/End. Compras conserva data original, competência, estados, parcelas e estornos; transferências/pagamentos não viram novas compras. Pagamento/edição/arquivo usam os mesmos comandos, com foco no gatilho estável.
- Prévia textual real do cartão, sem imagem, PAN, validade ou CVV. Quatro dígitos opcionais e conta sugerida editável; tipo/ciclo mantêm as regras históricas.
- Máscara inclui valores e final do cartão. A entrada rápida desmonta campos quando os valores ficam ocultos; revelar é explícito. O novo componente não coloca dinheiro em atributos/data-*.
- Campos16px e controles44px pelo DS, layout até320px, rolagem local das tabs e quebra de texto; sem tokens, fontes, dependências ou animações novos. Ainda exige conferência renderizada.

## Metadados opcionais

ContaFinanceira admite last_four e default_payment_account_id opcionais/nullable. Final preenchido é exatamente quatro dígitos ASCII, inclusive zero inicial. As allowlists HTTP/cliente não aceitam número completo, PAN ou CVV.

Sugestão nova/alterada exige conta ativa do mesmo Usuário, mesma moeda e tipo diferente de cartão. Referência arquivada posteriormente é conservada ao renomear o cartão; ao abrir pagamento deixa de ser sugerida. O select permite limpar/substituir a referência. Não há regra nova de saldo disponível ou proibição de excedente.

**Não há pagamento automático:** a sugestão apenas inicializa o campo; a pessoa pode alterá-lo e ainda precisa confirmar Registrar pagamento. O comando existente permanece autoridade final.

Campos legados ausentes significam não configurados (fallback null na leitura). A ausência não é reescrita artificialmente no before/snapshot/evento/recibo, pois mudaria CAS/fingerprint. Campos só entram quando fornecidos; limpeza explícita usa null. Os corpos de cálculo de saldos, patrimônio, competência, fatura, séries, juros/IOF e normalização do pagamento foram preservados.

Mudanças compartilhadas restritas às seções Financeiro de client-command-specs.ts e connected-application.ts; nenhuma alteração em Calendar/Captura/Auth, módulos ou generated types.

## SQL draft e portão de ativação

[drafts/finance-card-metadata.sql](drafts/finance-card-metadata.sql) **não é migration aplicada nem instalação**. A Root reserva ID, generated types, SQL Editor, catálogo/inventários e release. Propõe:

1. duas colunas geradas a partir do payload, sem reescrever legado;
2. FK composta (user_id,default_payment_account_id) para conta do dono;
3. extensão fechada do validador vigente para dois nomes opcionais, preservando demais ramos;
4. trigger privado para elegibilidade da nova/alterada sugestão, sem permissões públicas novas, ledger ou pagamento.

SQL aditivo; não modifica migrations001–022, RLS, RPCs de pagamento ou o protocolo de revisão/recibos. O validador copiado exige diff contra a fonte vigente e não é aceite de catálogo. O draft e suas [asserções descartáveis](drafts/finance-card-metadata-assertions.sql) começam com `DRAFT_NOT_AUTHORIZED_FOR_APPLICATION`; as asserções terminam com rollback. A importação do corpo proposto é opt-in somente no teste RAM, por marcadores únicos, e precisa ser substituída pelo loader canônico quando a Root reservar a migration.

**Antes da integração conectada:** revisar/promover draft a migration; testar PostgreSQL FK/owner, tipo/moeda, arquivo posterior, CAS simultâneo e rollback/recibo/evento; gerar tipos/artefatos, conferir catálogo/backup/restore e aplicar em janela supervisionada no projeto pessoal. CI/build/deploy não aplicam schema hospedado. Não liberar esses campos em produção usando o validador antigo.

## Validação preparada; não executada

- tests/core/finance-card-metadata.test.ts: legado, zeros, referência, replay/conflito, evento, limpeza null, usuário/moeda/arquivo e comparação de fatura/saldos/lançamentos.
- tests/adapters/finance-card-metadata.test.ts: DTO legado/null, formato/PAN/CVV, referência e decoder.
- tests/adapters/finance-card-metadata-sql.test.ts e asserções DRAFT: ausência/null, FK composta e ACL, dono/tipo/moeda/arquivo, zeros, RPC original com evento/recibo/replay, sessão alheia, CAS stale, rollback de recusa e falha injetada no recibo depois de observar a linha e o evento; nada cria lançamento ou pagamento. Moeda incompatível é recusada pela fundação BRL antes do trigger, sem inventar uma conta USD. A fixture vazia e o trigger de falha também desaparecem com rollback. Isso é cobertura preparada, ainda não executada; não substitui concorrência PostgreSQL nativa.
- tests/features/finance-composition.test.tsx: markup/máscara, vazio, rascunhos e sugestão inelegível/arquivada. SSR não prova navegador.
- tests/features/finance-connected-metadata.test.ts: leitura original sem autopagamento, erro≠vazio, retry e allowlist sem PAN/CVV/dono.
- tests/e2e/spec08-finance-composition.spec.ts: revisão sem criação/pagamento presumido; cancelamento/foco/máscara; cadastro Demo real; tabs por teclado; sugestão editável/cancelamento; máscara nas três abas do drawer com fixture de compras preenchida e final0042, verificando texto e atributos aria/data/title/value; matriz320/390/768/1440 nos dois temas com16px/44px, DOM principal→coluna, três recentes, overflow e8PNG anexados.

Runner sequencial Node24: focais acima; testes econômicos/legacy/commands existentes; typecheck/lint/camadas/DS/secrets; composição CSS exata da fixture; build/client-auth; E2Es financeiros antigos/novos. A Root reconcilia fontes/inventários sem relaxar omissões/pins. Nenhum oráculo econômico antigo foi reduzido ou renumerado.

**Validado na autoria:** leitura estática; ao congelar, diff-check/bytes/hashes nativos. **Pendente:** todo teste dinâmico, SQL draft/catálogo, renderização, contraste medido nos fundos reais, zoom200%, movimento reduzido/teclado/foco reais, dispositivos e produção. Referências do protótipo não são capturas desta implementação; os8PNG preparados só existirão após CI no SHA correspondente.

Não encerra #77/#71/#81. #78/#79, metas/reservas, novas recorrências/limites, Asaas, onboarding, Drive e abertura comercial permanecem fora desta entrega.

## Reconciliação Root do candidato

Manifesto da autoria22: febb2234040674bc024865dcd462ae2c3aa4e81ea250ccf6bc9745801333de23, com peer estático independente. Foram corrigidos os acessos a índices possivelmente ausentes nas tabs e preparado o cenário de máscara nas três abas. A integração promoveu o corpo do draft à migration024 (20261022042500_spec08_finance_card_metadata.sql), manteve o draft protegido e separou supabase/tests/finance-card-metadata.sql com rollback. O teste RAM agora usa somente o loader canônico, sem aplicação duplicada. IDs reservados em UTC por edição de fonte sob restrição de runtime local; nenhum SQL aplicado. Esses deltas não atribuem PASS dinâmico ao freeze. Catálogo, tipos oficiais, SQL Editor, CI, imagens renderizadas e corte hospedado permanecem pendentes.
