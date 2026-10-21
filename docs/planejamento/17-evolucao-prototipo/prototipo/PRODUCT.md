# Segundo Cérebro — contexto do protótipo

Documento de produto da entrega local, atualizado para o Financeiro e para agendamento, imagens e desempenho de hábitos em 21/10/2026. A entrada sem hash mostra Conheça; as rotas diretas existentes continuam disponíveis. A extensão conserva a apresentação pública, o checkout simulado e o perfil, o calendário lateral com eventos em lista e participantes, o Kanban de tarefas, a adaptação Mobile Devices, a personalização de capas, o onboarding simplificado, o refinamento v2 e as cores do DS 2.1. Os arquivos desta pasta implementam um protótipo navegável; não substituem a aplicação autenticada do repositório.

## Propósito e público

Um painel pessoal para capturar, organizar, conectar, reencontrar, agir e revisar. Reúne vida diária, conhecimento e organização financeira sem exigir que a pessoa pense na estrutura do software. O público informado é de adultos a partir de aproximadamente 23 anos, especialmente profissionais, estudantes e pessoas que procuram organização pessoal e produtividade.

A experiência privilegia linguagem direta, leitura rápida e continuidade: uma captura vira tarefa ou nota; um compromisso abre seu contexto; concluir uma tarefa ou registrar um hábito atualiza também o Início. O sistema é pessoal, sem pressupor colaboração em equipe.

## Origem e autoridade

- **SOLICITADO:** protótipo local, navegação pelos fluxos centrais, interface moderna e minimalista, claro/escuro e calendário visual. As nove imagens fornecidas orientam a composição, com 405324035233224479.jpg como principal referência da agenda. Na correção posterior de cores, o usuário definiu o design system do projeto como autoridade cromática para os dois temas e os modelos de Configurações.
- **OBSERVADO NO CÓDIGO:** [Segundo-Cerebro, commit 61d03c7](https://github.com/kauanbarateli/Segundo-Cerebro/tree/61d03c7), incluindo rotas, componentes, regras de domínio e ativos. A marca geométrica “2” veio de `src/app/icon.svg`; Geist faz parte do design system do projeto.
- **OBSERVADO NA DOCUMENTAÇÃO:** documentação local fornecida pelo usuário, consolidada em 16/10/2026, com documentos de entrega em 17/10. Há referências à PR #45 e ao commit `93ab854`, posteriores ao código clonado. Por isso, o escopo não foi deduzido apenas de arquivos históricos do repositório.
- **OBSERVADO E APLICADO:** `design-system/tokens.json` conserva os valores cromáticos do DS 2.1 do repositório; `design-system/colors.css` aplica esses valores nos dois temas. A documentação “Design System e Acessibilidade” confirma a direção de neutros quentes e acento monocromático.
- **RECOMENDADO E IMPLEMENTADO NESTE PROTÓTIPO:** organização visual das superfícies, distribuição das informações e apresentação adaptada ao celular. Os aliases aproveitam apenas cores existentes do DS; Estudos usa info/info-ink como mapeamento inferido. A composição e os fluxos existentes foram preservados nesta correção de cores.
- **SOLICITADO E IMPLEMENTADO NA EXTENSÃO:** primeira experiência progressiva para apresentar o produto e preparar perfil, contas Google fictícias, hábitos, projetos, tarefas e conhecimento. A identidade existente permanece; não houve mudança de nome, novos tokens globais, implementação de produção ou atualização do GitHub nesta extensão.
- **SOLICITADO E IMPLEMENTADO NA ADAPTAÇÃO MOBILE DEVICES:** composição de Início e Calendário orientada pelas duas imagens fornecidas em `Downloads/Mobile Devices`, com versões próprias para desktop e celular. As imagens orientam distribuição e hierarquia; o DS 2.1 continua determinando as cores. A adaptação é local e não altera o repositório ou as issues no GitHub.
- **SOLICITADO E IMPLEMENTADO NA PERSONALIZAÇÃO DE IMAGENS:** capas opcionais dos projetos e imagem do destaque do dia configurável em Configurações, seguindo a composição de `ea474ef2299b82b3f5a8372aa3bbbb7d.jpg`. A paisagem inicial foi gerada para a entrega; nenhuma fotografia da referência foi copiada. As escolhas são locais e não acrescentam um serviço de upload ou sincronização.
- **SOLICITADO E IMPLEMENTADO NO KANBAN:** visualização adicional na aba Tarefas, com as mesmas tarefas e estados já existentes. A lista é preservada. O quadro é uma extensão local solicitada em 20/10/2026; não muda o escopo documentado da aplicação de produção nem acrescenta colaboração.
- **SOLICITADO E IMPLEMENTADO NO CALENDÁRIO EM LISTA:** seletor lateral de datas, eventos em lista e rostos nos compromissos em grupo, orientados por `694348d7507cb8069508f983baf92a19.jpg`, preservada em `references/calendar-events-list.jpg`. Os participantes de demonstração usam nomes fictícios e retratos originais gerados para esta entrega; não são contatos reais.
- **SOLICITADO E IMPLEMENTADO EM CAPTURAR:** lista lateral com busca e filtros, documento amplo e formatação local, orientados por `5e3f05149e2089bd9382388630c85946.jpg`, preservada em `references/capture-editor.jpg`. A imagem orienta proporção e hierarquia. Marca, Geist e DS 2.1 permanecem, assim como os vínculos de origem ao organizar uma captura.
- **SOLICITADO E IMPLEMENTADO EM HÁBITOS:** escolha de dias no onboarding, imagens opcionais e desempenho por semana ou mês, com filtro compartilhado pela rotina. A referência `references/habits-monthly.png` orienta a composição; as estatísticas usam os registros locais existentes. Marca, Geist e DS 2.1 permanecem. A extensão é local, sem backend ou atualização de PR.
- **SOLICITADO E IMPLEMENTADO NO FINANCEIRO:** painel e interações orientados pelos nove estados de `references/finance-nine-screens.png`, com lançamentos, períodos, cartões/faturas, recorrências, limites e metas. A confirmação do usuário acrescenta imagens opcionais às metas criadas. Os números continuam derivados dos registros locais; marca, Geist e DS 2.1 permanecem.

As fontes locais mais relevantes foram `Comece aqui`, `Mapa do Segundo Cérebro`, as notas de funcionalidades e os documentos de design system, regras de domínio, segurança, situação atual e critérios do MVP. Checkpoints históricos não representam uma nova validação de produção.

## Superfícies implementadas

| Rota | Experiência demonstrada |
|---|---|
| `#/conheca` | Apresentação pública, capturas atuais, prévia Projetos/Kanban e oferta integral de R$ 29,90/mês |
| `#/checkout` | Assinatura simulada, dados de exemplo, dois aceites manuais e entrada no onboarding |
| `#/termos` | Termos de serviço, minuta v0.2 em revisão no PR #70 |
| `#/privacidade` | Política de privacidade da mesma minuta, com origem e limitações preservadas |
| `#/onboarding` | Boas-vindas, sete etapas opcionais, progresso salvo, resumo das escolhas e acesso ao painel |
| `#/inicio` | Próxima ação com fundo configurável e progresso diário, até três projetos em andamento com capas opcionais, tarefas do dia, agenda, hábitos, resumo financeiro, entrada e notas recentes |
| `#/capturar` | Buscar e filtrar a lista lateral, escrever com formatação, salvar e promover uma captura para tarefa ou Conhecimento, preservando a origem |
| `#/tarefas` | Alternar Lista/Kanban, criar/editar, filtrar e mover tarefas entre estados, com prazo, prioridade e projeto |
| `#/calendario` | Lista paginada a partir da data escolhida, calendário lateral ou expansível, participantes e detalhes; Dia, Semana, Mês, períodos, Hoje e fontes preservados |
| `#/conhecimento` | Cadernos e notas, texto simples legado ou formatação recebida de Capturar, referências entre notas e relações de contexto |
| `#/projetos` | Criar/editar projetos com capas opcionais e reunir seus contextos de tarefas, capturas e notas |
| `#/habitos` | Desempenho semanal/mensal, filtro por hábito e rotina de sete dias com imagem opcional; frequência diária, dias específicos ou meta semanal; registrar/desmarcar, pausar, arquivar e restaurar |
| `#/financeiro` | Visão geral, lançamentos com busca/filtros e duplicação, cartões/faturas, planejamento, recorrências, limites e metas com imagem opcional e aportes |
| `#/cofre` | Abrir demonstração, consultar itens fictícios, revelar/copiar exemplo e bloquear |
| `#/atividade` | Histórico das ações realizadas na demonstração |
| `#/integracoes` | Até duas contas Google fictícias e escolha das fontes compartilhadas com a agenda |
| `#/configuracoes` | Nome e foto de perfil, termos/privacidade, tema, imagem do destaque do dia, privacidade financeira, preferências da agenda, exportar/restaurar demonstração e retomar/rever o onboarding |

A busca global é acessível pela navegação e por Ctrl/Cmd+K. O Cofre fica fora da busca. Os módulos usam o mesmo estado local; não são telas isoladas com números independentes.

O refinamento preserva as doze rotas anteriores e os fluxos de captura, tarefas, conhecimento, hábitos e finanças. A navegação pode ser expandida ou recolhida manualmente, com preferência persistida no navegador. No celular, abre com os nomes dos módulos, gerencia o foco e mantém o conteúdo de fundo inativo até fechar. Alternar tema ou recolher a lateral atualiza a interface sem reconstruir a tela; os campos ainda não salvos permanecem em edição. Nos formulários anteriores isso não representa salvamento automático nem promessa de recuperar rascunhos após recarregar o arquivo. O onboarding tem persistência própria de rascunhos, descrita a seguir.

## Financeiro: painel, cartões, recorrências e metas — 21/10/2026

A rota reúne **Visão geral**, **Lançamentos**, **Cartões** e **Planejamento**. A Visão geral apresenta saldos atuais, lançamento rápido, entradas e despesas acumuladas, plano do mês, três lançamentos recentes, meta em destaque, cartões e recorrências. Planejamento reúne limite total, categorias, todas as metas e recorrências. O seletor de mês/ano, as setas e **Mês atual** mudam o período consultado; os saldos em contas e a dívida dos cartões continuam representando a posição atual. A data da demonstração permanece **17/10/2026**.

Os sete lançamentos iniciais foram preservados. Em outubro, o estado inicial calcula **R$ 6.034,70 em contas**, **R$ 268,90 comprometidos nos cartões**, **R$ 5.765,80 após reservar as faturas**, **R$ 6.500,00 em entradas** e **R$ 2.584,20 em despesas**. O gráfico usa valores acumulados por dia e oferece **Ver dados e cálculo** com tabela. O valor ilustrativo de R$ 1.998,80 da referência não foi transformado em dívida fictícia.

O lançamento rápido registra Entrada ou Saída em conta, na data da demonstração, com categoria Outros. **Novo lançamento** permite descrição, valor, data, categoria, conta ou cartão, situação e repetição. O menu de cada linha oferece **Editar**, **Duplicar** e **Excluir**; pagamentos de fatura têm edição própria e não oferecem duplicação. Duplicar abre uma cópia para confirmação na data da demonstração. Excluir exige confirmação e retira o registro dos totais. Busca por descrição/categoria e filtros por tipo, conta e situação podem ser combinados e limpos.

**Confirmado** (ou **Recebido** para entradas), **Pendente** e **Cancelado** são estados distintos. Apenas valores confirmados até a data da demonstração entram nos totais realizados; pendentes, cancelados, excluídos e confirmados futuros legados ficam fora. O editor rejeita confirmação futura e orienta escolher Pendente. Compra no cartão é despesa e aumenta a dívida sem reduzir imediatamente o caixa. O modelo calcula valores em centavos inteiros.

Cartões guardam nome, **somente os quatro últimos dígitos**, limite, dias de fechamento/vencimento, conta para pagamento e uma cor existente no sistema. **Fatura**, **Compras** e **Configurações** compartilham o cartão selecionado, com navegação de mês. Compra no dia do fechamento entra na próxima fatura; dias inexistentes no mês usam seu último dia. As compras legadas conservam a fatura já atribuída. Editar o fechamento não desloca compras anteriores.

**Registrar pagamento** aceita quitação parcial ou total, até o valor em aberto e o saldo da conta escolhida. O pagamento reduz conta e dívida uma vez, sem criar outra despesa; sua edição recalcula a mesma operação. A data precisa ser até 17/10/2026. Limites e pagamentos são separados por cartão. Não são solicitados número completo, validade, código de segurança ou conexão bancária.

**Nova recorrência** configura conta, categoria, valor, frequência mensal/semanal/anual, próximo vencimento e, opcionalmente, parcelas. **Gerar próximos lançamentos** cria pendências por até 12 meses a partir da próxima data, limitadas também ao fim das parcelas. Repetir um lançamento inicia a série na próxima ocorrência. Edição, pausa, retomada e exclusão ajustam as pendências futuras, preservando confirmados e ocorrências excluídas manualmente; a geração não duplica a mesma ocorrência. Pausar ou excluir cancela as pendências futuras geradas, sem apagar o histórico realizado. Cada ocorrência precisa ser confirmada em Lançamentos.

**Ajustar limite** permite definir o limite total do mês e limites opcionais por categoria. Eles são independentes: a soma das categorias não precisa igualar ou ficar abaixo do total. Categorias repetidas são rejeitadas. **Repetir por 12 meses** aplica a configuração ao mês escolhido e aos 11 seguintes. O consumo considera as despesas realizadas do período, incluindo compras no cartão uma vez.

**Nova meta financeira** recebe nome, valor desejado, prazo opcional e **Imagem da meta (opcional)**. O seletor reutiliza `App.media`: JPG, PNG e WebP de até 8 MB são preparados no navegador, com prévia, troca e remoção. A imagem só passa ao estado ao salvar; Cancelar/Escape descarta a edição. Imagens salvas participam da exportação local, sem upload. Editar título, alvo, prazo ou imagem preserva os aportes. Havendo várias metas, a Visão geral permite escolher a meta em destaque e Planejamento mostra todas.

**Adicionar valor** abre a prévia do aporte, a data e a conta de origem. Confirmar reserva o valor da conta e aumenta o progresso da meta, sem contar como despesa. Aportes futuros ou superiores ao saldo são rejeitados. A meta inicial **Viagem dos sonhos** demonstra **R$ 2.400,00 já reservados de R$ 6.000,00**, com imagem local existente; essa reserva inicial não é um novo débito nas contas nem uma transação criada nesta extensão. Metas novas começam sem reserva inicial.

Ocultar valores cobre resumo, gráfico, lançamentos, cartões, limites, metas e percentuais; a preferência é persistida. Os formulários de edição continuam mostrando os valores necessários à alteração, portanto essa opção é uma apresentação discreta, sem controle de acesso. Cada gravação aplica os dados e o histórico juntos. Falha de validação ou armazenamento restaura o estado anterior, conserva os campos e permite nova tentativa. O resumo do Início usa o mesmo modelo, e Restaurar exemplos recompõe a demonstração financeira.

A implementação está em `finance-model.js`, `finance.js/css`, `finance-cards.js/css` e `finance-goals.js/css`; `media.js` fornece as imagens locais. Direção, detector, capturas e revisão independente estão em `.impeccable/review/finance/`. A referência contém nove estados de interface, não nove rotas independentes. A extensão não implementa banco, juros, conciliação completa, estorno completo, importação ou movimentação financeira real.

## Hábitos: agendamento, imagens e desempenho — 21/10/2026

**Desempenho** apresenta barras de registros por dia, consistência e progresso por hábito. **Semana** e **Mês**, o campo de período e suas setas mudam essa análise. **Mostrar** filtra um hábito ou todos os hábitos da visão ativa; a escolha se aplica tanto ao desempenho quanto à rotina. A rotina tem navegação semanal própria, de segunda a domingo, com **Esta semana** para retornar. **Arquivados** troca a coleção consultada e **Ver ativos** retorna. Períodos inválidos restauram a seleção anterior, mantêm o foco no campo e explicam a correção.

O onboarding e **Novo hábito/Editar hábito** usam o mesmo contrato: **Todos os dias** (`daily`), **Dias específicos** (`weekdays`, pelo menos um dia) ou **Meta semanal** (`weekly_target`, inteiro de 1 a 7). Na etapa inicial, Frequência fica visível e revela somente os dias ou a quantidade pertinentes. Dias escolhidos e meta permanecem no rascunho após voltar, trocar tema ou recarregar. **Continuar** prepara um hábito válido ainda não adicionado; uma programação incompleta também bloqueia o avanço pelo resumo. **Acessar meu painel** transfere a frequência preparada ao módulo. Hábitos novos começam na data da demonstração, **17/10/2026**.

Na rotina, cada dia indica registro, disponibilidade ou impedimento. Dias futuros, anteriores ao início ou fora da programação não aceitam novas marcações; hábitos pausados e arquivados ficam sem registro ativo. Registrar ou desmarcar atualiza a análise, o Início e o histórico de atividades a partir dos mesmos dados. A mudança só informa sucesso depois de salvar. Se a gravação falhar, criação, edição, marcação ou alteração de estado restauram os dados e o histórico anteriores; o formulário mantém os campos para nova tentativa.

O cálculo de consistência exclui datas futuras, dias anteriores ao início e dias sem prática prevista durante pausa ou arquivamento. A meta semanal limita o crédito em cada semana de segunda a domingo; num período parcial, usa até a quantidade de dias disponíveis, sem frações proporcionais. As barras mostram os registros efetivos, mesmo quando ultrapassam a meta; a consistência limita o crédito à meta. O progresso da rotina compara o realizado até hoje com o planejamento da semana inteira, incluindo os dias futuros programados. **Ver registros por dia** oferece os dados do gráfico em tabela e **Como é calculado?** explica o cálculo. Sem práticas previstas, aparece uma indicação textual, sem percentual artificial.

Os exemplos contêm **14 registros salvos em outubro**, sobre **51 práticas previstas até 17/10**, portanto **27%** na visão mensal inicial de todos os hábitos ativos. Os 40 registros de 51 práticas ilustrados na referência não foram acrescentados ao histórico. Cada marcação válida conta uma única vez. Datas de calendário são tratadas pelo modelo compartilhado, sem usar o relógio atual do computador para mudar o dia da demonstração.

Editar a frequência vale a partir de hoje. `scheduleHistory` conserva a programação anterior; `activityHistory` conserva os períodos anteriores às mudanças de pausa/arquivo. `scheduleExceptions` permite preservar e desfazer uma marcação já existente no dia da mudança quando a nova frequência deixa esse dia fora da programação. Dados legados sem histórico de pausa não recebem retrospectivamente a pausa atual. A extensão não apaga nem reescreve os registros anteriores para ajustar as métricas.

**Imagem do hábito (opcional)** permite adicionar, trocar ou remover JPG, PNG ou WebP de até **8 MB**. O componente de mídia prepara e comprime a imagem localmente; a prévia só entra no estado após **Criar hábito** ou **Salvar alterações**. Cancelar ou fechar com Escape descarta a edição. Arquivo inválido conserva a imagem anterior; falha ao salvar mantém a edição disponível. Imagens personalizadas salvas participam da exportação, sem envio a servidor. Sem imagem, a rotina mostra um ícone neutro.

No Início, **Pequenos hábitos** compartilha essas mesmas imagens em miniaturas de **44 × 44 px**; imagens removidas, ausentes ou que falham ao carregar deixam o ícone do hábito visível.

Quando a propriedade `image` ainda não existe, os exemplos `h1`, `h2` e `h3` recebem, respectivamente, `project-learning.png`, `habit-movement.png` e `project-workspace.png`, em `assets/covers/`. Uma imagem personalizada ou uma remoção explícita prevalece. Leitura e planejamento reutilizam imagens originais já presentes; a fotografia de caminhada foi gerada para esta extensão, com origem e prompt em `assets/covers/habit-movement.png.json`. Nenhuma fotografia foi extraída da referência.

Implementação em [habits-model.js](habits-model.js), [habits.js](habits.js) e [habits.css](habits.css), com o seletor de imagens de [media.js](media.js), a programação em [onboarding.js](onboarding.js) e sua apresentação em [onboarding.css](onboarding.css). A direção e as evidências ficam em `.impeccable/review/habits/`. A grade mantém sete dias por hábito no celular; o escopo não inclui sequências completas, mapa de calor, sincronização ou backend de produção.

## Apresentação pública, checkout e perfil — 20/10/2026

Abrir `index.html` sem hash mostra Conheça, inclusive após concluir o onboarding. Links diretos como `#/inicio`, `#/capturar` e `#/calendario` continuam abrindo seus módulos. A apresentação conserva título em duas linhas, índice discreto, interface ampla, faixa inversa e capítulos alternados de `/conheca`, com menos texto. As 14 capturas locais em `assets/showcase/` mostram Início, Capturar, Calendário, Projetos e Kanban nos dois temas, incluindo variantes móveis de Início e Calendário; `provenance.json` registra a origem. A alternância Projetos/Kanban troca somente a prévia.

A oferta demonstra **acesso integral por R$ 29,90/mês**. **Assinar agora** abre `#/checkout`; a cobrança nesta simulação é **R$ 0,00**. **Preencher exemplo** prepara dados fictícios, mantendo os dois aceites desmarcados. O cartão aceito é `4242 4242 4242 4242`, com código `123` e validade futura em MM/AA. Campos inválidos recebem orientação e foco; **Ler** abre cada texto legal em diálogo, preservando o formulário ao voltar.

**Confirmar assinatura simulada** salva o registro local da simulação, e-mail e versões/data dos aceites; número do cartão, validade e código não entram no estado salvo. Uma nova rodada de onboarding recebe o nome informado e substitui seu rascunho anterior, sem apagar coleções, preferências ou foto de perfil. As etapas são opcionais; **Fazer depois** ou **Explorar por conta própria** levam ao painel. Falha de armazenamento restaura o estado anterior e conserva o formulário para nova tentativa. Não há conta, cobrança, processador de pagamentos ou ativação real.

O avatar do topo e o perfil da lateral abrem **Configurações > Seu perfil**. Iniciais são o padrão. **Escolher foto**, **Trocar foto** e **Remover foto** alteram a prévia; **Salvar perfil** aplica nome e imagem às duas posições. JPG, PNG e WebP de até 8 MB são preparados no navegador em recorte central quadrado de até 320×320 px, salvo como JPEG local. Salvar fica indisponível durante o processamento. Trocar tema ou recolher a lateral conserva a prévia; recarregar sem salvar a descarta. Arquivo inválido conserva a foto anterior; falha de persistência restaura o perfil salvo e permite tentar novamente com a prévia. Remover e salvar recupera as iniciais. A exportação inclui a foto salva, sem upload externo.

`#/termos` e `#/privacidade` são acessíveis pela apresentação e por Configurações. Os textos são cópias fiéis da **minuta v0.2 do PR #70**, head `b67f58ac3973fcef5f45daa23f36cdf84432a3fb`, aberto/draft na consulta de 20/10/2026, preservando avisos de revisão e contratação futura. Não são termos aprovados para uma assinatura ativa. O PR #69 fundamenta o preço planejado. Fontes e textos completos acompanham `references/public-flow/`, em `fontes.json`, `termos.md`, `privacidade.md`, `source-pr69/`, `source-pr70/` e `conheca-source/`. Links externos de origem podem exigir rede; o protótipo funciona offline.

O polimento removeu o parágrafo redundante de Configurações e corrigiu os espaços dos títulos móveis. Marca, Geist, DS 2.1, frontmatter e sidecar permanecem preservados. Evidências e limites estão em `VALIDACAO.md` e `.impeccable/review/public/`. Não houve novo PR ou deploy.

## Capturar com lista lateral e editor amplo — 20/10/2026

A rota Capturar reúne **Suas capturas**, busca por título ou trecho, filtros **Entrada**, **Organizadas** e **Todas**, e o documento selecionado. Cada item mostra tipo, data, título, trecho e situação; alterações pendentes recebem uma indicação. **Nova captura** abre um documento com título obrigatório e tipo Ideia, Tarefa, Nota ou Lembrete. A lista e a escrita aparecem lado a lado no desktop. Até **1000 px de viewport**, a tela alterna entre lista e editor; **Capturas** retorna à lista sem descartar o texto em edição.

A barra permite escolher **Parágrafo**, **Título**, **Subtítulo** ou **Citação**; aplicar negrito, itálico, sublinhado e tachado; criar listas com marcadores ou numeradas; alinhar à esquerda, ao centro ou à direita; inserir, editar ou remover links; limpar formatação; e desfazer/refazer. O título do documento continua separado dos títulos dentro do texto. A seleção de texto é preservada ao usar as ferramentas. Desfazer e refazer usam o histórico de edição do navegador, sem criar um arquivo persistente de versões.

**Salvar captura** aplica título, tipo, texto simples e HTML sanitizado ao armazenamento local. **Ctrl/Cmd+S** salva o editor principal de Capturar quando não há diálogo aberto. O status distingue **Alterações não salvas** de **Salvo neste navegador**. No editor principal, rascunhos por captura permanecem apenas em memória ao escolher outra captura, mudar de rota, alternar tema ou recolher a navegação. **Descartar alterações** restaura a versão salva; um documento novo volta a ficar vazio. Recarregar ou fechar a página sem salvar perde os rascunhos. O aviso de saída depende do navegador e não é uma forma de recuperação.

**Virar tarefa** e **Levar para Conhecimento** salvam a captura antes de abrir o formulário do destino. Cancelar esse formulário mantém a captura salva, sem criar o destino ou marcá-la como organizada. Confirmar cria um único destino e conserva a origem: Conhecimento recebe a formatação; a descrição da tarefa recebe texto simples legível. A captura organizada passa a leitura, com **Abrir nota** ou **Abrir tarefa**; a edição continua no destino. A consulta da origem também conserva a formatação original. Se o armazenamento falhar, dados e histórico envolvidos na operação voltam ao estado anterior, o texto permanece no editor ou diálogo e a pessoa pode tentar salvar novamente.

O componente de texto formatado também atende à captura rápida e à edição de páginas que já possuem HTML em Conhecimento. Notas e capturas legadas em texto simples continuam compatíveis; não é necessário restaurar exemplos. Referências `[[nome da página]]`, backlinks e renomeação continuam funcionando com o texto das notas, inclusive quando misturado à formatação.

Dentro da área de texto, **Ctrl/Cmd+K** abre a edição de link; fora dela, o atalho continua abrindo a busca global. Links aceitam endereços `https://`, `http://` e `mailto:` válidos. **Cancelar** ou **Escape** fecha e limpa a entrada do link, inclusive inválida, sem impedir o salvamento da captura. Colagem e serialização reduzem o HTML aos elementos de formatação permitidos; scripts, imagens, incorporações, atributos de evento e URLs não permitidas são removidos. Arrastar conteúdo para o editor insere somente texto. Esses limites pertencem ao editor local; não há backend, colaboração ou anexos.

Implementação em [capture.js](capture.js), [capture.css](capture.css), [richtext.js](richtext.js) e [richtext.css](richtext.css), integrada a [app.js](app.js) e carregada por [index.html](index.html). O contrato está em [capture-editor.md](.impeccable/surfaces/capture-editor.md). Claro e escuro usam a mesma identidade; os tokens, o frontmatter de DESIGN.md e `.impeccable/design.json` permanecem inalterados.

## Tarefas em Lista ou Kanban — 20/10/2026

A aba Tarefas oferece **Lista** e **Kanban** como duas representações dos mesmos registros. Sem preferência anterior, abre em Lista. A escolha fica salva separadamente no armazenamento deste navegador; se o navegador não permitir salvá-la, a visão escolhida continua disponível durante a sessão e a interface informa a limitação. Alternar as visões conserva a busca, o filtro de projeto, a situação e a ordenação atuais.

O quadro reúne três colunas: **A fazer** (`todo`), **Em andamento** (`doing`) e **Concluídas** (`done`). Cada cabeçalho apresenta a quantidade de tarefas visíveis; uma coluna sem resultados explica que não há tarefas naquela etapa com os filtros atuais. Os cartões exibem projeto, título, categoria, prioridade, prazo e indicação de nota relacionada quando existente. Abrir o título usa o diálogo de detalhes já disponível na lista, com os mesmos vínculos e ações.

No desktop, arrastar pelo ícone do cartão para outra coluna altera o estado. O seletor **Estado** no rodapé oferece a mesma mudança por teclado ou toque, além de permitir arquivar. O arraste não define uma ordem manual: dentro de cada coluna, os cartões seguem a ordenação compartilhada por prazo ou prioridade. Em dispositivos de toque, o seletor é a forma de mudar o estado; o quadro usa rolagem horizontal para percorrer as colunas.

**Nova tarefa** no fim de uma coluna abre o formulário existente com aquele estado e, quando há um projeto selecionado no filtro, com esse projeto preenchido. O botão geral de nova tarefa mantém seu comportamento anterior. Os filtros Todas, Hoje, Abertas e Concluídas também se aplicam ao quadro. Uma tarefa pode deixar de aparecer depois de uma mudança que não corresponda ao filtro ativo; isso não a exclui.

**Arquivo** apresenta uma única coluna de arquivadas. Alterar o Estado do cartão retira a tarefa do arquivo e a devolve à etapa escolhida. **Lixeira** apresenta uma única coluna com a ação **Restaurar tarefa**; a restauração remove a marca de exclusão e conserva o estado anterior. Arquivo e Lixeira não oferecem arraste ou criação no fim da coluna. Busca, projeto e ordenação continuam disponíveis.

Mudar o estado pelo quadro salva a tarefa e a entrada de histórico na mesma operação. Se o armazenamento falhar, ambos voltam ao estado anterior e a interface avisa que a mudança não foi salva. Após mover, o foco vai ao seletor da tarefa, ao cabeçalho da etapa de destino quando a tarefa sai do filtro, ou à coluna disponível. A posição de rolagem é preservada quando o controle continua visível; caso contrário, o quadro ajusta a rolagem horizontal e a página ajusta a vertical apenas para revelá-lo, entre o cabeçalho e a navegação fixa. As mudanças bem-sucedidas aparecem também na lista, no Início e no progresso do projeto, por compartilharem os mesmos dados.

Implementação em [kanban.js](kanban.js) e [kanban.css](kanban.css), integrada a [app.js](app.js). A extensão mantém o design system existente e não inclui colunas personalizadas, limites de trabalho em andamento, reordenação manual ou colaboração.

## Calendário lateral, lista e participantes — 20/10/2026

Sem preferência explícita de visualização, o Calendário abre em **Lista**. Uma preferência já salva, inclusive **Semana**, continua sendo respeitada. **Configurações > Preferências > Visualização inicial da agenda** oferece Lista, Dia, Semana e Mês. Alternar as quatro visões mantém a data e as fontes selecionadas.

A Lista mostra os compromissos da data selecionada até o fim daquele mês, em ordem cronológica, com eventos de dia inteiro antes dos horários de cada data. Cada página contém até **cinco eventos**; o rodapé informa a faixa exibida, o total e a página atual. Escolher outra data ou mudar o conjunto de fontes reinicia a paginação. **Ver mês completo** seleciona o primeiro dia do mês. As setas do período avançam ou recuam para o início de outro mês; navegar apenas no minicalendário não muda a lista até que uma data seja escolhida. **Hoje** retorna a 17/10/2026, data fixa da demonstração.

Um evento de vários dias aparece **uma única vez** na Lista. Se já começou e ainda está em curso na data selecionada, recebe essa data de exibição e a indicação **Em andamento**, com o intervalo original. Eventos de dia inteiro mantêm a data final exclusiva: o dia de término não é contado como dia ocupado. Eventos com horário que terminam à meia-noite também não ocupam o dia do término.

Quando há espaço, o seletor fica à esquerda, seguido por até dois **Eventos anteriores** encerrados antes da data selecionada, as fontes e a conexão demonstrativa. No celular e em contêineres do calendário de até 900 px, a lateral cede lugar ao botão de data acima da Lista. Esse botão expande o seletor; escolher uma data o recolhe e devolve o foco ao controle. Os filtros continuam acessíveis pelo botão de calendários. As visões Dia, Semana e Mês conservam suas representações descritas abaixo.

Grupos de dois ou mais participantes aparecem como rostos na Lista principal, na agenda diária e nas prévias de Eventos anteriores. São exibidos até quatro avatares e, quando necessário, **+N**; os nomes completos ficam disponíveis no rótulo acessível do grupo e no painel de detalhes. Os detalhes também mostram participantes individuais. Nomes são normalizados e escapados para exibição; imagens aceitam somente caminhos locais permitidos ou dados base64 de JPEG, PNG e WebP permitidos pelo módulo. Iniciais substituem fotos ausentes, rejeitadas ou que falhem ao carregar.

Os participantes demonstrativos são associados apenas aos quatro exemplos com **ID e título originais**, sem escrever nos registros: `e1` — Revisão do Segundo Cérebro, `e6` — Conversa sobre o produto, `e10` — Apresentação do projeto e `e13` — Grupo de leitura. Ana Lima, Rafael Costa e Marina Alves formam os grupos conforme o evento; são personagens fictícios, identificados nos detalhes. Seus retratos foram gerados com image_gen e acompanham `assets/avatars/`, com prompt e origem nos arquivos `.png.json`. A propriedade explícita `participants` sempre prevalece, inclusive quando contém `[]`; eventos novos ou renomeados não recebem pessoas automaticamente. Não há consulta a contatos, OAuth ou integração real.

Implementação em [calendar.js](calendar.js), [calendar-list.css](calendar-list.css), [calendar-people.js](calendar-people.js) e [calendar-people.css](calendar-people.css), com carregamento local em [index.html](index.html) e opção de preferência em [life.js](life.js). O contrato está em [calendar-events-list.md](.impeccable/surfaces/calendar-events-list.md). A extensão preserva o armazenamento e os dados pessoais existentes, os tokens globais e o caráter somente leitura dos eventos Google.

## Início e Calendário adaptados a desktop e celular

O Início reúne a primeira tarefa aberta do dia e os indicadores de tarefas concluídas e hábitos do dia. “Concluir tarefa” atualiza o mesmo registro usado no gerenciamento de tarefas. “Seus projetos” mostra até três projetos em andamento, abre o contexto de cada um e oferece “Ver todos”. O progresso considera tarefas não apagadas e não arquivadas do projeto; projetos sem tarefas são identificados. Se não houver projetos em andamento, a interface oferece criar um projeto.

No desktop, os projetos aparecem em colunas. Até 600 px, o trilho horizontal permite percorrê-los por rolagem nativa, mantendo parte do próximo cartão visível. Tarefas, agenda, hábitos e demais resumos continuam acessíveis abaixo. A navegação inferior contém Início, Tarefas, Capturar, Agenda e Mais, com captura central e rótulos preservados. Buscar fica disponível no cabeçalho móvel; Mais abre os demais módulos no menu existente.

| Visão do Calendário | Desktop, acima de 680 px | Celular, até 680 px |
|---|---|---|
| Dia | Agenda linear da data selecionada, com coluna de horários | Faixa de sete dias e agenda apenas do dia selecionado |
| Semana | Grade temporal de sete dias, com sobreposições e faixa de dia inteiro | Faixa de sete dias e agenda apenas do dia selecionado |
| Mês | Grade mensal com compromissos e acesso aos itens excedentes | Seletor mensal de datas e agenda apenas do dia selecionado |
| Lista | Até cinco eventos por página, da data selecionada ao fim do mês; seletor lateral quando há espaço | Mesma lista paginada, com seletor de data expansível |

Selecionar um dia na faixa ou no seletor mensal preserva a visão atual. As setas deslocam um dia em Dia, sete dias em Semana e um mês em Mês/Lista; Hoje retorna a 17/10/2026, data fixa da demonstração. Dias com compromissos possuem indicador, e o nome acessível inclui a data e a quantidade de itens. Seleção e Hoje têm estados distintos. Em larguras muito pequenas, os seletores usam rolagem horizontal interna para conservar os alvos de 44 px. O ajuste mantém a data selecionada visível sem tomar o foco ou rolar a página.

Na agenda linear, tocar um compromisso expande ou recolhe seu contexto. Apenas um fica expandido por vez; ao mudar de dia, o primeiro com contexto disponível recebe destaque, ou o primeiro compromisso quando nenhum possui contexto. Texto e local vêm do registro ou da nota vinculada; os rostos seguem as regras explícitas de participantes descritas acima. “Ver detalhes” abre o painel completo, que mantém a criação de tarefa relacionada; “Abrir nota” ou “Criar nota” usa o mesmo vínculo existente. Eventos de dia inteiro aparecem antes dos horários e preservam a data final exclusiva.

O minicalendário e as fontes permanecem na lateral quando há espaço. Até 900 px de largura do contêiner do calendário, essa lateral cede espaço e as fontes seguem acessíveis por botão; na Lista, a data continua acessível no seletor expansível. Desmarcar uma fonte afeta também a agenda do Início. Dia ou período vazio oferece escolher outra data ou revisar calendários. Ocultar todas as fontes mantém uma mensagem explicando o estado. Redimensionar a tela adapta a representação sem trocar a data, a visão ou as fontes selecionadas.

Implementação em [app.js](app.js), [devices.css](devices.css), [calendar.js](calendar.js) e [calendar-device.css](calendar-device.css). A direção visual e a origem das duas imagens estão em [DESIGN.md](DESIGN.md) e [mobile-devices.md](.impeccable/surfaces/mobile-devices.md). Não foram acrescentadas conexões reais, edição de eventos Google ou funções de colaboração.

## Capas dos projetos e imagem do destaque — 19/10/2026

“Novo projeto” e “Editar projeto” oferecem o campo opcional “Capa do projeto”. A imagem salva aparece acima do conteúdo nos cartões do Início, na lista de projetos e no detalhe do projeto. Projetos criados pela pessoa, inclusive no onboarding, continuam sem capa até uma escolha. “Usar paisagem” seleciona o ativo incluído; “Remover” deixa o projeto sem imagem. A alteração depende de “Salvar projeto”; cancelar o diálogo descarta a prévia e os demais campos em edição.

Em 20/10/2026, os três projetos de exemplo passaram a receber capas demonstrativas: mesa de trabalho para Segundo Cérebro, livros para Aprender com intenção e paisagem para Uma rotina mais leve. As mesmas capas aparecem no Início, na lista e no detalhe. As fotografias originais acompanham a pasta `assets/covers`, com prompt e origem nos arquivos `.png.json`.

Ao abrir uma versão anterior, apenas os exemplos com ID e título originais e sem propriedade de capa recebem a imagem. Capas personalizadas, remoções explícitas, projetos renomeados e projetos novos são preservados. A atualização não exige restaurar a demonstração nem apagar os dados do navegador. “Restaurar exemplos” passa a recuperar também as três capas demonstrativas.

Em **Configurações > Imagem do destaque do dia**, a pessoa escolhe o fundo da próxima ação no Início. A paisagem incluída é o padrão inicial. “Trocar imagem”, “Remover” e “Restaurar padrão” atualizam apenas a prévia; “Salvar imagem” aplica a escolha. Remover e salvar mantém o destaque sem foto nas próximas aberturas. “Ver no Início” apenas navega, sem salvar. O fundo não altera a tarefa priorizada, os indicadores ou suas ações.

Os dois campos aceitam **JPG, PNG ou WebP de até 8 MB**. O preparo verifica o arquivo e sua decodificação, recusa imagens maiores que 60 milhões de pixels e gera uma versão JPEG reduzida, dentro de 1600 × 1000 px, com compressão adicional quando necessária. Transparências são preenchidas com branco. O arquivo original não é alterado. A seleção mais recente substitui a anterior; remover uma prévia também cancela uma preparação pendente.

A imagem só entra no estado compartilhado após salvar. Trocar tema ou recolher a navegação preserva a prévia do formulário, mas navegar para outra tela, cancelar ou recarregar a descarta. Arquivo inválido conserva a imagem anterior na prévia e apresenta a correção necessária; o salvamento espera a imagem ficar pronta e válida. Se o armazenamento estiver indisponível ou cheio, o fluxo reverte a alteração dos dados e do histórico, mantém o formulário aberto e permite tentar uma imagem menor, usar a paisagem ou remover a imagem antes de salvar novamente.

As imagens personalizadas ficam no armazenamento deste navegador, sem envio externo ou vínculo ao módulo Arquivos. A exportação da demonstração inclui as imagens salvas; restaurar os exemplos remove as personalizações. Copiar a pasta não transporta o armazenamento local. A paisagem padrão acompanha o pacote em [focus-landscape.png](assets/covers/focus-landscape.png), com prompt e origem em [focus-landscape.png.json](assets/covers/focus-landscape.png.json).

Implementação compartilhada em [media.js](media.js) e [media.css](media.css), integrada a [app.js](app.js) e [life.js](life.js). Os tokens globais do DS 2.1 permanecem; o destaque com foto usa uma camada escura e texto claro nos dois temas para preservar a leitura.

## Onboarding inicial

O onboarding é acessado por `#/onboarding`, após o checkout simulado ou pelas ações de primeiros passos do painel e de Configurações. Sem hash, a entrada abre Conheça; `#/inicio` abre diretamente o painel. A apresentação possui **nove telas**: boas-vindas, sete etapas opcionais e resumo. Uma rota de módulo acessada diretamente continua navegável. Não é necessário preencher dados ou conectar recursos para explorar o painel.

A simplificação solicitada concentra cada etapa em uma ação, dentro de uma coluna de até 560 px. O progresso é discreto e “Ver etapas” abre a navegação quando necessário. Detalhes secundários de configuração começam recolhidos; a frequência do hábito fica visível e seus controles específicos aparecem conforme a escolha. A apresentação não contém sidebar, prévia decorativa ou blocos de benefícios.

| Tela | Propósito e escolhas disponíveis |
|---|---|
| Boas-vindas | Apresentar planos, rotina e ideias em uma frase. Oferecer “Começar” e “Explorar por conta própria”. |
| 1. Seu nome | Nome ou apelido. “Definir meu foco” revela as opções Trabalho, Estudos, Vida pessoal e Um pouco de tudo. |
| 2. Sua agenda | Selecionar até duas contas Google fictícias, sem login nem sincronização real. Fontes Pessoal, Estudos e Trabalho permanecem somente leitura. |
| 3. Um hábito | Informar o nome e escolher Todos os dias, Dias específicos ou Meta semanal de 1 a 7. A escolha revela os dias ou a quantidade pertinente. |
| 4. Um projeto | Informar um plano. “Ajustar detalhes” permite escolher Pessoal, Trabalho ou Estudos. |
| 5. Uma tarefa | Informar a próxima ação. “Ajustar detalhes” revela vínculo a projeto e prazo hoje na demonstração ou sem prazo. |
| 6. Suas notas | Nomear um caderno. “Adicionar uma primeira nota” revela título e texto; outro detalhe permite vinculá-la a um projeto. |
| 7. Outros espaços | Apresentar Financeiro, Arquivos e Cofre em três detalhes independentes, inicialmente fechados. “Concluir” abre o resumo. |
| Resumo | Mostrar apenas as escolhas preparadas, em linhas compactas. “Revisar escolhas” revela as etapas; “Acessar meu painel” aplica a configuração. |

“Voltar” e “Ver etapas” permitem revisar escolhas. “Pular” aparece quando a etapa não possui escolhas ou título em edição; depois de preencher, “Continuar” preserva a intenção configurada. Nos passos de hábitos, projetos e tarefas, o título digitado é adicionado ao rascunho antes de avançar. Após adicionar, a lista substitui o formulário e “Adicionar outro” permite preparar mais itens, até cinco por módulo em cada rodada. Nomear o caderno habilita sua preparação; limpar seus campos permite pular. Não há campos obrigatórios globais; as validações protegem os registros que a pessoa decide criar.

“Fazer depois” e “Explorar por conta própria” pausam o fluxo e abrem o Início. Um banner no painel e uma ação em Configurações retomam a etapa guardada. O rascunho inclui campos ainda não adicionados e persiste neste navegador, quando o armazenamento está disponível. Trocar tema, voltar ou recarregar não aplica o rascunho aos módulos. Sem armazenamento, a mensagem distingue continuidade da sessão de salvamento durável.

Antes de abrir o resumo, o fluxo prepara títulos pendentes de todas as etapas e valida caderno e nota, inclusive quando a pessoa navegou diretamente por “Ver etapas”. Um erro retorna à etapa correspondente e abre o detalhe do campo. O rascunho usa versão 2; a migração da versão anterior preserva os dados e IDs e remapeia o antigo resumo da etapa 7 para 8.

“Acessar meu painel” no resumo adiciona as escolhas ao estado compartilhado. Preserva exemplos e registros existentes, atualiza apenas as preferências preenchidas e leva ao Início. Hábitos, projetos e tarefas ganham IDs estáveis no rascunho e não são reaplicados com o mesmo ID. Títulos repetidos na lista preparada são recusados; uma nota com título de página já existente também é recusada, sem diferenciar maiúsculas e minúsculas. Cadernos existentes com o mesmo nome são reutilizados. Isso não impõe unicidade global aos nomes de hábitos, projetos ou tarefas em rodadas diferentes.

Após concluir, `#/inicio` continua abrindo o painel; abrir `index.html` sem hash mostra Conheça. Configurações oferece “Rever configuração”, com o resumo do que foi concluído. Essa revisão não reaplica os dados nem sobrescreve mudanças posteriores. “Configurar mais recursos” inicia uma nova rodada explícita de adições. O resumo representa a rodada concluída, não um contador de todos os registros do ambiente.

Google continua limitado a duas contas fictícias no total: contas já disponíveis são identificadas e preservadas, e pular a etapa não remove conexões existentes. Arquivos é uma apresentação conceitual sem upload ou módulo próprio. O onboarding não solicita senha, credenciais reais, dados financeiros nem segredos do Cofre.

Implementação em [onboarding.js](onboarding.js) e [onboarding.css](onboarding.css), com integração ao estado e à navegação existentes. A documentação da superfície está em [onboarding.md](.impeccable/surfaces/onboarding.md). A extensão usa a mesma marca, Geist, paleta e componentes do protótipo; a escala introdutória maior das boas-vindas é local, sem alterar o design system global.

## Regras preservadas e limites da simulação

- A data de referência é **17/10/2026**. Os registros iniciais são fictícios e usam datas coerentes. Não são métricas, compromissos ou saldos pessoais atuais.
- Calendário Google é **somente leitura**. As ações em um compromisso criam ou abrem contexto no Segundo Cérebro; não criam nem editam eventos no Google. Fonte desmarcada ou conta de exemplo removida deixa de alimentar a agenda e o Início.
- Hábitos não aceitam marcações futuras nem anteriores ao início. Frequência, pausa e arquivo preservam o histórico datado. A grade mostra uma semana; o desempenho permite consultar semanas e meses. Isso não representa todo o motor de sequências, planejamento de pausas futuras ou mapa de calor do produto.
- Dinheiro usa centavos inteiros. Compra no cartão cria dívida sem saída imediata de caixa; o fechamento atribui a fatura das novas compras, preservando os ciclos legados. Pagar a fatura reduz conta e dívida na mesma operação, sem duplicar a despesa. Recorrências geram pendências por até 12 meses. Limite mensal e limites de categoria são independentes; juros e estornos completos não são simulados.
- A exclusão de um lançamento o retira dos totais locais. Confirmado, Pendente e Cancelado são demonstrados, mas o protótipo não oferece conciliação completa, gestão completa de contas, lixeira financeira ou transferências livres entre contas. Aportes reservam caixa sem se tornar despesa.
- O Cofre usa apenas exemplos fixos. **Não há criptografia, senha mestra, kit de recuperação ou formulário para receber segredos.** Bloqueia manualmente, ao sair da área, ocultar a aba ou perder o foco. O navegador pode negar a cópia; o feedback informa isso. Nenhum segredo real deve ser inserido.
- Conexões, preferências de lembrete e sincronização são demonstrativas. Não há OAuth, acesso a Google, envio de notificação, comunicação com Supabase ou sessão autenticada.

## Execução e persistência

Entrada: `index.html`. HTML, CSS, JavaScript, marca e fonte estão nesta pasta, sem build, pacote remoto ou servidor obrigatório. O protótipo não precisa de internet para renderizar suas superfícies.

A cópia canônica de trabalho permanece em `outputs/segundo-cerebro`, com o pacote `outputs/Segundo-Cerebro-Prototipo.zip`. O destino de entrega solicitado é `D:/USUÁRIOS/Kauan/TRABALHO/CÉREBRO - STARTUP (SEGUNDO CÉREBRO)/Prótotipos/Protótipo - Codex`, com entrada direta em `index.html`. A entrega em D: foi replicada e conferida por hash; os registros anteriores de indisponibilidade referem-se às respectivas revisões históricas.

As alterações da demonstração, as imagens escolhidas, o tema, a escolha da lateral expandida ou recolhida e a preferência Lista/Kanban são salvos no armazenamento local do navegador, quando permitido. A preferência Lista/Kanban é local à interface e não faz parte do arquivo exportado de dados. A exportação gera um arquivo dos dados locais da demonstração, incluindo imagens personalizadas salvas; não implementa exportação da conta de produção. “Restaurar exemplos” apaga somente as alterações desta demonstração após confirmação. O comportamento de `file://` e da área de transferência depende do navegador.

Em Capturar, somente o salvamento explícito inclui as alterações nos dados persistidos e exportáveis. Os rascunhos em memória do editor principal não sobrevivem à recarga; a persistência própria dos rascunhos do onboarding continua independente.

## Fora desta entrega

Drive, grafo persistente, IA, colaboração, cobrança real, Open Finance, importação OFX/CSV, escrita Google, CalDAV, Gmail/ClickUp, Web Push, administração de usuários e autenticação real. Alguns itens são futuros do produto; outros foram retirados do MVP. A ausência no protótipo não autoriza excluir dados ou estruturas históricas do repositório.

## Critério de qualidade

O protótipo deve manter o contexto entre módulos, dar feedback de ações, permitir corrigir entradas inválidas e apresentar estados vazios. Claro e escuro devem compartilhar a mesma navegação e semântica. O projeto usa foco visível, campos de 16 px, controles principais de 44 px e suporte a movimento reduzido. O sistema tipográfico diferencia corpo de 14 px, controles de 13 px e metadados de leitura de 12 px; indicadores e títulos têm escalas próprias. A agenda prioriza títulos e horários legíveis, preserva filtros e navegação de períodos e apresenta detalhes em painel lateral. Os tokens de controle separam bordas interativas dos divisores discretos. Busca e operações frequentes por teclado evitam espera visual. Esses princípios não equivalem a certificação completa de acessibilidade ou a aceite de produção.

O sistema visual e a rastreabilidade das nove imagens e das orientações originais dos quatro repositórios de skills estão em `DESIGN.md`. Este documento descreve comportamento e critérios, sem substituir a validação registrada da entrega; instruções operacionais ficam no arquivo de leitura.
