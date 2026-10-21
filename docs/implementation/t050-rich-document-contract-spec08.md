# T-050 / #75 — extração neutra compatível

Refs #75. Part of #71. Base `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`; branch `codex/spec08-rich-document-contract-20261021`. Primeira fatia pura autorizada e reservada com a Root; não fecha #75.

## Implementado

`src/core/contracts/rich-document.ts` contém os tipos de JSON, limite512KiB, validador, documento vazio e conversões texto↔documento que antes estavam em Conhecimento. Os caminhos públicos de Conhecimento continuam reexportando os mesmos tipos/funções, com comportamento preservado. A resolução de referências, títulos e destinos permanece em Conhecimento. Imports diretos evitam ciclo pelo barrel de contratos/conhecimento; o Núcleo não recebe SDK, React, Next ou acesso externo.

Não foram acrescentados nós, atributos, formatos, limites, regex ou regras de validação. O documento atual mantém profundidade máxima32, até10.000 nós, até seis marcas por texto, títulos1–3 e a whitelist existente. URLs de marcas com atributos permanecem HTTP/HTTPS sem credenciais; HTML legado é texto literal, sem interpretação. `wikiLink` mantém sua semântica de Página. `captureLink` e `textAlign` continuam recusados nesta entrega.

## Contrato futuro proposto, ainda não ativado

- Captura: JSON aditivo e `document_version` monotônica; legado sem campo representa revisão0. `content` continua projeção textual de busca/tarefa com limite30.000 existente. O limite comum de documento não amplia o de Captura.
- `capture.update`: revisão esperada no envelope da intenção; conteúdo rico não pode ser substituído por cliente antigo sem CAS. Metadados preservam documento; edição derivada por rename precisa conservar JSON e elevar a revisão junto com evento/recibo. Estado incerto conserva JSON, revisão esperada e identificador originais para replay; trocar intenção exige resolução do envio anterior.
- Promoção: uma Página por `origin_capture_id`, idempotência e isolamento por usuário. Documento e anexos da origem precisam ser conservados. IDs de `linked_capture_ids` não podem virar `wikiLink.target_id` de Página. Página homônima ou coincidência de UUID entre tabelas não prova relação.
- Referência de Captura ainda não promovida: vínculo explicitamente tipado; associação a Página promovida exclusivamente por `origin_capture_id` do mesmo usuário, em ambas as ordens A→B. Não resolver por título nem realizar leitura cruzada. A escolha exata do novo nó e materialização ainda exige revisão antes de alterar parser, comandos ou persistência.
- Editor neutro compartilhado, alinhamento e Ctrl+K local, drafts versionados e falhas de persistência pertencem à fatia de ativação. Reutilizar extensões existentes sem duplicar motor, usar HTML/localStorage do protótipo ou mudar dependências por conveniência.

O confronto com o código mostrou que o CAS do snapshot relido não substitui revisão de conteúdo; a promoção atual texto→JSON também reconhece colchetes como referências de Página. A extração preserva esse comportamento e não declara o problema resolvido. O consumidor novo fica bloqueado até aceitar o contrato de namespace/revisão e preparar sua validação persistida.

## Validação e entrega

`tests/core/rich-document-contract.test.ts` prepara paridade nas APIs antiga/neutra: legado literal e Unicode; nós/marcas/projeção; limites UTF-8/profundidade/quantidade; protocolos/credenciais; atributos perigosos; recusa dos novos nós/attrs ainda propostos. O teste existente de Conhecimento continua sendo regressão necessária. Comando focal previsto:

```sh
npx vitest run tests/core/rich-document-contract.test.ts tests/core/knowledge.test.ts --maxWorkers=1
```

`git diff --check` é a verificação estática desta autoria. Nenhum teste dinâmico local foi executado: a RAM foi reconferida em aproximadamente0,630GiB, abaixo do limite humano de1GiB. CI precisa validar o SHA publicado, TypeScript/lint/camadas e regressões existentes; PASS de #52/#53 ou de outro HEAD não valida esta extração. O novo arquivo alcançável pode alterar inventários fechados de fonte, que permanecem sob revisão da Root.

Revisão estática independente comparou a extração integral com FFC e conferiu as expectativas dos testes sem encontrar bloqueador concreto ou mudança de contrato. As funções/tipos extraídos preservam seu conteúdo, e títulos/referências/resolução continuam em Conhecimento. Não houve execução dinâmica nessa revisão.

Sem novo editor, runtime, journal, parser persistido, SQL, migration, conta, pagamento, segredo, merge ou deploy. Apenas o sufixo lógico futuro `spec08_capture_rich_documents` está reservado pela Root; não há ordinal/timestamp SQL reservado ou gerado. Aplicação remota continua supervisionada. Não se atribui aceite J5/J11, visual ou conectado à extração. Processos pesados locais não foram iniciados.
