# Aceite e validação

## Jornadas de ponta a ponta

| ID | Jornada | Prova mínima |
|---|---|---|
| J1 | Configurações → avatar/fundo → Início | Escolher/trocar/remover/cancelar/recarregar; mesma foto no topo/rodapé, fallback e contraste |
| J2 | Projeto → capa → Início → tarefa | Capa privada refletida; projeto excluído não apaga contexto; até três cards de dados reais |
| J3 | Lista → Kanban → Projeto/Início | Mesma tarefa; mudar estado por teclado/toque/arraste; erro/retry/idempotência/deep links |
| J4 | Google → data/fonte → lista → detalhe | 0/1/5/6+ eventos, fusos/all-day/cross-month, participantes omitidos, fallback, notas preservadas |
| J5 | Capturar → formatar → recarregar → Conhecimento/Tarefa | JSON round-trip, drafts por usuário, conflito, origem/anexos/links preservados; HTML perigoso rejeitado |
| J6 | Onboarding hábito → módulo → Pequenos hábitos | Dias/alvo iguais; imagem atualizada; registro proibido no futuro; vigência/pausa/métricas coerentes |
| J7 | Lançamento/cartão → fatura → pagamento → painel | Caixa/dívida/despesa uma vez; parcial/excedente/juros, competência e filtros preservados |
| J8 | Limites/recorrência → período/ledger | Total independente, repetição12 meses, âncora e finitude; retry/pausa/retomada não duplica |
| J9 | Meta com foto → aporte → liberação | Saldo/patrimônio intactos, disponível correto, concorrência/replay; imagem/cancelamento isolados |
| J10 | Conheça → checkout → pagamento/ativação → onboarding → Início | Contratos #52–#65; conta existente, e-mail, hospedado Asaas, pular/retomar/revisar, sem duplicações |
| J11 | Suspenso/sem direito → novas rotas/comandos/imagens | Negativas de #53 também nos novos dados; preferências/fotos não concedem direito |
| J12 | Busca/Cofre/Atividade/PWA/Configurações | Regressões existentes preservadas; Cofre não vaza em busca/eventos/screenshots; sem reativar Drive |

Todas as jornadas exigem falha/retry além de caminho feliz. Datas e números das imagens não são asserts de produção. Exemplos de regra no doc 03 tornam-se fixtures do Núcleo, não constantes da UI.

## Matriz visual e acessível

Capturas com rota, estado, SHA, viewport, tema e origem dos dados: 320/390/768/1024/1440px; claro/escuro e Sistema; sidebar expandida/recolhida onde cabe. Incluir vazio, carregamento, erro, conteúdo denso, rótulos longos, imagem ausente/corrompida e formulário inválido. Zero overflow global, sem clipping/overlap; componentes equivalentes com estados coerentes.

Teclado completo, foco visível e restaurado, Escape/Tab em diálogos, sem armadilha, nome/descrição/erro associados, texto de gráficos em tabela, não depender apenas de cor ou arraste, zoom200%, reduced-motion. Contraste medido nos fundos reais e sobre imagens: texto≥4,5:1; indicadores/interativos≥3:1 nos pares aplicáveis. Alvo≥44px e campo≥16px. Testes automatizados não substituem conferência visual/teclado.

## Camadas e comandos

As auditorias listam testes existentes por módulo. Acrescentar casos ao núcleo/contratos/adapters/SQL/E2E na camada que garante a regra; não criar teste que apenas espelha markup. Migrations novas exigem catálogo, comportamento, RLS A/B, atomicidade/recibo, downgrade de cliente e legacy fixtures. Gerar espelhos oficiais e conferir tipos; nunca executar fixtures destrutivas na base pessoal.

Comandos existentes do projeto: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:timezones`, `npm run check:layers`, `npm run check:design-system`, `npm run check:sql-editor`, `npm run test:scripts`, `npm run test:local-sql`, `npm run check:secrets`, `npm run build`, `npm run check:client-auth` e `npm run test:e2e`. Selecionar suites focadas durante implementação e cumprir checks obrigatórios de merge uma vez na integração; com memória limitada, executar sequencialmente. Reconsultar package.json da branch real antes de copiar comandos.

Após os deltas, medir RAM novamente e retomar os testes #52/#53 do checkpoint conforme doc04. CI só é verde quando o run do SHA publicado terminar com sucesso. Build local, screenshot ou deploy sem erro não prova homologação comercial #68 nem migration aplicada.

## Entrega por issue

Informar commit/PR, arquivos alterados, regra implementada, comandos e resultados reais, capturas e limites. Separar implementado/validado/pendente/bloqueado. A issue só fecha com todos os próprios critérios atendidos; não fechar épicos existentes pelo planejamento. O aceite visual alimenta #44 e a jornada comercial alimenta #68.

## Validação deste pacote documental

O resultado reprodutível está em `validacao-pacote.json` e `capturas/manifest.json`: hashes do snapshot, resolução dos assets HTML/CSS, sintaxe dos scripts e metadados das capturas. Evidências históricas ficam preservadas dentro de `prototipo/.impeccable/review/`, com datas/limites próprios. Não executar testes de produção ou declarar checks conectados aprovados apenas para publicar documentação.
