# T-014 — interface de autenticação

Interface ligada às actions de servidor; não atesta autenticação externa nem conclusão do ticket.

## Entrega

- `/entrar`: e-mail, senha, recuperação e orientação sobre cadastro fechado.
- `/recuperar-senha`: solicitação por e-mail e retorno genérico fornecido pelo backend.
- `/redefinir-senha`: nova senha e confirmação; guarda de recuperação no servidor.
- `/trocar-senha`: nova senha e confirmação; senha atual aparece somente quando a guarda exige. Troca obrigatória não é deduzida de parâmetro da URL.

Composição preserva o login DS 2.1 do protótipo: painel central de 400px, marca portada e tokens vigentes. Layout de autenticação não usa o shell de módulos e não altera a demonstração existente. Field, Button, ícones, marca e seletor de tema são compartilhados.

As actions `signInAction`, `recoverPasswordAction` e `updatePasswordAction` recebem FormData com o contrato público de `src/lib/auth/types.ts`. Erros específicos se associam aos campos; retorno geral e espera do limitador são visíveis. Actions e guardas revalidam sessão e entrada; parâmetros da UI nunca concedem privilégio. Os avisos de URL usam uma lista fechada. Nenhuma senha vai para URL, localStorage ou estado retornado pela action.

Se a senha já foi alterada e uma etapa posterior falha, o backend pode indicar `completionPending` a partir de seu checkpoint assinado, inclusive após recarregar. Nesse estado a tela remove os campos de senha e oferece apenas “Concluir proteção da conta”, permitindo repetir a finalização sem pedir a senha antiga ou tentar mudá-la outra vez. O formulário não envia essa flag como autorização; a action confere o checkpoint novamente e preserva a indicação em respostas de limitação enquanto aplicável. O aviso `password-recheck` orienta nova entrada quando a confirmação da sessão precisa ser refeita. A falha da saída global final usa `password-updated-logout-incomplete`: confirma somente a senha alterada e a saída local, sem prometer outra finalização na sessão que o SDK já removeu.

Quando `getAuthFormAvailability` ou `getPasswordFormContext` informa indisponibilidade, campos e envio ficam bloqueados com mensagem explícita. Não há credencial ilustrativa, login local ou sucesso simulado. Em ambiente habilitado, os formulários usam as actions reais. Redirecionamentos e provas de recuperação pertencem ao backend.

## Acessibilidade e estados

H1 por tela, skip link, foco nativo, labels reais e autocomplete `username`, `current-password` e `new-password`. Senha oculta inicialmente; revelação mantém nome acessível e estado pressionado. Alvos ≥44px e campos ≥16px seguem as primitivas. A página pode rolar quando teclado ou conteúdo reduz a altura disponível. Tema claro/escuro/sistema segue a preferência existente.

Estado pendente bloqueia envio duplicado. Resultado leva foco ao primeiro campo com erro ou à mensagem. Indisponibilidade não pede uma senha pessoal. Política atual de senha nova do backend: mínimo de 12 caracteres Unicode e máximo de 72 bytes UTF-8; a UI orienta o limite e informa que acentos e emojis ocupam mais espaço. A validação do servidor é a autoridade.

## Evidência e pendências

13/13 testes focados passaram: `tests/features/auth-notices.test.ts` cobre a lista de avisos e o descarte de parâmetros repetidos/excessivos; `tests/features/auth-form.test.ts` renderiza os estados do formulário com respostas de action controladas, incluindo retomada pelo servidor, falha posterior à troca, limitação, invalidação explícita da retomada, bloqueio durante envio e retorno genérico da recuperação. Essa renderização SSR não testa submissão, foco ou effects no navegador. ESLint focal e TypeScript também passaram.

`tests/e2e/auth-forms.spec.ts` prepara nove testes em modo demo sem credenciais: quatro larguras, estado indisponível, links, autofill, teclado/tema, parâmetros e preservação do modo demo. Eles não comprovam envio de e-mail ou sessão.

Os nove cenários E2E de Auth passaram dentro da regressão integrada de 140 cenários. A raiz inspecionou oito capturas das quatro telas em desktop/claro e celular/escuro; resultados no [relatório integrado](t014-integracao.md). Login real, recuperação por e-mail, renovação/revogação de cookies, rate-limit RPC e fluxo entre aparelhos permanecem dependentes do ambiente e dos testes T-014/T-015. Nenhum projeto Supabase foi conectado nesta entrega; migrations continuam exclusivamente manuais conforme OP-002.
