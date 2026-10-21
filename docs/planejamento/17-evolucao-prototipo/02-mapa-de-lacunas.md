# Mapa de lacunas e cobertura

Detalhes por arquivo/campo/fluxo estão nas três auditorias. Esta matriz é o índice de implementação, não uma lista de funcionalidades todas ausentes.

| Área | Já existe em main | Aplicar agora | Lote |
|---|---|---|---|
| Shell/temas | Retrátil, tooltips, drawer, temas Claro/Escuro/Sistema, motion, busca | Refinar distribuição desktop/mobile; avatar superior usando o mesmo arquivo de Configurações | E1 |
| Imagens | Upload privado avatar/captura, processamento/limpeza | Finalidades para capa de Projeto, Hábito, Meta e destaque do dia; vínculos autorizados e lifecycle | E1 + consumidores |
| Início/Projetos | Projeções reais, vínculos, progresso e CRUD | Fundo configurável, até três projetos com capa, imagens em Pequenos hábitos; atualizações compartilhadas | E1, E5 |
| Tarefas | Lista, filtros, estados reais e comandos | Kanban adicional; `doing` demo → `in_progress`; mover acessível sem perder lixeira/origem | E2 |
| Calendário/Integrações | Lateral, Dia/Semana/Mês/Lista, OAuth readonly, duas contas | Nova lista paginada por data, contexto recente, participantes e fallback; manter todos os modos/fontes | E3 |
| Capturar | Split view, texto, anexos, drafts por usuário, promoção | Documento formatado amplo, toolbar compartilhada, migração legada e conflito | E4 |
| Conhecimento | TipTap JSON, árvore, links/backlinks/versão/lixeira | Receber formatação integral da Captura; harmonizar UI sem reduzir capacidades | E4 |
| Hábitos | Daily/weekdays/weekly_target, pausas, marks e sequências | Histórico de cadência, imagem, desempenho semana/mês, filtros, mesma imagem no Início | E5 |
| Financeiro | Cinco abas, contas/cartões, estados completos, transferências/estornos/juros/lixeira | Composição painel+cartões+gráfico e lançamentos; metadados visuais do cartão, formulários completos | E6 |
| Planejamento financeiro | Plano total/categorias no core; série finita mensal | UI de limites, repetição finita, recorrências semanal/mensal/anual e lifecycle explícito | E7 |
| Metas | Não observadas na base | Entidade, imagem, destaque, reserva virtual por conta, aporte/liberação sem despesa | E8 |
| Landing/checkout | Landing com acesso fechado; comercial planejado #50–61 | Textos curtos, preço mensal R$29,90, imagens atuais, UI sobre contratos reais | E9 + #52–61 |
| Onboarding | Planejado #62–65 | Nove telas enxutas, cadência completa, drafts/recibos reais, pular/rever/retomar | E9 + #62–65 |
| Legais | Fontes no PR #70 | Integrar fonte única, links e retorno; revisar cobertura das novas informações | E9 |
| Cofre/Atividade/Busca | Domínios reais e isolamento | Regressão de navegação, temas, eventos; nenhuma substituição por demo | E10 |
| Configurações | Perfil, avatar, preferências, segurança/PWA | Fundo, links legais, imagem coordenada, opções do novo calendário e retomada onboarding | E1/E3/E9 |

## Conflitos resolvidos explicitamente

- **Financeiro quatro vs cinco abas:** seguir a composição de quatro áreas do protótipo e preservar gestão de Contas/Carteira e Categorias por caminhos visíveis, além dos deep links anteriores. O inventário de ações existentes é critério de aceite; simplificar navegação não pode eliminar operações.
- **Saldo da meta:** o protótipo deduz caixa ao aportar; o produto fará reserva virtual conforme resposta atual. Corrigir textos, totais e exemplos da implementação. Não portar o cálculo errado para a regra escolhida.
- **Histórico dos hábitos:** main reaplica a frequência atual no passado; a implementação passa a usar vigências. Para registros legados não há como reconstruir mudanças desconhecidas: registrar baseline explícito.
- **Recorrências:** demo tem entidade mutável e três frequências; main tem séries finitas mensais. Evoluir com comando finito e revisão do ADR 0006, sem cron ilimitado ou migração implícita de séries antigas.
- **Participantes com foto:** Calendar Events não oferece foto. Renderizar fonte autorizada se houver; caso contrário, iniciais. Retratos fictícios só no demo, sem nova permissão Google silenciosa.
- **Captura formatada:** demo usa HTML; produção usa documento JSON validado compartilhado com TipTap. Texto antigo jamais é interpretado como HTML.
- **Checkout:** copiar a composição, não campos PAN/CVV nem conclusão fictícia. Produção comprova e-mail e processa Asaas/ativação antes do onboarding.

## Prioridade

P0: preservar dados/acesso, contratos das reservas e cadência, uploads privados, compatibilidade editor e coordenação #52/#53. P1: fluxos completos por módulo e representação visual. P2: capturas finais, ajustes finos e fechamento das provas. Cada fatia já deve entregar responsividade e teclado; acessibilidade não fica para o último lote.
