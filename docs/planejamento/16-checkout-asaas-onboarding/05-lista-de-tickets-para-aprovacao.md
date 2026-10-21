# SPEC-07 — divisão aprovada em 18 tickets

Estado em 18/10/2026: **APROVADO PARA PUBLICAÇÃO**, por instrução explícita do mantenedor (D-064). Um épico e 18 entregas verificáveis, produzidos com a skill to-tickets. Aprovação documental não inicia implementação, teste de pagamento, migration ou configuração de serviços. Publicado como [SPEC-07 / #50](https://github.com/kauanbarateli/Segundo-Cerebro/issues/50) e filhos #51–#68; veja o [registro de publicação](07-publicacao-github.md).

## Referências e numeração

- Fonte de produto: [decisões D-034–D-063](../registro-de-decisoes.md), [índice e respostas da entrevista](README.md), [fluxos e estados](02-fluxos-e-estados.md), [atribuição e privacidade](03-atribuicao-e-privacidade.md) e [contratos técnicos propostos](04-contratos-tecnicos-propostos.md).
- Arquitetura: [ADR-0009 de escopo](../../adr/0009-cobranca-asaas-e-onboarding-no-mvp.md), [ADR-0010 aceito no planejamento](../../adr/0010-fronteira-comercial-e-provisionamento-recuperaveis.md), [glossário](../../../CONTEXT.md), [issue tracker](../../agents/issue-tracker.md) e [labels de triagem](../../agents/triage-labels.md). A direção técnica foi aceita com a especificação (D-064); provas externas continuam pendentes.
- Base consultada: Main `f3d18960a41076e99aa60dcc9f6b46967970ebb5`; [pesquisa Asaas](https://github.com/kauanbarateli/Segundo-Cerebro/blob/12b572ec0c93aa004bfda7141f40bd5f0ef1b659/docs/implementation/pesquisa-asaas-assinatura-20261018.md), SHA `12b572e`; [onboarding do PR #47](https://github.com/kauanbarateli/Segundo-Cerebro/tree/57a2967f34a11cf985e62827d67179335474f477/docs/planejamento/15-aplicacao-layout-codex), SHA `57a2967`. Referências de protótipo não comprovam implementação ou teste conectado.
- A conferência remota de numeração feita pela Root encontrou SPEC-01–SPEC-06 e T-001–T-028. **SPEC-07 e T-029–T-046** foram publicados sem colisão: #50 e #51–#68. IDs do plano e números GitHub são distintos; os históricos não foram renumerados.
- Destino da publicação: [GitHub do repositório principal](https://github.com/kauanbarateli/Segundo-Cerebro/issues). Aplicar `ready-for-agent` somente a corpos completos e executáveis, depois do aceite; conferir labels e identidade pessoal antes de escrever. Nenhum label é criado por esta lista.

## Épico aprovado e publicado

**SPEC-07 — Contratação Asaas, gestão da Assinatura e onboarding do MVP.** Entrega a entrada pela `/conheca`, contratação mensal, comprovação de e-mail, pagamento, criação/ativação da conta, continuidade/regularização do acesso, gestão própria em Configurações, atribuição consentida e onboarding facultativo de nove telas. O épico reúne os filhos abaixo e seus gates; não é uma tarefa única para um agente.

O aceite exige os três métodos, contas atuais preservadas, isenção auditada, eventos/recibos, fronteiras de suspensão, comunicações, privacidade, retenção e evidências reais previstas. A ampliação soma critérios aos anteriores do MVP. Drive continua retirado; nenhuma promessa de novo módulo ou serviço externo adicional decorre desta lista.

## Gates comuns dos tickets

O aceite documental de especificação/ADR técnico/lista foi concluído em D-064. Antes de executar uma fatia autorizada, fechar os contratos que ela utiliza; reconferir a base e os deltas do PR #47. Bloqueio de produto ou homologação permanece explícito, não vira decisão silenciosa do agente. A disponibilidade de uma chave não autoriza operação externa.

Cada corpo completo inclui objetivo, escopo, critérios positivos/negativos, dependências reais, comandos pertinentes, roteiro de sandbox e pontos em aberto. Os critérios abaixo são comuns, além dos específicos de cada ticket:

- **N1 — autoridade e isolamento:** negar leitura/escrita de outro dono, enumeração pública, IDs externos manipulados, sessão revogada e capacidade fora de finalidade. Não remover ban/veto, conceder Master ou obter gratuidade pela ausência de estado comercial.
- **N2 — efeitos e recuperação:** duplo clique, duas abas, replay igual/diferente, timeout, resultado incerto, falha parcial e eventos fora de ordem não duplicam contratação, identidade, comandos ou mensagens. Alteração/evento local são atômicos; HTTP entre serviços não é transação única.
- **N3 — segredos e ambiente:** nenhum cartão completo, senha, chave, token ou link privado em Git, issue, bundle, evento, log ou captura. Asaas e persistência de teste devem estar isolados; não usar banco de produção em Preview como sandbox nem reutilizar legado, Ensaio_restore, VOE ou BlackSheep por inferência. Antes da primeira chamada Asaas, implementar/verificar combinação URL/chave/ambiente e scanner específico; a integração no app acrescenta guardas de build/runtime e bundle, sem esperar a fase de operação.
- **N4 — experiência e acessibilidade:** Impeccable/DS 2.1, Geist, claro/escuro, contraste medido, teclado/foco, campos ≥16 px, alvos ≥44 × 44 px, 320/390 px, larguras intermediárias, zoom e movimento reduzido. Nenhum sucesso antecipado, erro só por cor ou perda silenciosa de rascunho.
- **N5 — banco e evidência:** migrations novas versionadas, sem alterar/reaplicar 001–019, reset ou seeds. Aplicação futura supervisionada conforme OP-009, nunca por CI/build/deploy; ambiente separado exige sua própria autorização. Registrar SHA, cenário, ambiente e resultado, distinguindo implementado, validado e pendente.

**Perfis de validação futura:** `L` = checks locais adequados ao delta: `npm run typecheck`, `npm run lint`, `npm test`; acrescentar `npm run check:layers` para arquitetura, `npm run test:local-sql`/`npm run check:sql-editor` para banco, `npm run check:design-system` para tokens e `npm run check:secrets`/`npm run build`/`npm run check:client-auth` para fronteiras e publicação. `E` = `npm run test:e2e` com fixtures e ambiente permitidos. `S` = roteiro manual/API documentada no sandbox isolado, com execução autorizada e evidências sanitizadas. `R` = aceite real específico e lançamento somente quando autorizado. Esses comandos existem na base; testes comerciais específicos serão acrescentados na implementação. Nenhum desses perfis foi executado por esta lista.

## Lista numerada aprovada

1. **T-029 — Homologar pagamento hospedado e recorrência no Asaas.**
   - **Blocked by:** nenhum ticket novo; exige os gates comuns e ambiente de sandbox autorizado.
   - **Entrega:** prova reproduzível de cliente/assinatura e primeira cobrança por Pix, boleto e cartão hospedado, método dos ciclos seguintes, troca hospedada de método/cartão, ajuste da âncora e calendário curto. Resolve a viabilidade de D-035/D-037/D-046/D-051/D-052/D-053 sem capturar cartão no app; entrega relatório e contrato utilizável pelas fatias seguintes, sem abrir venda. Preparação mínima inclui configuração restrita ao sandbox, scanner de chaves Asaas testado e exemplo de ambiente somente com nomes.
   - **Validação/negativos:** `S` conforme documentação oficial citada no README e contrato 04; retorno sem pagamento, recusa, compensação, QR vencido, timeout e cobrança futura não concedem direito. Provar ajuste sobre faturas já emitidas sem duplicação; nunca provocar falhas deliberadas em produção.
   - **Em aberto antes do aceite:** destino de teste, capacidades da conta PF e efeito real dos métodos/ajustes. Se a fatura não suportar a recorrência escolhida, voltar à decisão humana; não adotar cartão próprio ou outra arquitetura por conta do agente.

2. **T-030 — Contratar pela landing e comprovar e-mail antes de cobrar.**
   - **Blocked by:** nenhum ticket novo; construir com entrada comercial pública ainda fechada para vendas reais.
   - **Entrega:** preço/CTAs de `/conheca` → oferta e dados → comprovação recuperável do endereço por e-mail → continuação autorizada para o método; nenhuma cobrança gerada nesta fatia. E-mail cadastrado conduz ao login sem enumeração. Introduz intenção de contratação, eventos/recibos privados pré-Auth necessários à comprovação, aceite comercial separado da atribuição, transportador transacional mínimo de servidor e estados de falha/reenvio (D-037/D-044/D-054/D-055/D-059; fluxo 02 e contrato 04).
   - **Validação/negativos:** `L`/`E`, envio `S` autorizado; scanner/GET não consome nem cobra, link expirado/repetido/e-mail alterado falha, nova pessoa não aparece em Auth, recusa de atribuição não impede seguir. Aplicar N1–N4.
   - **Em aberto:** copy fina, identificação/termos/privacidade, transporte/remetente e contrato final de capacidade/expiração. Não presumir SMTP genérico do Supabase nem criar Auth para verificar o endereço.

3. **T-031 — Compor acesso comercial preservando contas atuais e gestão própria.**
   - **Blocked by:** nenhum ticket novo; manter novas vendas fechadas e planejar transição compatível antes de ativar o gate.
   - **Entrega:** conta gratuita conferida continua funcionando; conta comercial suspensa mantém login/segurança/gestão mínima em Configurações e tem módulos negados no servidor e SQL/RLS. Categoria e projeção explícitas distinguem gratuidade, isenção e condição paga, preservando vetos/moderação. Fatia demonstrável com estados autorizados de teste, sem depender de cobrança real (D-043/D-047/D-048/D-049; contratos 04 e ADR-0010).
   - **Validação/negativos:** `L`/`E`, contratos SQL; acessos por RPC, snapshot, Storage, jobs e JWT antigo obedecem ao gate, estado ausente não isenta, Configurações não vaza módulos. Validar corte civil, preservação dos dados e transição das contas atuais sem bloqueio acidental.
   - **Em aberto:** corte/conjunto elegível e revisão do inventário de guardas. Se a mudança exigir expansão/migração/contração, manter etapas compatíveis no ticket e não ativar parcialmente uma proteção que prometa cobrir todos os canais.

4. **T-032 — Pagar por Pix, receber conta e ativar o acesso uma única vez.**
   - **Blocked by:** T-029, T-030 e T-031.
   - **Entrega:** checkout comprovado → cliente/assinatura sem duplicação → QR/copia e cola → inbox durável → reconhecimento qualificado → saga paga → definição inicial de senha/login → passagem autorizada para onboarding. Estende os eventos/recibos privados pré-Auth da T-030 aos fatos financeiros e ao provisionamento; acrescenta outbox/executor mínimos, reconciliação de resultado incerto e aba comercial mínima com cobrança/regularização. Integra os controles de ambiente/segredos no build, runtime e bundle antes da primeira chamada pelo app. É o primeiro percurso conectado completo (D-034/D-037/D-044/D-046/D-049/D-053/D-054; contratos 04).
   - **Validação/negativos:** `L`/`E`/`S`; Pix PF ainda não recebido, evento falso/duplicado/fora de ordem, aba fechada, falha Auth/SQL/SMTP e retorno falsificado. HTTP 200 só após inbox persistida; nenhuma conta antes do pagamento; sem chamada pública à saga Master, senha enviada ou segunda cobrança para recuperar erro.
   - **Em aberto:** contrato aceito de ativação e fatos temporais autoritativos. A recuperação atual deve continuar funcionando; scanners e outro navegador entram no aceite da ativação.

5. **T-033 — Contratar e regularizar por boleto.**
   - **Blocked by:** T-032.
   - **Entrega:** escolher boleto, receber linha digitável/fatura privada e acompanhar compensação até o mesmo provisionamento/acesso idempotente já entregue. Reabrir cobrança usa a existente; informa pagamento manual por ciclo e prazo real (D-037/D-053/D-054; fluxo 02 e contrato 04).
   - **Validação/negativos:** `L`/`E`/`S`; linha correta, expiração/vencimento distintos de confirmação, pagamento tardio, comprovante sem recebimento e tentativa de consultar boleto alheio. Não criar outra identidade ou dívida por recarga.
   - **Em aberto:** campos efetivamente exigidos, apresentação e recursos de compensação do sandbox, conforme resultado de T-029.

6. **T-034 — Pagar com cartão na fatura hospedada e manter a recorrência.**
   - **Blocked by:** T-032.
   - **Entrega:** escolha do cartão → fatura segura Asaas → retorno/espera → reconhecimento e acesso, sem PAN/CVV no produto. Método recorrente e alteração hospedada homologada ficam disponíveis na gestão própria, sem prometer capacidades não comprovadas (D-037/D-049; contrato 04).
   - **Validação/negativos:** `L`/`E`/`S`; confirmação reconhece sem esperar liquidação; `RECEIVED` não concede segunda mensalidade; conciliação recupera `CONFIRMED` perdido. Cobrir recusa, retorno sem pagamento, URL manipulada, timeout e ausência de dados de cartão no bundle/log.
   - **Em aberto:** contrato de alteração de cartão/método e limites confirmados em T-029; se exigir captura/tokenização no app, interromper e revisar a decisão humana.

7. **T-035 — Renovar, tolerar atraso, suspender e regularizar sem acumular meses.**
   - **Blocked by:** T-033 e T-034.
   - **Entrega:** ciclos dos três métodos e histórico/status na aba comercial; âncora pelo primeiro reconhecimento, corte civil após tolerância, pausa de novas mensalidades e retomada com mês completo/nova âncora após suspensão. Preserva a obrigação regularizada, trata faturas futuras e não cobra duas vezes o novo período (D-046/D-047/D-048/D-049/D-051/D-052).
   - **Validação/negativos:** `L`/`E`/`S`; limites antes/no/depois do corte São Paulo, meses curtos/bissexto, pagamento na tolerância com webhook tardio, meses suspensos, retomada concorrente, assinatura/fatura antiga e tentativas em trânsito. Cron atrasado não prolonga acesso e pausa não impede conciliar pagamento.
   - **Em aberto:** precisão/fonte dos fatos e execução homologada dos ajustes Asaas. Reter intenção pendente quando o efeito externo for incerto, sem sucesso otimista.

8. **T-036 — Cancelar futuras renovações mantendo o período pago.**
   - **Blocked by:** T-032.
   - **Coordenação:** pode avançar em paralelo ao ciclo de T-035 após congelar os contratos comuns.
   - **Entrega:** solicitar/acompanhar cancelamento em Configurações, inclusive na suspensão; confirmar interrupção das renovações/tentativas futuras, preservar acesso até o fim contratado e manter dívida já constituída. Trata faturas antecipadas sem confundir remoção no gateway com quitação (D-049/D-050; contrato 04).
   - **Validação/negativos:** `L`/`E`/`S` nos métodos disponíveis, ampliado aos três em T-046; replay, perda de resposta, cancelamento concorrente com recebimento/retomada e evento antigo não recriam assinatura. Não acrescentar tolerância de renovação inexistente ao período cancelado.
   - **Em aberto:** fronteira precisa do período, protocolo de arrependimento e tratamento de nova contratação, preservando direitos aplicáveis e distinguindo-os do cancelamento comum.

9. **T-037 — Reconciliar reembolso e chargeback com o direito correto.**
   - **Blocked by:** T-036.
   - **Entrega:** fato financeiro confirmado aparece na gestão e recalcula o acesso pela cobrança/período correto: integral/chargeback revogam conforme contrato; parcial autorizado mantém período e assinatura. Distingue solicitação, processamento e devolução confirmada, sem endpoint para o Usuário conceder crédito a si mesmo (D-058; contrato 04).
   - **Validação/negativos:** `L`/`E`/`S`; somar parciais confirmadas sem duplicatas, duas parciais integrais, parcial antigo após revogação e disputa/reversão fora de ordem. Valor inicialmente insuficiente não vira pagamento válido por ser chamado de parcial.
   - **Em aberto:** causalidade entre períodos, operação de arrependimento e prova que dependa do suporte Asaas. Registrar limite do sandbox; teste sintético não encerra uma prova externa pendente.

10. **T-038 — Conceder e revogar isenção pelo Master com transição de sete dias.**
    - **Blocked by:** T-032.
    - **Entrega:** concessão explícita/auditada a nova conta convidada/teste e revogação com e-mail, prazo informado e encaminhamento à contratação voluntária. Contas atuais gratuitas seguem preservadas; Admin e Usuário veem estados permitidos, sem expor motivo interno indevido (D-043/D-045/D-062; contrato 04).
    - **Validação/negativos:** `L`/`E`, envio `S` autorizado; não Master/sessão revogada, alvo incorreto, aviso incerto, duplicata, limite de sete dias, nova isenção/pagamento concorrentes. Não gerar dívida/assinatura/débito automático, restringir conta histórica ou remover veto por conceder isenção.
    - **Em aberto:** marco preciso do prazo, prova/recuperação do aviso e efeito sobre assinatura paga preexistente, sem mudar as políticas aprovadas.

11. **T-039 — Atribuir origem com consentimento do primeiro toque à contratação.**
    - **Blocked by:** T-032.
    - **Entrega:** cinco UTMs/domínio na landing e no checkout, primeiro/último toque, visita direta preservada, recusa/retirada disponíveis e vínculo idempotente ao Usuário pago. Congela origem ao confirmar o checkout e gerar a primeira cobrança, sem congelar na simples abertura nem reescrever por campanha posterior (D-063). Inclui funil de abandono e agregados permitidos para Admin, validade/expiração nos comandos e consultas; nenhuma análise habilitada antes dos controles necessários (D-038–D-042/D-057; documento 03).
    - **Validação/negativos:** `L`/`E`/`S`; recusar não impede pagar; campanha inválida/duplicada/parcial, navegação interna, falta de referrer, retirada concorrente ao pagamento, 30 dias/12 meses e outro dono. Sem URL bruta, mistura de visitas, campanha em eventos ou relatórios individuais; agregados exigem prova contra reidentificação.
    - **Em aberto:** marcos das janelas, normalização/referral, grupos pequenos e prova mínima de consentimento. T-044 completa a rotina operacional de eliminação e o inventário de cópias; não criar um segundo modelo de retenção.

12. **T-040 — Iniciar, pular e retomar onboarding com nome e foco real.**
    - **Blocked by:** T-032.
    - **Entrega:** boas-vindas/nome/foco → rascunho versionado no servidor → pausa/recarga/retomada → painel. Foco facultativo fica no perfil e é editável em Configurações; contas atuais entram manualmente por convite/ação, sem interceptação forçada nem perda de link profundo. Define o contrato da rodada para as próximas telas (D-060; documento 02 e referência do PR #47).
    - **Validação/negativos:** `L`/`E`; pular tudo, duas abas/dispositivos, versão antiga, troca de Usuário, falha de salvar, reentrada e foco omitido/inválido. Nenhuma fixture, flag ausente ou perfil antigo cria primeiro acesso; foco não altera direitos e suspensão não libera sua escrita por Configurações.
    - **Em aberto:** aceite final de elegibilidade, retenção do rascunho e resolução de conflitos. Esses pontos são propostas de contrato a fechar, não comportamento já implementado pelo protótipo.

13. **T-041 — Preparar hábitos, Projetos com contexto e Tarefas vinculadas.**
    - **Blocked by:** T-040.
    - **Entrega:** etapas de Hábito, Projeto e Tarefa usam os casos de uso reais, intenções/recibos estáveis e dependências por ID. Contexto facultativo do Projeto persiste e pode ser editado depois; Hoje/Sem prazo têm semântica temporal explícita. Uma confirmação parcial preserva os resultados anteriores (D-061; documento 02/PR #47).
    - **Validação/negativos:** `L`/`E`, contratos SQL pertinentes; projeto antes da tarefa, contexto inválido/omitido, homônimos, item removido, virada do dia, duplo clique e resultado desconhecido. Não marcar hábito como cumprido, classificar Projetos antigos automaticamente ou repetir gravação para recuperar erro.
    - **Em aberto:** fechamento técnico de Hoje/cadência/defaults/limite introdutório e extensão versionada do contexto, sem inventar categoria de Tarefa ou confundir foco pessoal com contexto do Projeto.

14. **T-042 — Conectar Google no onboarding e retornar à rodada correta.**
    - **Blocked by:** T-040.
    - **Entrega:** etapa Agenda lê conexões reais, permite OAuth somente leitura até duas contas e retorna à rodada após sucesso/recusa/erro. Explica o efeito externo antes da conclusão; pular/abandonar não desconecta. Reutiliza a integração existente (documento 02/PR #47).
    - **Validação/negativos:** `L`/`E`/`S` com contas Google autorizadas; duas conexões/reservas, negação, expiração, replay, logout/troca de sessão, destino externo e retorno com rascunho preservado. Não inventar conexões, guardar tokens no rascunho ou permitir terceira conta por contagem local.
    - **Em aberto:** contrato de continuação/expiração e recursos de ensaio autorizados. Configuração real do provedor e consentimento humano não são substituídos por mock.

15. **T-043 — Concluir as nove telas com notas, outros espaços e resumo idempotente.**
    - **Blocked by:** T-041.
    - **Coordenação:** T-042 não bloqueia a construção do resumo, que lê o estado real das conexões; sua integração será gate de T-046.
    - **Entrega:** Caderno/primeira Página/Vínculo explícito ao Projeto, apresentação contextual de outros espaços e resumo de escolhas da rodada; confirma somente o preparado, mostra resultados parciais e permite reentrada sem duplicatas. Fecha a sequência de nove telas (documento 02 e PR #47).
    - **Validação/negativos:** `L`/`E`; caderno vazio, nota incompleta, homônimos por ID, vínculo falho após Página criada, sessão trocada, rodada já concluída e configuração vazia. Não inventar `project_id` em Página, recriar registro confirmado ou anunciar Drive/upload genérico; Cofre não solicita segredo/kit e Financeiro não ganha exemplos persistidos.
    - **Em aberto:** fechamento do Vínculo Página→Projeto e apresentação dos resultados pendentes. O resumo distingue preparação local e OAuth já efetivado; 31 testes da demo não são aceite desta entrega.

16. **T-044 — Cumprir retenções, retirada e solicitações sem ressuscitar dados no restore.**
    - **Blocked by:** T-039 e T-040.
    - **Entrega:** revisão/retirada da atribuição e canal de solicitações na conta; rotinas verificáveis de 30 dias/12 meses/180 dias, aviso pré-exclusão e exceções de reativação/gratuidade. Inventário de cópias, exclusão com retomada após falhas e protocolo de restauração impedem reintroduzir o que expirou ou foi eliminado. Atualiza os textos de privacidade correspondentes (D-040/D-041/D-055/D-056/D-057; documento 03/ADR-0010).
    - **Validação/negativos:** `L`/`E`, banco/Storage de teste e ensaio de restore autorizado; antes/no/depois dos limites, solicitação por outro dono, pagamento/isenção/reativação concorrentes, falha parcial e backup anterior à retirada. Não expirar conta gratuita/isenta ativa, apagar identidade/obrigações financeiras com o prazo dos módulos ou prometer purga instantânea de todo backup.
    - **Em aberto:** protocolos/marcos de aviso e execução, retenção própria de identidade/legal/financeiro/provas/agregados, destino do ensaio e conciliação com #35. Canal de solicitação não implica exportador automático inexistente.

17. **T-045 — Operar e recuperar a cobrança com e-mails, conciliação e alertas.**
    - **Blocked by:** T-032.
    - **Entrega:** operação recuperável do fluxo que já funciona: agendas/execução autorizada, conciliação diária, monitoramento de inbox/fila Asaas, responsável/destino de alertas e runbooks por ambiente. Matriz de avisos apenas por e-mail evita duplicação Asaas/app; falhas de envio e jobs têm recuperação verificável. Não reimplementa a base de inbox/outbox/executor de T-032 (D-055; guia 01 e contrato 04).
    - **Validação/negativos:** `L`/`S`; sobreposição/crash, fila atrasada, `429`, evento perdido, cobrança de resultado incerto, SMTP indisponível e configuração de ambiente incompatível. Sem SMS/WhatsApp/voz, retry ilimitado, segredo em alerta ou teste deliberado de quinze falhas em produção; aceitação pelo transportador não prova entrega.
    - **Em aberto:** responsável operacional, destino dos alertas, limites/frequências e configuração futura autorizada. Revalidar os controles de segredos/ambiente já introduzidos em T-029/T-032, sem adiar sua implementação até a operação.

18. **T-046 — Validar contratação, gestão e onboarding integrados antes da abertura.**
    - **Blocked by:** T-035, T-037, T-038, T-039, T-042, T-043, T-044 e T-045; também os aceites existentes de [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12), [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) e [#44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44), respeitando seus critérios atuais.
    - **Coordenação:** T-036 e as outras bases são alcançadas transitivamente, sem acrescentar bloqueios redundantes.
    - **Entrega:** evidências do percurso público → comprovação → três pagamentos → identidade/ativação → nove telas → produto, mais renovação, suspensão/regularização, método, cancelamento, isenção, privacidade e recuperação. Checklist comercial reúne domínio/callbacks, Vercel Pro, oferta/termos e operação; a abertura só acontece com autorização correspondente.
    - **Validação/negativos:** `L`/`E`/`S` e aceites `R` autorizados; todos N1–N5, dois Usuários, fluxos vazios/parciais/completos, temas/foco/mobile/zoom/movimento reduzido, e-mail/outro navegador, falhas de serviços e ações concorrentes. Registrar SHA, artefatos sanitizados e CI remoto efetivamente observado; não promover build local/protótipo/sandbox a aceite real de produção.
    - **Em aberto:** pendências externas remanescentes, prova de chargeback dependente de suporte e autorização de lançamento. Não fechar épico ou aceites históricos enquanto seus critérios permanecerem pendentes.

## Frentes paralelas e integração

| Frente | Responsabilidade predominante | Tickets / coordenação |
|---|---|---|
| A — entrada, atribuição e interface | Percurso público, consentimento e projeções de interface com contratos reais. | T-030 e T-039; coopera no visual das superfícies comerciais, com dono único por delta. |
| B — cobrança e identidade, Root | Autoridade, prova Asaas, saga, ledger e revisão das operações conectadas. | T-029, T-031–T-038; valida efeitos externos e integra PRs das demais frentes. |
| C — onboarding | Rodada, campos reais, Google, dependências e confirmação da configuração. | T-040–T-043; T-042 pode caminhar com T-041 após T-040. |
| D — qualidade e operação | Retenção, recuperação, alertas e evidência integrada. | T-044–T-046; pode preparar cenários/runbooks antes dos bloqueadores, sem declarar o aceite resolvido. |

Congelar contratos de entrada/saída, eventos, autoridade e versões antes de abrir branches de implementação paralelas. Definir dono por superfície/contrato e migrations antes do trabalho; não editar os mesmos arquivos simultaneamente nem gerar sequências SQL concorrentes sem reserva. Cada frente usa branch/worktree própria baseada no SHA combinado e entrega PR focado; a Root revisa o SHA efetivo, o delta, testes e evidências antes de incorporar. Atualização da base invalida apenas a evidência afetada, que deve ser reconferida.

O agente pode preparar testes sintéticos, desenhos e interfaces contra contratos acordados sem credencial. Isso não resolve o bloqueio do aceite conectado: nenhuma frente simula Master, inventa pagamento confirmado ou consulta ambiente fora do autorizado para avançar. Worktree/branch remota não constitui aprovação de merge, deploy ou aplicação de migration.

## Ordem de publicação e fronteira de execução

Após aprovação, reconferir tracker, publicar SPEC-07 e depois T-029 até T-046 na ordem numérica acima: todos os bloqueadores novos já estarão publicados quando o dependente for criado. Usar sub-issues/dependências nativas quando disponíveis; senão referências `Part of`/`Blocked by` e task list no épico. IDs reservados T/SPEC e números reais GitHub devem aparecer sem confusão. Não publicar corpos resumidos deste preview como se fossem o contrato completo.

Fronteira inicial: T-029/T-030/T-031. Depois T-032 libera boleto, cartão, cancelamento, isenção, atribuição, onboarding e operação conforme suas dependências; trabalhar a fronteira real, sem esperar a sequência inteira onde não há bloqueio. T-035 aguarda os três métodos, T-044 aguarda os contratos de atribuição/rodada e T-046 reúne os aceites, não antecipa lançamento.

[#36](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36) permanece manutenção pós-MVP conforme decisão anterior. [#41](https://github.com/kauanbarateli/Segundo-Cerebro/issues/41), [#42](https://github.com/kauanbarateli/Segundo-Cerebro/issues/42), [#43](https://github.com/kauanbarateli/Segundo-Cerebro/issues/43) e #44 mantêm seus estados/escopos; não fechar ou reescrever pais automaticamente. [#46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46) está encerrada pelo layout: o complemento de onboarding não deve ser tratado como já implementado nem levar a reabertura/duplicação silenciosa. Coordenar o novo épico com essas referências, sem contornar as pendências históricas.

## Aprovação recebida

O mantenedor aprovou o consolidado e a divisão em 18 fatias, com os bloqueadores apresentados, e autorizou a publicação. Pontos em aberto e provas futuras permanecem nos respectivos critérios; a publicação não os declara resolvidos.

A autorização desta etapa cobre documentação, publicação e vínculos das novas issues. Não cobre implementação, alteração de pais históricos, configuração de serviços, merge ou deploy.
