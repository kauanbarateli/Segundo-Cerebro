# T-053 — limite mensal independente e cópia atômica

Fatia A da [#78](https://github.com/kauanbarateli/Segundo-Cerebro/issues/78), parte de #71. Base de autoria: `313f1c6a57798e794aa80e1208f3d26a6b74edb3`. Referências: [doc 17](../planejamento/17-evolucao-prototipo/README.md), seus contratos/auditoria e [ADR-0006](../adr/0006-financeiro-series-finitas.md). Reconferida a issue publicada em 23/10/2026. A #77 já está no candidato; seus metadados de cartão e migration 024 não foram reimplementados.

**Implementado em código; ainda não validado por execução.** O pacote não fecha #78: frequência, âncora e gestão durável das séries pertencem à fatia B. Metas/reservas da #79, Drive e checkout Asaas estão fora desta fatia.

## Comportamento

O painel e a aba Planejamento usam `planoDoMesFinanceiro`, que já existe no Core. O total explícito é o orçamento `category_id:null`. Quando ausente, aparece “Limite total não definido”; a soma das categorias permanece separada e não é convertida em total nem em zero. Consumo, estorno, competência, cartão e transferência continuam nas projeções econômicas existentes.

O editor oferece “Limite total do mês” como seleção explícita, diferente de nenhuma seleção. A ação do painel inicializa somente essa seleção. Limite, categoria e mês existentes preservam seus vínculos. Sobrealocação é informativa e não impede distribuir limites nas categorias.

A cópia fica desligada por padrão. O usuário escolhe aplicar ao mês selecionado e aos onze seguintes, vê o intervalo completo e precisa confirmar que substituirá os limites já existentes somente dessa seleção. Alterar valor, categoria ou mês retira essa confirmação. Outras categorias, lançamentos, valores pagos, contas e saldos não são modificados.

DS 2.1, Geist, campos de 16 px, foco e controles de 44 px reutilizam os componentes existentes. As duas confirmações são botões compartilhados com semântica `checkbox`, estado `aria-checked` e indicador visual/textual; não há input nativo fora do DS. Valores ocultos também removem percentuais, faixas de consumo/sobrealocação e geometria proporcional do total. A existência de um limite continua identificável, sem revelar seu valor.

## Contrato compatível

Foi estendido apenas `finance.budget.save` com `repeat_months?:1|12`. A omissão permanece ausente do corpo e do fingerprint legado; não é preenchida com 1. O resultado e o recibo continuam retornando o orçamento do mês selecionado, no formato v1. Não existe operação batch genérica enviada pelo navegador.

O caso de uso valida o intervalo civil inteiro antes de escrever. Um `executarComando` usa uma transação: doze upserts pela chave usuário/categoria/mês, doze eventos correspondentes e um recibo. Atualizações conservam ID e `created_at`. Uma origem inconsistente com dois limites na mesma chave é recusada. O intervalo precisa permanecer entre os anos 0001 e 9999.

Replay usa o mesmo `client_id` e corpo e não repete eventos; outro corpo para o mesmo identificador conflita. O adapter existente refaz CAS de snapshot obsoleto e reconcilia resultado incerto pelo recibo. O cliente conectado conserva o envio original no journal e impede substituí-lo por outro enquanto estiver pendente; a confirmação do envio original pelo shell continua disponível. Edição/erro não são prova de que o primeiro commit deixou de ocorrer. Nenhum retry automático de escrita foi acrescentado à interface.

## SQL proposto e portão de ativação

[finance-budget-repeat.sql](drafts/finance-budget-repeat.sql) é uma proposta inerte e não numerada. Seu primeiro bloco aborta com `DRAFT_NOT_AUTHORIZED_FOR_APPLICATION`. Ele não pertence ao carregador de migrations e não deve ser aplicado por CI, build ou deployment. A migration 026 continua reservada ao onboarding pela Root.

A proposta confere o corpo efetivo de `app_private.finance_commit(uuid,uuid,text,jsonb)` antes de modificar dois pontos exatos. Fonte original: `20261009144343_financial_transactions.sql`; SHA-256 do `prosrc`, normalizando somente CRLF para LF: `eac90c8853a494ff7c9ccfb5d7ac4663dfdede42733d0c5d3715019573cc245c`. Qualquer outra divergência aborta. Owner, signature, Security Definer, `search_path`, ACL, guarda Auth/sessão, lock financeiro, CAS, validação de linhas/eventos/recibo e resultado são preservados.

A exceção ao lote unitário vale somente para a intenção fechada de salvar orçamento: repetição 1 ou 12, quantidade exata, mesma categoria/valor, competências únicas no intervalo consecutivo e resultado do mês inicial. A FK/dono e o restante das validações originais continuam ativos. Não há nova permissão pública.

Antes de habilitar esse comportamento conectado, a Root precisa revisar/promover a proposta, atribuir número posterior à reserva 026, conferir a fonte de catálogo e executar a instalação canônica descartável/asserções. Depois, deve atualizar inventários e conferir backup/restore, gerar evidência e aplicar supervisionadamente somente no destino pessoal autorizado. **A UI da cópia não pode ir para produção com o backend antigo.** O bloqueio de merge/deploy permanece até esses gates; produzir SQL não significa tê-lo aplicado.

## Validação preparada

Nenhum Node, npm, compilador, navegador, PostgreSQL, SDK ou API foi executado nesta autoria. Os comandos abaixo são o roteiro do candidato combinado, a cargo da Root/CI, um processo por vez:

```text
npx vitest run tests/core/finance-budget-repeat.test.ts tests/adapters/finance-budget-repeat-contract.test.ts tests/adapters/finance-budget-repeat-store.test.ts tests/features/finance-monthly-limit.test.tsx
npx playwright test tests/e2e/spec08-finance-monthly-plan.spec.ts --workers=1
```

Somar os testes econômicos e de comandos financeiros já existentes, typecheck, lint, fronteiras de dependência, DS, secrets e build. Não reduzir oráculos antigos para acomodar o delta.

| Cobertura preparada | Limite da evidência |
| --- | --- |
| Core: legado, doze meses/virada anual, IDs, categoria alheia, duplicação de chave, limite 9999, repetição inválida, replay/conflito, falha na 11ª linha/evento/recibo/commit | Adapter em memória não prova concorrência PostgreSQL |
| Adapter real com transporte atômico injetado: doze alterações no mesmo request, CAS concorrente, rollback tardio, resposta perdida, recibo indisponível e recuperação pelo mesmo UUID | Transporte sintético não executa SQL/RLS |
| Allowlists HTTP/cliente: campo opcional preservado, rejeição de dono, papel e batch arbitrário | Não prova sessão hospedada |
| SSR: total diferente de alocação, ausência diferente de zero, sobrealocação e máscara sem aria/geometry | Não prova contraste, foco ou renderização |
| E2E 320/390 nos dois temas: total explícito, intervalo, confirmação obrigatória, alteração retira aceite, cancelamento sem escrita, virada do ano, valores ocultos e guardas visuais; quatro capturas preparadas | Escrito, ainda não executado; contraste, zoom, teclado e dispositivo requerem os gates combinados |
| [Asserções SQL descartáveis](drafts/finance-budget-repeat-assertions.sql): doze linhas/eventos/um recibo, replay, stale, lote 11/13/repetido, sessão alheia, rollback tardio após linhas/eventos | Inertes; exigem promoção revisada e banco descartável canônico vazio. Não executar no SQL Editor hospedado |

Concorrência SQL real exige duas sessões com barreira: duas gerações para a mesma chave, replay concorrente, CAS/perda de resposta e rollback tardio. O teste de uma sessão ou `Promise.all` sobre memória não certifica isso. Aceites J8/J11, snapshots comparáveis, medição de contraste nos dois temas, foco/teclado, 200% de zoom e dispositivos continuam pendentes.

## Estado para integração

- Implementado: Core, allowlists, composição/editor e cinco arquivos de testes da fatia A; proposta/asserções SQL separadas.
- Validado na autoria: leitura estática e, no freeze, diff-check/bytes/SHA nativos. Nenhum PASS dinâmico é atribuído.
- Pendente: peer independente, CI no SHA integrado, promoção/ensaio SQL, aplicação supervisionada, catálogo/restore, interface renderizada e aceites conectados/mobile.
- Fora deste pacote: fatia B de #78 (metadados da série, frequências, cursor e estados de pausa/retomada/edição/encerramento), #79 e abertura comercial. Não fechar a issue por essa entrega parcial.

## Revisão e ensaio de Root

Root incorporou em checkout próprio os 15 arquivos do freeze V2 e os três arquivos do gate SQL, conferindo tamanho e SHA-256 de cada um. A revisão estática considerou o Núcleo, o transporte de commit, as listas permitidas, a máscara, o editor, os dois temas e os componentes compartilhados. A Impeccable local e a revisão React foram usadas como referências; o carregador de contexto não executou e o contexto existente foi consultado diretamente. Isso não constitui inspeção gráfica ou aceite de acessibilidade renderizada.

Lint dos 13 arquivos TypeScript passou, assim como whitespace e scanner de segredos. O pin do corpo financeiro também foi conferido anteriormente por leitura do catálogo da homologação, sem aplicação de SQL. Em um único PGlite local em memória, o helper original instalou 001–025 e o candidato V2; as asserções SQL originais passaram, incluindo doze efeitos/eventos, recibo, replay, ataques de deslocamento do BEFORE e rollback tardio. A conferência posterior encontrou zero usuários, sessões, orçamentos, eventos, recibos e revisões de fixture. Nenhuma conexão externa ou instalação hospedada participou.

O gate versionado em `tests/adapters/finance-budget-repeat-sql.test.ts` acrescenta conferências de ACL e resíduos e ainda precisa executar no CI do SHA publicado, junto das unidades, arquitetura, build e navegador. O ensaio local é serial e não certifica concorrência nativa, GoTrue, PostgREST, contraste ou aparelhos. A branch de revisão mantém o deploy automático desabilitado; merge e produção seguem bloqueados.

## Correções após os primeiros originais

No SHA `7cd1e51`, os 14 envelopes nativos passaram e os dois gerais falharam em cinco casos da unidade de orçamentos. Quatro falhas eram do fixture: o callback da transação devolvia o objeto de asserção do Vitest, que não é clonável. O callback agora mantém a mesma verificação de recibo ausente e retorna `void`. A quinta apontou ano 0000 chegando ao helper civil antes de ser recusado pelo domínio. Ano, mês e fim do intervalo agora são validados antes do cálculo e de qualquer escrita; os negativos exigem `VALIDATION`, inclusive em 9999 e nos meses 00/13.

O delta recebeu revisão independente e lint. As falhas originais permanecem registradas; o CI precisa executar de novo sobre o novo commit para comprovar as correções. A base foi reconciliada com o inventário de fontes compartilhadas da homologação, sem reintroduzir Drive nem alterar suas políticas de execução. Nenhuma proposta SQL foi ativada.
