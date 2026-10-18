# SPEC-07 — Contratação Asaas, gestão da Assinatura e onboarding do MVP

## Objetivo e aprovação

Entregar a contratação de R$ 29,90/mês a partir da landing pública `/conheca`, com pagamento Asaas, criação automática da conta após pagamento reconhecido, continuidade/regularização do acesso, gestão própria em Configurações, atribuição consentida e onboarding facultativo de nove telas.

O mantenedor aprovou o consolidado, a direção técnica e a divisão em 18 tickets em 18/10/2026 (D-064). A publicação registra planejamento executável, **sem iniciar implementação**, aplicar migrations, configurar serviços ou abrir vendas. O label de triagem não despacha agentes automaticamente. Nenhuma integração comercial foi homologada por esta issue.

## Especificação e referências

- [Consolidado e entrevista]({{PLAN_BASE}}/README.md), [fluxos e estados]({{PLAN_BASE}}/02-fluxos-e-estados.md), [atribuição e privacidade]({{PLAN_BASE}}/03-atribuicao-e-privacidade.md), [contratos técnicos]({{PLAN_BASE}}/04-contratos-tecnicos-propostos.md), [divisão aprovada]({{PLAN_BASE}}/05-lista-de-tickets-para-aprovacao.md).
- [ADR-0009: ampliação do MVP]({{ADR_BASE}}/0009-cobranca-asaas-e-onboarding-no-mvp.md), [ADR-0010: fronteira comercial recuperável]({{ADR_BASE}}/0010-fronteira-comercial-e-provisionamento-recuperaveis.md), [AGENTS]({{REPO_BASE}}/AGENTS.md), [glossário]({{REPO_BASE}}/CONTEXT.md), [registro de decisões]({{REPO_BASE}}/docs/planejamento/registro-de-decisoes.md).
- [Preparação exclusiva do mantenedor]({{PLAN_BASE}}/06-preparacao-do-mantenedor.md) e [destinos privados das chaves]({{PLAN_BASE}}/01-chaves-e-ambientes.md). Nada de chave, senha ou token em chat, Git ou issues.
- [Pesquisa Asaas @12b572e](https://github.com/kauanbarateli/Segundo-Cerebro/blob/12b572ec0c93aa004bfda7141f40bd5f0ef1b659/docs/implementation/pesquisa-asaas-assinatura-20261018.md) e [onboarding do PR #47 @57a2967](https://github.com/kauanbarateli/Segundo-Cerebro/tree/57a2967f34a11cf985e62827d67179335474f477/docs/planejamento/15-aplicacao-layout-codex). Reconciliar o HEAD atual; protótipo e fontes públicas não comprovam o produto conectado.

## Regras que todas as fatias preservam

- Recebedor Asaas PF. Checkout próprio para dados/Pix/boleto; cartão na **fatura hospedada Asaas**, sem PAN/CVV no app. Homologar a recorrência/troca hospedada antes das dependentes; não substituir por outra arquitetura silenciosamente. Pix/boleto convencionais exigem pagamento a cada ciclo.
- Comprovar e-mail antes de cobrar, sem criar Auth prematuro. Conta existente exige login antes de qualquer nova cobrança. Pagamento qualificado, não retorno do navegador, autoriza provisionar/vincular uma vez; saga comercial não expõe os poderes Master do Admin.
- Cartão reconhecido em confirmação qualificada; Pix/boleto em recebimento, respeitando Pix PF cautelar. Instantes/fontes confiáveis e semântica financeira serão homologados. Inbox durável antes de HTTP 200, uso idempotente do ID do evento, executor recuperável e conciliação; falhas não duplicam identidade, cobrança ou e-mail.
- Primeiro vencimento em três dias civis da geração; âncora mensal pelo primeiro pagamento reconhecido. Cinco dias civis completos de tolerância em São Paulo: vence 10, bloqueia às 00h de 16. Cobrança futura não é atraso.
- Suspensão preserva login, regularização, segurança, cancelamento e solicitações de dados, bloqueando módulos em todos os canais. Pausa novas mensalidades, preserva dívida causadora e não acumula meses suspensos; sua quitação após suspensão dá novo mês completo/âncora, sem cobrar duas vezes. Dentro da tolerância não reancora.
- Cancelamento comum interrompe renovação e preserva período pago; reembolso integral/chargeback revogam o direito causal correto, parcial autorizado mantém período. Direitos legais e retenções específicas exigem tratamento próprio, sem apagar dívidas por efeito colateral de API.
- Contas atuais conferidas continuam gratuitas. Isenção de novos convidados/testes é explícita e auditada; revogação exige aviso confirmado e sete dias civis completos para contratar voluntariamente, sem cobrança automática. Vetos/ban nunca são removidos por pagamento ou isenção.
- Cinco UTMs e domínio de origem, primeiro/último toque com consentimento facultativo. Visita direta não apaga campanha. Janela de visita/abandono até 30 dias; congelar na confirmação que gera a primeira cobrança, não na abertura/pagamento; atribuição convertida até 12 meses ou retirada anterior. Não rastrear para contornar recusa.
- Onboarding: boas-vindas, nome, Google, hábito, Projeto, Tarefa, notas, outros espaços, resumo. Pular/pausar/retomar, rascunho servidor versionado e confirmação idempotente. Foco pessoal e contexto do Projeto são facultativos, persistidos/editáveis. Google somente leitura, até duas contas; nota usa Vínculo Página→Projeto. Drive permanece fora.
- Módulos preservados por 180 dias após fim efetivo do acesso, com aviso/revalidação; identidade/financeiro/legal/backup separados. Retirada/exclusão não podem ser desfeitas por replay ou restore. Somente e-mail operacional, sem marketing implícito ou canais adicionais.

## Tickets e dependências

{{CHILDREN_TABLE}}

As relações nativas de sub-issue e `blocked by` complementam os vínculos textuais. As pendências históricas [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12), [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) e [#44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44) bloqueiam o aceite integrado T-046 conforme seus critérios atuais; esta publicação não as altera. [#36](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36) continua manutenção pós-MVP. Fechamento de #46 pelo layout não comprova onboarding.

## Frentes e ordem futura

**A:** T-030/T-039, entrada e atribuição. **B (Root):** T-029/T-031–T-038, cobrança/identidade e validação externa. **C:** T-040–T-043, onboarding. **D:** T-044–T-046, privacidade/operação/QA.

A fronteira inicial, quando a implementação for solicitada, é T-029/T-030/T-031. T-032 libera as demais bases; após T-040, T-041 e T-042 podem avançar em paralelo. Antes de branches concorrentes, fechar interfaces/eventos/versões, reservar migrations e donos de superfícies. Cada frente entrega PR focado; Root revisa o SHA efetivo, testes e evidências antes de incorporar. Branch/worktree não autoriza merge ou deploy.

## Aceite do épico

- [ ] Dezoito fatias concluídas com critérios próprios, negativos e evidências por SHA/ambiente; nenhum PASS local promovido a homologação.
- [ ] Três métodos, conta criada uma vez, credenciais/links seguros e onboarding vazio/parcial/completo demonstrados em ambiente autorizado.
- [ ] Renovação, suspensão/regularização, cancelamento, reembolso/chargeback, isenção, gestão própria, atribuição e retenções demonstrados, inclusive concorrência/timeout/eventos fora de ordem e outro Usuário.
- [ ] Impeccable/DS 2.1 preservados, claro/escuro com contraste medido, teclado/foco, campos ≥16 px, alvos ≥44 px, 320/390 px, zoom e movimento reduzido.
- [ ] Regras no Núcleo sem SDK, adapters só servidor, dependências verificadas, alteração/evento atômicos, RLS/grants/Storage/jobs sem caminhos de fuga e segredos ausentes dos artefatos.
- [ ] Migrations novas revisadas/aplicadas em operação supervisionada no destino correto, nunca por CI/build/deploy; sem reset/seeds/reaplicar 001–019. Ambiente de teste adicional exige autorização própria.
- [ ] Checks adequados e CI hospedado observados; domínio/HTTPS, callbacks, remetentes, Vercel Pro, termos/privacidade, operação e recuperação prontos. Aceites históricos mantidos; lançamento somente após autorização correspondente.

## Validação e pontos em aberto

Cada filho define comandos existentes, testes a acrescentar e roteiro autorizado de sandbox/Google/restore. O aceite integrado T-046 exige trilha completa, negativos de identidade/ambiente/duplicatas/falhas e prova externa, sem transações reais por inferência.

**B:** comprovar fatura hospedada/recorrência/troca, fonte temporal, PF e ajustes de ciclo, eventos/suporte de chargeback. **Mantenedor:** destinos privados, remetente/serviço, domínio/Pro, identidade da oferta/atendimento, revisão de termos/retencões e inventário gratuito. **C/D com Root:** contratos de rascunho, avisos/exclusão, operação/alertas, recuperação e evidências. Políticas aprovadas não serão reentrevistadas; limitação do provedor que inviabilize uma delas volta ao mantenedor.

## Prompt de retomada da coordenação

> Retome SPEC-07 em `kauanbarateli/Segundo-Cerebro` apenas quando a execução for solicitada; leia Parent/especificação, AGENTS/CONTEXT e os ADRs citados.
> Reconcilie main/PR #47 e as pendências históricas; registre o SHA e preserve WIPs/branches das outras frentes.
> Distribua a fronteira desbloqueada entre A/B/C/D com contratos e propriedade definidos; Root responde pelas conexões e revisão das entregas.
> Confira a preparação humana, não peça segredos e não aplique banco ou faça cobrança sem a autorização/destino correspondentes.
> Publique PRs sem coautoria, relatando implementado/validado/pendente; não feche o épico nem abra vendas enquanto algum aceite estiver pendente.
