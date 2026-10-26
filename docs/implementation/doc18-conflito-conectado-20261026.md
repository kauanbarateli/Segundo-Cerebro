# Conhecimento — conflito em duas abas conectadas

**Observado em26/10/2026:** Preview Source `3a9239f0f40147e645cef67cd4f55bb90edf9145`, deployment `dpl_6bDiSTdcoRTCndnifc68whRdaeJt`, somente homologação `twrydxsdemaykgvdlpyd` e conta comum QA existente. Duas abas da mesma sessão editaram a mesma página sintética v3 com textos diferentes. Um save criou a versão vencedora v4. A outra aba voltou ao leitor após o aviso global; seu rascunho permaneceu. Após retomar e acionar Salvar uma única vez, voltou ao leitor sem mostrar a resolução de conflito.

Readonly confirmou página única, v4, vencedor presente e perdedor ausente, três recibos cumulativos de update, três eventos de atualização e um evento do estado atual. Links permitidos permaneceram e `title` extra continuou ausente. O DOM final tinha zero editores, zero regiões de conflito, botão Retomar edição e aviso de rascunho preservado. [Observação sanitizada e foto original](evidence/doc18-knowledge-cas-3a-20261026/observation.json). Nenhum status HTTP ou SQLSTATE foi observado/inferido; ausência de sobrescrita não basta para aceitar a interface.

## Causa e correção

`ConnectedCommandFeedback` devolvia children isolados em idle/demo e um Fragment com aviso anterior nos outros estados. A posição de reconciliação mudava, remontando a rota. O rascunho de sessão sobrevivia; edição, erro e conflito locais não. O refresh conserva data durante loading e não foi identificado como a causa dessa desmontagem. O fixture SQL#28 usava provider/TipTap/journal reais, mas omitia esse wrapper global.

A correção mantém Fragment externo e slot/key de conteúdo constantes; `SESSION_CHANGED` conectado continua removendo os children. Avisos, ações de confirmação, política de resultado incerto, Core, CAS, versões e journal permanecem. O fixture recebe o wrapper real sem mudar os asserts/ledgers dos dois casos SQL. O novo teste ReactDOM confere identidade do elemento, estado e mount/unmount em avisos, dispensa, demo e revogação; sua execução de navegador fica no GitHub.

Três contratos estruturais passaram na frente e na Root, com lint e revisão independente. O Typecheck focado em seis raízes excedeu o teto local de256MB e não produziu resultado; a tipagem completa exige CI próprio. Nenhum browser, servidor ou banco de teste foi iniciado localmente para validar o patch. O novo aceite conectado deve reproduzir as duas abas após publicar a candidata exclusivamente em QA, conservar o perdedor até a escolha explícita e conferir a versão/eventos/recibos sem novas mutações da recusa.

Não houve overwrite, retry corretivo, descarte, upload, OAuth, migration, SQL de escrita ou operação Production. O rascunho antigo permanece em sua aba; não confundir observação3a com validação da correção. #122/#81 continuam abertas. Merge e produção seguem bloqueados.
