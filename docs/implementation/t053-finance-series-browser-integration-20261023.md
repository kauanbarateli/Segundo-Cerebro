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

Refs #78. Não encerra a issue, não concede aceite de restore, não reintroduz Drive ou checkout Asaas. Merge e deploy de produção continuam bloqueados.
