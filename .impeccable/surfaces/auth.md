# Autenticação — T-014

## Refinamento autorizado em 26/10/2026

**RECOMENDADO, conforme pedido explícito do mantenedor:** conservar Geist, marca e tokens DS 2.1, com cabeçalho de marca/tema, painel de formulário de até 444 px e introdução curta ao lado somente no desktop. Até 900 px, o formulário fica em coluna única; controles Claro, Escuro e Sistema são radios nativos de 44 px no cabeçalho, com ícones no celular. As rotas de recuperação/troca usam a mesma moldura e conservam seus textos e guardas.

**CONFIRMADO pelo mantenedor:** somente no login disponível, exigir a confirmação desmarcada “Li os Termos de Serviço e a Política de Privacidade.”. Links separados abrem as páginas públicas em outra aba sem perder campos. A ciência permanece no estado do formulário em caso de rejeição; não grava consentimento, recibo jurídico versionado ou autorização de marketing. Não altera o contrato de autenticação do servidor nem a exigência de senha atual. O ambiente sem Auth continua bloqueado, sem solicitar ciência inútil.

Rodapé com políticas e contato de suporte reais. A ação principal continua Entrar; autofill, senha oculta/revelação, erros/foco, loading e prevenção de duplicação permanecem. Verificação atual: revisão independente e 14 contratos estáticos do formulário aprovados; E2Es, screenshots de 320/390/768/1280 px, temas e aceite conectado da nova Source ainda pendentes. Não herdar os resultados históricos abaixo.

## Histórico T-014 — composição anterior

As seções seguintes documentam a entrega anterior de 400 px; a composição e o controle de tema foram substituídos pelo refinamento acima.

## Superfície e modo

**Operate.** Rotas `/entrar`, `/recuperar-senha`, `/redefinir-senha` e `/trocar-senha`; entradas em `src/app/(auth)/`, composição em `src/components/features/auth/`.

## Tarefa e conteúdo

Entrar com conta existente, solicitar recuperação ou definir uma nova senha. Cadastro fechado conforme SPEC-03. Forms dependem da disponibilidade e das guardas reais do servidor; demo não concede sessão nem solicita senha pessoal. O backend controla a necessidade de senha atual.

## Direção e proveniência

**OBSERVADO:** protótipo DS 2.1, seção login e `.lcard`: painel central de até 400px, margem de 20px, padding de 32px, marca, campos e ação. Preservar mundo de DESIGN.md e primitivas existentes. **RECOMENDADO:** h1 visível e formulários derivados para recuperação/troca; padding mobile de 20px e mensagens completas sem esconder controles. Tokens existentes para todos os fundos, tintas e espaçamentos; nenhum novo material ou cor. Contexto Impeccable já teve fallback nesta sessão; não foi reiniciado.

## Primeiro viewport

Marca “2” original, título da tarefa, descrição curta, campos e ação principal; links de acesso após o formulário. O estado sem serviço aparece antes dos campos bloqueados. Tema permanece alcançável no rodapé, sem navegação de módulos nesta superfície.

## Interação e acesso

Field/Button compartilhados, alvo de 44px, campo de 16px, preenchimento automático nativo, senha oculta com botão de revelação por campo. Submit pendente informa andamento e impede duplicação. Erro recebe foco no primeiro campo inválido ou no resumo; sucesso de recuperação recebe foco no retorno público genérico. Sem movimento decorativo, sem armazenamento de credenciais. Mensagens da URL usam lista fechada.

## Limites e verificação

320/390/768/1280px, dois temas, teclado e ausência de transbordo verificados em nove E2E sem conexão, dentro da regressão integrada de 140 cenários. A raiz inspecionou as oito capturas desktop/claro e celular/escuro em uma passagem delimitada, sem novo ciclo de polimento. Testes reais de login, e-mail, cookie e sessão ainda dependem de projeto configurado e schema aplicado manualmente. A composição herda o protótipo aprovado; não é proposta de identidade ou fluxo fictício.
