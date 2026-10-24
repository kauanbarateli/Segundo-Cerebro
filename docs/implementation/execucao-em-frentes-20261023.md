# Execução em frentes — MVP e redesign

Registro de 23/10/2026. O objetivo autorizado inclui MVP operacional, redesign, onboarding facultativo de nove telas e ajustes da landing. Checkout Asaas, abertura de vendas e Drive continuam fora desta execução. Merge e deploy de produção permanecem bloqueados; homologação isolada está autorizada. Uma pergunta sem resposta não impede as frentes independentes.

## 1. Interface e protótipo

**Implementado:** PR #113, melhorias do onboarding e landing que preservam a identidade e os capítulos aprovados. Mensagens, ações secundárias e resumo foram ajustados sem substituir a arquitetura ou ampliar o escopo comercial.

**Validado:** d16e1dd teve 17 checks originais aprovados; Root conferiu quatro capturas reais do CI em 320/390 px, claro/escuro, contra as referências do protótipo. O Preview isolado foi atualizado para25c1de7, após seus17 checks próprios aprovados. Nele a sessão real, o resumo concluído com duas contas Google, a ausência de duplicatas e a tarefa em andamento foram reconferidos. Os dois percursos completos e OAuth anteriores continuam vinculados à85b9712; a regressão posterior não inventa um novo consentimento Google. Esses percursos não certificam automaticamente a interface posterior de Metas.

**Em execução:** interface de Metas da PR #116 em044432e teve16 checks próprios aprovados e foi transportada para a PR #118 junto dos canais browser/HTTP. A composição seguinte acrescenta capa privada do card, coluna opcional da imagem e Cancelar, preservando modal, hierarquia e proporções do protótipo. A fundação E1-A e o display E1-B1 foram escritos e revisados estaticamente, sem aplicação remota. Capturas de lista/editor/detalhe, fotos presentes/falhas e destaque compacto serão retidas pelo CI próprio. Picker/upload e vínculo financeiro ainda dependem da fatiaE1-B2; fixture RAM continua sem certificar journal, HTTP ou persistência reais.

**Próximo gate:** checks e capturas próprios de Metas; candidato integrado qualificado; então revisão visual conectada em homologação. Medição de contraste e aparelhos reais da nova composição não são declarados por screenshots de fixture.

## 2. Financeiro e novas funcionalidades

**Implementado:** PR #111 contém a composição financeira de orçamento/séries e correções do canal de navegador. PR #115 prepara Core e adapters de Metas, mantendo propostas SQL inertes e regras isoladas do SDK.

**Validado:** 708cbc6 teve 17 checks originais aprovados, incluindo as jornadas de navegador. Seu SQL descartável usa 001–025. As falhas de teste da PR #115 e suas correções estão registradas por SHA; a falha de porta de um original 0de769c permanece sem atribuição artificial ao produto.

**Validado na composição:** a PR #117 em25c1de7 encerrou17 originais aprovados, incluindo Typecheck, lint, unidades, scripts, E2E, build e envelopes nativos. O novo helper verifica todos os26 arquivos canônicos e compõe as propostas inertes apenas no banco descartável de testes. As fontes e os encerramentos pertencem a esse SHA; não certificam automaticamente os novos canais da #118.

**Em execução:** journal durável/epoch, rotas e recibos da PR #118. O primeiro conjuntofffa378 terminou com14 PASS e2 FAIL no Typecheck. A correçãobafc9f6 passou essa etapa e encontrou dois casos de unidade e uma falha de guarda pura de Auth, todos registrados sem rerun. Correções focais estão em revisão; não se declara CI completo aprovado. A saída terminal de tentativa sem recibo tem proposta separada; ausência de recibo continua sem provar rollback.

**Próximo gate:** CI próprio da união; migrations novas revisadas, tipos/catálogo e instalação supervisionada somente na homologação; canal/journal e aceites Auth/RLS/CAS, replays, falhas parciais e privacidade. Não instalar uma guarda de fechamento isoladamente antes de existir o caminho de liberação de reservas.

## 3. Restore e operação

**Validado:** uma inspeção nativa V8 do mesmo archive imutável concluiu transporte e comparação com o Ensaio_restore, somente leitura. O leitor passou1.229 controles públicos antes da operação. Produção e destino não receberam mutações, e nenhum restore foi executado.

**Pendente técnico:** o baseline foi recusado por36 diferenças de vetores e cinco definições públicas. Agora todos os36 vetores foram comparados integralmente: multiplicidade igual, ordem diferente. Isso não altera o contrato estrito do A2. As cinco identidades correspondem ao helper público de RLS e suas ACLs/defaults; a correlação não prova equivalência de definições. SQL, permissões ou vetores não foram normalizados para permitir restore. `baselineQualified`, `remoteMutation` e `restoreAccepted` continuam falsos.

**Em execução:** revisão pública e finita da política do baseline, incluindo fontes oficiais do helper. Não repetir inspeções para redescobrir a ordem já demonstrada. Preparar alvo, mudar política de comparação ou executar restore são gates separados, com proposta e revisão próprias; o diagnóstico não os libera.

## 4. CI e revisão da integração

Os testes pesados rodam no GitHub; localmente, revisões e verificações focais são serializadas. Cada SHA preserva seus próprios resultados, inclusive falhas, skips e infraestrutura. Não há rerun ou alteração de porta/timeout para produzir um resultado verde.

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
