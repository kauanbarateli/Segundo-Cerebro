# Mapa de issues para execução paralela com 8 GB de RAM

Conferência somente leitura em **18/10/2026, às 23h49 de Fortaleza** (19/10, 02h49 UTC). Fonte: buscas de issues/PRs abertas e metadados individuais no GitHub. Este é um retrato, não uma certificação de aceite. Reconferir corpo, comentários, dependências nativas, PRs e SHAs na retomada.

Repositório: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro). O [prompt de execução](../agents/prompt-retomada-issues-paralelas-8gb-20261018.md) usa este mapa e os contratos dos tickets, sem iniciar a implementação por sua mera publicação.

**Atualização humana de hospedagem, separada da conferência GitHub acima:** em 18/10/2026 o mantenedor confirmou **Vercel Hobby** e decidiu **“Manter Hobby e adiar o deploy”**. D-074 autoriza a publicação desta entrega legal/documental, mas não autoriza contratar Pro nem realizar deploy. A Root pretende publicar somente no GitHub, em PR draft, sem merge ou atualização de `main`, com `vercel.json` contendo `git.deploymentEnabled` desabilitado exclusivamente para `codex/paginas-legais-e-checklist-20261018`. A [documentação oficial](https://vercel.com/docs/project-configuration/git-configuration) admite essa regra por branch; sua presença no arquivo não prova que o serviço já a aplicou. Conferir metadados após o envio, sem afirmar antecipadamente ausência de deployment. O CI permanece ativo.

Antes de qualquer push de ticket comercial, reconferir a decisão atual e os gatilhos de autodeploy, inclusive Preview em PR draft. A regra específica desta entrega não cobre branches futuras. Coordenar com a Root uma publicação sem deploy e obter a evidência correspondente; se isso não estiver garantido, entregar commits/patches locais. Não contornar o adiamento com outra branch, checkout externo ou deploy manual, nem desativar CI para ocultar falhas. Publicação GitHub, elegibilidade de hospedagem comercial e consentimento para despesas são decisões separadas.

## Base e PRs encontradas

| Referência | Estado observado | SHA conferido | Uso na retomada |
|---|---|---|---|
| `main` | Branch padrão | `f3d18960a41076e99aa60dcc9f6b46967970ebb5` | Layout incorporado; não contém automaticamente as PRs ainda abertas. |
| [PR #45](https://github.com/kauanbarateli/Segundo-Cerebro/pull/45) | Aberta, draft, não incorporada | `93ab8549efbdc7c121715ea449c2ce04676585ed` | Handoff histórico e correções locais de restore/Auth; revisão por delta, sem merge integral por inferência. |
| [PR #47](https://github.com/kauanbarateli/Segundo-Cerebro/pull/47) | Aberta, draft, não incorporada | `57a2967f34a11cf985e62827d67179335474f477` | Referência das nove telas e contratos do onboarding; protótipo não comprova runtime. |
| [PR #49](https://github.com/kauanbarateli/Segundo-Cerebro/pull/49) | Aberta, não draft, não incorporada | `13da4579b97072b60eed245d3e6cab4e10a10a45` | Pesquisa Asaas; o insumo citado no plano é o commit `12b572ec0c93aa004bfda7141f40bd5f0ef1b659`. Revisar o delta antes de trocar a referência. |
| [PR #69](https://github.com/kauanbarateli/Segundo-Cerebro/pull/69) | Aberta, draft, não incorporada | `3433c49b9e0e59546ed564222f3c3de814e71098` | SPEC-07 e publicação dos tickets, sem implementação comercial. |
| Branch local `codex/paginas-legais-e-checklist-20261018` | HEAD inicial desta preparação | `e76f323c6cc96bbe8c256b3a3fbc3282407ee85b` | Páginas legais/checklist; Root está evoluindo esta entrega. Não usar o SHA como HEAD final. |

`base_sha` informado em metadados antigos de uma PR não substitui a leitura atual de `main`. Não desenvolver em cima de branches de pesquisa ou operação apenas porque estão abertas. Root deve indicar a base integrada efetiva antes dos dois worktrees de código.

## SPEC-07 e seus 18 tickets

O [épico #50](https://github.com/kauanbarateli/Segundo-Cerebro/issues/50) e os 18 filhos abaixo foram encontrados pela consulta `is:issue is:open`. Seus textos ainda descrevem planejamento/aceites futuros; esta conferência não acrescentou implementação ou teste. Os números T e GitHub são distintos.

| Ticket / issue | Entrega | Bloqueadores diretos | Trilho de engenharia |
|---|---|---|---|
| [T-029 / #51](https://github.com/kauanbarateli/Segundo-Cerebro/issues/51) | Homologação Asaas: fatura hospedada, métodos e recorrência | Nenhum ticket novo; sandbox autorizado e preparação externa | Root para a prova conectada; apoio de contratos pelo trilho 2 |
| [T-030 / #52](https://github.com/kauanbarateli/Segundo-Cerebro/issues/52) | Landing, checkout e comprovação de e-mail antes de cobrar | Nenhum ticket novo; abertura comercial desligada | 1 |
| [T-031 / #53](https://github.com/kauanbarateli/Segundo-Cerebro/issues/53) | Composição comercial de acesso e gratuidades | Nenhum ticket novo; transição real depende do inventário de contas | 2 |
| [T-032 / #54](https://github.com/kauanbarateli/Segundo-Cerebro/issues/54) | Pix, inbox/outbox, saga paga e ativação idempotentes | #51, #52, #53 | 2, com interface do trilho 1 e validação Root |
| [T-033 / #55](https://github.com/kauanbarateli/Segundo-Cerebro/issues/55) | Boleto e compensação | #54 | 2 |
| [T-034 / #56](https://github.com/kauanbarateli/Segundo-Cerebro/issues/56) | Cartão na fatura Asaas e recorrência | #54 | 2 |
| [T-035 / #57](https://github.com/kauanbarateli/Segundo-Cerebro/issues/57) | Renovação, tolerância, suspensão e regularização | #55, #56 | 2 |
| [T-036 / #58](https://github.com/kauanbarateli/Segundo-Cerebro/issues/58) | Cancelar renovação e preservar período pago | #54 | 2; paralelo a #57 somente com contratos estáveis |
| [T-037 / #59](https://github.com/kauanbarateli/Segundo-Cerebro/issues/59) | Reembolso e chargeback | #58 | 2 |
| [T-038 / #60](https://github.com/kauanbarateli/Segundo-Cerebro/issues/60) | Isenção Master e transição de sete dias | #54 | 2 |
| [T-039 / #61](https://github.com/kauanbarateli/Segundo-Cerebro/issues/61) | Atribuição consentida e funil | #54 | 1 |
| [T-040 / #62](https://github.com/kauanbarateli/Segundo-Cerebro/issues/62) | Início/pausa/retomada do onboarding, nome e foco | #54 | 3 |
| [T-041 / #63](https://github.com/kauanbarateli/Segundo-Cerebro/issues/63) | Hábito, Projeto com contexto e Tarefa | #62 | 3 |
| [T-042 / #64](https://github.com/kauanbarateli/Segundo-Cerebro/issues/64) | Continuação Google na rodada correta | #62 | 3; OAuth real pela Root |
| [T-043 / #65](https://github.com/kauanbarateli/Segundo-Cerebro/issues/65) | Notas, outros espaços e resumo idempotente | #63 | 3; #64 é gate da integração, não da construção do resumo |
| [T-044 / #66](https://github.com/kauanbarateli/Segundo-Cerebro/issues/66) | Retenções, retirada, solicitações e não ressuscitar dados no restore | #61, #62 | 4, coordenado com inventário legal Root |
| [T-045 / #67](https://github.com/kauanbarateli/Segundo-Cerebro/issues/67) | E-mails, conciliação, alertas e recuperação | #54 | 4; ativação externa pela Root |
| [T-046 / #68](https://github.com/kauanbarateli/Segundo-Cerebro/issues/68) | Validação comercial/onboarding antes da abertura | #57, #59, #60, #61, #64, #65, #66, #67, #12, #35, #44 | 4 e Root |

O [registro de publicação](../planejamento/16-checkout-asaas-onboarding/07-publicacao-github.md) documenta 18 sub-issues e 29 bloqueios nativos verificados naquele momento. Nesta atualização os bloqueadores foram reconferidos nos corpos atuais; não se afirma nova auditoria das 29 relações nativas. A execução deve ler ambas as representações e resolver divergências antes de avançar.

## Pendências históricas ainda abertas

| Issue | Escopo preservado e próximo passo |
|---|---|
| [#41](https://github.com/kauanbarateli/Segundo-Cerebro/issues/41) | Transporte SourceTOC/diagnóstico offline no Windows. Pode receber delta de construção isolado; execução conectada é da Root. Não atribuir causa a EPIPE por hipótese. |
| [#42](https://github.com/kauanbarateli/Segundo-Cerebro/issues/42) | Baseline, qualificação nativa, restore transacional e backup; bloqueada por #41. Root controla perfis, janelas e operações novas. Preparos CLOSED não são retomáveis por cópia. |
| [#43](https://github.com/kauanbarateli/Segundo-Cerebro/issues/43) | Drain/cleanup de Admin e Recovery e prova no CI. Construção offline pode caminhar com #41; execução real e limpeza exigem evidência própria. |
| [#44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44) | Rodada visual/acessibilidade/PWA e seis jornadas após estabilização de design. Preparar cenários antes, aceitar produto final depois. |
| [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) | Hardening/release; agrega restore, Auth e operação, preservando os critérios originais. Não fecha pela entrega isolada das filhas. |
| [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12) | PWA/portões visuais e registros físicos. Instalação em iPhone 11 e A35 e tema sincronizado já foram relatados; completar os literais restantes, sem pedir o mesmo relato novamente. |
| [#2](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2), [#7](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7) | Épicos históricos dependentes dos seus aceites/filhos. |
| [#36](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36) | Manutenção **pós-MVP**, sem bloquear o aceite por decisão do mantenedor. Verificar fontes oficiais antes de afirmar o estado atual do upstream; não forçar peers/desligar lint. |

[#46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46) foi lida individualmente como `closed/completed`; não é evidência de onboarding entregue. Drive continua retirado. Aplicação nativa em lojas é planejamento adicional, sem ticket de implementação inferido desta solicitação de guia.

## Recomendação de execução nesta máquina

Quatro trilhos lógicos não significam quatro runtimes. Usar **dois codificadores no máximo**, uma Root revisora e **um único processo pesado por vez em toda a máquina**. A fila inicial útil é #52 + construção offline de #53; Root recebe a prova externa de #51. A entrada em #54 e suas dependentes conserva os bloqueios; enquanto aguardam, preparar contratos/cenários ou um recorte independente de #41/#43 aprovado e sem sobreposição, sem declarar o ticket dependente implementado.

O prompt detalha a reserva de arquivos, migrations, slots de teste e PRs. Estes limites são recomendações operacionais para 8 GB, não um benchmark medido da máquina. Este mapa não executou testes de aplicação, transações, migrations ou mutações GitHub.
