# Peer independente C2b-E V1 — editor opcional de fotos de Metas

24/10/2026. **V1 bloqueada por dois P2s objetivos antes da integração.** Somente leitura pública dos payloads congelados. Não editei E/R/Root, executei Node, testes, lint, TypeScript, browser, SQL, rede ou serviços. V2 ainda não foi lida neste parecer.

## Fonte e integridade

Freeze finance-goals-image-upload-editor-freeze-v1-20261024, manifest 4040 B/SHA256 3a7fff895bd65039441d8ecdb4c2ea9b8fa0f524af2654bdfd6ad9143cfc3640. Conferidos sete after e dois before, dois artefatos e identidade da dependência R2 9ac3f3f2107d56d4054bb60481e96f41ae2a1b6042264d738e49b4ac2c91feef. Na abertura do peer, os sete arquivos do WT eram byteiguais ao freeze; após o autor iniciar V2, só o freeze V1 foi usado.

| Path | SHA256 after |
| --- | --- |
| goal-image-picker.tsx | 6ce9d8db76c5063ec5d043de1d88b1c996c2ac4cad4a7c1d39fba3eee8c61c40 |
| goal-editor.tsx | a4e6fa5d12d88941366aa96ce1ac9e1b707ebae604cfca1f72d6824566862a1a |
| goal-image-editor-session.ts | af34eed92212795f971a764014a61f6a7726376d35345b91f077830af834631c |
| tests/features/goal-image-editor-session.test.ts | a4020b2d37341fcfdb610e86fe8437ce3a2af1acebebc938ef821f3cbb1b3c1f |
| tests/e2e/finance-goals-image-upload.spec.ts | ed0703ef5ef9230ea5fb480a6953bb10f3ccde22fe444f4a747cf79d873f8a39 |
| tests/e2e/helpers/finance-goals-image-upload-fixture.tsx | 9b38beb5d40bb65de0012c01bd47daf81cbfa2f6212a1a2c5570f412113d265b |
| documento E | 499bdd018e34644ccdba1e10fb3a6dd3bb910bc1d001786e1931fc957434e9c5 |

Before Git bf1ffb0 conferidos: picker d15ee33bb947e084d451c750d57f5f31091ece5a e editor f5c0571c8007c2d0a2d25c300edd9841bdb905ec. Nenhum before de cinco paths novos foi inventado.

## P2 — selected pode cair em null com resposta interna malformada

Fonte congelada: src/components/features/financeiro/goals/goal-image-editor-session.ts:139–147.

O ramo needs-upload chama inspectReady e confere scope/generation, mas não confere imageFileId. A variável image recebe o campo sem validação em runtime; a criação usa image ?? null depois de chamar createId. Como o seam local é um Pick estrutural, um retorno interno incompleto/null pode converter uma seleção em null ou aceitar um UUID inválido, violando o contrato funcional selected nunca vira null/omissão e desperdiçando identidade financeira antes da recusa.

O coordenador R real valida esse ID; não classifico isso como ataque externo ou falha de autoridade do servidor. É um buraco de robustez do consumidor explícito. Menor correção: validar UUID primitivo fechado e rejeitar INVALID ANTES de createId/prepare, sem fallback de null/omit no ramo selected. Negativos com ID ausente/null/string inválida/número/objeto devem exigir zero IDs e prepare, mantendo A. Doubles negativos não são prova nominal positiva e não devem enfraquecer R.

## P2 — fixture update confunde null explícito com omissão

Fonte congelada: tests/e2e/helpers/finance-goals-image-upload-fixture.tsx:41.

No update, patch.image_file_id ?? saved?.image_file_id usa o arquivo antigo quando o patch contém null explícito. A fixture, portanto, não modela remoção. O produto E distingue corretamente omissão versus null com journal vazio (session:130/145–147); o achado está na projeção sintética e no limite de sua cobertura.

A Surface V1 sempre fornece goal=null/scope de criação. Não há caso E2E de edição/remoção; só o unitário confere o input. Corrigir Object.hasOwn antes de escolher o fallback, manter null e adicionar jornada existing/update com o client real, separando preservação e remoção. Até então não atribuir aceite end-to-end de remoção a essa fixture. Root autorizou o autor a preparar V2 para ambos os P2s; isso não corrige retroativamente V1.

## Geração e retomada A

Não encontrei bloqueador na comparação com snapshot A, em vez da geração local do picker. Consultar A reconstitui somente sua metadata. Ao reselecionar o File original, generationFloor faz o ordinal local avançar, enquanto R.reselect exige nome/MIME/tamanho/hash exatos da A durável; resume/finalize/inspectReady ainda devolvem prova da geração original A. O E2E escrito de reload/reseleção (spec:49) pede uma reserva/PUT e o mesmo clientId. Exigir igualdade direta à geração local nova quebraria essa recuperação legítima.

Essa interpretação precisa permanecer explícita: Revisar retoma A; nova B passa por recuperação/retirement e replaceRetired, nunca por um rebase de A. Um File diferente deve falhar antes de UUID/preparo ou outro transporte. O autor informou que escreverá esse negativo na V2; não o executei nem o aceitei aqui.

## Demais contratos lidos

- Sessão captura scope/draft/revisão/escolha antes de awaits, mantém intenção/UUID privados em clones e verifica version, owner/epoch/capability/factory/linked e stillCurrent. Não chama financeiro execute/reconcile/stage/ack. Há trava síncrona para duplo review; resposta tardia não recebe novo corpo para o mesmo UUID.
- Retirada aceita apenas linked() nominal do client concreto ou finalize original por R. A/B e readback perdido seguem a consulta explícita; replace exige retirement-review e abre NOVO handle após A encerrado. Snapshot não minta ready. Limite conservador de review(A) (substituir B ou fechar) é documentado, não um empty presumido.
- Cancelar/undo só alteram preview/RAM; não chamam retiro/delete. Unmount/dispose preservam os journals. ObjectURL usa o hook existente: só em RAM, filtra referência de File e revoga na troca/unmount. Não há setter genérico Goal ou arbitrária URL de imagem.
- Picker mantém onChange metadata-only; File usa seam separado. A máscara não monta campos/picker antes de revelar. Campos, botões, foco/erro e estilos são primitivas existentes. Não medi contraste, geometria ou renderização; h44/fonts16 e mobile são gates escritos, não PASS observado.
- O fixture usa classes/journals/coordinator/client/controller reais com localStorage/Web Locks e transporte sintético fechado; não constrói proof válido em mock. Os unitários cobrem recusas/empty sem mint nominal. Rotas browser inesperadas são negadas e contabilizadas. Esses testes não provam Auth, CommandJournal operacional, Storage hospedado ou corrida nativa.
- A injeção tipada do Picker evita importar seu CSS no caminho legado, mas o import runtime de session/coordinator amplia a closure de código. Root precisa derivar e qualificar o grafo real pelo novo SHA; não concluir que optional prop evita carregamento de módulos nem apenas aumentar contagens.

## Limites e próxima revisão

R2 é dependência não copiada no WT E; TypeScript/closure requerem a união Root real, sem stubs. CI próprio da união, gates R de hold/liveness, E1/financeiro supervisionados e aceites conectados/visuais continuam pendentes. Não herdar resultados de bf1,7f ou das fixtures anteriores.

Após freeze V2, reconferir os dois P2s e os testes/identidades alterados separadamente. Este parecer preserva V1 bloqueada, sem sugestão de publicar/mergear/montar ou de operar restore.
