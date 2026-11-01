# Inspeção de Auth no QA — 2026-11-01

Inspeção visual somente de leitura no projeto de homologação `twrydxsdemaykgvdlpyd`, após o responsável autenticar o painel. Nenhum campo foi alterado, mensagem enviada ou credencial copiada. As observações são um retrato deste ambiente, não evidência sobre produção.

- O provedor de e-mail está habilitado e a confirmação de e-mail está ligada. A opção global de permitir novos cadastros está desligada; logins anônimos também estão desligados. O prazo de OTP mostrado é 3.600 segundos.
- SMTP próprio está desligado. A tela informa que os modelos padrão são utilizados e que SMTP próprio é necessário para editar assunto e corpo. A inspeção não comprovou entregabilidade, remetente ou capacidade para o teste com endereços externos.
- Os modelos atuais de confirmação de cadastro e de recuperação usam `ConfirmationURL`. A candidata de cadastro espera `token_hash` na rota de confirmação e um POST explícito; o modelo padrão, portanto, não comprova esse fluxo nem sua proteção contra scanners. A recuperação existente usa o mesmo modelo de recuperação: substituí-lo sem uma estratégia compatível pode quebrar o fluxo legado.
- A configuração de URLs tem somente uma URL de redirecionamento, a da rota legada `/auth/callback` no preview de QA. As rotas candidatas `/auth/confirmar-cadastro` e `/auth/continuar-cadastro` ainda não foram homologadas nessa configuração. A lista do painel não comprova que um template customizado seja seguro.
- O painel mostra limites por IP para inscrições/entradas e verificação de tokens, ambos em 30 solicitações por cinco minutos. Encaminhamento de IP está desligado. Como a candidata usa Auth no servidor, é necessário avaliar os limites efetivos e proteção contra abuso com a arquitetura de implantação; não habilitar encaminhamento por inferência.

Antes de abrir o cadastro: selecionar e configurar um provedor SMTP e remetente de teste, revisar os templates e os redirecionamentos com foco em preservação da recuperação existente, e validar recebimento, expiração, scanners, reenvio e confirmação em outro dispositivo em ambiente aprovado. Essas mudanças de serviço e sua ativação têm gates próprios; o estado observado **não habilita** a abertura nem atesta um fluxo real.

A [documentação oficial de SMTP do Supabase](https://supabase.com/docs/guides/auth/auth-smtp) informa que o envio padrão é restrito a endereços autorizados e sujeito a limites, e lista Resend entre os provedores compatíveis. A [documentação dos templates](https://supabase.com/docs/guides/auth/auth-email-templates) descreve as variáveis disponíveis; nenhuma dessas referências substitui o teste de entrega e de recuperação existente.

O responsável confirmou que o Resend e o domínio de envio já estavam disponíveis e funcionando na recuperação. Há [evidência anterior de entrega e recuperação em produção](smtp-producao-20261012.md); ela não comprova que o projeto separado de QA use a mesma configuração. A inspeção acima observou o SMTP próprio desligado no QA, sem examinar ou alterar credenciais. A preparação do QA precisa preservar a recuperação existente e não pressupõe falta de conta ou domínio de envio.

## Candidata para revisão dos modelos, ainda não aplicada

O Supabase documenta modelos Go com condicionais e as variáveis `RedirectTo`, `TokenHash` e `ConfirmationURL`. O envio inicial e o reenvio de cadastro informam exatamente `/auth/confirmar-cadastro`; a retomada usa recuperação com `/auth/continuar-cadastro`. A recuperação legada usa `/auth/callback` com um parâmetro `state` variável. Por isso, uma alteração global que substitua todos os links de recuperação quebraria o contrato anterior.

Para um ambiente com origem fixa revisada, pode-se avaliar uma condição de igualdade exata entre `RedirectTo` e a URL completa candidata daquele ambiente. Somente nessa condição, o link apontaria para essa URL fixa com `?token_hash={{ .TokenHash }}`; no ramo `else`, deve permanecer o `{{ .ConfirmationURL }}` original. Aplicar a mesma distinção separadamente ao modelo de confirmação e ao de recuperação, cada um com sua própria rota fixa. Não usar correspondência por prefixo, origem fornecida pelo usuário, coringas ou concatenação de parâmetros arbitrários. Não instalar estes exemplos sem revisar os modelos atuais e o endereço concreto do preview:

```gotemplate
{{ if eq .RedirectTo "https://ORIGEM-QA-REVISADA/auth/confirmar-cadastro" }}
<a href="https://ORIGEM-QA-REVISADA/auth/confirmar-cadastro?token_hash={{ .TokenHash }}">Confirmar e-mail</a>
{{ else }}
<a href="{{ .ConfirmationURL }}">Confirmar e-mail</a>
{{ end }}
```

```gotemplate
{{ if eq .RedirectTo "https://ORIGEM-QA-REVISADA/auth/continuar-cadastro" }}
<a href="https://ORIGEM-QA-REVISADA/auth/continuar-cadastro?token_hash={{ .TokenHash }}">Continuar cadastro</a>
{{ else }}
<a href="{{ .ConfirmationURL }}">Redefinir senha</a>
{{ end }}
```

Esses trechos são uma proposta para revisão, não uma configuração instalada ou um teste de renderização do provedor. Antes de usá-los, confirmar o valor real de `RedirectTo` permitido, a sintaxe e o escape no Auth do QA, desligar rastreamento/reescrita de links do remetente e verificar redação de tokens em infraestrutura. Exercitar separadamente primeiro acesso, reenvio, retomada, link expirado/usado, abertura automática por scanner sem consumir o token, sessão existente, outro dispositivo e recuperação legada completa. O GET candidato só transfere o hash para cookie HttpOnly; a verificação ocorre no POST explícito. A URL contém um segredo temporário, portanto não deve ser copiada para evidências, logs ou mensagens.
