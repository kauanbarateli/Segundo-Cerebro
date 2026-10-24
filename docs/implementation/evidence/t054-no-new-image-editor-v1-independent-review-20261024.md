# Peer estático G0 Editor V1 — 24/10/2026

Parecer: **V1 bloqueada somente pelo P2 já identificado pelo Root no fence legado**. Não encontrei outro bloqueador objetivo nesta leitura. A correção deverá ser reconferida em V2 congelada; este parecer não é aceite executado.

## Identidade e limites

Pacote `finance-goals-image-upload-no-new-image-editor-freeze-v1-20261024`, manifesto 3593 bytes, SHA256 `e9ccadc03b5bdea8390deb9f18a1a086fa9e7a631f616f2134f9a08aa7c7ed14`. Base `0d933d98ca8fcd6def222d184d9b9462370d98eb`, árvore `b6c018609cac8267f9c58def3385911f6dcd8eb2`.

Conferi os seis after, cinco before e três artefatos pelos tamanhos e hashes declarados, todos correspondentes. Li somente as cópias congeladas para o peer; o WT do autor já contém a correção V2 em autoria e não foi tratado como drift. Não executei Node, TypeScript, Vitest, navegador, SQL, rede, serviços, apply-check ou Git mutável. Não alterei produto nem pacote. Usei as orientações Impeccable/DS já lidas para máscara, foco, ações explícitas e alvo de toque, sem alegar renderização.

## P2 — erro/foco legado precisa acompanhar a base atual

Em `after/src/components/features/financeiro/goals/goal-editor.tsx:71`, `currentBasis()` protege referência da intenção, revisão financeira e identidade/revisão da Meta, mas não protege os campos atuais normalizados nem `!latest.current.hidden`. Assim, um prepare atrasado que recusa pode publicar o erro/foco das linhas 75 após uma edição do formulário ou ocultação dos valores, permanecendo no mesmo editor e revisão. O corpo/UUID original continua retido; isto não demonstra mutação financeira indevida.

Correção mínima solicitada pelo Root: comparar `goalFields(latest.current.draft)` à base normalizada capturada e exigir `!hidden`, capturando qualquer recusa da normalização no próprio predicado. A referência de `prepare` não deve integrar esse fence, pois um rerender legítimo pode trocá-la durante busy. Preservar o mesmo cache, UUID e corpo; nenhum retry automático. Os controles escritos precisam mudar campo habilitado/ocultar pelo host durante preview pendente e verificar ausência de erro/foco tardio, sem forçar campo disabled.

## Demais invariantes lidas

- `reviewWithoutNewImage` captura campos, revisão, escolha, seleção e callbacks antes do primeiro await. Reconfere a instância/scope e a seleção nos retornos; chama authorize e claim reais antes de criar o UUID financeiro. A prova não é gerada por DTO da UI. O G0 não confere autoridade financeira por ausência de recibo.
- A leitura do estado A é preservada integralmente e comparada novamente após claim. A ação não retira, cancela, troca ou completa A; File perdido não impede esta decisão explícita. A exclusão da prévia ocorre somente no callback local posterior ao claim e antes do ID/prepare.
- Create usa `image_file_id:null`; update-omit omite a chave; update-remove inclui null explícito. Não há inferência selected→null. O método normal `review` tem exatamente os mesmos 3822 caracteres entre os marcadores antes/depois; nenhum fallback G0 foi introduzido nele.
- A intenção é clonada e armazenada antes de prepare. Nova chamada humana com a mesma base reapresenta o mesmo corpo/UUID; base alterada recusa. A preparação não executa o comando financeiro. Controller, client e barreira reais mantêm pending/reconfirm/hold protegidos.
- Capability opcional conserva o caminho sem imagem. O editor usa limpeza da sessão, owner/epoch/capability guards existentes, scopes por instância e cancelamento local sem apagar A. O fluxo novo não acrescenta Workspace, Core, API, SQL, factory ou ativação de host.
- Texto distingue prévia excluída, foto atual mantida e remoção ainda dependente da confirmação financeira. Campos e nomes não são montados no modo oculto; o picker é desmontado após decisão explícita. CSS e primitivas existentes não mudam. Foco/layout responsivo permanecem pendentes de execução dos controles escritos.

## Testes escritos e limites das fixtures

Os unitários novos usam coordenador, journals, client, controller e barreira reais para os positivos; os doubles antigos recusam as novas capacidades e não fabricam prova nominal. O fetcher unitário aceita o path relativo enviado pelo client; sem origin configurada, o Response sintético de URL vazia é compatível com o guard público do client. Não repete o setup absoluto incorreto do primeiro pacote G0 R.

Li os controles de três escolhas, A byteigual, zero transporte/UUID de foto, preview excluída antes do ID, pending físico/hold lógico, mutação de argumento, owner/form/service após autorização, claim tardio, clique duplo, dispose e lease após 150001 ms. Li também a retenção do mesmo corpo/UUID após prepare perdido. São testes escritos, não resultados PASS.

O E2E sintético preserva `Object.hasOwn(patch,'image_file_id')`, evitando confundir omit com null; Meta existente inicia em revisão 3/global 7 e a atualização esperada é revisão 4. Os casos novos verificam lost File, A prepared/reserving, escolha explícita, normal review recusada sem fallback, prepare perdido, execute incerto e recibo ausente. Fake HTTP não constitui prova de Storage/Auth hospedados. O asset PNG válido já incorporado permanece literal público. Nenhuma imagem foi renderizada neste peer.

## Hashes dos seis payloads

| Path relativo | SHA256 after |
| --- | --- |
| src/components/features/financeiro/goals/goal-editor.tsx | d1067785c77ef18f62dffc00a093bbbf1f78e5e14aa297fdda6c0603c4571c0b |
| src/components/features/financeiro/goals/goal-image-editor-session.ts | 65a684d006998f4b63ae94250c8618bc90653dd9f5c8c4d3e0c1db7fbaff21b5 |
| tests/features/goal-image-editor-session.test.ts | 5e06b36bb031acd12b02dc987a1845f17974f5daae2b26e82fa03a82ea30f12c |
| tests/e2e/finance-goals-image-upload.spec.ts | 497f7a594ff2fab411dde05ba0f91d7e4d0a465cfc32958def8d521d42d006dc |
| tests/e2e/helpers/finance-goals-image-upload-fixture.tsx | ab70a0fe4af34bf8ee5fdc671f98079131671fc50e55dd6ea7a546fa1b331a2d |
| docs/implementation/t054-finance-goals-image-upload-no-new-image-editor-20261024.md | 095ba667b8919345baa02079b388c97f270287764d69f661d421c374f7f0e375 |

Patch 74156 bytes SHA256 `02ebf9b31e22e9d1c5c7e5945e7f29a2d4823e68834cc0c491b1b087294007c4`. README e static-checks correspondem ao manifesto. A dependência coordenador `d8a93ebb6b6ad5b251b1a9d0faaf47dc5cdb199551e8987345dfafa5d0c03348` é idêntica nos pacotes R V1/V2; a correção R V2 foi somente setup de teste/documento.

Próximo passo: reconferir a V2 estreita congelada; Root decidirá integração e checks próprios. Nenhuma qualificação de UI, upload, banco, restore, merge ou produção decorre deste parecer.
