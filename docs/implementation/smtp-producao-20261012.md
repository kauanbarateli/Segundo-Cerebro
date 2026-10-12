# Recuperação por e-mail em produção — 12/10/2026

O mantenedor autorizou criar uma conta comum, confirmada e sem promoção administrativa, para ensaiar a recuperação em `https://segundo-cerebro-of.vercel.app`. A senha inicial foi aleatória, mantida somente em memória e descartada. A conta master pessoal não foi alterada. Endereço, UUID, senha e links não integram este registro público.

## Resultado comprovado

- O aplicativo aceitou o pedido com a resposta genérica, sem confirmar a existência da conta pela interface.
- O mantenedor confirmou o recebimento do e-mail. O primeiro link foi aberto inicialmente em outro navegador e depois recusado. O fluxo exige o cookie de solicitação e o verifier PKCE do contexto de origem; esse recorte não comprova sozinho a causa exata do primeiro retorno nem uma falha do SMTP.
- Foi enviado um único novo pedido pelo navegador do Codex. O mantenedor abriu o novo link nesse mesmo contexto, preencheu/confirmou/enviou a nova senha e informou sucesso, incluindo a entrada na conta.
- A raiz observou o Início protegido e, nas Configurações, a identidade da conta comum, diferente da master. A consulta somente leitura dessa conta no provedor confirmou e-mail validado e `last_sign_in_at=2026-10-12T15:29:22.093709Z` (12:29:22 em Fortaleza), às `2026-10-12T15:31:29.651Z`.

Isso comprova entrega e recuperação funcional por e-mail na produção com conta comum. A conta continua cadastrada; nenhuma exclusão ou alteração de senha foi realizada pelo agente. A entrada e o envio da nova senha foram feitos pelo responsável.

## Limites e continuidade da #21

Não foi possível comparar a senha antiga nesta rodada, pois a senha inicial havia sido descartada. Não certificar uso único, prazo de expiração, refresh, isolamento concorrente, logout global ou dois aparelhos por esse recorte. As provas locais/CI dessas operações conservam seus próprios SHAs; os critérios conjuntos ainda não demonstrados mantêm a [#21](https://github.com/kauanbarateli/Segundo-Cerebro/issues/21) aberta.

Nenhum domínio, remetente, DNS, template ou credencial SMTP foi alterado nesta rodada. O recebimento humano certifica a entrega observada, sem certificar configuração DNS, tracking ou todos os clientes de e-mail. Consulte o [guia operacional](../operations/configuracoes-pendentes-passo-a-passo.md#2-smtp-recuperar-senha-por-e-mail-real) para novos ensaios.
