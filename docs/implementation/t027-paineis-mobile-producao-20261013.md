# Painéis de Configurações no layout móvel — 13/10/2026

O teste conectado na conta já autenticada em produção comprovou o quinto critério original de #34: **painéis com navegação interna e recolhíveis no mobile**. A raiz executou as ações e registrou [somente os resultados permitidos](evidence/settings-mobile-panels-production-20261013.json); o peer independente conciliou o literal e seus limites.

As seis âncoras chegaram a Perfil, Sessões, Aparência, Módulos, Lembretes e Meus dados. Em cada painel, Enter recolheu o conteúdo, conservou o foco no botão e Enter o reabriu. A raiz conferiu o elemento único indicado por `aria-controls`, conteúdo oculto após recolher e visível após reabrir. Os seis estados expandidos iniciais foram restaurados; nenhuma ação de salvar preferências, enviar avatar, alterar credenciais ou revogar sessões foi realizada.

O navegador solicitou viewport de 320 px, mas a largura CSS efetiva foi **388 px**, com scrollWidth também 388 e navegação móvel visível. Essa rodada comprova 388 px, sem transbordo horizontal. Não comprova 320/390 px efetivos ou aparelho físico, nem identifica o commit servido pela URL canônica. O override de viewport foi removido ao terminar.

A prova hermética original, `tests/e2e/issue34-settings-sql.spec.ts`, cobre em 320 px seis âncoras, Space/Enter, foco, conteúdo, temas e movimento reduzido, com ledger inalterado. A tentativa local de repeti-la recusou Windows no `beforeAll` exigindo Linux CI; não foi alterado o guard nem atribuído PASS local. O CI próprio de [74907f9](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38423605289), job 115387064660, concluiu as 27 etapas com sucesso, incluindo a execução E2E padrão em Linux. Este último é um registro de metadados do lote próprio, sem contagem individual extraída ou herança de runs anteriores.

A revisão automática recusou o screenshot por possível exposição de dados privados da conta. Não houve captura, nova tentativa ou contorno; a alternativa textual foi usada. A imagem não é um requisito desse literal. Tema entre desktop/celular e reordenação com recusa de essencial mantêm seus critérios separados; #34 continua aberta.
