# Calendário: composição OAuth, cifra e desconexão — 13/10/2026

O novo [teste de composição](../../tests/adapters/calendar-oauth-sql.test.ts) fecha a jornada positiva prevista no planejamento: START/PKCE/cookie → CALLBACK → cifra persistida → evento e cursor → desconexão com confirmação e exclusão. Usa rotas, Core, adapters, SDK instalado, provider, cifra e as 19 migrations originais. Auth/configuração e todo HTTP são seams sintéticos explícitos, com recusa de qualquer transporte não declarado desde o bootstrap. O banco PGlite é descartável, em RAM.

O desafio PKCE corresponde ao verifier do cookie; a flow SQL é consumida antes do exchange. Callback positivo grava um envelope AES-GCM real, ligado por AAD ao dono, conta e versão; bindings errados recusam decrypt. State adulterado e replay não fazem outro exchange. O snapshot recebe o evento e a janela do cursor persistido e não expõe token, código, verifier, envelope ou cursor.

A primeira revogação Google sintética retorna 400: a conta permanece em `revocation_pending`, a credencial cifrada é preservada e fontes/eventos ficam ocultos. O retry com o mesmo `client_id` recebe 200 sintético antes de chamar o SQL original `finish_disconnect`; conta, credencial, eventos e cursores são removidos, e o recibo é gravado. Repetir o comando concluído não gera outra revogação. Metadados de domínio não incluem segredos.

Root leu o teste inteiro e os módulos originais pertinentes, conferiu o hash e incorporou somente o novo arquivo. Em Main, repetiu **86/86 testes em cinco suites**, além de TypeScript integral, lint do novo arquivo e diff. O agente também passou 86/86; o peer independente leu fontes e repetiu somente **1/1 caso focado**, sem herdar o lote do agente. Hash integrado: 17.746 bytes/SHA-256 `fa842ab7dc7dca822fbe0417bcae88021fb0ecd60bd276fe79ac1ad42d35ca2f`.

## Conciliação dos critérios originais

O [planejamento](../planejamento/13-tickets.md) permite jornada Google mock/fixture. Essa composição demonstra o literal OAuth/PKCE/AAD/desconectar sem acrescentar um gate de revogação Google real. A expansão sem reload tem prova própria no [Workspace original montado](../../tests/e2e/calendar-workspace-browser.spec.ts#L278): pede período fora do cursor, recebe evento novo, amplia a janela e conserva documento/marcador; navegar no intervalo já coberto não repete sync. Os oito cenários dessa UI foram repetidos por Root na integração anterior, registrada no [checkpoint](mvp-progresso-20261013.md). Não são testes do provider/banco real.

Os demais três literais conservam suas provas próprias: evento de três dias nas visões por fixture; filtro Calendário/Início/lembretes; cron autenticado e visível no Admin. As [duas contas e o cron pessoais](google-producao-20261012.md), assim como o [primeiro schedule observado](evidence/google-cron-first-schedule-20261013.json), não recebem contagens deste teste.

A composição foi publicada em `44b721e`. Os cinco critérios foram atualizados e o [readback](evidence/calendar-closure-readback-20261013.json) confirmou #32 `CLOSED/COMPLETED`, com histórico integral preservado. Não declara consentimento em navegador nesta composição, ACK Google real, GoTrue/PostgREST hospedados, aparelho físico ou novo cron. Observações conectadas parciais, falhas globais dos runners, restore e release permanecem separados. Não houve alteração de produto, migration ou conta real.
