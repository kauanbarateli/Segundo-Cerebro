# C2a pausado antes da correção V2

A pausa humana chegou antes de qualquer edição da correção. O coordenador, a suíte e o documento continuam byte a byte no pacote V1; não há V2 implementada, patch corretivo ou teste novo a publicar como concluído.

- Base: `01ae6a7c62b8d2dbe9e295b7702d329f64ec5313`, branch `codex/goals-terminal-http-20261023`.
- V1 preservado: `finance-goals-image-upload-c2a-freeze-v1-20261024/manifest.json`, SHA-256 `b2fabf1f6861eb469542bf11c5b831e86d502fd32f5d78f93c5eab1b1356efc3`.
- Reconferidos somente por leitura e SHA-256: 9 arquivos C2a, 4 artefatos V1, 12 arquivos M2-S, 4 arquivos J2 e o client-before `7e5bad2`.
- Não houve execução de Node, testes, lint, TypeScript, SQL, rede, serviços, commit ou push nesta correção.

## Bloqueador ainda presente

Em `src/lib/files/goal-image-upload.ts`, `resume` entra na lease na linha 168 sem conferir o sinal capturado; `attempt` e `advance` usam a guarda geral sem sinal. `finalize` inicia na linha 150 e chama `executeDomainCommand` na linha 158 ao avaliar o argumento de `wait`. Portanto, a checagem de `wait` ocorre depois dessa chamada. Se a fila da lease ultrapassar o prazo total de 150 segundos, uma callback tardia pode tentar finalizar depois de a operação ter sido recusada. A V1 não deve ser apresentada como livre desse bloqueador.

`select` já confere `guard(signal)` na entrada da lease. `reselect` (linha 138) não o faz. A revisão corretiva autorizada precisa conferir também os efeitos e os avanços após esperas; nenhuma alteração dessa revisão foi realizada antes da pausa.

## Retomada finita

Alterar somente o coordenador, `tests/lib/goal-image-upload.test.ts` e `docs/implementation/t054-finance-goals-image-upload-coordinator-20261024.md`. Adicionar as guardas com sinal nas entradas tardias e imediatamente antes de envio/efeitos; preservar API, fases, J2, barreira, SQL e todos os prazos. Escrever o teste sintético de lease retida por mais de 150 segundos e liberada após a recusa, exigindo zero envios e estado persistido preservado. O teste existente de timeout após um envio já iniciado deve continuar conservando a incerteza.

Uma futura V2 exige novo pacote imutável com os 9 after, delta exato dos 3 paths, provas de preservação e novo peer/CI. Este checkpoint contém só metadados e pendências. Não autoriza retomada operacional, montagem, merge ou produção.
