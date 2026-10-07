# T-008–T-010 — integração da sessão de demonstração

Início, Capturar e Tarefas compartilham uma instância do adapter em memória, um relógio injetável e as mesmas entidades. As telas consultam o provider sob a guarda de acesso. Escritas chamam casos de uso do Núcleo, registram eventos e invalidam apenas as consultas afetadas; só os módulos com observadores ativos são consultados novamente.

## Massa e ciclo de vida

O dia ilustrativo do doc 14 é 23/09/2026, às 14h em São Paulo. A massa contém sete tarefas (cinco abertas e duas concluídas), sete notas (quatro organizadas e três na entrada), três hábitos e três compromissos nesse dia. As notas mantêm os IDs, títulos e corpos da referência DS 2.1. Datas de captura distinguem a ordenação do editor sem depender da ordem alfabética dos IDs.

O financeiro do Início já deriva da mesma massa que alimentará T-011: entradas de R$ 8.000,00, despesas de R$ 3.247,60, resultado de R$ 4.752,40, Itaú R$ 4.317,42, CDB R$ 18.500,00 e fatura Nubank R$ 2.412,80. Transferências são duas pernas vinculadas; o limite de R$ 8.000,00 segue o protótipo. Esses valores são exemplos calculados, sem dados pessoais ou conexão bancária.

Snapshots são cópias congeladas. A factory admite massa vazia, relógio/IDs e falhas injetadas. Consultas preservam estados explícitos de carregamento, erro e dados disponíveis; uma falha de leitura não vira lista vazia. Desativar a exibição de Projetos também retira a consulta de enriquecimento usada por Capturar/Tarefas. Preferência não revoga acesso direto a um módulo permitido.

Sair, inclusive por URL direta, limpa rascunhos daquele usuário, cancela o flush pendente do editor, descarta os bytes de imagens e a instância de dados e restaura a política demonstrativa. Não há autenticação real nesta fase. O tema permanece como preferência local.

## Revisão conjunta

Os três recortes foram implementados por agentes com ownership separado e revisados na integração. A revisão corrigiu categoria explicitamente vazia, chaves de rascunho que coincidem com propriedades herdadas de JavaScript, preservação de conteúdo longo ao editar tarefa convertida e consistência transacional da renomeação de wiki-links. A sessão não contém uma segunda coleção de tarefas ou notas específica de cada tela.

Impeccable local e doc 14 orientaram uma inspeção visual conjunta, seguida de um lote de correções e uma confirmação final. O botão fixo de salvar de Capturar segue a posição exigida pela referência; a composição não foi redesenhada. Contraste, alvos de toque, campos e ausência de overflow são verificados nos portões existentes.

## Evidência

Validação local em 07/10/2026:

- 525 testes de unidade e contrato passaram em cada fuso: UTC e America/Sao_Paulo (21 arquivos).
- Typecheck, lint, build de produção e fronteiras passaram: 127 módulos, 335 dependências, nenhuma violação. Impeccable 0.1.6 apresentou zero achados; 164 pares de contraste do DS passaram.
- Os 94 cenários E2E foram validados no Chromium. A primeira execução teve 90 aprovações e quatro falhas de teste: dois caminhos antigos para o catálogo visual, um seletor de alerta que incluía o anunciador de rota e uma espera que não confirmava a seleção da nota. Os três arquivos afetados foram corrigidos e seus 29 cenários passaram novamente sobre o mesmo build. Nenhum código de produto foi alterado para contornar as asserções.
- Incluem-se CRUD de tarefas no desktop/mobile, ida e volta do fuso no formulário, conversão captura→tarefa→origem, renomeação com vínculos, rascunho/reload/logout, entrada de imagens por três vias e saída reencodada sem EXIF. Os portões de overflow/alvos/campos passaram também nas novas telas.
- A confirmação visual final abrange Início, Capturar, Tarefas e Drawer em 1440px/claro e 390px/escuro. As oito [capturas de evidência](evidence/t008-t010/) foram inspecionadas. Sem novo defeito bloqueante; encerrada a rodada de refinamento.

O CI do commit será acompanhado no GitHub antes de fechar as issues #15, #16 e #17. Os relatórios por recorte detalham as regras: [Início](t008-inicio.md), [Capturar](t009-capturar.md) e [Tarefas](t010-tarefas.md). Esta evidência conclui as verificações de integração indicadas como pendentes nesses relatórios.

## Limites mantidos

Persistência entre dispositivos e autenticação pertencem a M2; anexos desta entrega ficam em memória, exceto metadados dos rascunhos locais. Nenhuma migration ou alteração em banco foi aplicada. Safari, leitor de tela e instalação em aparelhos físicos não são inferidos dos testes Chromium e continuam no aceite manual de T-005/release.
