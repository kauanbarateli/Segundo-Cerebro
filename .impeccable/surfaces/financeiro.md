# Financeiro — T-011 e extensão T-018/T-020

## Estado e autoridade

Modo **Operate**. Feature implementada sobre a sessão demonstrativa única; aguardando E2E e inspeção visual integrados. D-030/DS2.1 já aprovados. A skill Impeccable local e as referências de contexto, `operate` e `craft-floor` foram consideradas nesta sessão; o fallback documental previamente autorizado permanece válido, sem repetir o launcher.

**OBSERVADO:** doc 13 T-011 exige cinco telas, URL compartilhável, Painel e Lançamentos coerentes, fatura derivada em cinco estados, máscara integral e SVG próprio. O resumo do ticket enumera quatro telas; a quinta é **Orçamentos**, explícita nas abas do HTML DS2.1 (`docs/prototipo/prototipo-segundo-cerebro.html`, linhas 1081–1085 e bloco `f-orc`). Docs 05, 06 D-006 e 09 definem hierarquia, invariantes, ciclo de vida, propriedade e ausência de conteúdo em logs.

**OBSERVADO:** `PRODUCT.md`, `DESIGN.md`, tokens locais e primitivas T-003/T-006 são a autoridade visual. Tipografia operacional, cores por token, superfícies sólidas, cartões com raio local e densidade de produto. A h1 vem do shell; a feature não repete um cabeçalho de marketing.

## Hierarquia e interação

- **OBSERVADO:** Painel, Lançamentos, Contas, Categorias e Orçamentos são navegação real. Abas quebram em linhas no mobile; não provocam rolagem horizontal da página.
- **RECOMENDADO:** mês, máscara e Novo lançamento precedem a navegação. Painel prioriza patrimônio líquido e faturas a pagar, depois realizado, categorias e histórico. Competência e vencimento são rótulos distintos.
- **OBSERVADO:** Lançamentos usa a mesma DataTable e o mesmo `view.rows` para tabela e cartões. A extensão controlada é opcional e conserva os consumidores existentes. Estado de busca, filtros, ordenação e página vive na URL.
- **RECOMENDADO:** oito colunas no desktop; cartões equivalentes abaixo de 768px. Nome e menu Ações abrem os mesmos detalhes. Não há ação exclusiva por hover ou arrastar.
- **OBSERVADO:** os formulários usam Drawer compartilhado, campos 16px, alvos 44px, foco inicial e retorno, rodapé acessível e safe areas herdadas. Transação, conta, categoria e orçamento têm edição real em memória. Tipos de conta/categoria são imutáveis para conservar o histórico.
- **RECOMENDADO:** ações compostas ainda sem comando de domínio são somente leitura: transferência/série mostra seu vínculo sem oferecer edição ou exclusão isolada. Exclusão independente permite restauração e Desfazer.

## Dados e privacidade

**OBSERVADO:** a massa comum contém receita de R$ 8.000,00, despesa de R$ 3.247,60, resultado de R$ 4.752,40, ativos de R$ 22.817,42 e dívida de R$ 2.412,80. O patrimônio líquido derivado é R$ 20.404,62. Limite Nubank: R$ 8.000,00; disponível: R$ 5.587,20. A fatura de setembro vence em outubro. O total ilustrativo a pagar do HTML não é copiado quando mistura esses recortes.

**RECOMENDADO:** a linha mostra resultados calculados para seis competências, inclusive zero onde não há lançamentos. Não copia a tendência ou a porcentagem de crescimento desenhada no protótipo. A rosca reflete saídas realizadas por categoria; orçamento usa consumo líquido de estornos e faixas 80/100 do núcleo.

**OBSERVADO:** `useDemoPrivacy()` é compartilhado com Início. Todo valor usa a mesma máscara `R$ ••••`, sem sinal ou extensão variável. Percentuais, status que indicam pagamento, `aria-valuenow`, geometria de gráficos e barras desaparecem enquanto ocultos. Categorias são ordenadas por nome sob máscara, sem ranking por valor. Resumos textuais acessíveis usam a mesma máscara.

**RECOMENDADO:** formulário monetário exige Exibir valores antes de montar campos; nenhum valor é inserido em input invisível. Categoria, sem campo monetário, pode ser editada enquanto a máscara está ativa. A preferência nunca entra na URL.

## Verificação e limites

Testes puros cobrem URL, BRL, patches, competência histórica, estados e coerência da massa comum. E2E preparados para 320/1280, quatro formulários, exclusão/desfazer, URL/voltar/reload, igualdade tabela/cards, máscara, teclado/foco, erro e vazio reais. A existência dos testes não constitui aprovação da rodada integrada. Esta frente não executou build, servidor ou browser.

O recorte original T-011 usava dados em memória. A extensão preparada em 09/10/2026 acrescenta os fluxos financeiros de M3; aplicação de schema e verificação operacional continuam posteriores.

## Direction contract — extensão de 09/10/2026

**RECOMENDADO:** permanecer em Operate/DS2.1: Geist, superfícies neutras, tokens existentes e primitivas compartilhadas. A prioridade é tornar as operações financeiras acessíveis nas telas existentes. Nenhum novo valor de cor, tipografia ou espaçamento foi criado para preencher lacunas.

**OBSERVADO em código:** mês/máscara/Novo lançamento/Transferir organizam a toolbar; Contas apresenta Pagar fatura/Arquivar e histórico; Drawers acrescentam pagamento, transferência, séries e etiquetas. Campos monetários exigem exibição explícita dos valores; provável duplicidade usa texto sem revelar montante. Erro conserva campos e foco; operações pendentes impedem nova submissão. Desfazer usa 8.000 ms conforme T-020 e a restauração posterior continua na lixeira.

**OBSERVADO:** a frente de interface leu a Impeccable local e referências de contexto, Operate e craft-floor, inspecionando goldens existentes de 390px/escuro e 1440px/claro. Os testes puros de formulário/rota passaram. Não houve execução de browser/build ou novas capturas; goldens anteriores não comprovam os layouts/interações acrescentados.

**PENDENTE:** finish/revisão visual das novas interações em claro/escuro/mobile, teclado/foco, máscara, alvos e movimento reduzido no navegador integrado. Essa limitação está registrada em `docs/implementation/t018-t020-financeiro.md`; não representa aprovação visual final.
