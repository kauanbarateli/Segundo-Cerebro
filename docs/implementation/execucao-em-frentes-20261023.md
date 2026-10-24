# Execução em frentes — MVP e redesign

Registro de 23/10/2026. O objetivo autorizado inclui MVP operacional, redesign, onboarding facultativo de nove telas e ajustes da landing. Checkout Asaas, abertura de vendas e Drive continuam fora desta execução. Merge e deploy de produção permanecem bloqueados; homologação isolada está autorizada. Uma pergunta sem resposta não impede as frentes independentes.

## 1. Interface e protótipo

**Implementado:** PR #113, melhorias do onboarding e landing que preservam a identidade e os capítulos aprovados. Mensagens, ações secundárias e resumo foram ajustados sem substituir a arquitetura ou ampliar o escopo comercial.

**Validado:** d16e1dd teve 17 checks originais aprovados; Root conferiu quatro capturas reais do CI em 320/390 px, claro/escuro, contra as referências do protótipo. O Preview isolado foi atualizado para25c1de7, após seus17 checks próprios aprovados. Nele a sessão real, o resumo concluído com duas contas Google, a ausência de duplicatas e a tarefa em andamento foram reconferidos. Os dois percursos completos e OAuth anteriores continuam vinculados à85b9712; a regressão posterior não inventa um novo consentimento Google. Esses percursos não certificam automaticamente a interface posterior de Metas.

**Validado:** interface de Metas da PR #116 em044432e teve16 checks próprios aprovados e foi transportada para a PR #118 junto dos canais browser/HTTP. A PR #119 acrescenta capa privada do card, coluna opcional da imagem e Cancelar. Seu primeiro ddd16aa encerrou 14 PASS e dois Typecheck FAIL; a correção dab149c preservou SQL/asserts e encerrou16/16 originais aprovados: ambos gerais com201 arquivos/3.240 unidades por fuso,1.963 scripts e467 E2E, além dos 14 envelopes nativos sem violações. O artifact próprio gerou32 PNGs públicos; Root inspecionou12 em320/390/1440 e nos dois temas contra o protótipo. A comparação motivou ajuste de peso dos títulos e agrupamento mais compacto do resumo, ainda sujeitos ao CI do novo candidato. Nenhuma captura é aceite da integração hospedada.

**Implementado localmente:** B2a prepara modelo/presenter de escolha de foto sem enviar ou salvar, em paths novos e sem montar no GoalEditor. Seleção permanece needs-upload e não vira null silencioso; nove testes foram escritos, sem execução local. O primeiro candidato da PR #120, 01ae6a7, encerrou 14 PASS e dois Typecheck FAIL pelo mesmo narrowing em um teste. A correção captura a referência já validada antes do callback, conservando o ataque de mutação e a asserção. Upload durável, vínculo financeiro e aceite visual dessa nova apresentação continuam pendentes. A fundação E1-A segue proposta SQL inerte, sem aplicação remota.

**Revisão visual de 24/10:** Root viu dez das 36 capturas próprias de7e5bad2, incluindo as quatro confirmações em320/390px, claro/escuro. O peso dos títulos e o agrupamento do progresso ficaram mais próximos do protótipo. Em320px, o filtro comprimia os dois botões da toolbar; o delta corretivo mantém o filtro em sua própria linha abaixo de350px. Essa alteração precisa de novas capturas e não recebeu aceite visual antecipado.

**Regressão real de 24/10:** o alias de homologação foi reconferido na Vercel como Preview READY de25c1de7, preservando o banco isolado. Com a sessão comum descartável, o link de conclusão do onboarding levou ao painel. Uma captura sintética foi salva pelo editor, reabriu com o mesmo título, corpo e identidade após recarga integral, foi arquivada e restaurada. A biblioteca mostrou uma nota após salvar/recarregar/restaurar e zero na caixa de entrada durante o arquivamento. Não houve exclusão definitiva, SQL administrativo, alteração de schema ou produção. Isso verifica esse percurso conectado de Capturar; não certifica Storage de imagens, RLS entre usuários, teclado virtual ou aparelhos físicos.

**Promoção conectada de 24/10:** a mesma captura sintética foi guardada pelo fluxo da interface em Conhecimento e a página reabriu após recarga integral com título e documento preservados. Uma consulta privilegiada estritamente somente leitura, limitada aos dois registros sintéticos e após reconferir o ref da homologação, confirmou uma página ativa vinculada, origem arquivada, mesmo dono/documento/título, um recibo da promoção e um evento de criação da página. Essa conferência de consistência não prova RLS entre usuários ou atomicidade diante de falhas injetadas. Não houve escrita SQL administrativa nem exclusão da fixture.

**Próximo gate:** novas capturas do ajuste320px; candidato integrado qualificado; então revisão visual conectada dos novos canais em homologação. Medição de contraste e aparelhos reais da nova composição não são declarados por screenshots de fixture.

## 2. Financeiro e novas funcionalidades

**Implementado:** PR #111 contém a composição financeira de orçamento/séries e correções do canal de navegador. PR #115 prepara Core e adapters de Metas, mantendo propostas SQL inertes e regras isoladas do SDK.

**Validado:** 708cbc6 teve 17 checks originais aprovados, incluindo as jornadas de navegador. Seu SQL descartável usa 001–025. As falhas de teste da PR #115 e suas correções estão registradas por SHA; a falha de porta de um original 0de769c permanece sem atribuição artificial ao produto.

**Validado na composição:** a PR #117 em25c1de7 encerrou17 originais aprovados, incluindo Typecheck, lint, unidades, scripts, E2E, build e envelopes nativos. O novo helper verifica todos os26 arquivos canônicos e compõe as propostas inertes apenas no banco descartável de testes. As fontes e os encerramentos pertencem a esse SHA; não certificam automaticamente os novos canais da #118.

**Validado:** journal durável/epoch, rotas e recibos da PR #118 em b4c4586 encerrou17/17 originais aprovados, sem rerun/cancelamento. Ambos gerais passaram200 arquivos/3.232 unidades em cada fuso,1.963 scripts e457 E2E, Typecheck/lint/camadas/build/PWA/auditoria zero. Os 14 envelopes nativos encerraram sem violações, com 504 blobs Git próprios sem drift; Auth conserva o limite de manifesto por arquivo. Falhas anteriores de Typecheck, unidades, guarda pura e camadas permanecem registradas por SHA, sem serem reapresentadas como aprovadas.

**Implementado em candidato:** fundação terminal M1 V2 com captura nominal servidor, recibo original e fence absoluto. O codec V1 foi recusado no diagnóstico de Unicode e preservado; a decisão V2 declara explicitamente a autoridade do servidor e a perda de prova estrutural SQL no texto opaco sem recibo. O teste de composição cobre M1 e imagens nas duas ordens. A autoria M2 foi dividida em três frentes: duas rotas e transporte servidor; captura/prova no navegador e journal/controller; confirmação visual inline. Os pacotes têm revisão estática cruzada e são reunidos com a correção de Typecheck em um próximo candidato, sem herdar resultados anteriores. Ausência de recibo nunca autoriza liberar uma tentativa.

**Implementado em candidato:** consultar e encerrar são ações humanas distintas. Um novo positivo vinculado ao comando e ao epoch pode recuperar uma limpeza local parcial; erro, corpo ausente ou resposta trocada não liberam a tentativa. Depois de resolução positiva, a interface exige atualizar os dados e confirmar nova revisão. A recuperação conserva Auth/Entitlement e funciona com a flag de novas operações desligada. Onze casos de navegador foram acrescentados à fixture pública, incluindo quatro capturas de confirmação em 320/390 px, claro/escuro, movimento reduzido, foco, Voltar sem envio, duplo clique, resposta perdida e troca de dono. Os onze casos passaram no CI próprio de7e5bad2; a inspeção das capturas ainda está pendente. A fixture usa protocolo/prova nominais com transporte e journal sintéticos em RAM; não certifica HTTP, SQL ou armazenamento durável.

**Próximo gate:** CI próprio da união; migrations novas revisadas, tipos/catálogo e instalação supervisionada somente na homologação; canal/journal e aceites Auth/RLS/CAS, replays, falhas parciais e privacidade. Não instalar uma guarda de fechamento isoladamente antes de existir o caminho de liberação de reservas.

## 3. Restore e operação

**Validado:** uma inspeção nativa V8 do mesmo archive imutável concluiu transporte e comparação com o Ensaio_restore, somente leitura. O leitor passou1.229 controles públicos antes da operação. Produção e destino não receberam mutações, e nenhum restore foi executado.

**Pendente técnico:** o baseline foi recusado por36 diferenças de vetores e cinco definições públicas. Agora todos os36 vetores foram comparados integralmente: multiplicidade igual, ordem diferente. Isso não altera o contrato estrito do A2. As cinco identidades correspondem ao helper público de RLS e suas ACLs/defaults; a correlação não prova equivalência de definições. SQL, permissões ou vetores não foram normalizados para permitir restore. `baselineQualified`, `remoteMutation` e `restoreAccepted` continuam falsos.

**Em execução:** revisão pública e finita da política do baseline, incluindo fontes oficiais do helper. Não repetir inspeções para redescobrir a ordem já demonstrada. Preparar alvo, mudar política de comparação ou executar restore são gates separados, com proposta e revisão próprias; o diagnóstico não os libera.

## 4. CI e revisão da integração

Os testes pesados rodam no GitHub; localmente, revisões e verificações focais são serializadas. O diagnóstico de23/10 encontrou156MiB livres em7.915MiB, portanto novos bancos/compilação local foram evitados durante essa pressão. Cada SHA preserva seus próprios resultados, inclusive falhas, skips e infraestrutura. Não há rerun ou alteração de porta/timeout para produzir um resultado verde.

O original 01ae6a7 da PR #120 encerrou 14 PASS e dois Typecheck FAIL, sem unidades, build, E2E ou PNGs nos gerais. O candidato a560bd1 corrigiu o Typecheck, mas parou em quatro testes SQL com `syntax error at end of input`. Esses resultados permanecem falhos. O agrupamento restrito dos dois CASE foi revisado sem remover testes ou guardas.

**Validado em 7e5bad2:** os 16 originais passaram. Cada geral aprovou 212 arquivos/3.360 unidades em cada fuso, 1.963 scripts e 478 E2E, além de Typecheck, lint, camadas, build, PWA e auditoria zero. Os 14 envelopes nativos encerraram sem violações, com 504 blobs Git próprios sem drift, 63 dependências observadas e 26/1.720; Auth conserva o limite de manifesto por arquivo. As capturas próprias ainda precisam de inspeção visual. O [registro por candidato](t054-finance-goals-terminal-validation-20261024.md) distingue as evidências e seus limites. Isso não certifica upload de imagens nem as corridas terminais ainda em autoria.

**Continuação em paralelo:** uma frente prepara o journal de upload com identidade integral preservada após falhas parciais; outra constrói os confrontos nativos de commit/encerramento; a terceira revisa as entregas e os originais do CI. Root confere os pacotes e as capturas contra o protótipo. A memória livre chegou a41MiB, portanto nenhum serviço ou teste pesado local foi iniciado. A extração mecânica dos compiladores SQL puros permanece um WIP revisado, sem alteração dos SQLs ou dos 26 arquivos históricos, para evitar importar WASM no futuro gate nativo. Cada nova união exige seus próprios checks.

**Encerramento de70c5dd5 em24/10:** os16 checks originais concluíram aprovados, sem fail, skip, cancelamento ou rerun. Cada geral observou213 arquivos/3.392 unidades por fuso,1.963 scripts e478 E2E. Root conferiu o registro final próprio:14 envelopes nativos sem violações,504 blobs Git próprios sem drift,63 dependências observadas e catálogo26/1.720; Auth conserva o limite de manifesto por arquivo. O candidato inclui a fundação J2 do upload, a extração pura dos Sources e a correção da toolbar em320px. As novas capturas ainda exigem inspeção; esse PASS não certifica os dois pacotes seguintes, C2a do coordenador e N dos confrontos nativos, entregues apenas para revisão.

O candidato deriva os inventários pelas funções originais de arquivos públicos: Admin 471; Foundation 48; Recovery 234; regressão histórica de Storage/Drive 270. Isso não equivale ao vínculo de blobs/dependências e ao encerramento dos serviços nativos: esses precisam ser comprovados pelo CI próprio do candidato. A regressão histórica não recoloca a aba Drive no MVP.

## Decisões e ações externas preservadas

- As credenciais Google de Production serão recadastradas pelo mantenedor após os testes, conforme combinado. Não modificar Production para adiantar a homologação.
- Aceite humano visual e testes físicos da nova interface permanecem separados. As instalações anteriores em iPhone/A35 e a sincronização de tema já relatadas não certificam toda alteração posterior.
- Aprovação final de merge/produção fica para depois dos testes e revisão; enquanto isso continuam implementação, CI, documentação e homologação independente.
- Nenhuma etapa depende de resposta sobre Asaas, Drive ou novas contratações. Esses escopos não são iniciados por esta frente.

## Ordem de execução

1. Encerrar e registrar os originais dos SHAs em teste, corrigindo somente os erros demonstrados.
2. Qualificar o candidato integrado com seus testes, fontes e encerramentos próprios.
3. Concluir canal e schema financeiro em fatias revisáveis, com migrations novas e sem reescrever as históricas.
4. Publicar somente Preview isolado, verificar banco/alvo/configuração e testar as jornadas reais.
5. Registrar o que passou, o que falta e os aceites humanos, sem encerrar issues por inferência.
