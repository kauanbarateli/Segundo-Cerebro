# Chaves Asaas — destinos e preparação futura

Estado: guia preparado durante a entrevista de 18/10/2026. **Não executar agora.** O planejamento não autoriza alterar `.env`, Vercel ou conta Asaas. Usar este roteiro quando o ticket de integração estiver aprovado e implementado; os controles citados abaixo ainda são requisitos de construção.

Atualização D-072: a escolha da hospedagem foi adiada e o trabalho permanece local. As instruções Vercel abaixo só se aplicam se esse destino for mantido e a configuração for autorizada; não representam ordem de upgrade/deploy agora.

## O que guardar e onde

As três variáveis são exclusivas do servidor, sem `NEXT_PUBLIC_`:

| Nome | Finalidade | Local / Vercel Development | Vercel Preview de teste | Vercel Production |
|---|---|---|---|---|
| `ASAAS_API_URL` | Destino permitido das chamadas | `https://api-sandbox.asaas.com/v3` | Sandbox | `https://api.asaas.com/v3` |
| `ASAAS_API_KEY` | Autenticação da API | Chave exclusiva de sandbox | Chave de sandbox | Chave exclusiva de produção |
| `ASAAS_WEBHOOK_TOKEN` | Autenticar eventos recebidos | Segredo de teste | Segredo do webhook desse destino | Segredo exclusivo do webhook de produção |

`ASAAS_API_KEY` não é o token do webhook. Não reutilizar credenciais Supabase, Google, Admin, backup ou cron. Uma API key de sandbox não funciona na URL de produção, nem o inverso. Prefixos documentados: `$aact_hmlg_` e `$aact_prod_`. [Autenticação Asaas](https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1).

Os ensaios também precisam de aplicativo e persistência de teste autorizados e isolados dos dados de produção. Cadastrar uma chave sandbox em Preview não isola o banco Supabase por si. O destino e a preparação do banco de teste serão definidos no plano de validação; não reutilizar o Ensaio_restore, legado, BlackSheep ou VOE por conveniência.

A comprovação de e-mail antes da cobrança (D-054) também precisará de envio transacional pelo servidor, sem criar conta Auth antecipadamente. O SMTP já configurado no painel do Supabase Auth não significa que o app tenha esse transportador disponível. Confirmar provedor pessoal, remetente e forma de autenticação no ticket correspondente; então preparar somente os segredos necessários no destino privado, separados por ambiente. Não copiar credenciais de painéis para o chat nem presumir novos nomes de variáveis antes de fechar o adapter. D-055 restringe avisos a e-mail, sem habilitar SMS/WhatsApp/voz como atalho.

## 1. Preparar o desenvolvimento local

1. Abra a cópia de desenvolvimento do Segundo Cérebro fora do OneDrive ou de outra pasta sincronizada. Não use o clone de outra frente sem coordenação.
2. Confirme que `.env.local` está ignorado pelo Git e que não há segredo versionado. O nome do arquivo não garante essa proteção em todo clone.
3. No editor local, abra `.env.local`; preserve as configurações existentes. Acrescente os três nomes acima, uma vez cada. Use a URL sandbox literal e cole a chave sandbox diretamente no campo correspondente, sem passar pelo chat ou por uma issue.
4. Preserve todos os caracteres da chave, inclusive `$`. Não monte comandos com o segredo em aspas duplas no PowerShell: isso pode expandir variáveis e gravar o valor no histórico.
5. Para o token do webhook, use um segredo aleatório gerado em gerenciador privado; a referência admite 32–255 caracteres. Registre-o diretamente no destino privado. Não usar a chave da API como token. [Criar webhook](https://docs.asaas.com/reference/criar-novo-webhook).
6. Salve sem incluir o arquivo no commit. Reinicie o servidor local somente na futura execução autorizada.

O `.env.example` versionado receberá somente os nomes com valores vazios na implementação. Não copiar para ele chaves reais, valores mascarados ou exemplos que pareçam credenciais completas.

## 2. Preparar Vercel Development e Preview

1. No painel Vercel, selecione a equipe pessoal correta e o projeto `segundo-cerebro-of`. Confira a identidade do projeto antes de qualquer edição.
2. Entre em **Settings → Environment Variables**. Cadastre a URL sandbox como configuração. Cadastre a API key e o token como segredo/valor protegido conforme o controle disponível no painel.
3. Selecione **Development** e o **Preview de teste pretendido**, nunca Production para as credenciais sandbox. Verifique exceções por branch/custom environment e variáveis homônimas preexistentes.
4. Cole os valores diretamente no painel. Não imprimir variáveis em logs, screenshots, comandos ou no navegador do app. Se o painel diferenciar tipo Secret e Config, use Secret para chave/token.
5. O webhook precisa de endereço HTTPS estável e alcançável pelo Asaas. Previews efêmeros ou protegidos não são um destino automaticamente utilizável: o contrato de ambiente, endpoint e entrega será definido no ticket. Não desabilitar proteção global para resolver isso.
6. Depois da implementação e da autorização de execução, faça um novo deploy de teste. Alterações de variáveis não modificam deployments anteriores. [Variáveis Vercel](https://vercel.com/docs/environment-variables).

Este guia não solicita `vercel env pull` nem download de credenciais de produção para a máquina local. Development e Preview não precisam da chave de produção para os testes.

## 3. Preparar produção, somente após homologação

1. Cumprir os aceites do sandbox e o checklist de lançamento. D-036 prevê mudar para Vercel Pro antes da abertura comercial; domínio próprio não substitui essa mudança. [Hobby](https://vercel.com/docs/plans/hobby).
2. Confirmar domínio final, HTTPS, origem do app, callbacks de Auth/Google e retorno da fatura. Não mudar `APP_URL` enquanto a dependência ainda não estiver pronta.
3. No projeto pessoal correto, cadastrar as três variáveis selecionando **apenas Production**: URL de produção, chave de produção e token exclusivo de produção.
4. Na conta Asaas PF de produção, configurar o webhook com o endereço aprovado e o mesmo token desse ambiente **somente quando o endpoint estiver implementado e a alteração autorizada**. Seleção de eventos, e-mail operacional e tipo de envio pertencem ao contrato da integração; não improvisar durante o cadastro.
5. Criar novo deployment após a mudança, com o fluxo de checkout ainda condicionado ao aceite de lançamento. A presença de variáveis não deve, sozinha, abrir vendas ou aplicar migrations.

O Asaas envia o token em `asaas-access-token`. O servidor envia a API key ao Asaas em `access_token` e identifica a aplicação por `User-Agent`; nenhum desses segredos deve ir ao cliente. [Autenticação](https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1), [recepção de webhook](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook).

## Controles a implementar e validar nos tickets

- Validar combinação exata de URL permitida e prefixo de chave, sem aceitar host arbitrário. Build e runtime recusam ambiente incompatível sem revelar valores; a regra deve distinguir sandbox de produção independentemente de `NODE_ENV` (Preview também faz build de produção).
- Isolar dados, identificação da conta gateway e eventos por ambiente; não liberar acesso real com evento sandbox nem consumir credencial de produção em Preview.
- Acrescentar reconhecimento de chaves Asaas ao scanner de segredos, com testes negativos e fixtures claramente sintéticas. O scanner atual não comprova essa proteção específica.
- Verificar `server-only`, dependências e bundle de cliente; não serializar segredo em props, erro ou evento de domínio.
- Validar token de webhook e aceitar entrega somente depois de persistência durável; duplicatas e falhas de banco entram nos testes. Sem evento aceito, não criar cadastro por retorno do navegador.
- Não chamar API Asaas, aplicar migration ou cadastrar webhook em build/CI/deploy. Credencial disponível não autoriza esses efeitos.

## O que informar ao agente na execução

Somente: ambientes preparados, domínio de teste aprovado, se os valores foram salvos e eventuais códigos de erro sanitizados. **Não enviar valores, parte da chave, token, dump de `.env`, senha ou tela de configuração com segredos.** A validação deverá retornar presença/compatibilidade por nome e ambiente, sem ecoar credenciais.

Se ocorrer exposição, a execução precisará de revogação/rotação na conta correta e atualização dos destinos correspondentes. Não reutilizar a credencial exposta.
