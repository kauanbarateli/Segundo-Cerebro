# Diagnóstico do relay Next.stop — 16/10/2026

As capturas próprias de Admin e recuperação de senha em `41b30fd` mantiveram requisições pendentes sem provar seu terminal. O novo recorte observa a avaliação original do relay e o estado do Promise original do parent. Não tenta novamente o stop, não amplia a autoridade de GET estático e não altera os gates de PASS ou limpeza.

## Observações distintas

O worker guarda `case.nextStopDiagnostic` na primeira falha HTTP: nulo quando não existe observação, ou `{ outcome, reason }` fechado. Outcomes: `NOT_ATTEMPTED`, `NOT_NEEDED`, `INELIGIBLE`, `EMITTED`, `REFUSED`. Os motivos distinguem somente ramos avaliados naquela chamada: relógio, gate, identidade, autoridade estática, row original e writer. Se a avaliação lança sem resultado, o campo permanece nulo.

`snapshot()` só lê estado já guardado. Não chama novamente relógio, gate, writer, metadata ou ação. A primeira falha não é preenchida retrospectivamente. `EMITTED` significa somente que o writer original retornou true; não prova recebimento do frame.

O parent registra por entrada Admin ou no topo Recovery:

```ts
{
  phase: "after-worker-run-settlement-before-finally",
  requested: boolean | null,
  settled: boolean | null,
  resolvedTrue: boolean | null
}
```

A fase é acrescentada no callsite real após resolver/rejeitar o runner e antes do finally. Não alega terminal do worker nem simultaneidade com a falha HTTP. `resolvedTrue` significa apenas retorno literal true do Promise original de stop; é nulo enquanto não há settlement. O diagnóstico não chama `metadata()`.

Os validadores aceitam ausência histórica e nulo, mas recusam campos extras, pares outcome/reason impossíveis, flags incoerentes, getters e campos privados. Campos diagnósticos não concedem autoridade: primeira falha, incerteza, registros pendentes, prazo absoluto de 15 s, protocolo, EOF, critérios de limpeza e aceite permanecem independentes.

## Revisão e validação

São 14 paths existentes, sem novo import de caminho ou mudança nas contagens de fontes. Root revisou os diffs e um peer independente conferiu os 14 candidatos e hashes, sem bloqueador. Root executou **165/165** em Node 24.19.0 com `--test-concurrency=1`: as três suítes do relay/Admin/Recovery mais os 18 testes do coletor legado. Autor passou 147/147 nas três suítes em execução própria. Root e autor passaram lint dos 14 paths e TypeScript sem emissão.

Os testes cobrem resultado original sem releitura, throw sem backfill, primeira falha, snapshots parent sem metadata, contratos históricos, integridade de fontes/dependências e recusa de corrupção binária. Nenhum Next, browser, Docker ou Supabase real foi iniciado localmente.

O próximo run hospedado terá fonte própria e precisará de metadata e leitura diagnóstica nova, revisada e vinculada à sua etapa original. Não reabrir ou repetir as capturas anteriores para procurar PASS. Este recorte não corrige por si só a pendência das Requests nem certifica limpeza.

## Estado hospedado anterior a este delta

Em `9a7c217`, o passo 15 do CI geral [38957484266](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38957484266) concluiu com success às 19:50:41 UTC. O workflow estava nos E2E na conferência seguinte; esse sucesso parcial não é sucesso global.

Admin [38957484167](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38957484167) e Recovery [38957484182](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38957484182) concluíram com failure por metadados. Seus logs não foram lidos para atribuir nova causa. As evidências de `41b30fd` continuam próprias.
