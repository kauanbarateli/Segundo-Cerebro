# Peer estático — G0 do coordenador, V1

24/10/2026. Leitura independente do pacote `finance-goals-image-upload-no-new-image-freeze-v1-20261024`, sobre 0d933d9. **Bloqueado por um P2 na fixture; não identifiquei outro bloqueador objetivo no produto nesta leitura.** Nenhum Node, teste, lint, SQL, browser, rede ou serviço foi executado; nenhuma fonte do autor foi editada.

Manifesto conferido: 2.585 B, SHA256 `3429284e70efa9015de0ba184498663e882e7eeb996caeae864c0db889efc722`. Três after coincidem com manifesto e WT do autor; o before do coordenador e os três artefatos também conferem.

| Path | Bytes after | SHA256 |
| --- | ---: | --- |
| src/lib/files/goal-image-upload.ts | 34822 | d8a93ebb6b6ad5b251b1a9d0faaf47dc5cdb199551e8987345dfafa5d0c03348 |
| tests/lib/goal-image-upload-no-new-image.test.ts | 22134 | ef5b9da2617bc47e41d35c2fde8d6c3567df5a01fd36ffdf04656943ef73cf49 |
| docs/implementation/t054-finance-goals-image-upload-no-new-image-20261024.md | 6478 | 2586f0d46f8dac7d681660d2be99fd52bec9d7eb45b394ef98fac79ad2248339 |

## P2 — disponibilidade usa representação diferente no setup

`tests/lib/goal-image-upload-no-new-image.test.ts:29` exige que o input do fetcher seja a URL absoluta `https://g0.invalid/api/finance/goals/availability`. Entretanto o client concreto da mesma base chama `this.fetcher(path, ...)` com o path relativo, em `src/lib/finance-goals-client.ts:205`; a opção origin apenas valida a URL da resposta contra `new URL(path, origin)` na linha seguinte.

Assim, a disponibilidade sintética é recusada antes de `controller.open()` retornar; a fixture lança em sua linha 43 e os casos não alcançam G0. É uma falha de teste/materialização, sem evidência de falha funcional do coordenador. Correção mínima: exigir o path relativo exato, normalizando somente response.url para a URL absoluta da origem sintética. Não permitir múltiplos endpoints nem alterar o client para satisfazer a fixture. Restore e Root foram avisados antes do fechamento; V1 permanece imutável.

## Produto e compatibilidade por leitura

- O delta do coordenador acrescenta dois imports, tipos/captura G0, uma coleção privada, dois métodos e a redação dessas capabilities no dispose. O diff antes/depois não altera hash/upload/resume/Ready/Linked/retire/replace, timers ou seus guards.
- `captureNoNewImageBasis` (26–36) fecha descritores/campos, scope, revisão, centavos, dia e escolha. Create-null só corresponde a scope sem Meta. A captura original e o target são reconferidos nas filas; não há GoalCommand/UUID financeiro/foto fabricado no emissor.
- `authorizeNoNewImage` (331–355) obtém lease upload e depois `financeClear` real. O snapshot completo serializado de A inclui estado, revisão, phase, seleção/hash e IDs; a identidade original da instância é verificada, sem rebasing para o scope atual. A em phase válida, inclusive anterior a finalizing, não exige File nem é convertida em ready.
- `claimNoNewImage` (357–375) reconhece apenas a própria instância, apaga o registro WeakMap antes do primeiro await, compara basis/state/fence e usa novamente upload → barreira financeira. Receiver estrangeiro não consome a prova de outra instância. Qualquer falha de um claim próprio exige nova autorização.
- A barreira existente verifica o pending físico e o hold/reconfirm do controller real. Não chama acknowledgeReview. Os callbacks G0 fazem somente leitura/guard/registro RAM; não há Storage, sender/finalize, HTTP, SET/DELETE J2, limpeza, substituição ou novo ID.
- Guard com signal na entrada tardia da lease e no callback financeiro preserva as condições de timeout. O catch de emissão remove uma capability eventualmente emitida antes da recusa, e dispose redige as capabilities G0 da instância.
- O resultado não prova revisão atual no servidor nem mantém lock durante futuro HTTP. Preview/commit continuam responsáveis pelo frescor/CAS. Essa limitação está explícita no documento e é compatível com a UI G0 congelada separadamente.

## Matriz e gates

A suíte escrita cobre 7 phases × 3 escolhas, retirement-review, corpo A preservado, storage que recusa escrita, ordem dos locks, one-use/instância/owner/epoch, clones/Proxy, basis mutado, avanço por outra aba, pending físico, hold/reconfirm lógico, alvo stale, fila tardia com timeout, dispose/revoke e ausência/corrupção/legado. Não fabrica prova nominal nos positivos. A falha de setup acima precisa ser corrigida antes de esses controles produzirem evidência.

Após a correção estreita e seu peer, o produto está apto apenas à composição/revisão/CI próprios. Permanecem pendentes typecheck, execução das unidades/E2E, closure/layers, Web Locks reais e aceites hospedados. Esta leitura não autoriza montagem, schema/flag, merge ou produção.
