# Auditoria estática curta — Finance SQL spec × H0/H1

24/10/2026. Fonte atual do RootWT/coorte140 informado por Root. Dois gaps de declaração encontrados; não executei Node, browser, bundler, SQL, SDK, CI ou rede. Nenhuma fonte foi editada.

## 1. GET availability de Metas ausente no seam

Caminho alcançável: fixture issue26-27-finance-browser.tsx:72–81 monta FinanceWorkspace com DemoApplicationProvider/serverUserId; spec:280–281 exige modo connected. FinanceWorkspace:131/135 monta FinanceGoalsHost no painel/orçamentos. Host:30–51 abre o client concreto e GoalsPanel; use-goals-channel.ts:19–24 chama controller.open, cujo goals-ui-model.ts:141–144 consulta service.availability após loadPending. A flag de novas imagens não evita essa consulta.

finance-goals-client.ts:246 usa /api/finance/goals/availability; request:198–209 envia GET sem body/query, x-expected-user-id, same-origin/no-store e espera {ok:true,result:{available:boolean}}. Porém attach do spec:219–273 só reconhece imagem Home, Series availability/classification, /api/finance e navegação. O GET novo cai no veto UNEXPECTED_REQUEST:273. Os asserts trace.unexpected=[] permanecem, portanto um host que abre normalmente tem um caminho HTTP não declarado.

A disponibilidade real do servidor é financeGoalsAvailable(env), somente FINANCE_GOALS_V1_ENABLED==='true' (finance-goals-availability.ts:5–6). A rota availability autentica primeiro e só retorna esse boolean, sem GoalRPC. O spec fixa explicitamente apenas o ambiente Series(:27); não declara o ambiente Goals. Não há dado de Metas exigido pelo fluxo correto desligado: use-goals-channel.ts:22–24 não lê página quando available=false e GoalsPanel:138 usa silentUnavailable sem erro. Logo não se deve adicionar mock de list/detail vazia, GoalFeature, tabelas ou fallback por falha.

Próxima ação proposta: declarar o único GET de disponibilidade com método/query/body/header/dono fechados e ambiente Goals false explícito, derivando a resposta do helper real de rollout no entry de produto estreito. Preservar recusas e tornar observável o caminho; não esconder/desmontar Goals para evitar a leitura. Nenhuma contagem de requests é presumida por esta auditoria.

## 2. Gap pré-app: stylesheet do picker lazy

goal-image-host-binding.ts:130 contém import('./goal-image-picker'), e goal-image-picker.tsx:12 importa goal-image-picker.css. O bundle da fixture parte do FinanceWorkspace real. O resolver do spec:60–65 coleta CSS também dos módulos lazy resolvidos; a igualdade da closure:79 compara contra componentCss:33–35. A lista inclui goals.css, mas omite goal-image-picker.css. É uma omissão estática do inventário CSS alcançável, anterior ao HTTP; o conteúdo efetivo do set e eventual falha do coorte só podem ser afirmados após execução própria.

Próxima ação proposta se Root confirmar o delta: incluir somente esse stylesheet já existente na composição declarada, em ordem coerente com o CSS da feature, conservando a igualdade de closure. Não ignorar extra CSS nem reduzir assert.

## Leituras de Goal/imagem e limites

/api/finance/goals?view=page|detail e image read de Metas não estão declarados nesse seam. Com Goals availability=false confirmado, nenhum desses reads é necessário na montagem inicial. O único read auxiliar de imagem existente é home-image-read.ts:7–12, propósito home_focus_image exato; não é leitor genérico de Goal. Fotos novas seguem contexto false por ausência do provider de habilitação, e J2/upload só abrem por gesto. Schema027/Goals enabled pertence a outro aceite; este spec usa o loader canônico existente (26 arquivos no estado revisto), não a fundação Goals inerte. O comentário spec:25 ainda cita001–025; ele não é autoridade do schema executado.

Não interpreto um erro/rejeição de availability como prova de feature desligada nem proponho mocked-success. Falhas anteriores do bundle/CSS impediram observar este fluxo; a análise é de alcance/declaração por fonte, não resultado do CI140.

Pin do spec lido: 16febe14d77f237b4758738b1d46bd760e8378b8febf9c53357e541683718dcd. Host:2ac35a651a37f833440d5c99c16a90bcc4499f8f973837210bba9fb2976e567c. Binding:decc51c15348a38bcbec1112fde2184eb19183c4337ac6135ac4bb83061993b3.
