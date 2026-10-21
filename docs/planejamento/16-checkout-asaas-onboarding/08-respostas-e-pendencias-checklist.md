# Checklist respondido — decisões e providências restantes

Atualização de 18/10/2026. Registra as anotações do mantenedor no checklist 06, sua mensagem sobre domínio/suporte e o questionário interativo. **Construção comercial ainda não iniciada.** D-074 autorizou o pacote legal e materiais; a decisão atual D-075 confirma **Hobby e deploy adiado**. Publicar somente para revisão no GitHub, com autodeploy impedido na branch legal antes do push, sem merge em main, upgrade ou migração de hospedagem.

## 1. O que já foi resolvido

| Item | Resposta / evidência | Estado real |
|---|---|---|
| Domínio | `segundocerebroapp.com.br`, adquirido e ligado à Vercel. | Raiz e `www`, em `/conheca`, responderam HTTPS 200 na conferência pública de 18/10; não é prova de callbacks internos ou plano contratado. |
| Asaas | Sandbox acessível, produção PF aprovada e duas chaves guardadas separadamente, marcados pelo mantenedor. | Preparado por relato; API, métodos e recorrência ainda não homologados. Não pedir chaves novamente. |
| Recebimento de e-mail | MX da raiz apontam para Hostinger. O mantenedor informou envio e recebimento testados em `suporte@segundocerebroapp.com.br`. | DNS observado e funcionamento relatado; preservar MX existentes. Corrigida a variante digitada `segundocerebro.app.com.br`. |
| Responsável | Kauan Sousa Barateli, pessoa física. | Q1 / D-066 confirmado. Identificação complementar segue procedimento privado. |
| Público inicial | Pessoas com 18 anos ou mais. | Q2 / D-067. Texto não implementa verificação etária nem dispensa avaliar acesso provável por menores. |
| Ambiente para começar | Desenvolver/testar localmente; preparar ensaio conectado depois. | Q3 esclarecida / D-068. Não criar serviço hospedado agora; não alterar Ensaio_restore. |
| Canal de atendimento | Mesmo suporte para privacidade, dados, cancelamento e reembolso. | Q4/Q5 / D-069. Não confundir canal de contato com designação automática de encarregado. |
| Envio do app | Resend; `conta@notificacoes.segundocerebroapp.com.br`; Reply-To para suporte. | Q6 / D-070. Escolha aprovada; configuração não executada. |
| Atendimento humano | Segunda a sexta, 9h–18h, Brasília, exceto feriados nacionais. | Q8 / D-071. E-mail recebe a qualquer hora; os prazos legais continuam aplicáveis. |
| Hospedagem | Mantenedor confirmou Hobby e decidiu manter o plano e adiar deploy. | D-075 atualiza D-072/D-074: entrega em PR draft, com proteção de autodeploy só desta branch. Não abre vendas nem altera produção. |
| Identificação formal | Mantenedor pediu orientação para um arquivo privado. | Q9: [roteiro e modelo](09-identificacao-privada-do-fornecedor.md) preenchidos em arquivo privado. Estrutura conferida sem imprimir valores; divulgação não habilitada no arquivo. D-073 autoriza endereço pessoal apenas se necessário à futura oferta. |

## 2. Respostas às dúvidas anotadas no checklist

### O que é “homologação comercial”?

É um ensaio do percurso de compra: checkout, pagamento **simulado no Asaas sandbox**, criação/ativação de conta e onboarding. O objetivo é descobrir falhas antes de cobrar de clientes, sem afetar o banco pessoal de produção. Não é um novo produto ou uma obrigação de contratar agora outra hospedagem.

O mantenedor escolheu começar localmente. O ambiente conectado será preparado quando as fatias estiverem prontas; o relatório de um teste local não será apresentado como prova de integração hospedada.

### Podemos usar Ensaio_restore?

Ainda não foi aprovada essa destinação. O projeto está reservado à recuperação da #35 e seu estado atual não foi reconferido nesta rodada. A última evidência versionada registra um baseline de teste, sem aceite de restore; não é correto afirmar que ele contém cópia real nem que continua vazio hoje.

Alterá-lo para checkout poderia invalidar o baseline do ensaio. Reutilização exige inspeção atual, decisão explícita de finalidade e tratamento do destino de restore. D-068 preserva o projeto enquanto isso; nenhum dado deve ser apagado por inferência.

### Pode ser uma página do domínio novo?

Uma rota como `/homologacao` dentro do mesmo app não separa banco ou credenciais. Para um ensaio hospedado futuro, a recomendação é `homologacao.segundocerebroapp.com.br` com deployment, variáveis e banco isolados. O subdomínio sozinho também não produz isolamento. Nada foi criado agora.

### Podemos usar Resend?

Sim. O SMTP do Supabase Auth atende aos fluxos de autenticação que ele envia. Antes do primeiro pagamento, ainda não existe conta Auth: a comprovação do e-mail precisa de envio independente pelo servidor do app.

O Resend pode prestar esse envio. D-070 separa **notificações transacionais** da caixa **Hostinger de suporte**. As respostas chegam à sua caixa por Reply-To. A escolha não substitui o atendimento humano nem significa que um adapter de envio já foi implementado.

Preparação que pode ser feita pelo mantenedor quando desejar configurar o remetente:

1. Na conta pessoal Resend, adicionar o domínio de envio `notificacoes.segundocerebroapp.com.br`.
2. Usar os registros exatos que o painel indicar para envio e verificação. Preservar os MX da raiz usados pela Hostinger; registros de retorno em subdomínio têm finalidade própria e não devem substituir o recebimento de suporte.
3. Aguardar a verificação do domínio e manter rastreamento de abertura/clique desligado nas mensagens transacionais.
4. Preparar credencial exclusiva com os menores privilégios disponíveis para o domínio de envio, guardando-a privadamente. Não revogar a credencial do SMTP Auth para fazer essa preparação.
5. Informar somente “domínio verificado” e a disponibilidade do remetente. A fatia de envio definirá o destino e os nomes das variáveis; a chave será inserida diretamente ali, sem passar por chat, Git ou captura.

Fontes: [domínio e verificação Resend](https://resend.com/docs/add-a-domain), [recebimento e MX](https://resend.com/docs/dashboard/receiving/custom-domains), [rastreamento](https://resend.com/docs/dashboard/domains/tracking). A configuração não foi executada pelo agente.

### Checkout externo permitiria manter Vercel Hobby?

O lugar onde o pagamento ocorre não decide isso. A regra oficial considera finalidade de ganho financeiro e inclui solicitar/processar pagamentos **e divulgar a venda de produto ou serviço**. Por isso, retirar o checkout da Vercel não torna automaticamente elegível ao Hobby um app de assinatura ou sua oferta comercial. É uma condição de uso do plano, não uma afirmação de bloqueio técnico imediato.

Código e testes locais podem avançar. Antes de hospedar o uso comercial, decidir por plano Vercel compatível, confirmação aplicável do provedor ou outra hospedagem. D-072 adia essa escolha; não permite presumir que basta aguardar a primeira cobrança. [Regra oficial de uso comercial](https://vercel.com/docs/limits/fair-use-guidelines).

Uma VPS pode substituir a hospedagem Vercel, mas continua tendo custo e transfere a operação de TLS, proxy, atualizações, monitoramento, jobs, deploy e recuperação. Domínio, e-mail, Supabase e taxas Asaas continuam separados. Não foi escolhida VPS, orçamento ou migração. [Hospedagem própria com Next.js](https://nextjs.org/docs/app/guides/self-hosting).

## 3. O que o mantenedor ainda precisa fazer

1. **Identificação formal:** arquivo privado preenchido. Manter os dados fora do Git e revisar o alcance da divulgação quando houver oferta; não preencher novamente nem enviar o conteúdo no chat. Endereço pessoal somente na identificação obrigatória, conforme D-073.
2. **Remetente Resend:** verificar o subdomínio quando for configurar o envio; guardar a chave no destino privado e informar somente o estado.
3. **Hospedagem:** escolher o destino comercial depois, como decidiu em D-075, mantendo Hobby por enquanto. Nenhum deploy desta entrega será usado para antecipar essa decisão.
4. **Revisão da operação:** aprovar identificação da oferta, procedimento de atendimento, retenções de identidade/obrigações/segurança/backups e textos antes da versão definitiva. Os agentes podem preparar inventário e proposta; não se presume revisão profissional já realizada.
5. **Quando houver ensaio conectado:** disponibilizar os acessos pessoais pertinentes e participar dos passos de e-mail/senha/consentimento. Banco, callbacks e webhook só serão configurados com destino/roteiro prontos e autorização correspondente.

Não há nova pergunta sobre domínio, e-mail escolhido, PF, guarda das chaves ou horário: esses pontos estão respondidos. Hospedagem e ambiente hospedado foram adiados por decisão, não tratados como respostas ausentes.

## 4. Pendências técnicas dos agentes

- Construir e testar as fatias SPEC-07 somente após solicitação de execução, respeitando o grafo já publicado.
- Conferir identidade/contexto e base dos PRs, reservar migrations e contratos entre as quatro frentes.
- Inventariar retenções atuais, fornecedores/subprocessadores, localização e mecanismos de transferência; não inventar países, contratos ou prazo universal de logs. A consulta autenticada de metadados não ficou disponível nesta rodada; a Vercel recusou o escopo com HTTP 403 e não há CLI instalada para o fallback. Nova tentativa solicitada pelo mantenedor manteve a recusa; Supabase retornou INVALID_ARGUMENT. Não presumir país ou plano por esses erros. A verificação pública de DNS/HTTPS é independente disso.
- Reconciliar as páginas legais com o cadastro/consentimento futuros, controles de idade e a revisão de acesso provável por menores. Implementar os direitos sem exigir senha ou documentos excessivos.
- Preparar a verificação Google para o público comercial, callbacks e políticas; duas contas de teste conectadas não certificam essa liberação.
- O [inventário técnico](../../implementation/inventario-retencao-transferencias-20261018.md) foi concluído por categoria; completar provas operacionais e instrumentos de transferência antes da versão definitiva. As páginas foram revisadas sem abrir vendas. Resend requer avaliação específica de transferência antes de envio real: sua FAQ não aceita cláusulas específicas LGPD/ANPD; região de envio não muda armazenamento nos EUA.

Nenhuma migration, credencial, serviço, cadastro de webhook, plano ou projeto foi alterado. As páginas legais e materiais estão preparados para revisão em branch própria, separada da documental do PR #69. A publicação atual está descrita no [registro da entrega](../../implementation/paginas-legais-publicacao-20261018.md); não presumir deploy por existir PR.
