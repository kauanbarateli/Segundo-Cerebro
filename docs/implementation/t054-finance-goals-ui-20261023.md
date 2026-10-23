# #79 / T-054 — interface isolada de Metas

Refs #79, #71, #46 e #44. **Implementação preparada, sem ativação e sem validação de runtime.** Base `1cc97e726b94aa50c5eb8a92f716877e22f3b8ae`, após transporte Root dos quatro diagnósticos TS da base anterior. Essa correção de Core/teste não é autoria desta fatia. Proposta aprovada em `work/ci-capture-write-20261021/finance-goals-ui-proposal-v1-20261023` do checkout principal.

## Implementado

`GoalsPanel` é composição React exportada e **não importada por nenhuma rota/feature ativa**. Recebe `FinanceGoalsClient`, dono, dia civil do servidor, catálogo de nomes/IDs de contas, máscara/reveal e gerador de UUID. Seis componentes reproduzem doc17 `finance-goals.js/css`: cartão compacto/lista, editor, detalhe/aporte, histórico e avisos da operação. Controles de36/40px e select13px da demonstração passam ao piso44/16 usando tokens existentes. Sem foto fictícia: a ausência de imagem usa o ramo sem capa já previsto no protótipo.

Editor conserva texto parcial até revisão e erro; nome segue160 caracteres do Core, alvoBRL estrito sem arredondar terceira casa. Aporte e liberação usam data explícita até hoje, revisão textual capturada, UUID e corpo clonados. Contas de cartão/inativas/nãoBRL são omitidas da escolha, mas autorização/disponibilidade continuam no servidor. Arquivar preserva reservas e avisa sobre limpeza do destaque; restaurar não destaca automaticamente. Não há seleção automática da primeira Meta nem escrita otimista de dinheiro/IDs. Histórico paginado não vira somatório completo.

Máscara usa `formatBRL` e `R$ ••••` uniforme, retira geometria/percentual/`progress` e não monta campos monetários até revelar. Reocultar desmonta os campos sem apagar o draft em memória daquela instância; owner/epoch novo desmonta toda a sessão anterior. Formulário não usa inputs invisíveis. Dialog compartilhado conserva foco, Escape, retorno e safeareas.320px tem uma coluna;390/desktop usam a composição do protótipo, ainda pendente de medição.

## Port e incerteza

`src/lib/finance-goals-client-contract.ts` importa somente tipos Core. Não contém fetch, SDK, import de adapter (nem type-only), RPC, segredo ou armazenamento real. Leituras usam DTOs de apresentação fechados equivalentes aos já propostos no Server V1. `prepare` é contrato de projeção readonly da mesma intenção; não inventa novo RPC nem produz efeitos. `execute` e `reconcile` devolvem resultado Core validado do dono. O futuro canal precisa fornecer validação completa de transporte e Auth/Entitlement antes de qualquer retorno.

O controlador abre o journal antes de disponibilidade/leitura pública; valida vínculo owner/epoch e protege todos os retornos assíncronos. Serviço/dono/geração trocados ou unmount impedem aplicação de sucesso, erro e finally antigos. Intenção é capturada antes do primeiro await. Stage precisa devolver/readback a mesma intenção durável antes de execute. Timeout/malformado/erro após envio mantém bloqueio de nova intenção e oferece consulta explícita. Consulta sem recibo e403 posterior não comprovam ausência. Não há reenvio automático nem criação de outro UUID para contornar incerteza. Confirmado exige atualizar dados antes de preparar outra operação; CAS alterado exige revisão humana.

**Durabilidade é um requisito do seam injetado, não uma entrega certificada.** O host futuro deve usar lock entre abas, sentinel/epoch persistido e redigir o corpo local no logout/troca confirmada de identidade, sem confundir erro403/503 com logout. O controller não altera o journal existente de Séries nem implementa localStorage como banco de Metas. A fixture usa RAM e a rotula expressamente; os testes não provam Web Locks, armazenamento, sessão revogada real, HTTP ou SQL. A UI oferece reconciliação, não um botão de repetição de escrita nesta fatia.

## Validação preparada e pendente

Testes puros preparados: parsing estrito, parcial preservado, máscara, futuro/cartão/inatividade, journal antes de leituras, quota sem execute, clone de intenção, timeout,403 após incerto, indisponibilidade sem limpar pendência, resposta tardia de leitura/escrita/erro, owner diferente, revisão stale, corpo preparado alterado e ausência de confirmação/ack com tentativa pendente.

Fixture E2E compila somente os componentes reais e port de RAM; CSSallowlist e vedação de adapters/SDK/server-only no bundle. Casos preparados para320/390/1440 claro/escuro, foco/Escape, máscara/reveal, vazio/indisponível, prévia sem escrita, ordemstage→execute/mesmoUUID, invalidade com draft mantido, quota, perda de resposta/replay, ausência de recibo, liberação parcial e troca de identidade. Não há rota de teste em `src/app`; o spec monta HTML e bundle isolados.

**Não executado:** Node, typecheck, lint, detector, Vitest, build, browser, contraste real, medições mobile, SQL e conexões. A captura do protótipo não certifica esta renderização. Após peer, Root pode executar serialmente `npx eslint --max-warnings=0` nos TS/TSX novos, typecheck completo, teste `tests/core/finance-goals-ui-model.test.ts`, portão de dependências/segredos e Playwright `tests/e2e/finance-goals-workspace.spec.ts` no GitHub. Detector e capturas comparáveis exigem rodada autorizada separada. Sem afirmação de PASS nesta entrega.

## Limites e composição

Imagem nova não nula permanece recusada no backend: upload/finalização própria `finance_goal_image` e URL assinada segura são dependências E1/#72; não usar avatar, Capture, URL arbitrária ou Drive. Nenhum byte de imagem foi incorporado. PR90`c74fc57` continua preservada como helper de conjunto declarado, sem somar páginas nem importar seus quatro paths automaticamente.

FinanceWorkspace/FinancePanels, roteamento, HTTP, journal durável concreto, flag/disponibilidade real, schema, Core, adapters, migrations, tipos gerados, env/package/lock/workflows permanecem fora desta fatia. Vercel apenas ganha `false` para esta branch; nenhum deploy é disparado. #79 exige ainda integração ativa supervisionada, mídia, tipos/catálogo, Auth/RLS/concorrência e ciclo retenção/export/backup/restore; não encerra por esta entrega React.

Impeccable local4.4.0 foi lida integralmente e `context` executou uma vez neste worktree; Operate/craft-floor/audit/polish e referência React aplicadas por leitura. Avisos históricos de `buildPath` ausente e versão4.5.2 disponível foram preservados sem alterar config/skills ou executar atualização. O plano e o protótipo aprovado já fixam a direção de código e o escopo desta sessão.

## Delta V2 após revisão estática, sem execução

O freeze V1 permanece preservado. Peer independente identificou alias do argumento em `stage` e `reconcile`: ambos agora recebem cópia separada da intenção privada capturada. Readback só autoriza o primeiro execute quando owner/epoch/fence, corpo/UUID e fase **staged** são exatos; faseuncertain não autoriza novo envio. O controller conserva um hold local do corpo original se o readback vier alterado/nulo: isso não certifica persistência, mas impede a UI de abrir outro UUID ou consultar um corpo adulterado. Somente resultado Core válido da mesma intenção e readback sem pendência resolvem esse hold. Negativos preparados cobrem mutação de amount/client_id, estágioincerto, leitura posterior nula, argumento de consulta adulterado e preservação do corpo original. Nenhum decoder ou Core foi relaxado.

Fakes de criação agora devolvem revisão0, como exige o Core; Metas existentes começam em1 e atualização continua incrementando a revisão. Essa correção evita que um fake incoerente seja confundido com erro do produto. O parecer visual estático V1 foi preservado separadamente em EV; não é aceite renderizado.

Também após autorização Root: detalhe exibe **Após o aporte** somente quando o portprepare e o detalhe são da mesma revisão financeira/Meta e intenção. A soma segura parte do agregado daquele detalhe, nunca de páginas; barra/projeção do Core conserva excesso real. O texto marca a informação como prévia a reconferir pelo servidor, sem autorização de saldo. Não houve ampliação do port ou RPC. Sob máscara, o novo texto usa máscara única e omite percentual, e o progress/campos seguem ausentes. Novos testes preparados conferem revisão divergente/overflow e máscara sem escrita.

Editor ganhou Cancelar textual ligado ao mesmo fechamento protegido de X/Escape; fechar uma tentativa incerta não limpa o journal. A mensagem de indisponibilidade foi corrigida em concordância. E2E preparado para cancelar com retorno de foco e zero prepare/execute. Estes deltas continuam sem Node/lint/typecheck/browser/SQL; a V2 exige reconferência independente e CI próprio antes de incorporação.

## Delta V3 — tentativa recuperada

Nova reconferência independente encontrou o mesmo risco de perda de intenção ao **abrir** uma sessão: uma pendência recuperada ainda não estabelecia o hold privado. Agora o primeiro readback de qualquer pendência (`staged` ou `uncertain`) fixa o corpo/UUID original antes da disponibilidade. Leitura posterior nula ou alterada não autoriza nova intenção; a consulta continua sendo da tentativa original. Somente resultado próprio confirmado e leitura sem pendência encerram o hold. Negativos preparados cobrem `open(A incerta) → leitura nula/alterada → prepare B` com zero prepare/execute e reconcileA. V1/V2 preservadas; nenhuma execução nova nesta correção. O lint V2 foi executado pela Root em rodada própria e não certifica os novos bytes V3.

## Delta V4 — correlação da união na fixture

Os originais próprios do CI de `7c9febccc3e6024a3cdd321810d91e10a6456f95` registraram TS2345 em `tests/core/finance-goals-ui-model.test.ts:43`: o teste reconstruía uma união discriminada usando spreads de duas chamadas independentes de `command()`, perdendo a correlação entre comando e input. A fixture agora clona um único comando e altera somente seu `client_id` comum antes de tentar preparar a segunda intenção. O UUID continua distinto; os asserts de bloqueio por incerteza, consulta da intenção original e contagens de prepare/execute não mudaram. O helper, o Core e os componentes permanecem intocados, sem casts ou alargamento de tipos. V1–V3 e os originais do CI estão preservados. Nenhum runtime/typecheck/teste foi executado nesta correção; o novo SHA não herda os resultados de 7c9, e a publicação aguarda Root concluir a coleta dos 16 originais.
