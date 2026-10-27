# Calendário, Financeiro e acesso — refinamento de 26/10/2026

Pedido do mantenedor: reproduzir o layout do protótipo no Calendário/Financeiro e melhorar composição, tema e acesso às políticas no login. Referência: [doc17](../planejamento/17-evolucao-prototipo/prototipo/) e [doc18](../planejamento/18-convergencia-prototipo-20261025/README.md). Base desta rodada: `abb453bc5a6cd4385f254eebf57bfaef8120ad39`, que concluiu 23/23 workflows; esses resultados não certificam o novo lote.

| Superfície | Correção | Contratos preservados |
|---|---|---|
| Calendário | Lateral de Lista mais ampla, cartões com data/fonte separadas, Dia linear expansível e seletores mobile de semana/mês. | OAuth de leitura, duas contas, fontes, fuso, cache parcial, notas, Drawer, URLs e Entitlements. |
| Financeiro | Compactação das faixas de controle, resumo e tabela; filtros agrupados e explicações secundárias recolhíveis, conforme o protótipo. | Valores/competência, máscara, ordenação, paginação, séries, faturas, limites, reservas e imagens de Metas. |
| Acesso | Moldura ampla no desktop e coluna única no celular; três opções diretas de tema; links de políticas e suporte. | Autofill, revelação de senha, disponibilidade, foco/erros, loading, retorno seguro e recuperação/troca de senha. |

## Ciência das políticas

O mantenedor confirmou pelo questionário a leitura obrigatória no formulário de login. A checkbox inicia desmarcada, tem alvo de 44 px, preserva seu estado após rejeição e só aparece no sign-in disponível. Links separados abrem [Termos](../../src/app/termos-de-servico/page.tsx) e [Privacidade](../../src/app/privacidade/page.tsx) em nova aba, sem descartar campos. O rodapé também mantém esses destinos e o suporte informado pelo mantenedor.

Essa confirmação é uma validação da interface. Não cria recibo legal versionado no banco, não representa consentimento genérico para tratamento de dados e não autoriza marketing. O servidor conserva o contrato de credenciais; o registro jurídico persistido do futuro cadastro continua no escopo comercial próprio. Recuperar/definir/trocar senha não ganham nova exigência.

## Diferenças justificadas do protótipo

- O DTO de Calendário não fornece descrição nem texto da nota; esses parágrafos não serão inventados. Participantes conservam as iniciais permitidas, sem nova coleta de fotos.
- A lateral de 330 px só aparece quando comporta os sete alvos de 44 px. Em larguras menores, filtros recolhíveis e seletores locais preservam acesso sem overflow da página.
- Em 320 px, setas → Hoje usam ordem visual igual ao DOM; nenhuma correção por tabindex positivo.
- Conteúdo financeiro e imagens de Metas continuam derivados dos registros disponíveis. A referência visual não autoriza fabricar valores, metas ou uploads.

## Validação por etapa

**Revisado localmente:** Auth, Calendário e Financeiro por autoria, Root e peer independente. O lote agregado de 11 arquivos/204 testes passou em Node 24, com heap de 256 MB e um worker: contratos SSR do formulário, Calendário e cálculos/modelos financeiros. Os 22 contratos estáticos adicionais do Calendário também passaram na entrega da frente. As verificações locais usam a instalação Vitest 4.1.11; o CI fará a instalação canônica do lockfile. Nenhum build, browser de testes, PostgreSQL ou Docker foi iniciado localmente.

**Preparado para CI:** layouts em 320/390/768/1280/1440 px conforme a superfície, claro/escuro, teclado, radios, checkbox negativa sem envio, rejeição com campos preservados, datas sem mudar vista, expansão/Drawer, overflow e fontes/estado parcial. Os helpers nativos de login passam a marcar a ciência, preservando seus oráculos de sessão e efeitos. Testes pesados permanecem no GitHub.

**Revisão financeira:** a tabela de Lançamentos mantém as seis colunas visíveis do protótipo atual; o mosaico de inspiração não substitui a captura e o código do doc17. O painel de categoria/ordenação conserva abertura e foco ao limpar o último filtro. Os oito arquivos da entrega coincidem após normalização LF; o Git removeu somente um CR final em cada um dos dois CSS. Nenhum conteúdo foi substituído para atender hashes de transporte.

**Portões locais:** lint dos 31 arquivos TS/TSX/MJS alterados aprovado sem warnings; detector Impeccable sem achados nos alvos das três superfícies; scanner de segredos aprovado em 2.774 arquivos versionáveis, sem imprimir valores; whitespace aprovado. Três contratos de inventário de fontes Auth/Admin e oito mocks de login positivo/negativo passaram, sem iniciar serviços. O fechamento derivado inclui o novo seletor de tema: Admin 543 fontes/61 dependências; recuperação 269/60, sem adicionar o fixture de interface às entradas nativas.

**Ainda pendente nesta redação:** Typecheck/CI próprios e comparação visual da candidata integrada. A existência dos testes não equivale a execução aprovada. Registrar os próximos resultados por SHA e deployment; não atualizar goldens para esconder diferenças.

## Primeira inspeção conectada — e50d606

Source `e50d6060f5ac49fc0f19ed09d718c51f94ed386a`, Preview `dpl_9PGrZX7dM8sv344sJgyZpn9bTMYa`, branch exclusiva de homologação, build READY. Conferência no navegador em 1280 × 720, com sessão comum de QA já existente:

- Login: três radios, checkbox obrigatória inicialmente desmarcada, campos de 16 px, controles de 44 px CSS e ausência de overflow horizontal. Claro/escuro e navegação com setas entre os radios conferidos, restaurando Claro. Os seis pares de texto/fundo medidos tiveram contraste mínimo de 5,60:1 no [claro](evidence/auth-layout-e50d606-20261026/auth-light-measurements-e50d606.json) e 7,85:1 no [escuro](evidence/auth-layout-e50d606-20261026/auth-dark-measurements-e50d606.json). Links separados preservam `_blank` e `noopener noreferrer`. Não houve preenchimento de credenciais, envio de login ou aceite das políticas pelo agente.
- Calendário: Lista com a lateral/cartão previstos; troca para Dia, escolha de outra data conservando Dia, expansão de compromisso existente e abertura do Drawer somente leitura conferidas. Sem conectar/revogar contas, sincronizar ou criar/vincular notas.
- Financeiro: composição real, Lançamentos e filtros conferidos. Escolher categoria e voltar a todas manteve o painel aberto, foco na categoria e Tab para ordenação, sem alterar dados financeiros. A inspeção revelou moeda e status quebrando dentro da célula desktop; essa correção integra a rodada seguinte.

O CI desta Source não foi aprovado: Typecheck recusou uma tupla de teste sem tipo fechado; os contratos puros de Auth/recuperação encontraram doubles anteriores à checkbox e um fixture de cardinalidade anterior ao novo import. Build READY não substitui esses portões. As correções devem preservar os oráculos, negativas e limites. Mobile, autenticação positiva real desta candidata e aceite integral permanecem pendentes.

**Correção dos testes:** a tupla passa a ser literal; a preparação da UI acompanha a checkbox também na tentativa nativa com senha antiga; doubles aceitam somente o controle nominal e recusam um check falho antes de qualquer POST; o fixture final usa a cardinalidade 269 já derivada por AST e mantém seus negativos. Revisão independente aprovada. Os 409 contratos de suporte completos e 11 casos de recuperação selecionados passaram localmente. Um caso adicional parou em `SOURCE_REFUSED`, pela instalação local Next 15.5.27 frente ao pin 15.5.28; nenhuma guarda foi contornada. A instalação canônica e esse aceite continuam no GitHub.

**Correção da tabela:** regras locais a partir de 768 px preservam a unidade do valor em BRL e do estado. Descrição e conta continuam quebrando linhas; cards mobile e o scrollport existente da tabela permanecem. O novo teste em 768/1440 px mede uma linha de texto contida na célula e ausência de overflow global. Lint focado e detector do CSS corrigido passaram; execução do E2E e confirmação hospedada pertencem à candidata seguinte.

Merge e deploy de produção continuam bloqueados. Somente homologação isolada está autorizada. Sem migration, alteração de credenciais, contratação, checkout Asaas, novo Drive ou retomada do restore.
