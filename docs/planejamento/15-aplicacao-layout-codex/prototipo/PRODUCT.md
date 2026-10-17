# Segundo Cérebro — contexto do protótipo

Documento de produto da entrega local, atualizado para o refinamento v2 e o alinhamento de cores ao DS 2.1 em 17/10/2026. Os arquivos desta pasta implementam um protótipo navegável; não substituem a aplicação autenticada do repositório.

## Propósito e público

Um painel pessoal para capturar, organizar, conectar, reencontrar, agir e revisar. Reúne vida diária, conhecimento e organização financeira sem exigir que a pessoa pense na estrutura do software. O público informado é de adultos a partir de aproximadamente 23 anos, especialmente profissionais, estudantes e pessoas que procuram organização pessoal e produtividade.

A experiência privilegia linguagem direta, leitura rápida e continuidade: uma captura vira tarefa ou nota; um compromisso abre seu contexto; concluir uma tarefa ou registrar um hábito atualiza também o Início. O sistema é pessoal, sem pressupor colaboração em equipe.

## Origem e autoridade

- **SOLICITADO:** protótipo local, navegação pelos fluxos centrais, interface moderna e minimalista, claro/escuro e calendário visual. As nove imagens fornecidas orientam a composição, com 405324035233224479.jpg como principal referência da agenda. Na correção posterior de cores, o usuário definiu o design system do projeto como autoridade cromática para os dois temas e os modelos de Configurações.
- **OBSERVADO NO CÓDIGO:** [Segundo-Cerebro, commit 61d03c7](https://github.com/kauanbarateli/Segundo-Cerebro/tree/61d03c7), incluindo rotas, componentes, regras de domínio e ativos. A marca geométrica “2” veio de `src/app/icon.svg`; Geist faz parte do design system do projeto.
- **OBSERVADO NA DOCUMENTAÇÃO:** central em `D:\USUÁRIOS\Kauan\TRABALHO\CÉREBRO - STARTUP (SEGUNDO CÉREBRO)`, consolidada em 16/10/2026, com documentos de entrega em 17/10. Há referências à PR #45 e ao commit `93ab854`, posteriores ao código clonado. Por isso, o escopo não foi deduzido apenas de arquivos históricos do repositório.
- **OBSERVADO E APLICADO:** `design-system/tokens.json` conserva os valores cromáticos do DS 2.1 do repositório; `design-system/colors.css` aplica esses valores nos dois temas. A documentação “Design System e Acessibilidade” confirma a direção de neutros quentes e acento monocromático.
- **RECOMENDADO E IMPLEMENTADO NESTE PROTÓTIPO:** organização visual das superfícies, distribuição das informações e apresentação adaptada ao celular. Os aliases aproveitam apenas cores existentes do DS; Estudos usa info/info-ink como mapeamento inferido. A composição e os fluxos existentes foram preservados nesta correção de cores.

As fontes locais mais relevantes foram `Comece aqui`, `Mapa do Segundo Cérebro`, as notas de funcionalidades e os documentos de design system, regras de domínio, segurança, situação atual e critérios do MVP. Checkpoints históricos não representam uma nova validação de produção.

## Superfícies implementadas

| Rota | Experiência demonstrada |
|---|---|
| `#/inicio` | Próxima ação, tarefas do dia, agenda, hábitos, resumo financeiro, entrada e notas recentes |
| `#/capturar` | Capturar, editar, organizar e promover uma captura para tarefa ou Conhecimento, preservando a origem |
| `#/tarefas` | Criar/editar, filtrar, concluir/reabrir e acompanhar ações com prazo, prioridade e projeto |
| `#/calendario` | Dia, semana, mês e lista; períodos e Hoje; fontes; detalhes e contexto de compromissos |
| `#/conhecimento` | Cadernos e notas, edição textual, referências entre notas e relações de contexto |
| `#/projetos` | Projetos e seus contextos de tarefas, capturas e notas |
| `#/habitos` | Diário, dias específicos e meta semanal; registrar/desmarcar, pausar, arquivar e restaurar |
| `#/financeiro` | Resumo, busca/filtro de lançamentos, criar/editar/excluir, cartão e limite mensal |
| `#/cofre` | Abrir demonstração, consultar itens fictícios, revelar/copiar exemplo e bloquear |
| `#/atividade` | Histórico das ações realizadas na demonstração |
| `#/integracoes` | Até duas contas Google fictícias e escolha das fontes compartilhadas com a agenda |
| `#/configuracoes` | Nome, tema, privacidade financeira, preferências da agenda, exportar/restaurar demonstração |

A busca global é acessível pela navegação e por Ctrl/Cmd+K. O Cofre fica fora da busca. Os módulos usam o mesmo estado local; não são telas isoladas com números independentes.

O refinamento preserva essas rotas e os fluxos de captura, tarefas, conhecimento, hábitos e finanças. A navegação pode ser expandida ou recolhida manualmente, com preferência persistida no navegador. No celular, abre com os nomes dos módulos, gerencia o foco e mantém o conteúdo de fundo inativo até fechar. Alternar tema ou recolher a lateral atualiza a interface sem reconstruir a tela; os campos ainda não salvos permanecem em edição. Isso não representa salvamento automático de formulários nem promessa de recuperar rascunhos após recarregar o arquivo.

## Regras preservadas e limites da simulação

- A data de referência é **17/10/2026**. Os registros iniciais são fictícios e usam datas coerentes. Não são métricas, compromissos ou saldos pessoais atuais.
- Calendário Google é **somente leitura**. As ações em um compromisso criam ou abrem contexto no Segundo Cérebro; não criam nem editam eventos no Google. Fonte desmarcada ou conta de exemplo removida deixa de alimentar a agenda e o Início.
- Hábitos não aceitam marcações futuras nem anteriores ao início. Pausar/arquivar preserva registros. A grade demonstra uma semana; não representa todo o motor de sequências, pausas com intervalos ou mapa de calor do produto.
- Dinheiro usa centavos inteiros. Compra no cartão cria dívida sem saída imediata de caixa. Pagar a fatura reduz conta e dívida na mesma operação, sem duplicar a despesa. O ciclo demonstrativo agrupa compras por mês da data; não simula fechamento, juros, séries ou estornos completos. O limite mensal demonstrado é independente de orçamento por categoria.
- A exclusão de um lançamento o retira dos totais locais. Este protótipo não oferece toda a interface de conciliação, estados financeiros, contas, séries, lixeira ou transferências entre contas do domínio real.
- O Cofre usa apenas exemplos fixos. **Não há criptografia, senha mestra, kit de recuperação ou formulário para receber segredos.** Bloqueia manualmente, ao sair da área, ocultar a aba ou perder o foco. O navegador pode negar a cópia; o feedback informa isso. Nenhum segredo real deve ser inserido.
- Conexões, preferências de lembrete e sincronização são demonstrativas. Não há OAuth, acesso a Google, envio de notificação, comunicação com Supabase ou sessão autenticada.

## Execução e persistência

Entrada: `index.html`. HTML, CSS, JavaScript, marca e fonte estão nesta pasta, sem build, pacote remoto ou servidor obrigatório. O protótipo não precisa de internet para renderizar suas superfícies.

As alterações da demonstração, o tema e a escolha da lateral expandida ou recolhida são salvos no armazenamento local do navegador, quando permitido. A exportação gera um arquivo dos dados sintéticos locais; não implementa exportação da conta de produção. “Restaurar exemplos” apaga somente as alterações desta demonstração após confirmação. O comportamento de `file://` e da área de transferência depende do navegador.

## Fora desta entrega

Drive, grafo persistente, IA, colaboração, cobrança, Open Finance, importação OFX/CSV, escrita Google, CalDAV, Gmail/ClickUp, Web Push, administração de usuários e autenticação real. Alguns itens são futuros do produto; outros foram retirados do MVP. A ausência no protótipo não autoriza excluir dados ou estruturas históricas do repositório.

## Critério de qualidade

O protótipo deve manter o contexto entre módulos, dar feedback de ações, permitir corrigir entradas inválidas e apresentar estados vazios. Claro e escuro devem compartilhar a mesma navegação e semântica. O projeto usa foco visível, campos de 16 px, controles principais de 44 px e suporte a movimento reduzido. O sistema tipográfico diferencia corpo de 14 px, controles de 13 px e metadados de leitura de 12 px; indicadores e títulos têm escalas próprias. A agenda prioriza títulos e horários legíveis, preserva filtros e navegação de períodos e apresenta detalhes em painel lateral. Os tokens de controle separam bordas interativas dos divisores discretos. Busca e operações frequentes por teclado evitam espera visual. Esses princípios não equivalem a certificação completa de acessibilidade ou a aceite de produção.

O sistema visual e a rastreabilidade das nove imagens e das orientações originais dos quatro repositórios de skills estão em `DESIGN.md`. Este documento descreve comportamento e critérios, sem substituir a validação registrada da entrega; instruções operacionais ficam no arquivo de leitura.
