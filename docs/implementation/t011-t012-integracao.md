# T-011/T-012 — Financeiro e demais módulos demonstrativos

O Financeiro passa a oferecer cinco abas conectadas à mesma sessão do Início. Calendário, Hábitos, Conhecimento, Projetos, Drive, Cofre e Configurações substituem o conteúdo provisório por navegação, dados e estados próprios. Esta entrega conclui o recorte de demonstração M1; autenticação, persistência e integrações continuam nos tickets seguintes.

## Integração e revisão

As frentes de interface foram delegadas e revisadas antes da integração. O provider único ganhou queries de conhecimento, projetos, arquivos, metadados do Cofre e perfil. Conhecimento lê as notas organizadas de Capturar; Projetos agrega apenas seções autorizadas e visíveis. A massa do Calendário inclui os mesmos três compromissos do Início e exemplos futuros, inclusive um evento de vários dias com fim exclusivo.

Configurações permite carregar uma coleção vazia e plantar uma falha real de leitura, recuperável por retry. O cenário substitui dados e rascunhos da visita, conservando a política de acesso. Não há conexão externa nem cópias financeiras privadas em cada tela.

Os comandos financeiros validam campos no Núcleo, conservam competência histórica de cartão, aplicam a normalização central de pagamento e gravam alteração, evento e recibo na mesma transação. Transferências e séries recusam alterações isoladas. Os testes cobrem rollback, idempotência, isolamento do dono, soft delete/restauração, limites monetários e troca de conta.

A revisão independente identificou que remover a preferência de privacidade em uma aba poderia revelar valores em outra. A sincronização agora reage somente às escolhas explícitas de ocultar/exibir; logout e limpeza do armazenamento não retiram uma máscara já ativa em outra aba. A regressão verifica esses casos com duas abas do mesmo contexto.

## Validação local — 07/10/2026

- 614 testes de unidade e contrato aprovados em cada fuso, UTC e America/Sao_Paulo, em 26 arquivos.
- Typecheck, lint, build de produção e regras de dependência aprovados: 152 módulos e 488 dependências, sem violação. DS 2.1 com 164 pares de contraste aprovados e Impeccable 0.1.6 sem achados.
- 130 cenários E2E validados no Chromium. Após o lote de correções, a execução completa aprovou 129; um teste esperava a nota errada como seleção inicial de Conhecimento. A expectativa foi corrigida para a coleção ordenada vigente e esse cenário passou sobre o mesmo build, sem alteração do produto.
- Na primeira execução, 118 de 126 passaram. Sete falhas vinham de seletores/expectativas dos testes: alertas globais incluíam o anunciador de rota e texto de pausa incluía o campo do diálogo fechado. O caso Drive revelou um separador CSS entrando no nome acessível do breadcrumb; a fonte foi corrigida com separador explicitamente decorativo. Foram adicionadas quatro regressões de privacidade e geometria.
- CRUD financeiro, máscara completa, URL/reload/voltar, cinco estados de fatura, coerência de totais, hábitos passados/pausa, leituras com erro/retry, cenários vazios, Cofre demonstrativo e navegação por pastas foram verificados. Os portões de overflow, campos e alvos passaram nas larguras previstas, em ambos os temas.

## Revisão visual encerrada

Impeccable local, D-030 e doc 14 orientaram uma inspeção conjunta de 28 capturas em desktop claro (1440px) e celular escuro (390px). Um único lote corrigiu a quebra de rótulos do mês financeiro e fixou dias, faixa de dia inteiro e horas durante a rolagem do Calendário. A confirmação final dessas superfícies foi inspecionada, sem novo defeito bloqueante. Não houve nova rodada de refinamento.

As 28 [capturas finais e medições](evidence/t011-t012/) registram cinco abas financeiras, formulário, grades semanal/mensal e sete módulos. O rodapé fixo nas capturas de página inteira ocupa a posição do viewport de origem; o conteúdo restante é alcançável por rolagem.

## Limites e acompanhamento

Os dados continuam em memória e recarregar restaura os exemplos. Drive contém metadados; Cofre é uma maquete sem criptografia e não aceita senha pessoal. Os formulários completos de produção e conexões pertencem a M2/M3. Nenhuma migration, seed, reset ou alteração de schema foi aplicada.

As issues #18 e #19 serão encerradas após confirmação do CI deste commit; o épico #3 acompanha o encerramento de M1. O aceite de instalação PWA em aparelhos reais continua separado em #12. Autenticação e isolamento real de banco não são inferidos da suíte demonstrativa.

Detalhes por recorte: [Financeiro](t011-financeiro.md), [Calendário/Hábitos/Conhecimento/Projetos](t012-content-shells.md) e [Drive/Cofre/Configurações](t012-drive-cofre-configuracoes.md). Este relatório substitui as pendências de validação integrada desses documentos.
