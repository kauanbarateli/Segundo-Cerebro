# Retomada da Frente C — Auth/CI — 17/10/2026

Repositório: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro). Este handoff registra o ponto limpo da análise de quiescência e do contraste público Active Close. Não atesta aceite final de Auth, cleanup de fixtures, restore ou conclusão do MVP.

## Estado e fontes

Main no checkpoint desta revisão: `61d03c768071e6618136e648fc71c552e3db2043`. A PR draft de consolidação será preparada por Root; este arquivo não presume que ela foi incorporada. Antes de editar, conferir o SHA e o delta efetivo, preservando os WIPs do usuário.

Materiais específicos:

- `docs/implementation/browser-active-close-probe.md`: contrato, comparação das fontes e correção da sessão CDP manual.
- `scripts/verification/browser-active-close-probe.mjs` e `tests/scripts/browser-active-close-probe.test.mjs`: produtor público e QA RAM.
- `docs/implementation/browser-redirect-drain-probe.md` e `scripts/verification/browser-redirect-drain-probe.mjs`: contraste anterior, cuja fonte encerrada não deve ser reexecutada para obter outro resultado.
- `docs/implementation/browser-quiescence-fence-probe.md` e seu produtor: fence, limites e regra de timeout antecipado.
- `tests/e2e-auth-local/admin-browser-local.spec.ts`, `auth-recovery-local.spec.ts`, `admin-browser-support.mjs` e `admin-browser-contract.mjs`: proprietários e gates atuais do drain real.
- `tests/e2e-auth-local/next-stop-relay.mjs` e `next-stop-reporter.mjs`: autoridade do próximo stop, preservada.
- `scripts/verification/admin-browser-local-ci.mjs`, `auth-recovery-local-ci.mjs` e workflows de mesmo nome: runners hospedados descartáveis.
- No Review, `docs/implementation/auth-read-drain-correction-proposal.md` e `auth-801b-next-diagnostic.md`: raciocínio anterior; são propostas, não validações conectadas.

Não abrir novamente raw, logs, relatórios ou capturas privados dos runs encerrados. Usar os resumos fechados abaixo e as fontes públicas. Preparos e operativos antigos são evidência histórica, não comandos de retomada.

## Evidência fechada que permanece válida

Em `801b6a84d536574dd3c8d0cebb9b77e645806d45`, Root capturou uma única vez os relatórios nativos Admin e Recovery. Os manifests de fontes conferiram; as etapas funcionais de Admin e de Recovery, incluindo alteração de credenciais nesta última, passaram. A quiescência final não passou: Admin reteve uma leitura e Recovery quatro, sem terminais originais correspondentes. Cleanup não foi aceito. Uma classe de path de login não prova que o método seja POST. Permanece proibido deduzir o método pelo nome da rota.

O Redirect de `a159db9e858563896e45e540b60a5718fe6d881e` foi executado e capturado uma única vez por Root. O controle finito passou; o GET direto ficou pendente aos 15.000 ms apesar de continue resolvido, fonte/sockets fechados e handlers liquidados. O caso de redirect ficou inconclusivo por observação de protocolo insuficiente. Isso mostrou que a reprodução pública da pendência não depende de redirect; não estabeleceu causa para Auth.

O Active Close de `8084c3988b34f8973c72178aab446bdaecffa014`, run `38990606937`, também foi executado/capturado uma única vez por Root. O leitor qualificou a forma full-native; isso não significa PASS da aplicação. Controle: `CONTROL_PASSED`, `controlQualified=true`, decisão em 1518 ms e cleanup completo. Candidato: `INCONCLUSIVE/ORIGINAL_TERMINALS_BEFORE_CLOSE`; antes do fator já existiam public failed e CDP failed originais, manager ausente e zero requests pendentes. Fonte fechada em 151 ms, decisão em 152 ms; close solicitado/evento observados eram zero e a promessa estava not-requested. O fator ativo não ocorreu. O cleanup da sessão manual ficou unconfirmed e actionsSettled ficou false. Nenhum resultado anterior deve ser reclassificado após corrigir o código.

Conferência posterior de Root, somente por metadados, para `61d03c7…`: Auth local38991430121, Admin backend38991430081, Foundation38991430115, Avatar38991430103 e Captura Storage38991430091 terminaram success; Admin navegador38991430101 e Recovery38991430080 terminaram failure. CI geral38991430122 permanecia in_progress. Não houve captura dos relatórios falhos dessa fonte nem causa atribuída; resultados pertencem a esse SHA. Consultar metadados finais na retomada, sem herdar contagens de outro run.

## Correção local concluída e revisada

O erro concreto do produtor público era o listener `session.once("disconnected")` em uma **CDPSession pública**. Playwright 1.63 emite `close` nessa sessão; `disconnected` pertence ao Browser. Depois do close do contexto, a flag incorreta permitia tentar detach de um alvo já encerrado.

A correção usa `createActiveCloseSessionOwner` no adaptador e nos testes RAM. Registra `close` na aquisição; se o evento original precede qualquer detach, não envia um comando ao alvo encerrado. Se detach foi solicitado, guarda a promessa exata e a devolve em chamadas posteriores. Resolução sem evento não confirma o recurso, promessa pendente continua pendente e rejeição/throw permanecem falha, mesmo que um close posterior seja observado. Não há retry, alteração de Request, terminal fabricado ou modificação do observador original.

Pins da entrega revisada no Review:

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `scripts/verification/browser-active-close-probe.mjs` | 32600 | `D50B176078156F0BB9B499A959DE5F4EF40D972F4CC9CA6E57E16FB490BAFE33` |
| `tests/scripts/browser-active-close-probe.test.mjs` | 25537 | `3169737D18C555BDAEB8CFB39815B0D575B495E19819CD0BED78811FE155CB94` |
| `docs/implementation/browser-active-close-probe.md` | 11576 | `8A0ACAFCD99FD419253C41CA3111535084C93F574D8F6B41D9064064716D6868` |

QA própria: 33/33 RAM, zero skips/falhas, 304.232 ms em Node 24.19.0; lint2 sem warnings. Root confirmou QA própria e peer aprovados. Isso testa o proprietário e o mesmo pipeline contexto → sessão em RAM; não constitui uma nova execução nativa. A alteração não muda schema, outcomes, prazo absoluto de 15.000 ms nem a recusa de callback aos 14.999 ms. Não modifica os specs Auth.

`actionsSettled=false` no relatório anterior não prova, isoladamente, ação funcional pendente: o campo também exige settlement do cleanup sem falhas. O código anterior permite a rejeição por detach sobre alvo encerrado, mas não foram lidos erros privados para atribuir a ela a causa exclusiva do run.

## Diferença de instrumentação e limite da conclusão

Redirect e Active Close usam o mesmo observer com fetchCommands, ledger, fence, GET retido, stopLoading, about:blank e fechamento da fonte. Active Close acrescenta tracking de promises, pré-condição inicial mais estrita e checkpoint antes do fator. Isso muda checkpoints/microtasks, mas não explica causalmente, por si só, o término em uma execução e a pendência na outra.

Depois de um terminal remover a entrada do manager, a projeção fetchCommand/fetchOutcome fica unavailable por contrato: ela exige o mesmo Request ainda presente e sessão registrada. Isso não prova falha de continue nem apaga retroativamente um ACK. Não remover esse gate para produzir um valor aparentemente melhor.

## Próximo trabalho executável

1. Revisar a PR draft de Root pelo SHA exato. Conferir os três pins acima e o delta de Auth real, se houver. Fazer QA/lint serial em Node 24.19.0 somente após reservar o semáforo da máquina. Não repetir browser público para buscar um outcome diferente.
2. Obter **somente metadados** finais dos runs do SHA escolhido: run, tentativa, job, step e conclusão. Usar conta pessoal `kauanbarateli` explicitamente. Não usar a conta padrão VOE, mudar sua configuração, imprimir tokens ou abrir logs/caches diretamente.
3. Trabalhar no **mesmo proprietário de contexto** do Admin/Recovery. Os specs atuais aguardam quiet completo após blank e só fecham contextos depois; esse fluxo pode consumir o prazo inteiro antes de qualquer close ativo. Extrair um helper pequeno compartilhado de propriedade/drain, com QA RAM, é preferível a duplicar outro produtor diagnóstico.
4. Conservar dois caminhos honestos: se os terminais originais já existem e todos os gates atuais passaram, concluir o quiet ordinário e realizar cleanup; se ainda há somente leituras expressamente permitidas, qualquer proposta de close ativo deve ocorrer dentro do prazo original e exigir os terminais público/CDP originais posteriores e o settlement do próprio close. Close/evento/promise ou sessão removida isoladamente nunca fornecem zero. Não marcar quietBeforeClose retroativamente.
5. Antes de alterar os specs, testar em RAM: leitura terminada antes do close; leitura pendente; close sem terminal; só terminal público; erro tardio; erro de cleanup; mesma promessa de close/detach sem retry; callback aos 14.999 ms; escrita/método desconhecido/owner externo/SDK/SQL/UI pendente vetando. Preservar também os testes e gates de autoridade do next-stop.
6. Root revisa a entrega e decide um único novo SHA hospedado e seu protocolo de evidência. Uma futura captura precisa de leitor/preparo/operativo e paths novos, binding original revisado, pins atualizados e janela estrita. Não reutilizar captura 801b/8084, seu leitor ou seu resultado para o novo SHA. Se uma operação recusar, registrar a primeira falha e seu contexto fechado antes de decidir outra execução.

Permanecem obrigatórios: original Request/owner, interceptor online ativo, prazo monotônico absoluto, observação original viva até a decisão e primeira falha persistente. Escritas, efeitos incertos, métodos desconhecidos, operações pendentes ou autoridade ausente impedem cleanup/aceite. Não ampliar o relay estático para endpoints Auth, não usar Fetch.failRequest depois de continue como prova, não apagar mapas nem sintetizar eventos.

## Divisão entre agentes

A frente de construção offline pode revisar o helper de propriedade, acrescentar QA RAM e documentação e entregar uma PR/branch sem operações reais. Deve informar arquivos, SHA, pins, resultados e limites. Não publica aceites nem altera ambientes.

Root mantém a frente conectada: revisa/integra a PR, acompanha o CI pelo SHA correto, autoriza o novo protocolo de captura e valida a entrega hospedada. Nenhum agente deve executar Supabase pessoal, Vercel, profiles, restore, migrations, fixtures remotas ou cleanup de banco a partir deste handoff. Usar somente projetos descartáveis já autorizados quando Root retomar explicitamente esse trabalho; VOE, BlackSheep, legado e 001–019 permanecem fora do escopo.

Este documento foi criado somente a partir de fontes públicas e resumos fechados fornecidos por Root. Nenhuma QA, captura, consulta de run, operação de conexão ou arquivo privado foi executado para escrevê-lo.
