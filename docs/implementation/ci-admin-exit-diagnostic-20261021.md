# Diagnóstico de término do processo Admin — 21/10/2026

Refs #52. O HEAD `a575893d84fbb73918c2e449f7cc9204d1713a0e` da PR #83 concluiu 15/16 checks com sucesso. A tentativa 1 do [run Admin 39553074409](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39553074409) falhou na etapa de execução isolada. A anotação informa exit code 1. Os logs disponíveis contêm Chromium BOUND, mas não o JSON final `admin-browser-local-ci` nem o fallback `REPORT_REFUSED`.

Leitura estática: `capture:false` consome, limita e descarta o texto do filho; isso explica poucos detalhes de Playwright/Supabase, mas não explica a falta do relatório pai. `main()` deveria imprimir o relatório retornado ou o fallback fechado. Não há prova de OOM, kill, erro de Chromium, falha de produto ou cleanup bem-sucedido. BOUND não localiza a fase funcional alcançada.

O wrapper Bash passa a imprimir uma única linha JSON fechada imediatamente após capturar `$?`, antes do `sleep`: versão fixa, cenário fixo `admin-node-exit` e código numérico do processo Node. A saída não contém argumentos, paths, ambiente, stderr, dados pessoais, credenciais ou erros livres. Preserva o status original mesmo se a impressão falhar e mantém o mesmo `sleep` e `exit`. Não há novo handler de exceptions/signals, replay de teste ou relaxamento de erro.

Essa linha distingue um retorno observado pelo wrapper da ausência desse checkpoint. Código zero não substitui o relatório funcional, os terminais originais ou a prova de quiescência. Um status não zero não identifica sozinho a causa; a relação com signals depende de evidência posterior. Se o caso não se reproduzir, o PASS do novo HEAD não explica nem apaga a falha histórica.

Também se reutiliza o delta sintético revisado de `ef53061`: relógio contextual de um único teste de autoridade, já aprovado na PR #84 com 408/408 controles nos dois runs Auth. Nenhuma feature comercial da PR #84 acompanha esse cherry-pick. Os deadlines reais, fonte finita 379/61, oráculos, cleanup, serviços descartáveis e todos os workflows permanecem. A nova rodada exige resultado próprio do seu SHA.

Validação local: revisão estática e diff-check, sem Node, testes, build, navegador ou serviços por restrição de RAM. A PR permanece draft, sem merge, deploy, mudança de plano ou SQL remoto. A regra Vercel da branch continua `false`. O diagnóstico não fecha #52 nem certifica a operação hospedada.
