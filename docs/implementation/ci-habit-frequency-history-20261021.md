# #76 — integração isolada do contrato de vigência

Refs #76. Part of #71. A fonte `05649bb3d72ca750d5d4c419b7db6bfd89d82a19`, baseada em `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`, permanece ancestral. Os quatro hashes do manifesto `5e1590a05049435b43f75b19cbe9407386acf1c3dfff163ccfb79f3a01c79709` foram conferidos com os bytes dos blobs Git. A base de CI é `eab708f35dfc8ef47962a904b09b602c51b2373c`, sem incorporar a fatia financeira da #86. Nenhuma dessas branches foi integrada em main.

## Correção da revisão

Root e dois revisores independentes encontraram um P2: conferir apenas os descritores próprios e depois acessar `input.historico` permitia executar um getter herdado. O filho de integração aceita objetos comuns ou de protótipo nulo, recusa accessors e captura os valores dos descritores próprios em snapshots de protótipo nulo. Hábito, linhas e envelope são consumidos desses snapshots; listas leem comprimento e itens dos descritores. Não há acesso posterior por `get` aos objetos originais.

Os controles preparados incluem getter herdado que retorna histórico, retorna undefined ou lança, normalizador e resolver antes do início, accessor próprio, envelopes de protótipo nulo e Proxy com get que lança no envelope/hábito/linha/lista. A reflexão de um Proxy ainda pode executar seus próprios traps de introspecção; não se promete ausência de qualquer efeito arbitrário de Proxy. Não há execução dos getters ou dos get traps observados pelos controles.

Cadências, relações de proprietário/hábito, intervalos exclusivos, baseline explícita e rejeição de histórico presente inválido permanecem. Não há cálculo de desempenho, CAS, consumidor, UI, CRUD, persistência, evento, migration ou escrita de domínio nessa fatia.

## Inventários e execução

O novo export do barrel de hábitos torna `src/core/habitos/frequency-history.ts` alcançável nas três projeções de importação existentes. Esta base passa de 379 para 380 fontes Admin, 209 para 210 Recovery e 242 para 243 no coletor legado, mantendo respectivamente 61/60/50 dependências. São contagens declaradas por análise do delta; o Actions deve derivar e confirmar os conjuntos reais do SHA publicado. Os controles exigem o caminho novo e recusam sua omissão ou identidade Git incorreta. O coletor legado permanece apenas controle histórico; isso não reativa o Drive nem seu workflow manual.

Reutilizam-se somente os ajustes estreitos de orçamento global de CI, relógio contextual de teste sintético e diagnóstico fechado da saída Node/Admin. Nenhum terminal, timeout interno, oracle de acesso, limpeza, origem ou restrição de relatório é relaxado. A branch recebe `git.deploymentEnabled:false` antes do primeiro push. Essa configuração não é evidência de inspeção no provedor; nenhuma mudança de plano ou deploy está autorizada nesta rodada.

## Evidência e pendências

Conferidos hashes, conjunto de quatro paths da entrega, revisão estática e diff-check. Nenhum Node, teste, lint, build, navegador ou serviço local foi executado por limitação de RAM. A execução ocorrerá somente nos runners descartáveis do GitHub, no SHA publicado, com os gates originais. Os resultados e eventuais falhas serão registrados na PR e na #76; testes preparados não são PASS. A #76/#71/#81 permanecem abertas.

A PR #70 possui seu próprio resultado anterior 17/17. A #86 no HEAD `bdf8afa` terminou 16/17: CI geral push/PR passou; o Admin push `39562263016` recusou quiescência após actor-intact/after-blank, pending1, incerteza de escrita e cleanup não certificado. O relatório original existe no ZIP; o CLI 2.97.0 trunca sua visualização ao encontrar uma linha acima de 64 KiB. O wrapper confirmou exitCode1. Esse histórico não é transferido como PASS nem escondido por esta integração; a investigação compartilhada permanece na #43.

Sem merge, deploy, alteração de plano, credenciais de produção, Supabase hospedado ou Asaas. Migrations 001–019 permanecem preservadas.
