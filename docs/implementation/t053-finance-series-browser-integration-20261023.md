# #78 — candidato integrado do navegador de séries

A composição acrescenta gestão de séries ao painel financeiro e encaminha grupos existentes para o fluxo correto. O journal é aberto antes de qualquer chamada; resultado incerto conserva a mesma intenção e exige consulta ou reenvio humano. O atalho legado depende de classificação positiva do grupo próprio, preservando o replay do recibo v1 antes dessa classificação.

Base desta PR técnica: `0d9d92f2f19cc528b1f7947a2f1f850fbca65b2f`, PR #109. A branch é `codex/finance-series-browser-20261023`; o deployment automático está bloqueado. O pacote não integra ainda a homologação principal nem ativa a disponibilidade/guarda do servidor. Não há migration canônica nova, schema remoto, ambiente alterado ou tipos gerados neste delta. As propostas SQL B2 herdadas da base continuam inertes.

## Composição e revisão

Root conferiu os quatro manifestos congelados: journal/channel V3, UI V3, E2E V2 e atalho legado V1. São 36 registros e 34 paths únicos. As duas sobreposições seguem UI V3 → atalho legado V1; não houve descarte silencioso de arquivo.

O FinanceWorkspace foi revisado separadamente: os imports, estado e painel são aditivos. A única linha substituída é a ação de grupo, mantendo as ações de lançamentos independentes. Não foi localizado um patch adicional da Root; não se alega preservar um delta não demonstrado.

A primeira execução de lint encontrou quatro avisos em três componentes. A correção captura as dependências específicas dos efeitos, estabiliza `run` com `useCallback` e captura a instância de lifetime usada pelo cleanup. Permanecem as verificações de dono, época, geração, fechamento e sessão após cada espera. Nenhuma regra de lint foi desativada; não se adicionou o objeto `channel` mutável às dependências.

## Implementado e ainda não validado

O código inclui formulários com prévia e confirmação, detalhes, tentativas pendentes, máscara de valores e encaminhamento seguro de grupos. A UI usa os componentes existentes; indisponibilidade, erro ou sessão alterada não autorizam mutação pela via legada. Nenhuma tentativa é reenviada automaticamente. O corpo de uma tentativa não pode ser recuperado por outra conta ou serviço; perder o sentinel exige reconferência.

Há 54 casos de modelo e 15 cenários de navegador escritos nos pacotes. Essa quantidade não é uma declaração de PASS. A revisão estática e o lint local passaram; typecheck, testes de regras/client/journal/rotas, camadas, build e E2E do candidato precisam dos próprios resultados no GitHub. O Vitest local disponível diverge da versão do lock, portanto não será usado para certificar esta entrega.

## Próximos gates

1. Executar as suítes gerais e focais no SHA desta PR, com dependências do lock. Não herdar o CI de #109.
2. Conferir o navegador sintético: resultado incerto, journal indisponível/corrompido, troca de conta/época, resposta tardia, classificação gerida/legada e ausência de retry automático.
3. Medir a interface integrada: temas, contraste real, 320/390 px, larguras intermediárias, zoom, teclado, foco, máscara, campos de 16 px e alvos de 44 px. Fixtures não substituem aparelhos reais.
4. Compor explicitamente com a cadeia 026 da homologação. A base financeira desta PR permanece 001–025; não copiar a branch inteira sobre a PR #105 nem repinar preparadores históricos.
5. Criar/revisar as migrations finais e concluir Auth/RLS/CAS/recibo/evento e compatibilidade v1 em ambiente isolado antes de ativar qualquer guarda ou disponibilidade. CI/build/deploy não aplicam schema.

## Primeiro CI e correções do candidato

O head `5d6f128b24ae87e9f1e56bae4e377ed83bdb3287` encerrou os 16 runs originais, todos na primeira tentativa: 12 PASS e quatro falhas. Os dois gerais pararam no typecheck TS2339 antes das unidades, scripts e E2E. Os dois Admin Browser pararam nos controles puros, com 249/251 aprovados: o coletor recusou o inventário desatualizado de 444 arquivos diante do grafo real de 470. Nenhum deles chegou aos casos conectados de Admin. Não houve rerun para substituir esses resultados.

A correção de tipagem acrescenta uma asserção positiva de `pause`, `end` ou `update_future` antes de ler `from_on`, sem cast e sem alterar os corpos das prévias. A checagem focal em Node24/TypeScript5.9.3 não encontrou diagnósticos nas 41 fontes transitivas; o CI completo do novo SHA ainda é necessário.

O delta do inventário foi derivado dos blobs Git de `0d9d92f2f19cc528b1f7947a2f1f850fbca65b2f` e `5d6f128b24ae87e9f1e56bae4e377ed83bdb3287`: 26 adições exatas, sendo 15 arquivos novos e 11 existentes que passaram a ser alcançáveis, zero remoções e zero imports externos novos. Um walker independente e a função original extraída por AST concordaram. A única fonte WIP durante a derivação foi lida pelo blob Git declarado; sua guarda de tipagem não muda imports.

O contrato passa a exigir 470 fontes Git e mantém 61 dependências. A lista das 26 adições é explícita e congelada; o teste confere presença, hash e unicidade, recusa cada ausência e testa blobs divergentes nos ramos de API e journal. O runner e seus predicados permanecem preservados. Essa derivação estática não substitui a execução nativa do coletor no novo SHA.

Root revisou os quatro deltas e executou lint focal sem erros ou avisos de regras. Uma chamada inicial de lint parou por erro de caminho do operador, antes de carregar o ESLint; a chamada corrigida encerrou com código zero. As propostas SQL continuam inertes. Os resultados nativos aprovados da primeira execução pertencem a 001–025/catálogo1.534, não ao banco 026 nem ao Preview da PR #105.

Refs #78. Não encerra a issue, não concede aceite de restore, não reintroduz Drive ou checkout Asaas. Merge e deploy de produção continuam bloqueados.
