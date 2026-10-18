# ADR-0010 — Fronteira comercial e provisionamento recuperáveis

Estado: **ACEITO PARA O PLANEJAMENTO**, em 18/10/2026, pelo aceite explícito do consolidado e da divisão (D-064). Autoriza publicar os tickets; não declara implementação, homologação ou autorização de operações nos serviços.

## Contexto e alcance

O [ADR-0009](0009-cobranca-asaas-e-onboarding-no-mvp.md) aceita a ampliação de escopo, não seu desenho técnico. As decisões da entrevista no [registro](../planejamento/registro-de-decisoes.md) definem políticas de produto; este ADR propõe como preservá-las nas fronteiras do monolito. O [glossário](../../CONTEXT.md) continua distinguindo Usuário, Pagador, Assinatura, Cobrança, Entitlement e Preferência.

A base consultada é `f3d18960a41076e99aa60dcc9f6b46967970ebb5`. Seus eventos/recibos exigem Usuário Auth; o checkout pago existe antes dele. O [ADR-0007](0007-admin-auth-saga-fechada.md) exige Master e sessão para criar contas administrativamente; sua autorização não se transfere ao webhook. Auth, Asaas, envio de e-mail e banco não compartilham transação.

O [documento de contratos](../planejamento/16-checkout-asaas-onboarding/04-contratos-tecnicos-propostos.md) detalha as propostas e a matriz de validação. Este ADR não fixa nomes de tabelas, estados, endpoints ou transportador, nem substitui as decisões financeiras ainda abertas.

## Decisão

### Núcleo, portas e autoridade

- Manter regras comerciais determinísticas no Núcleo, recebendo relógio e portas explícitas. Não importar SDK, HTTP, Next.js ou configuração de ambiente em `src/core/`.
- Adapters Asaas, Auth, envio transacional e persistência ficam no servidor. Rotas/Actions validam entrada e autoridade antes do caso de uso; não decidem pagamento na interface.
- Introduzir somente portas necessárias e dependências compatíveis com o monolito modular. Mudança de fronteira exige revisão e o portão `check:layers`, sem desabilitar regras para acomodar importações.
- Separar capacidade restrita de retomada do checkout, identidade autenticada do Usuário, autoridade financeira do provedor e poder administrativo Master. Identificador ou e-mail informado não constitui autorização.

### Escritas e eventos antes do Usuário

- Propor agregado comercial privado com ator técnico fechado, eventos e recibos próprios antes de `auth.users`; alteração, evento e intenção de trabalho local confirmam na mesma transação.
- Não inventar Usuário, usar o Master como dono do visitante ou relaxar `domain_events.user_id` para contornar a ausência da identidade. Depois do vínculo real, registrar eventos permitidos por Usuário sem copiar conteúdo pessoal desnecessário.
- Aplicar privilégios e isolamento também aos registros privados; não conceder listagem anônima ou leitura geral a `authenticated`. Projeções de posse e de gestão retornam somente campos autorizados.
- Recibo de comando vincula intenção e conteúdo. Correlação por `externalReference` não prova idempotência de POST; resultado externo desconhecido permanece incerto até conciliação do alvo exato.

### Recebimento durável e efeitos externos

- Validar o webhook por ambiente e persistir inbox deduplicada antes de responder HTTP 200 dentro do limite documentado pelo Asaas. Falha de persistência não recebe confirmação fictícia; Auth/e-mail não bloqueiam a resposta após o commit da inbox.
- Gravar outbox na transação que determina o efeito; executor recuperável usa claim, revisão/fence e resultado persistido. Não depender de promessa em memória continuar após a resposta HTTP.
- Interrupção, duplicata e timeout não autorizam nova assinatura, identidade ou mensagem indiscriminadamente. Expiração de claim não comprova que uma chamada externa antiga terminou.
- Conciliar periodicamente com a API e reutilizar os mesmos casos de uso de eventos. Vínculo, ambiente, valor, método, período e causalidade prevalecem sobre ordem de chegada ou retorno do navegador.
- Eventos de assinatura informam seu ciclo, não comprovam pagamento. Ledger por cobrança preserva fatos e permite aplicar D-046–D-053 sem apagar dívida ou período pago por efeito colateral do gateway.

### E-mail, identidade e ativação

- Cumprir D-054 com comprovação do e-mail antes da primeira cobrança, sem criar Auth, sessão ou acesso. Link limitado e vinculado à intenção não é convite de cadastro nem autenticação de conta existente; D-044 continua exigindo login.
- Propor envio transacional próprio por porta/adapter e modelos permitidos. O SMTP configurado no Supabase Auth não constitui transportador genérico já disponível ao aplicativo; confirmar capacidade/configuração na execução, sem extrair suas credenciais.
- Provisionamento pago é saga de autoridade restrita a pagamento qualificado e vínculo comprovado. Pode reaproveitar salvaguardas do ADR-0007, sem chamar comandos Admin publicamente, simular Master ou enfraquecer `requireMaster`.
- Ativação pós-pagamento tem contrato próprio de senha e comprovação, distinto da recuperação atual. Homologar expiração, consumo, reenvio, scanners e abertura em outro navegador; não enviar senha nem confiar no pagamento como prova do e-mail.
- Confirmar conta, vínculo comercial e efeitos conhecidos separadamente; estado incerto não vira sucesso. Falha de SMTP não exige outra cobrança ou outra identidade. A criação administrativa isenta autorizada em D-045 continua sendo uma exceção explícita ao checkout pago.

### Acesso comercial e gestão durante suspensão

- Compor sessão/identidade válida, moderação, autorização da Funcionalidade e condição comercial aplicável. Preservar gratuidade conferida e isenção explícita, sem isentar por ausência de estado nem remover vetos manuais.
- Não representar suspensão sobrescrevendo `user_entitlements` para depois restaurá-los. Preferência mantém somente visibilidade/ordem; pagamento não concede Master nem remove bloqueio administrativo.
- Aplicar a mesma política no Núcleo, servidor e SQL/RLS, incluindo RPCs, Storage, snapshots e jobs. Calcular o corte no acesso segundo D-047; um cron atrasado ou JWT antigo não prolonga o direito.
- Preservar login e a fronteira própria de gestão de D-048/D-049, inclusive Assinatura e cobranças, sem exigir período comercial ativo para regularizar/cancelar. Essa exceção não abre módulos nem ignora ban, sessão ou propriedade.
- Interromper uso de módulos sem apagar seus dados; recepção financeira, conciliação e regularização permanecem operantes. Conflitos entre Admin, cancelamento, pausa, retomada e eventos exigem revisão/fence, nunca última mensagem vence.

### Retenção e exclusão

- D-056 define retenção dos módulos após o fim efetivo do acesso, com aviso prévio e canal de solicitação; não autoriza apagar identidade, registros financeiros/legais ou atribuição no mesmo prazo.
- Antes de executar limpeza, definir protocolo verificável: marco e aviso, conferência de reativação/isenção, dependências, exclusões pendentes e provas sem conteúdo eliminado. Tratar backups e restauração para não ressuscitar dados eliminados.
- Consentimento/retirada e retenção da atribuição têm contrato separado; D-057 fixa o prazo individual pós-contratação em 12 meses, com retirada anterior respeitada. Marcos operacionais e prova de agregação ainda precisam de contrato. Não perpetuar UTMs em eventos append-only nem transformar aceite comercial em autorização para marketing.

## Alternativas e consequências

| Alternativa não recomendada | Motivo / trade-off |
|---|---|
| Criar conta, enviar e-mail e chamar gateway no webhook síncrono | Acopla a confirmação a serviços lentos e repete efeitos após timeout; durabilidade e execução posterior acrescentam estados operacionais, mas tornam a recuperação explícita. |
| Liberar por retorno da fatura ou payload do navegador | Navegação não comprova fato financeiro nem vínculo; exige estado de espera e conciliação no desenho recomendado. |
| Expor a saga Admin ou usar Usuário fictício antes de Auth | Mistura autoridade e isolamento; o contrato comercial próprio exige eventos/recibos adicionais, preservando os contratos existentes. |
| Tratar várias chamadas HTTP como uma transação única | Não reverte efeitos externos; saga, outbox e recibos têm custo de implementação e operação, mas não afirmam atomicidade inexistente. |
| Guardar apenas booleano pago ou resolver tudo no menu | Perde ciclos, reversões, vetos e canais diretos; projeção comercial composta exige testes de equivalência em servidor/SQL. |

Essas alternativas fundamentam a decisão técnica aceita no planejamento (D-064). A recomendação evita exigir outro serviço de fila por pressuposto; o acionamento, a frequência e os limites operacionais do executor ainda precisam de contrato.

## Pendências e portões futuros

1. Aceite documental concluído em D-064. Os contratos ainda dependentes de prova externa, a retenção financeira/legal e os demais gates explícitos serão resolvidos nos tickets; não presumir homologação.
2. **Prova sintética/local:** regras de ciclo/acesso, rollback de alteração e evento, RLS/grants, concorrência, resultado incerto, fences, duplicatas/ordem, comprovação sem Auth antecipado e ausência de segredos; executar checks pertinentes, incluindo dependências e segredos.
3. **Prova no sandbox isolado e autorizado:** pagamento hospedado/recorrência, ajustes de âncora, pausa/retomada/cancelamento, eventos, e-mail e ativação. Registrar limites que exigem suporte do Asaas; teste sintético não substitui essa prova.
4. **Prova real e lançamento:** somente na execução autorizada, com ambiente, configuração, domínio/hospedagem e aceites próprios. Sandbox não comprova produção nem autoriza transações reais. Migrations futuras serão novas, revisadas e supervisionadas segundo OP-009, nunca aplicadas por CI/build/deploy.

Nenhum desses portões foi executado por este ADR. Entrevista, proposta, implementado, validado sinteticamente, validado no sandbox e validado em produção permanecem estados distintos.
